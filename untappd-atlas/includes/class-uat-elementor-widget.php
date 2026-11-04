<?php
defined('ABSPATH') || exit;

final class UAT_Elementor_Widget extends \Elementor\Widget_Base {
    public function get_name(): string { return 'untappd-atlas'; }
    public function get_title(): string { return 'Untappd Atlas'; }
    public function get_icon(): string { return 'eicon-kit-details'; }
    public function get_categories(): array { return ['general']; }
    public function get_keywords(): array { return ['untappd', 'bière', 'statistiques', 'atlas']; }
    public function get_style_depends(): array { return ['uat-dashboard']; }
    public function get_script_depends(): array { return ['uat-dashboard']; }
    protected function register_controls(): void {
        $this->start_controls_section('uat_content', ['label' => 'Untappd Atlas']);
        $this->add_control('uat_help', ['type' => \Elementor\Controls_Manager::RAW_HTML, 'raw' => 'L’éditeur montre une démonstration fictive. Modifiez les titres, sous-titres et libellés dans les sections de l’onglet Contenu. Personnalisez les couleurs et la typographie dans Style ; l’icône globe permet de choisir un style global Elementor.', 'content_classes' => 'elementor-panel-alert elementor-panel-alert-info']);
        $this->end_controls_section();
        foreach (UAT_Content::groups() as $group => $label) {
            $this->start_controls_section('uat_texts_' . $group, ['label' => $label, 'tab' => \Elementor\Controls_Manager::TAB_CONTENT]);
            foreach (UAT_Content::fields() as $key => $field) {
                if ($field['group'] !== $group) { continue; }
                $this->add_control('uat_text_' . $key, [
                    'label' => $field['label'],
                    'type' => !empty($field['multiline']) || strlen($field['default']) > 80 ? \Elementor\Controls_Manager::TEXTAREA : \Elementor\Controls_Manager::TEXT,
                    'rows' => 3, 'label_block' => true, 'placeholder' => $field['default'],
                    'description' => 'Vide : texte commun du plugin.' . (!empty($field['vars']) ? ' Variables entre accolades : ' . $field['vars'] . '.' : ''),
                ]);
                if ($field['hideable'] ?? true) {
                    $this->add_control('uat_visibility_' . $key, [
                        'label' => 'Visibilité : ' . $field['label'], 'type' => \Elementor\Controls_Manager::SELECT,
                        'options' => ['' => 'Hériter des réglages du plugin', 'show' => 'Afficher', 'hide' => 'Masquer'], 'default' => '',
                        'description' => 'Masquer retire ce texte sur ce widget, y compris dans son PNG.',
                    ]);
                }
            }
            $this->end_controls_section();
        }
        foreach (UAT_Theme::groups() as $group => $label) {
            $this->start_controls_section('uat_style_' . $group, ['label' => $label, 'tab' => \Elementor\Controls_Manager::TAB_STYLE]);
            foreach (UAT_Theme::tokens() as $key => $token) {
                if ($token['group'] !== $group) { continue; }
                $this->add_control('uat_color_' . str_replace('-', '_', $key), [
                    'label' => $token['label'], 'type' => \Elementor\Controls_Manager::COLOR,
                    'alpha' => true, 'global' => ['active' => true],
                    'selectors' => ['{{WRAPPER}} .uat-app' => '--uat-' . $key . ': {{VALUE}};'],
                    'description' => 'Vide : palette du plugin. Valeur initiale : ' . $token['default'],
                ]);
            }
            $this->end_controls_section();
        }
        $this->start_controls_section('uat_typography', ['label' => 'Typographie des textes', 'tab' => \Elementor\Controls_Manager::TAB_STYLE]);
        foreach ([
            'body' => ['Texte courant', '{{WRAPPER}} .uat-app'],
            'headings' => ['Titres des sections et cartes', '{{WRAPPER}} .uat-app h2, {{WRAPPER}} .uat-app h3'],
            'hero' => ['Titre principal', '{{WRAPPER}} .uat-app .uat-intro h2'],
            'subtitles' => ['Sous-titres et descriptions', '{{WRAPPER}} .uat-app .uat-intro p, {{WRAPPER}} .uat-app .uat-card > p, {{WRAPPER}} .uat-app .uat-section-head p, {{WRAPPER}} .uat-app .uat-ring-description'],
            'numbers' => ['Chiffres clés', '{{WRAPPER}} .uat-app .uat-kpi strong, {{WRAPPER}} .uat-app .uat-mini strong'],
            'buttons' => ['Boutons', '{{WRAPPER}} .uat-app button, {{WRAPPER}} .uat-app .uat-file'],
        ] as $key => [$label, $selector]) {
            $this->add_group_control(\Elementor\Group_Control_Typography::get_type(), ['name' => 'uat_typography_' . $key, 'label' => $label, 'selector' => $selector, 'global' => ['active' => true]]);
        }
        $this->end_controls_section();
    }
    protected function render(): void {
        $editor = \Elementor\Plugin::$instance->editor->is_edit_mode();
        $settings = $this->get_settings_for_display();
        $texts = [];
        $visibility = [];
        foreach (UAT_Content::fields() as $key => $field) {
            if (isset($settings['uat_text_' . $key])) { $texts[$key] = $settings['uat_text_' . $key]; }
            if (isset($settings['uat_visibility_' . $key])) { $visibility[$key] = $settings['uat_visibility_' . $key]; }
        }
        echo uat_dashboard($editor, $texts, $visibility); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by renderer.
    }
}
