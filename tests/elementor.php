<?php
// Run only on an isolated local WordPress installation with Elementor activated.
$root = $argv[1] ?? getenv('WP_ROOT');
if (!$root) { fwrite(STDERR, "Usage: php tests/elementor.php /path/to/wordpress\n"); exit(1); }
$_SERVER['HTTP_HOST'] = '127.0.0.1:8787';
define('WP_ADMIN', true);
require rtrim($root, '/\\') . '/wp-load.php';
function check_theme($condition, $message) { if (!$condition) { throw new RuntimeException($message); } echo "PASS $message\n"; }
check_theme(class_exists('Elementor\\Plugin'), 'Elementor loaded');
$tokens = UAT_Theme::tokens();
$widget = Elementor\Plugin::$instance->widgets_manager->get_widget_types('untappd-atlas');
check_theme($widget instanceof UAT_Elementor_Widget, 'native Elementor widget registered');
$controls = $widget->get_controls();
foreach ($tokens as $key => $token) {
    $control = $controls['uat_color_' . str_replace('-', '_', $key)] ?? [];
    check_theme(($control['type'] ?? '') === 'color' && !empty($control['global']['active']) && str_contains($control['selectors']['{{WRAPPER}} .uat-app'] ?? '', '--uat-' . $key . ':'), 'editable global color: ' . $key);
}
check_theme(UAT_Theme::color('#aabbcc88') === '#aabbcc88', 'alpha hex preserved');
check_theme(UAT_Theme::color('rgba(0, 1, 2, 0.5)') !== '', 'RGBA preserved');
check_theme(UAT_Theme::color('red; background:url(https://example.com)') === '', 'CSS injection rejected');
$sanitized = UAT_Theme::sanitize(['follow_elementor' => 1, 'bg' => '#aabbcc', 'accent' => 'url(javascript:bad)', 'unknown' => '#fff']);
check_theme($sanitized === ['follow_elementor' => 1, 'bg' => '#aabbcc'], 'palette allows only declared safe colors');
delete_option('uat_palette');
check_theme(str_contains(UAT_Theme::css(), '--uat-heading:var(--e-global-color-primary,'), 'plugin defaults inherit Elementor global colors');
update_option('uat_palette', ['follow_elementor' => 0, 'accent' => '#123456']);
check_theme(str_contains(UAT_Theme::css(), '--uat-accent:#123456;') && !str_contains(UAT_Theme::css(), 'var(--e-global-'), 'manual palette and disabling automatic inheritance work');
delete_option('uat_palette');
uat_register_assets();
check_theme(wp_script_is('uat-dashboard', 'registered') && wp_style_is('uat-dashboard', 'registered'), 'widget dependencies registered');
$html = uat_dashboard();
check_theme(str_contains($html, 'uat-app') && str_contains($html, '&quot;preview&quot;:false'), 'shortcode renderer remains available');
echo 'ELEMENTOR OK — ' . ELEMENTOR_VERSION . ' / WordPress ' . $GLOBALS['wp_version'] . PHP_EOL;
