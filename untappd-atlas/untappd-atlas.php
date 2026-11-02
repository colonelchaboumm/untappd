<?php
/**
 * Plugin Name: Untappd Atlas
 * Description: Votre histoire Untappd en statistiques, disque chronologique et exports PNG / Excel. Shortcode : [untappd_atlas].
 * Version: 1.0.0
 * Requires at least: 6.4
 * Requires PHP: 8.1
 * Author: Colonelchaboumm
 * License: GPL-2.0-or-later
 * Text Domain: untappd-atlas
 */
defined('ABSPATH') || exit;
define('UAT_VERSION', '1.0.0');
define('UAT_FILE', __FILE__);
require_once __DIR__ . '/includes/class-uat-api.php';

register_activation_hook(__FILE__, ['UAT_API', 'install']);
register_deactivation_hook(__FILE__, function () { wp_clear_scheduled_hook('uat_cleanup'); });
add_action('uat_cleanup', ['UAT_API', 'cleanup']);
add_action('rest_api_init', ['UAT_API', 'routes']);
add_action('wp_enqueue_scripts', function () {
    $post = get_post();
    if ($post && has_shortcode($post->post_content, 'untappd_atlas')) {
        wp_enqueue_style('uat-dashboard', plugins_url('assets/dashboard.css', UAT_FILE), [], UAT_VERSION);
    }
});
add_action('admin_post_uat_callback', ['UAT_API', 'callback']);
add_action('admin_post_nopriv_uat_callback', ['UAT_API', 'callback']);
add_action('admin_menu', function () {
    add_options_page('Untappd Atlas', 'Untappd Atlas', 'manage_options', 'untappd-atlas', 'uat_settings');
});
add_action('admin_init', function () {
    register_setting('uat_settings', 'uat_credentials', [
        'sanitize_callback' => function ($input) {
            $old = get_option('uat_credentials', []);
            $id = preg_replace('/[^a-zA-Z0-9]/', '', $input['id'] ?? '');
            $secret = trim($input['secret'] ?? '');
            return ['id' => $id, 'secret' => !empty($input['clear']) ? '' : ($secret !== '' ? UAT_API::seal($secret) : ($old['secret'] ?? ''))];
        }, 'default' => []
    ]);
});
function uat_settings() {
    if (!current_user_can('manage_options')) { return; }
    $c = get_option('uat_credentials', []);
    ?>
    <div class="wrap"><h1>Untappd Atlas</h1>
    <p>Ajoutez le shortcode <code>[untappd_atlas]</code> à la page de votre choix. Les visiteurs y importent leur profil et consultent leurs statistiques.</p>
    <p>L’import CSV/JSON fonctionne sans API. L’import par lien et OAuth nécessitent des identifiants d’application autorisés par Untappd.</p>
    <form method="post" action="options.php"><?php settings_fields('uat_settings'); ?>
    <table class="form-table"><tr><th><label for="uat-id">Client ID</label></th><td><input class="regular-text" id="uat-id" name="uat_credentials[id]" value="<?php echo esc_attr($c['id'] ?? ''); ?>" autocomplete="off"></td></tr>
    <tr><th><label for="uat-secret">Client Secret</label></th><td><input class="regular-text" type="password" id="uat-secret" name="uat_credentials[secret]" autocomplete="new-password" placeholder="<?php echo !empty($c['secret']) ? 'Déjà enregistré — laisser vide pour conserver' : ''; ?>"><p><label><input type="checkbox" name="uat_credentials[clear]" value="1"> Effacer le secret enregistré</label></p></td></tr>
    <tr><th>URL de retour OAuth</th><td><code><?php echo esc_html(admin_url('admin-post.php?action=uat_callback')); ?></code><p>Recopiez exactement cette URL dans les paramètres de votre application Untappd. Utilisez HTTPS.</p></td></tr></table>
    <?php submit_button(); ?></form>
    <h2>Données et confidentialité</h2><p>Les exports de fichiers sont analysés dans le navigateur. Les imports API et jetons chiffrés sont isolés par session et supprimés après 24 heures (nettoyage horaire WordPress). Le visiteur peut les effacer immédiatement. Aucun résultat personnel n’est intégré au HTML public de la page.</p>
    <p><a href="https://untappd.com/api/docs/v4" target="_blank" rel="noopener noreferrer">Documentation API officielle</a></p></div>
    <?php
}
add_shortcode('untappd_atlas', function () {
    wp_enqueue_style('uat-dashboard', plugins_url('assets/dashboard.css', UAT_FILE), [], UAT_VERSION);
    wp_enqueue_script('uat-core', plugins_url('assets/core.js', UAT_FILE), [], UAT_VERSION, true);
    wp_enqueue_script('uat-export', plugins_url('assets/export.js', UAT_FILE), ['uat-core'], UAT_VERSION, true);
    wp_enqueue_script('uat-dashboard', plugins_url('assets/dashboard.js', UAT_FILE), ['uat-core', 'uat-export'], UAT_VERSION, true);
    $credentials = get_option('uat_credentials', []);
    $config = ['api' => rest_url('untappd-atlas/v1/'), 'configured' => !empty($credentials['id']) && !empty($credentials['secret']), 'timezone' => wp_timezone_string() ?: 'UTC'];
    return '<div class="uat-app alignwide" data-config="' . esc_attr(wp_json_encode($config)) . '"><p>Chargement d’Untappd Atlas… JavaScript est nécessaire pour les graphiques et exports.</p></div>';
});
