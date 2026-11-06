<?php
// Run against an isolated WordPress installation with Untappd Atlas active.
$root = $argv[1] ?? '';
if (!$root) { exit(1); }
$_SERVER['HTTP_HOST'] = '127.0.0.1:8787';
require rtrim($root, '/\\') . '/wp-load.php';

function history_request(string $method, array $body = []): WP_REST_Response {
    $request = new WP_REST_Request($method, '/untappd-atlas/v1/history');
    if ($body) {
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode($body));
    }
    return rest_do_request($request);
}

function check_history($valid, string $label): void {
    if (!$valid) { throw new RuntimeException($label); }
    echo "PASS $label\n";
}

$users = [];
register_shutdown_function(static function () use (&$users) {
    require_once ABSPATH . 'wp-admin/includes/user.php';
    foreach ($users as $user) { wp_delete_user($user); }
});
for ($i = 0; $i < 2; $i++) {
    $user = wp_insert_user(['user_login' => 'uat-history-' . wp_generate_uuid4(), 'user_pass' => wp_generate_password()]);
    if (is_wp_error($user)) { throw new RuntimeException($user->get_error_message()); }
    $users[] = $user;
}

$one = ['id' => '101', 'date' => '2024-01-01T19:30:00.000Z', 'beer' => 'Test', 'beerId' => '42', 'photos' => 0, 'rating' => 3];
$two = ['id' => '102', 'date' => '2025-02-05T19:30:00.000Z', 'beer' => 'IPA', 'beerId' => '81', 'rating' => 4];
$entries = static fn(...$rows) => ['entries' => array_map(static fn($row) => ['key' => 'id:' . $row['id'], 'row' => $row], $rows)];
check_history(history_request('GET')->get_status() === 401 && history_request('POST', $entries($one))->get_status() === 401, 'guest access blocked');

wp_set_current_user($users[0]);
check_history(history_request('POST', $entries($one))->get_status() === 200, 'first import saved');
check_history(history_request('POST', $entries(array_replace($one, ['rating' => 4.5, 'photos' => null]), $two))->get_status() === 200, 're-import merges a changed check-in and appends a new one');
$report = history_request('GET');
$rows = array_column(array_column($report->get_data()['entries'], 'row'), null, 'id');
check_history(count($rows) === 2 && $rows['101']['photos'] === 0 && $rows['101']['rating'] === 4.5, 'history keeps prior known fields, updates ratings and deduplicates');
check_history(str_contains($report->get_headers()['Cache-Control'] ?? '', 'no-store'), 'history responses are private and uncached');
check_history(str_contains(uat_profile_history($users[0]), 'Mes statistiques Untappd') && uat_profile_history($users[1]) === '', 'only the owner can render the profile section');

wp_set_current_user($users[1]);
check_history(history_request('GET')->get_data()['entries'] === [], 'account history is isolated');
check_history(history_request('POST', $entries($two))->get_status() === 200, 'second account can save the same check-in independently');
check_history(history_request('DELETE')->get_status() === 200 && history_request('GET')->get_data()['entries'] === [], 'owner can erase their own history');
wp_set_current_user($users[0]);
check_history(count(history_request('GET')->get_data()['entries']) === 2, 'erasing another account leaves this history intact');
wp_set_current_user(0);
echo "HISTORY OK\n";
