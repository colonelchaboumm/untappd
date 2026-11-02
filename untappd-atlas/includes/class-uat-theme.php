<?php
defined('ABSPATH') || exit;

final class UAT_Theme {
    public static function tokens(): array {
        static $tokens;
        if ($tokens === null) { $tokens = json_decode(file_get_contents(dirname(__DIR__) . '/assets/palette.json'), true) ?: []; }
        return $tokens;
    }
    public static function groups(): array {
        return ['general' => 'Fond, textes et cartes', 'controls' => 'Champs et boutons', 'messages' => 'Messages et démonstration', 'cans' => 'Pyramides de canettes', 'charts' => 'Graphiques et classements', 'series' => 'Palette des 10 styles'];
    }
    public static function color($value): string {
        if (!is_string($value)) { return ''; }
        $value = trim($value);
        if (preg_match('/^#(?:[a-f0-9]{3,4}|[a-f0-9]{6}|[a-f0-9]{8})$/iD', $value)) { return strtolower($value); }
        if ($value === 'transparent') { return $value; }
        // Deliberately accept only numeric CSS color functions, never arbitrary CSS or URLs.
        if (preg_match('/^(?:rgba?|hsla?)\(\s*[-+\d.%\s,\/]+\)$/iD', $value)) { return $value; }
        return '';
    }
    public static function sanitize($input): array {
        $input = is_array($input) ? $input : [];
        $out = ['follow_elementor' => empty($input['follow_elementor']) ? 0 : 1];
        foreach (self::tokens() as $key => $token) {
            $color = self::color($input[$key] ?? '');
            if ($color !== '') { $out[$key] = $color; }
        }
        return $out;
    }
    public static function css(): string {
        $settings = get_option('uat_palette', ['follow_elementor' => 1]);
        $out = '.uat-app{';
        foreach (self::tokens() as $key => $token) {
            $value = self::color($settings[$key] ?? '');
            if ($value === '') {
                $value = !empty($settings['follow_elementor']) && !empty($token['global'])
                    ? 'var(--e-global-color-' . $token['global'] . ',' . $token['default'] . ')'
                    : $token['default'];
            }
            $out .= '--uat-' . $key . ':' . $value . ';';
        }
        return $out . '}';
    }
    public static function settings() {
        $values = get_option('uat_palette', ['follow_elementor' => 1]);
        ?>
        <h2>Couleurs et Elementor</h2>
        <p>Dans Elementor, ajoutez le widget <strong>Untappd Atlas</strong>, puis ouvrez son onglet <strong>Style</strong>. Chaque couleur peut être reliée à une couleur globale avec l’icône globe, ou remplacée pour ce widget.</p>
        <p>La palette ci-dessous sert de base à tous les tableaux de bord, y compris ceux insérés par shortcode. Un champ vide conserve la couleur par défaut ou la couleur globale Elementor. Les réglages du widget sont prioritaires. L’export PNG reprend les couleurs du tableau de bord.</p>
        <form method="post" action="options.php"><?php settings_fields('uat_appearance'); ?>
        <p><label><input type="checkbox" name="uat_palette[follow_elementor]" value="1" <?php checked(!empty($values['follow_elementor'])); ?>> Suivre automatiquement les couleurs globales Elementor pour les titres, textes, boutons, accent et trois premières séries</label></p>
        <?php foreach (self::groups() as $group => $title) : ?>
        <details style="margin:12px 0;padding:12px 18px;border:1px solid #c3c4c7;background:#fff"><summary style="cursor:pointer;font-weight:600"><?php echo esc_html($title); ?></summary>
        <table class="form-table" role="presentation"><?php foreach (self::tokens() as $key => $token) : if ($token['group'] !== $group) { continue; } ?>
        <tr><th><label for="uat-color-<?php echo esc_attr($key); ?>"><?php echo esc_html($token['label']); ?></label></th><td>
        <input class="<?php echo $key === 'shadow' ? 'regular-text' : 'uat-color-input'; ?>" type="text" id="uat-color-<?php echo esc_attr($key); ?>" name="uat_palette[<?php echo esc_attr($key); ?>]" value="<?php echo esc_attr($values[$key] ?? ''); ?>" placeholder="<?php echo esc_attr($token['default']); ?>" data-default-color="<?php echo esc_attr($token['default']); ?>">
        <span class="description">Défaut : <?php echo esc_html($token['default']); ?></span></td></tr>
        <?php endforeach; ?></table></details><?php endforeach; ?>
        <?php submit_button('Enregistrer les couleurs'); ?></form>
        <?php
    }
}
