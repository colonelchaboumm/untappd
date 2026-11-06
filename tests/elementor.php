<?php
// Run only on an isolated local WordPress installation with Elementor activated.
$root = $argv[1] ?? getenv('WP_ROOT');
if (!$root) { fwrite(STDERR, "Usage: php tests/elementor.php /path/to/wordpress\n"); exit(1); }
$_SERVER['HTTP_HOST'] = '127.0.0.1:8787';
define('WP_ADMIN', true);
require rtrim($root, '/\\') . '/wp-load.php';
$previous_text_options = [];
foreach (['uat_texts', 'uat_text_visibility', 'uat_palette'] as $key) { $previous_text_options[$key] = get_option($key, null); }
register_shutdown_function(function() use ($previous_text_options) {
    foreach ($previous_text_options as $key => $value) { if ($value === null) { delete_option($key); } else { update_option($key, $value); } }
});
delete_option('uat_text_visibility');
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
foreach (UAT_Content::fields() as $key => $field) {
    $control = $controls['uat_text_' . $key] ?? [];
    check_theme(in_array($control['type'] ?? '', ['text', 'textarea'], true), 'editable content: ' . $key);
    if ($field['hideable'] ?? true) {
        $visibility = $controls['uat_visibility_' . $key] ?? [];
        check_theme(($visibility['type'] ?? '') === 'select' && array_keys($visibility['options'] ?? []) === ['', 'show', 'hide'], 'per-widget text visibility: ' . $key);
    }
}
foreach (['body', 'headings', 'hero', 'subtitles', 'numbers', 'buttons'] as $group) {
    check_theme(isset($controls['uat_typography_' . $group . '_typography']), 'typography controls: ' . $group);
}
update_option('uat_texts', ['hero_title' => 'Titre commun']);
check_theme(UAT_Content::values(['hero_title' => 'Titre local'])['hero_title'] === 'Titre local', 'widget text overrides global text');
check_theme(UAT_Content::values(['hero_title' => ''])['hero_title'] === 'Titre commun', 'empty widget text inherits global text');
update_option('uat_text_visibility', ['hero_title' => 'hide']);
check_theme(UAT_Content::values()['hero_title'] === '', 'global visibility can hide an inherited title');
check_theme(UAT_Content::values([], ['hero_title' => 'show'])['hero_title'] === 'Titre commun', 'widget can show a globally hidden title');
check_theme(UAT_Content::values(['hero_title' => 'Titre local'])['hero_title'] === '', 'text overrides retain the chosen inherited visibility');
delete_option('uat_text_visibility');
check_theme(UAT_Content::values([], ['hero_title' => 'hide'])['hero_title'] === '' && UAT_Content::values()['hero_title'] === 'Titre commun', 'hiding a widget title does not change another widget');
check_theme(UAT_Content::sanitize_visibility(['hero_title' => 'hide', 'photos_description' => 'show', 'unknown' => 'hide', 'hero_subtitle' => 'invalid', 'import_button' => 'hide']) === ['hero_title' => 'hide', 'photos_description' => 'show'], 'visibility rejects unknown, invalid and non-hideable fields');
check_theme(!isset(UAT_Content::fields()['ring_description'], UAT_Content::fields()['history_title'], UAT_Content::fields()['top_note']), 'removed blocks are not offered as active text controls');
$placed_widget = new UAT_Elementor_Widget(['id' => 'uat-text-test', 'elType' => 'widget', 'widgetType' => 'untappd-atlas', 'settings' => ['uat_text_hero_title' => 'Titre du widget', 'uat_visibility_photos_description' => 'hide']], []);
$render = new ReflectionMethod($placed_widget, 'render');
ob_start(); $render->invoke($placed_widget); $widget_html = ob_get_clean();
preg_match('/data-config="([^"]+)"/', $widget_html, $config_match);
$widget_config = json_decode(html_entity_decode($config_match[1], ENT_QUOTES, 'UTF-8'), true);
check_theme($widget_config['texts']['hero_title'] === 'Titre du widget' && $widget_config['texts']['photos_description'] === '', 'native Elementor render transmits custom text and hidden descriptions');
$story_widget = Elementor\Plugin::$instance->widgets_manager->get_widget_types('untappd-atlas-story');
check_theme($story_widget instanceof UAT_Elementor_Story_Widget && $story_widget->get_style_depends() === ['uat-story'], 'annual recap is registered with its stylesheet');
$story_controls = $story_widget->get_controls();
check_theme(isset($story_controls['uat_text_story_cover_title'], $story_controls['uat_text_import_button'], $story_controls['uat_color_series_1']) && !isset($story_controls['uat_text_hero_title'], $story_controls['uat_text_story_open']), 'annual recap exposes its own controls');
$placed_story = new UAT_Elementor_Story_Widget(['id' => 'uat-story-test', 'elType' => 'widget', 'widgetType' => 'untappd-atlas-story', 'settings' => ['uat_text_story_cover_title' => 'Mon récit']], []);
ob_start(); (new ReflectionMethod($placed_story, 'render'))->invoke($placed_story); $story_html = ob_get_clean();
preg_match('/data-config="([^"]+)"/', $story_html, $config_match);
$story_config = json_decode(html_entity_decode($config_match[1], ENT_QUOTES, 'UTF-8'), true);
check_theme($story_config['storyOnly'] === true && $story_config['texts']['story_cover_title'] === 'Mon récit' && $widget_config['storyOnly'] === false, 'annual recap enables inline mode only for its own widget');
delete_option('uat_texts');
check_theme(UAT_Content::values()['hero_title'] === UAT_Content::fields()['hero_title']['default'], 'empty global settings restore defaults');
$safe_text = UAT_Content::sanitize(['hero_title' => "Bonjour\n<script>alert(1)</script><b>bière</b>", 'unknown' => 'ignored']);
check_theme(!str_contains($safe_text['hero_title'], '<') && !isset($safe_text['unknown']) && str_contains($safe_text['hero_title'], "\n"), 'text sanitation strips HTML, preserves line breaks and ignores unknown keys');
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
