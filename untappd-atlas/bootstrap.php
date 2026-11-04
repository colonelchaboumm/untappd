<?php
// Shared bootstrap. The single WordPress plugin header lives in the root entry point.
defined('ABSPATH') || exit;
if (defined('UAT_VERSION')) { return; }
define('UAT_VERSION', '1.6.3');
if (!defined('UAT_MAIN_FILE')) { define('UAT_MAIN_FILE', __FILE__); }
define('UAT_FILE', __FILE__);
require_once __DIR__ . '/includes/class-uat-api.php';
require_once __DIR__ . '/includes/class-uat-public.php';
require_once __DIR__ . '/includes/class-uat-theme.php';
require_once __DIR__ . '/includes/class-uat-content.php';

function uat_register_assets() {
    static $registered = false;
    if ($registered) { return; }
    $registered = true;
    wp_register_style('uat-dashboard', plugins_url('assets/dashboard.css', UAT_FILE), [], UAT_VERSION);
    wp_add_inline_style('uat-dashboard', UAT_Theme::css());
    wp_register_script('uat-core', plugins_url('assets/core.js', UAT_FILE), [], UAT_VERSION, true);
    wp_register_script('uat-theme', plugins_url('assets/theme.js', UAT_FILE), [], UAT_VERSION, true);
    wp_register_script('uat-content', plugins_url('assets/content.js', UAT_FILE), [], UAT_VERSION, true);
    wp_register_script('uat-export', plugins_url('assets/export.js', UAT_FILE), ['uat-core'], UAT_VERSION, true);
    wp_register_script('uat-dashboard', plugins_url('assets/dashboard.js', UAT_FILE), ['uat-core', 'uat-theme', 'uat-content', 'uat-export'], UAT_VERSION, true);
}
add_action('wp_enqueue_scripts', 'uat_register_assets', 5);
add_action('elementor/frontend/after_register_scripts', 'uat_register_assets');
add_action('elementor/frontend/after_register_styles', 'uat_register_assets');
add_action('elementor/editor/before_enqueue_scripts', 'uat_register_assets');
add_action('elementor/widgets/register', function ($manager) {
    require_once __DIR__ . '/includes/class-uat-elementor-widget.php';
    $manager->register(new UAT_Elementor_Widget());
});
add_action('admin_enqueue_scripts', function ($hook) {
    if ($hook !== 'settings_page_untappd-atlas') { return; }
    wp_enqueue_style('wp-color-picker');
    wp_enqueue_script('wp-color-picker');
    wp_add_inline_script('wp-color-picker', 'jQuery(function($){$(".uat-color-input").wpColorPicker();});');
});

register_activation_hook(UAT_MAIN_FILE, ['UAT_API', 'install']);
register_deactivation_hook(UAT_MAIN_FILE, function () { wp_clear_scheduled_hook('uat_cleanup'); });
add_action('uat_cleanup', ['UAT_API', 'cleanup']);
add_action('rest_api_init', ['UAT_API', 'routes']);
add_action('wp_enqueue_scripts', function () {
    $post = get_post();
    if ($post && has_shortcode($post->post_content, 'untappd_atlas')) {
        wp_enqueue_style('uat-dashboard');
    }
});
add_action('admin_post_uat_callback', ['UAT_API', 'callback']);
add_action('admin_post_nopriv_uat_callback', ['UAT_API', 'callback']);
add_action('admin_menu', function () {
    add_options_page('Untappd Atlas', 'Untappd Atlas', 'manage_options', 'untappd-atlas', 'uat_settings');
});
add_action('admin_init', function () {
    register_setting('uat_appearance', 'uat_palette', ['sanitize_callback' => [UAT_Theme::class, 'sanitize'], 'default' => ['follow_elementor' => 1]]);
    register_setting('uat_content', 'uat_texts', ['sanitize_callback' => [UAT_Content::class, 'sanitize'], 'default' => []]);
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
    <p>Sans clés API, le bouton lit uniquement les pages publiques accessibles. L’historique ancien et le catalogue de badges peuvent être masqués par Untappd. Une connexion OAuth complète nécessite toujours une application autorisée.</p>
    <form method="post" action="options.php"><?php settings_fields('uat_settings'); ?>
    <table class="form-table"><tr><th><label for="uat-id">Client ID</label></th><td><input class="regular-text" id="uat-id" name="uat_credentials[id]" value="<?php echo esc_attr($c['id'] ?? ''); ?>" autocomplete="off"></td></tr>
    <tr><th><label for="uat-secret">Client Secret</label></th><td><input class="regular-text" type="password" id="uat-secret" name="uat_credentials[secret]" autocomplete="new-password" placeholder="<?php echo !empty($c['secret']) ? 'Déjà enregistré — laisser vide pour conserver' : ''; ?>"><p><label><input type="checkbox" name="uat_credentials[clear]" value="1"> Effacer le secret enregistré</label></p></td></tr>
    <tr><th>URL de retour OAuth</th><td><code><?php echo esc_html(admin_url('admin-post.php?action=uat_callback')); ?></code><p>Recopiez exactement cette URL dans les paramètres de votre application Untappd. Utilisez HTTPS.</p></td></tr></table>
    <?php submit_button(); ?></form>
    <?php UAT_Theme::settings(); ?>
    <?php UAT_Content::settings(); ?>
    <h2>Données et confidentialité</h2><p>Les exports de fichiers sont analysés dans le navigateur. Les imports API et jetons chiffrés sont isolés par session et supprimés après 24 heures (nettoyage horaire WordPress). Le visiteur peut les effacer immédiatement. Aucun résultat personnel n’est intégré au HTML public de la page.</p>
    <p><a href="https://untappd.com/api/docs/v4" target="_blank" rel="noopener noreferrer">Documentation API officielle</a></p></div>
    <?php
}
function uat_dashboard($preview = false, $texts = []) {
    uat_register_assets();
    wp_enqueue_style('uat-dashboard');
    wp_enqueue_script('uat-dashboard');
    $credentials = get_option('uat_credentials', []);
    $config = ['api' => rest_url('untappd-atlas/v1/'), 'configured' => !empty($credentials['id']) && !empty($credentials['secret']), 'timezone' => wp_timezone_string() ?: 'UTC', 'preview' => (bool) $preview, 'texts' => UAT_Content::values($texts)];
    return '<div class="uat-app alignwide" data-config="' . esc_attr(wp_json_encode($config)) . '"><p>Chargement d’Untappd Atlas… JavaScript est nécessaire pour les graphiques et exports.</p></div>';
}
add_shortcode('untappd_atlas', function () { return uat_dashboard(); });
