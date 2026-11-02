<?php
// Isolated local WordPress with the current plugin active. No real Untappd calls.
$_SERVER['HTTP_HOST'] = '127.0.0.1:8787'; $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
require rtrim($argv[1], '/\\') . '/wp-load.php';
function check_public($condition, $label) { if (!$condition) { throw new RuntimeException($label); } echo "PASS $label\n"; }
$html = '<html><p class="username">Fixture</p><div class="stats"><a data-href=":stats/general"><span class="stat">37</span></a><a data-href=":stats/badges"><span class="stat">58</span></a></div><div class="item" data-checkin-id="123"><p class="text"><a class="user">Person</a> is drinking <a href="/b/fixture/99">Fixture Beer</a> by <a href="/Brewery">Fixture Brewery</a></p><div data-rating="4.5"></div><a class="timezoner">Sun, 27 Oct 2024 12:45:15 +0000</a><p class="photo"><img src="photo"></p><div class="cheers"><span class="count"><span>2</span></span></div><span class="badge"><img alt="Explorer (Level 2)" src="https://assets.untappd.com/badges/a.png"></span></div><p>Please sign in to view more.</p></html>';
$beer = '<html><div class="name"><p class="style">IPA - American</p></div><p class="abv">6.5% ABV</p><p class="ibu">0 IBU</p></html>';
$p = UAT_Public::parse_profile($html, 'Fixture');
check_public(!is_wp_error($p) && count($p['items']) === 1 && $p['profile']['expected'] === 37 && $p['profile']['expected_badges'] === 58 && !$p['complete'], 'visible history is partial and totals stay separate');
check_public($p['items'][0]['brewery']['brewery_name'] === 'Fixture Brewery' && $p['items'][0]['badges']['items'][0]['badge_name'] === 'Explorer (Level 2)', 'public beer, brewery, photo and badges extracted');
check_public(!isset($p['items'][0]['comments']) && $p['items'][0]['toasts']['count'] === 2, 'visible toasts are known while missing comments stay unknown');
$all = UAT_Public::parse_profile(str_replace(['>37<','<p>Please sign in to view more.</p>'], ['>1<','<div data-checkin-id=""></div>'], $html), 'Fixture');
check_public($all['complete'] && $all['invalid'] === 0, 'interface placeholders are not counted as missing check-ins');
check_public(is_wp_error(UAT_Public::parse_profile('<title>Login to Untappd</title>', 'Fixture')), 'login page rejected');
check_public(is_wp_error(UAT_Public::parse_profile($html, 'Different')), 'wrong profile rejected');
check_public(is_wp_error(UAT_Public::beer('https://evil.example/b/fixture/99')) && is_wp_error(UAT_Public::profile('../admin')), 'arbitrary hosts and traversal are rejected');
$info = UAT_Public::parse_beer($beer, '/b/fixture/99');
check_public($info['beer_style'] === 'IPA - American' && $info['beer_ibu'] === 0.0, 'beer style, ABV and zero IBU parsed');
$calls = []; $redirect = false;
add_filter('pre_http_request', function($pre, $args, $url) use ($html, $beer, &$calls, &$redirect) {
    check_public(str_starts_with($url, 'https://untappd.com/') && empty($args['cookies']) && $args['redirection'] === 0, 'requests stay unauthenticated on Untappd without redirects');
    $calls[] = $url;
    return ['headers' => $redirect ? ['location' => 'https://untappd.com/login'] : [], 'body' => str_contains($url, '/b/') ? $beer : $html, 'response' => ['code' => $redirect ? 302 : 200]];
}, 10, 3);
$saved = get_option('uat_credentials', []); delete_option('uat_credentials');
register_shutdown_function(function() use ($saved) { update_option('uat_credentials', $saved); });
foreach (['/user/Fixture','/b/fixture/99'] as $path) { delete_transient('uat_public_' . hash('sha256', $path)); }
delete_transient('uat_public_budget'); delete_option('uat_lock_public');
function public_request($route, $token = '', $body = [], $method = 'POST') { $r = new WP_REST_Request($method, '/untappd-atlas/v1/' . $route); if ($token) { $r->set_header('X-UAT-Session', $token); } foreach ($body as $k => $v) { $r->set_param($k, $v); } return rest_do_request($r); }
$created = public_request('session')->get_data(); $token = $created['session'];
$start = public_request('start', $token, ['profile' => 'Fixture', 'source' => 'public']);
check_public($start->get_status() === 200 && $start->get_data()['state']['source'] === 'public' && count($start->get_data()['items']) === 1, 'one-button public import works without API credentials');
$step = public_request('step', $token); $status = public_request('status', $token, [], 'GET')->get_data();
check_public($step->get_status() === 200 && $status['state']['phase'] === 'done' && !$status['state']['public_complete'] && $status['items'][0]['beer']['beer_style'] === 'IPA - American', 'public enrichment completes without claiming a full history');
$redirect = true; delete_transient('uat_public_' . hash('sha256','/user/Fixture'));
check_public(is_wp_error(UAT_Public::profile('Fixture')), 'login redirect is stopped');
public_request('erase', $token);
foreach (['/user/Fixture','/b/fixture/99'] as $path) { delete_transient('uat_public_' . hash('sha256', $path)); }
delete_transient('uat_public_budget');
echo 'PUBLIC IMPORT OK' . PHP_EOL;
