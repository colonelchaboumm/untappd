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
        $this->add_control('uat_help', ['type' => \Elementor\Controls_Manager::RAW_HTML, 'raw' => 'Le formulaire, les imports et les statistiques s’affichent ici. L’éditeur montre une démonstration fictive. Personnalisez toutes les couleurs dans l’onglet Style ; l’icône globe permet de choisir une couleur globale Elementor.', 'content_classes' => 'elementor-panel-alert elementor-panel-alert-info']);
        $this->end_controls_section();
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
    }
    protected function render(): void {
        $editor = \Elementor\Plugin::$instance->editor->is_edit_mode();
        echo uat_dashboard($editor); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by renderer.
    }
}
