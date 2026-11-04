<?php
// Run only against an isolated local WordPress with the current plugin active.
$_SERVER['HTTP_HOST'] = '127.0.0.1:8787'; $_SERVER['REMOTE_ADDR'] = '127.0.0.72';
require rtrim($argv[1], '/\\') . '/wp-load.php';
function verify_import($ok, $message) { if (!$ok) { throw new RuntimeException($message); } echo "PASS $message\n"; }
function import_request($route, $token = '', $body = [], $method = 'POST') {
    $r = new WP_REST_Request($method, '/untappd-atlas/v1/' . $route);
    if ($token) { $r->set_header('X-UAT-Session', $token); }
    foreach ($body as $key => $value) { $r->set_param($key, $value); }
    return rest_do_request($r);
}
global $wpdb;
$original_prefix = $wpdb->prefix;
$test_prefix = 'uat_import_' . substr(md5(uniqid('', true)), 0, 8) . '_';
$denied_prefix = $test_prefix . 'denied_';
$credentials = get_option('uat_credentials', []);
$previous_cron = get_option('cron', []);
$prior_log = ini_get('error_log');
$log = __DIR__ . '/../test-artifacts/import-errors-' . uniqid() . '.log';
if (!is_dir(dirname($log))) { mkdir(dirname($log), 0777, true); }
ini_set('error_log', $log);
$fail = ''; $throw_http = false;
$html = '<p class="username">Colonelchaboum</p><a data-href=":stats/general"><span class="stat">37</span></a><a data-href=":stats/badges"><span class="stat">58</span></a><div class="item" data-checkin-id="123"><p class="text"><a href="/b/import-fixture/99">Test Beer</a> by <a href="/Fixture">Test Brewery</a></p><a class="timezoner">Sun, 27 Oct 2024 12:45:15 +0000</a><span class="badge"><img alt="Explorer" src="https://assets.untappd.com/a.png"></span></div><p>Please sign in to view more.</p>';
$http = function($pre, $args, $url) use (&$throw_http, $html) {
    if ($throw_http) { throw new LogicException('SENTINEL_PRIVATE_VALUE'); }
    if ($url === 'https://untappd.com/user/Colonelchaboum') { $body = $html; }
    elseif ($url === 'https://untappd.com/b/import-fixture/99') { $body = '<div class="name"><p class="style">IPA - American</p></div>'; }
    else { return new WP_Error('test_external', 'External HTTP disabled.'); }
    return ['headers' => [], 'body' => $body, 'response' => ['code' => 200]];
};
$queries = function($sql) use (&$fail, $test_prefix, $denied_prefix) {
    if (($fail === 'schema' && str_contains($sql, $denied_prefix) && preg_match('/^CREATE TABLE/i', $sql)) ||
        ($fail && $fail !== 'schema' && preg_match('/^REPLACE INTO\s+[`"]?' . preg_quote($test_prefix . 'uat_' . $fail, '/') . '[`"]?\s/i', $sql))) {
        return 'SELECT id FROM ' . $test_prefix . 'table_does_not_exist';
    }
    return $sql;
};
$paths = ['/user/Colonelchaboum', '/b/import-fixture/99'];
try {
    delete_option('uat_credentials'); delete_option('uat_lock_public'); delete_transient('uat_public_budget');
    foreach ($paths as $path) { delete_transient('uat_public_' . hash('sha256', $path)); }
    add_filter('pre_http_request', $http, 10, 3); add_filter('query', $queries);
    $wpdb->prefix = $test_prefix;
    $created = import_request('session');
    verify_import($created->get_status() === 200, 'missing import tables are automatically created without reactivation');
    $token = $created->get_data()['session'];
    $fail = 'sessions';
    $denied = import_request('session');
    verify_import($denied->get_status() === 503 && $denied->get_data()['code'] === 'storage' && str_contains($denied->get_data()['message'], 'Référence'), 'session write failure returns a diagnostic JSON error instead of a critical page');
    $fail = 'checkins';
    $failed = import_request('start', $token, ['profile' => 'https://untappd.com/user/Colonelchaboum', 'source' => 'public']);
    verify_import($failed->get_status() === 503 && $failed->get_data()['code'] === 'storage', 'check-in write failure is contained at import start');
    verify_import(!get_option('uat_lock_' . hash('sha256', $token)), 'failed import releases its session lock');
    $fail = ''; $throw_http = true;
    delete_transient('uat_public_' . hash('sha256', $paths[0]));
    $unexpected = import_request('start', $token, ['profile' => 'Colonelchaboum', 'source' => 'public']);
    verify_import($unexpected->get_status() === 500 && $unexpected->get_data()['code'] === 'import_server', 'unexpected import exception becomes a structured server error');
    verify_import(!str_contains(wp_json_encode($unexpected->get_data()), 'SENTINEL_PRIVATE_VALUE'), 'internal exception details are not exposed to the visitor');
    $throw_http = false;
    $start = import_request('start', $token, ['profile' => 'https://untappd.com/user/Colonelchaboum', 'source' => 'public']);
    verify_import($start->get_status() === 200 && $start->get_data()['state']['count'] === 1, 'same visitor can retry the public import after a failed write');
    $fail = 'checkins';
    verify_import(import_request('step', $token)->get_status() === 503, 'enrichment write failure is reported');
    $state = import_request('status', $token, [], 'GET')->get_data()['state'];
    verify_import($state['details_done'] === 0 && $state['phase'] === 'public_beers', 'failed enrichment does not advance the saved cursor');
    $fail = '';
    verify_import(import_request('step', $token)->get_status() === 200, 'enrichment can resume after the storage recovers');
    $status = import_request('status', $token, [], 'GET')->get_data();
    verify_import($status['state']['phase'] === 'done' && !$status['state']['public_complete'] && $status['state']['profile']['expected_badges'] === 58 && $status['items'][0]['beer']['beer_style'] === 'IPA - American', 'successful retry preserves partial-history and badge coverage information');
    $wpdb->update($test_prefix . 'uat_sessions', ['data' => 'true'], ['id' => hash('sha256', $token)]);
    verify_import(import_request('status', $token, [], 'GET')->get_status() === 401, 'damaged session JSON is rejected safely');
    $wpdb->prefix = $denied_prefix; $fail = 'schema';
    $schema = import_request('session');
    verify_import($schema->get_status() === 503 && $schema->get_data()['code'] === 'storage', 'refused table creation is reported without a critical error');
    $logged = file_get_contents($log);
    verify_import(str_contains($logged, 'Untappd Atlas') && !str_contains($logged, 'SENTINEL_PRIVATE_VALUE') && !str_contains($logged, $token) && !str_contains($logged, 'REPLACE INTO'), 'diagnostic log contains references without exception messages, SQL or session tokens');
} finally {
    remove_filter('query', $queries); remove_filter('pre_http_request', $http);
    $wpdb->prefix = $original_prefix;
    foreach ([$test_prefix, $denied_prefix] as $prefix) {
        foreach (['uat_sessions', 'uat_checkins'] as $table) { $wpdb->query('DROP TABLE IF EXISTS ' . $prefix . $table); }
    }
    update_option('uat_credentials', $credentials); update_option('cron', $previous_cron);
    foreach ($paths as $path) { delete_transient('uat_public_' . hash('sha256', $path)); }
    delete_transient('uat_public_budget'); delete_option('uat_lock_public');
    delete_transient('uat_new_' . substr(hash_hmac('sha256', $_SERVER['REMOTE_ADDR'], wp_salt('nonce')), 0, 32));
    ini_set('error_log', $prior_log);
    if (is_file($log)) { unlink($log); }
}
echo 'IMPORT ERROR RECOVERY OK' . PHP_EOL;
