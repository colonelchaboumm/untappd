<?php
defined('ABSPATH') || exit;

final class UAT_Content {
    public static function fields(): array {
        static $fields;
        if ($fields === null) { $fields = json_decode(file_get_contents(dirname(__DIR__) . '/assets/content.json'), true) ?: []; }
        return array_filter($fields, fn($field) => empty($field['retired']));
    }
    public static function groups(): array {
        return ['intro'=>'Introduction','form'=>'Formulaire et accueil','filters'=>'Filtres et boutons','report'=>'Rapport et repères','metrics'=>'Compteurs et leurs descriptions','sections'=>'Titres des sections','charts'=>'Graphiques et leurs descriptions','rankings'=>'Classements et leurs descriptions','badge_texts'=>'Badges et leurs descriptions','footer'=>'Pied de page','export'=>'Export PNG'];
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
    public static function sanitize_visibility($input): array {
        $out = [];
        foreach (self::fields() as $key => $field) {
            if (($field['hideable'] ?? true) && is_array($input) && isset($input[$key]) && in_array($input[$key], ['show', 'hide'], true)) { $out[$key] = $input[$key]; }
        }
        return $out;
    }
    public static function values($overrides = [], $visibility = []): array {
        $defaults = array_map(fn($field) => $field['default'], self::fields());
        $values = array_replace($defaults, self::sanitize(get_option('uat_texts', [])), self::sanitize($overrides));
        $visibility = array_replace(self::sanitize_visibility(get_option('uat_text_visibility', [])), self::sanitize_visibility($visibility));
        foreach ($visibility as $key => $mode) { if ($mode === 'hide') { $values[$key] = ''; } }
        return $values;
    }
    public static function settings() {
        $values = get_option('uat_texts', []);
        $visibility = self::sanitize_visibility(get_option('uat_text_visibility', []));
        ?>
        <h2>Textes du tableau de bord</h2>
        <p>Définissez ici les textes communs au shortcode et aux widgets Elementor. Dans Elementor, l’onglet <strong>Contenu</strong> du widget permet de les remplacer pour une page. Un champ vide hérite du texte commun ou du texte initial. Utilisez <strong>Masquer</strong> pour retirer un titre ou une description. Les champs acceptent du texte simple et des retours à la ligne.</p>
        <form method="post" action="options.php"><?php settings_fields('uat_content'); ?>
        <?php foreach (self::groups() as $group => $title) : ?>
        <details style="margin:12px 0;padding:12px 18px;border:1px solid #c3c4c7;background:#fff"><summary style="cursor:pointer;font-weight:600"><?php echo esc_html($title); ?></summary><table class="form-table" role="presentation">
        <?php foreach (self::fields() as $key => $field) : if ($field['group'] !== $group) { continue; } ?>
        <tr><th><label for="uat-text-<?php echo esc_attr($key); ?>"><?php echo esc_html($field['label']); ?></label></th><td><textarea class="large-text" rows="<?php echo !empty($field['multiline']) ? 3 : 2; ?>" maxlength="2000" id="uat-text-<?php echo esc_attr($key); ?>" name="uat_texts[<?php echo esc_attr($key); ?>]" placeholder="<?php echo esc_attr($field['default']); ?>"><?php echo esc_textarea($values[$key] ?? ''); ?></textarea>
        <?php if (!empty($field['vars'])) : ?><p class="description">Variables : <?php echo esc_html($field['vars']); ?>, à entourer d’accolades. Exemple : {<?php echo esc_html(explode(', ', $field['vars'])[0]); ?>}.</p><?php endif; ?>
        <?php if ($field['hideable'] ?? true) : ?><p><label>Visibilité <select name="uat_text_visibility[<?php echo esc_attr($key); ?>]"><option value="show" <?php selected($visibility[$key] ?? 'show', 'show'); ?>>Afficher</option><option value="hide" <?php selected($visibility[$key] ?? 'show', 'hide'); ?>>Masquer</option></select></label></p><?php endif; ?></td></tr>
        <?php endforeach; ?></table></details><?php endforeach; ?>
        <?php submit_button('Enregistrer les textes'); ?></form>
        <?php
    }
}
