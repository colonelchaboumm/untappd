<?php
defined('WP_UNINSTALL_PLUGIN') || exit;
global $wpdb;
$wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}uat_checkins");
$wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}uat_sessions");
$wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}uat_archive");
$wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}uat_history");
delete_option('uat_credentials');
delete_option('uat_palette');
delete_option('uat_texts');
delete_option('uat_text_visibility');
wp_clear_scheduled_hook('uat_cleanup');
// Also remove short-lived quota, OAuth and locking records from the options table.
foreach (['uat_lock_', '_transient_uat_', '_transient_timeout_uat_'] as $prefix) {
    $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name LIKE %s", $wpdb->esc_like($prefix) . '%'));
}
