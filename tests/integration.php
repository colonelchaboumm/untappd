<?php
// Runs against an isolated, already installed WordPress. No real Untappd calls.
$root = $argv[1] ?? getenv('WP_ROOT');
if (!$root) { fwrite(STDERR, "Usage: php tests/integration.php /path/to/wordpress\n"); exit(1); }
$_SERVER['HTTP_HOST'] = '127.0.0.1:8787'; $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
require rtrim($root, '/\\') . '/wp-load.php';
function verify($condition, $message) { if (!$condition) { throw new RuntimeException($message); } echo "PASS $message\n"; }
function request($route, $token = '', $body = [], $method = 'POST') {
    $r = new WP_REST_Request($method, '/untappd-atlas/v1/' . $route);
    if ($token) { $r->set_header('X-UAT-Session', $token); }
    foreach ($body as $k => $v) { $r->set_param($k, $v); }
    return rest_do_request($r);
}
$calls = []; $mode = 'normal';
$fixture = fn($id) => ['checkin_id' => $id, 'created_at' => '2024-01-01T18:00:00+0000', 'beer' => ['bid' => 10, 'beer_name' => 'Fixture'], 'brewery' => ['brewery_id' => 2, 'brewery_name' => 'Fixture Brewery'], 'rating_score' => 4, 'comments' => ['count' => 1, 'items' => []]];
add_filter('pre_http_request', function ($pre, $args, $url) use (&$calls, &$mode, $fixture) {
    if (!str_starts_with($url, 'https://api.untappd.com/')) { return new WP_Error('test_external', 'External requests disabled during tests.'); }
    $calls[] = $url;
    $path = wp_parse_url($url, PHP_URL_PATH); parse_str(wp_parse_url($url, PHP_URL_QUERY), $query);
    $response = [];
    if (str_contains($path, '/user/info/')) { $response = ['user' => ['user_name' => 'Colonelchaboum', 'first_name' => 'Test', 'stats' => ['total_checkins' => 3]]]; }
    elseif (str_contains($path, '/checkin/view/')) { $id = basename($path); $response = ['checkin' => array_merge($fixture($id), ['comments' => ['count' => 1, 'items' => [['user' => ['uid' => 9, 'user_name' => 'Ami'], 'comment' => 'Super']]]])]; }
    elseif (str_contains($path, '/user/checkins/')) {
        $cursor = $query['max_id'] ?? '';
        $items = !$cursor || $mode === 'repeat' ? [$fixture('103'), $fixture('102')] : ($cursor === '102' ? [$fixture('101')] : []);
        $response = ['checkins' => ['count' => count($items), 'items' => $items], 'pagination' => ['max_id' => $items ? end($items)['checkin_id'] : null]];
    }
    return ['headers' => ['x-ratelimit-remaining' => '90'], 'body' => wp_json_encode(['meta' => ['code' => 200], 'response' => $response]), 'response' => ['code' => 200, 'message' => 'OK'], 'cookies' => []];
}, 10, 3);
verify(UAT_API::username('https://untappd.com/user/Colonelchaboum') === 'Colonelchaboum', 'profile URL validated');
verify(is_wp_error(UAT_API::username('https://example.com/user/x')), 'foreign profile URL rejected');
verify(is_wp_error(UAT_API::username('https://untappd.com/user/a/../../admin')), 'path injection rejected');
$sealed = UAT_API::seal('private-token');
verify($sealed !== 'private-token' && UAT_API::unseal($sealed) === 'private-token', 'token encryption round-trip');
$damaged = base64_decode($sealed); $damaged[28] = chr(ord($damaged[28]) ^ 1);
verify(UAT_API::unseal(base64_encode($damaged)) === '', 'tampered token rejected');
verify(request('status', '', [], 'GET')->get_status() === 401, 'data inaccessible without session bearer');
$_SERVER['HTTP_ORIGIN'] = 'https://attacker.example';
verify(request('session')->get_status() === 403, 'cross-origin session creation rejected');
unset($_SERVER['HTTP_ORIGIN']);
update_option('uat_credentials', ['id' => 'TESTCLIENT', 'secret' => UAT_API::seal('TESTSECRET')]);
$a = request('session')->get_data()['session']; $b = request('session')->get_data()['session'];
verify(strlen($a) === 64 && $a !== $b, 'unpredictable independent sessions created');
$start = request('start', $a, ['profile' => 'https://untappd.com/user/Colonelchaboum', 'enrich' => true]);
verify($start->get_status() === 200 && $start->get_data()['state']['phase'] === 'feed', 'profile import starts');
for ($i = 0; $i < 3; $i++) { $step = request('step', $a); verify($step->get_status() === 200, 'feed page ' . ($i + 1)); }
$s = request('status', $a, [], 'GET')->get_data();
verify($s['state']['count'] === 3 && count($s['items']) === 3 && $s['state']['phase'] === 'details', 'all pages stored without duplicates before enrichment');
verify(request('status', $b, [], 'GET')->get_data()['items'] === [], 'second visitor cannot see first visitor data');
verify(!str_contains(wp_json_encode($s), 'TESTSECRET') && !str_contains(wp_json_encode($s), 'token'), 'credentials absent from API output');
for ($i = 0; $i < 4; $i++) { $step = request('step', $a); verify($step->get_status() === 200, 'detail step ' . ($i + 1)); }
$s = request('status', $a, [], 'GET')->get_data();
verify($s['state']['phase'] === 'done' && $s['state']['details_done'] === 3 && count($s['items'][0]['comments']['items']) === 1, 'detail enrichment completes and is persisted');
verify(request('start', $b, ['profile' => 'Colonelchaboum'])->get_status() === 200, 'new visitor can start independently');
$scope = substr(hash('sha256', wp_json_encode(['client_id' => 'TESTCLIENT', 'client_secret' => 'TESTSECRET'])), 0, 32);
set_transient('uat_budget_' . $scope, ['used' => 95, 'reset' => time() + 3600], 3700);
$before = count($calls); $quota = request('step', $b);
verify($quota->get_status() === 429 && count($calls) === $before, 'shared API quota prevents additional network request');
verify(request('status', $b, [], 'GET')->get_data()['state']['retry_at'] > time(), 'quota retry time persisted for resume');
delete_transient('uat_budget_' . $scope);
verify(request('step', $b)->get_status() === 200, 'quota reset permits resuming same session');
$mode = 'repeat';
verify(request('step', $b)->get_status() === 502, 'repeated page is reported rather than marked complete');
verify(request('status', $b, [], 'GET')->get_data()['state']['phase'] === 'feed', 'pagination error preserves incomplete state');
verify(request('erase', $a)->get_status() === 200 && request('status', $a, [], 'GET')->get_status() === 401, 'erase destroys bearer session and data');
global $wpdb;
$wpdb->update($wpdb->prefix . 'uat_sessions', ['expires' => time() - 1], ['id' => hash('sha256', $b)]);
UAT_API::cleanup();
verify((int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}uat_checkins WHERE session_id=%s", hash('sha256', $b))) === 0, 'scheduled cleanup removes expired check-ins');
verify(request('status', $b, [], 'GET')->get_status() === 401, 'expired session removed by cleanup');
delete_option('uat_credentials');
echo 'INTEGRATION OK — WordPress ' . $GLOBALS['wp_version'] . PHP_EOL;
