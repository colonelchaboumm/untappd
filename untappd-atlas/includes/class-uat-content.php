<?php
defined('ABSPATH') || exit;

final class UAT_Content {
    public static function fields(): array {
        static $fields;
        if ($fields === null) { $fields = json_decode(file_get_contents(dirname(__DIR__) . '/assets/content.json'), true) ?: []; }
        return $fields;
    }
    public static function groups(): array {
        return ['intro'=>'En-tête et introduction','form'=>'Formulaire et accueil','report'=>'Rapport et repères','sections'=>'Titres des sections','charts'=>'Titres et sous-titres des graphiques','rankings'=>'Titres et sous-titres des classements','footer'=>'Tableaux et pied de page','export'=>'Export PNG'];
    }
    public static function sanitize($input): array {
        $input = is_array($input) ? $input : [];
        $out = [];
        foreach (self::fields() as $key => $field) {
            if (!isset($input[$key]) || !is_string($input[$key])) { continue; }
            $value = trim(sanitize_textarea_field($input[$key]));
            if ($value !== '') { $out[$key] = function_exists('mb_substr') ? mb_substr($value, 0, 2000) : substr($value, 0, 2000); }
        }
        return $out;
    }
    public static function values($overrides = []): array {
        $defaults = array_map(fn($field) => $field['default'], self::fields());
        return array_replace($defaults, self::sanitize(get_option('uat_texts', [])), self::sanitize($overrides));
    }
    public static function settings() {
        $values = get_option('uat_texts', []);
        ?>
        <h2>Textes du tableau de bord</h2>
        <p>Définissez ici les textes communs au shortcode et aux widgets Elementor. Dans Elementor, l’onglet <strong>Contenu</strong> du widget permet de les remplacer pour une page. Un champ vide hérite du texte commun ou du texte initial. Les champs acceptent du texte simple et des retours à la ligne.</p>
        <form method="post" action="options.php"><?php settings_fields('uat_content'); ?>
        <?php foreach (self::groups() as $group => $title) : ?>
        <details style="margin:12px 0;padding:12px 18px;border:1px solid #c3c4c7;background:#fff"><summary style="cursor:pointer;font-weight:600"><?php echo esc_html($title); ?></summary><table class="form-table" role="presentation">
        <?php foreach (self::fields() as $key => $field) : if ($field['group'] !== $group) { continue; } ?>
        <tr><th><label for="uat-text-<?php echo esc_attr($key); ?>"><?php echo esc_html($field['label']); ?></label></th><td><textarea class="large-text" rows="<?php echo !empty($field['multiline']) ? 3 : 2; ?>" maxlength="2000" id="uat-text-<?php echo esc_attr($key); ?>" name="uat_texts[<?php echo esc_attr($key); ?>]" placeholder="<?php echo esc_attr($field['default']); ?>"><?php echo esc_textarea($values[$key] ?? ''); ?></textarea>
        <?php if (!empty($field['vars'])) : ?><p class="description">Variables : <?php echo esc_html($field['vars']); ?>, à entourer d’accolades. Exemple : {<?php echo esc_html(explode(', ', $field['vars'])[0]); ?>}.</p><?php endif; ?></td></tr>
        <?php endforeach; ?></table></details><?php endforeach; ?>
        <?php submit_button('Enregistrer les textes'); ?></form>
        <?php
    }
}
