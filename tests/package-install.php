<?php
// Run only against an isolated local WordPress; its plugins and cron are restored.
$root = $argv[1] ?? '';
$archive = realpath($argv[2] ?? '');
$version = $argv[3] ?? '1.8.0';
if (!$root || !$archive) { fwrite(STDERR, "Usage: php tests/package-install.php /path/to/wordpress plugin.zip [version]\n"); exit(1); }
$_SERVER['HTTP_HOST'] = '127.0.0.1:8787';
define('WP_ADMIN', true);
$target = __DIR__ . '/../test-artifacts/package-install-' . uniqid();
mkdir($target, 0777, true);
define('WP_PLUGIN_DIR', realpath($target));
define('WP_PLUGIN_URL', 'http://127.0.0.1:8787/package-test');
require rtrim($root, '/\\') . '/wp-load.php';
wp_set_current_user(1);
$previous_plugins = get_option('active_plugins', []);
$previous_cron = get_option('cron', []);
register_shutdown_function(function() use ($previous_plugins, $previous_cron) {
    update_option('active_plugins', $previous_plugins);
    update_option('cron', $previous_cron);
});
update_option('active_plugins', []);
add_filter('filesystem_method', fn() => 'direct');
add_filter('pre_http_request', fn() => new WP_Error('local_test', 'External requests disabled.'), 1);
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
require_once ABSPATH . 'wp-admin/includes/misc.php';
require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
try {
    $skin = new WP_Ajax_Upgrader_Skin();
    $upgrader = new Plugin_Upgrader($skin);
    $result = $upgrader->install($archive, ['clear_update_cache' => false]);
    if ($result !== true) {
        $error = is_wp_error($result) ? $result : $skin->get_errors();
        throw new RuntimeException(wp_json_encode(['codes' => $error->get_error_codes(), 'messages' => $skin->get_error_messages()]));
    }
    $plugin = $upgrader->plugin_info();
    $data = get_plugin_data(WP_PLUGIN_DIR . '/' . $plugin, false, false);
    if ($data['Name'] !== 'Untappd Atlas' || $data['Version'] !== $version) { throw new RuntimeException('Unexpected plugin identity'); }
    wp_clear_scheduled_hook('uat_cleanup');
    $activation = activate_plugin($plugin);
    if (is_wp_error($activation) || !is_plugin_active($plugin) || !function_exists('uat_dashboard')) { throw new RuntimeException('Activation failed'); }
    if (plugin_basename(UAT_MAIN_FILE) !== $plugin || !has_action('activate_' . $plugin) || !wp_next_scheduled('uat_cleanup')) { throw new RuntimeException('Activation hook did not run for the installed entry point'); }
    uat_register_assets();
    $script = wp_scripts()->registered['uat-dashboard']->src;
    $expected = plugins_url('assets/dashboard.js', UAT_FILE);
    if ($script !== $expected || !is_file(dirname(UAT_FILE) . '/assets/dashboard.js') || !str_contains(uat_dashboard(), 'uat-app')) { throw new RuntimeException('Installed asset paths or shortcode failed'); }
    if (!is_file(dirname(WP_PLUGIN_DIR . '/' . $plugin) . '/uninstall.php')) { throw new RuntimeException('Missing uninstall entry point'); }
    deactivate_plugins($plugin);
    if (is_plugin_active($plugin) || wp_next_scheduled('uat_cleanup')) { throw new RuntimeException('Deactivation hook did not run'); }
    echo wp_json_encode(['archive' => basename($archive), 'plugin' => $plugin, 'version' => $data['Version'], 'extractor' => class_exists('ZipArchive') ? 'ZipArchive' : 'PclZip', 'installed' => true, 'activation' => true, 'assets' => $script, 'deactivation' => true], JSON_PRETTY_PRINT) . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}
