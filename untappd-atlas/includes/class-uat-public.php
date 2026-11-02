<?php
defined('ABSPATH') || exit;

// Only unauthenticated HTML on fixed Untappd paths. No cookies, login or challenge bypass.
final class UAT_Public {
    private static function page($path) {
        if (!preg_match('~^/(?:user/[A-Za-z0-9_.-]+|b/[A-Za-z0-9_%.-]+/[0-9]+)/?$~D', $path)) { return new WP_Error('public_path', 'Adresse publique non valide.', ['status' => 400]); }
        $key = 'uat_public_' . hash('sha256', $path);
        $cached = get_transient($key);
        if (is_string($cached)) { return $cached; }
        if (!add_option('uat_lock_public', time(), '', false)) {
            if ((int) get_option('uat_lock_public') < time() - 60) { delete_option('uat_lock_public'); }
            return new WP_Error('public_busy', 'Lecture publique occupée. Réessayez dans quelques secondes.', ['status' => 429]);
        }
        try {
            $budget = get_transient('uat_public_budget') ?: ['count' => 0, 'reset' => time() + HOUR_IN_SECONDS];
            if ($budget['reset'] <= time()) { $budget = ['count' => 0, 'reset' => time() + HOUR_IN_SECONDS]; }
            if ($budget['count'] >= 100) { return new WP_Error('public_quota', 'Limite de lecture publique atteinte. Import reprenable.', ['status' => 429, 'retry_at' => $budget['reset']]); }
            $budget['count']++;
            set_transient('uat_public_budget', $budget, HOUR_IN_SECONDS);
            $r = wp_safe_remote_get('https://untappd.com' . $path, ['timeout' => 20, 'redirection' => 0, 'cookies' => [], 'user-agent' => 'UntappdAtlas/' . UAT_VERSION . ' (public HTML; ' . home_url() . ')', 'limit_response_size' => 3 * MB_IN_BYTES]);
            if (is_wp_error($r)) { return new WP_Error('public_network', 'Page publique Untappd inaccessible. Import conservé.', ['status' => 502]); }
            if (wp_remote_retrieve_response_code($r) !== 200) { return new WP_Error('public_access', 'Untappd limite cette page ou exige une connexion. Seules les pages publiques accessibles peuvent être importées.', ['status' => 502]); }
            $html = wp_remote_retrieve_body($r);
            if (preg_match('~<title>\s*(?:Login|Sign In|Just a moment|Attention Required)~i', $html)) { return new WP_Error('public_login', 'Cette page exige une connexion Untappd. La lecture publique ne donne pas l’historique complet.', ['status' => 502]); }
            set_transient($key, $html, HOUR_IN_SECONDS);
            return $html;
        } finally { delete_option('uat_lock_public'); }
    }
    private static function dom($html) {
        if (!class_exists('DOMDocument')) { return new WP_Error('public_dom', 'L’extension PHP DOM est nécessaire.', ['status' => 503]); }
        $prior = libxml_use_internal_errors(true);
        $doc = new DOMDocument(); $ok = $doc->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors(); libxml_use_internal_errors($prior);
        return $ok ? new DOMXPath($doc) : new WP_Error('public_html', 'Page publique illisible.', ['status' => 502]);
    }
    private static function cls($name) { return "contains(concat(' ',normalize-space(@class),' '),' $name ')"; }
    private static function text($xp, $q, $context = null) { $n = $xp->query($q, $context)->item(0); return $n ? trim(preg_replace('/\s+/u', ' ', $n->textContent)) : ''; }
    private static function attr($xp, $q, $attr, $context = null) { $n = $xp->query($q, $context)->item(0); return $n instanceof DOMElement ? $n->getAttribute($attr) : ''; }
    private static function count($text) { return preg_match('/^[0-9\s,.]+$/D', $text) ? (int) preg_replace('/\D/', '', $text) : null; }
    public static function profile($username) { $html = self::page('/user/' . rawurlencode($username)); return is_wp_error($html) ? $html : self::parse_profile($html, $username); }
    public static function parse_profile($html, $username) {
        $xp = self::dom($html); if (is_wp_error($xp)) { return $xp; }
        $actual = self::text($xp, '//p[' . self::cls('username') . ']');
        if (!$actual || strcasecmp($actual, $username) !== 0) { return new WP_Error('public_profile', 'Profil public introuvable ou privé.', ['status' => 404]); }
        $expected = self::count(self::text($xp, '//*[@data-href=":stats/general"]//*[' . self::cls('stat') . ']'));
        $badges = self::count(self::text($xp, '//*[@data-href=":stats/badges"]//*[' . self::cls('stat') . ']'));
        $items = []; $paths = []; $invalid = 0;
        foreach ($xp->query('//div[@data-checkin-id and ' . self::cls('item') . ']') as $node) {
            $id = $node->getAttribute('data-checkin-id'); $q = './/p[' . self::cls('text') . ']/a[starts-with(@href,"/b/")]';
            $beer = self::text($xp, $q, $node); $path = self::attr($xp, $q, 'href', $node); $stamp = strtotime(self::text($xp, './/a[' . self::cls('timezoner') . ']', $node));
            if (!ctype_digit($id) || !$beer || !$stamp || !preg_match('~^/b/[A-Za-z0-9_%.-]+/([0-9]+)$~D', $path, $m)) { $invalid++; continue; }
            $item = ['checkin_id' => $id, 'created_at' => gmdate('c', $stamp), 'beer' => ['bid' => $m[1], 'beer_name' => $beer], 'brewery' => ['brewery_name' => self::text($xp, $q . '/following-sibling::a[1]', $node)], 'rating_score' => self::attr($xp, './/*[@data-rating]', 'data-rating', $node)];
            $photos = $xp->query('.//p[' . self::cls('photo') . ']//img', $node)->length;
            if ($photos) { $item['media'] = ['count' => $photos]; }
            $item['checkin_comment'] = self::text($xp, './/*[' . self::cls('checkin-comment') . ']/p', $node);
            $toasts = self::count(self::text($xp, './/*[' . self::cls('cheers') . ']//span[' . self::cls('count') . ']/span', $node));
            if ($toasts !== null) { $item['toasts'] = ['count' => $toasts]; }
            $venue = self::text($xp, './/p[' . self::cls('text') . ']/a[starts-with(@href,"/v/")]', $node);
            if ($venue !== '') { $item['venue'] = ['venue_name' => $venue]; }
            $earned = [];
            foreach ($xp->query('.//span[' . self::cls('badge') . ']/img[@alt]', $node) as $image) { $earned[] = ['badge_name' => $image->getAttribute('alt'), 'badge_image' => ['sm' => $image->getAttribute('src')]]; }
            if ($earned) { $item['badges'] = ['items' => $earned, 'count' => count($earned)]; $item['badges_partial'] = true; }
            // Missing markup stays unknown, including comments and badges.
            $items[$id] = $item; $paths[$m[1]] = $path;
        }
        $gated = (bool) preg_match('/sign in to view more/i', html_entity_decode(strip_tags($html)));
        return ['profile' => ['username' => $actual, 'name' => $actual, 'expected' => $expected, 'expected_badges' => $badges], 'items' => array_values($items), 'beer_paths' => array_values($paths), 'complete' => !$gated && !$invalid && $expected !== null && count($items) === $expected, 'invalid' => $invalid];
    }
    public static function beer($path) { $html = self::page($path); return is_wp_error($html) ? $html : self::parse_beer($html, $path); }
    public static function parse_beer($html, $path) {
        if (!preg_match('~/([0-9]+)$~D', $path, $m)) { return new WP_Error('public_beer', 'Bière non valide.', ['status' => 400]); }
        $xp = self::dom($html); if (is_wp_error($xp)) { return $xp; }
        $style = self::text($xp, '//div[' . self::cls('name') . ']/p[' . self::cls('style') . ']');
        if (!$style) { return new WP_Error('public_format', 'Format de page publique non reconnu. Import conservé, informations de bière incomplètes.', ['status' => 502]); }
        $beer = ['bid' => $m[1], 'beer_style' => $style];
        foreach (['abv' => 'beer_abv', 'ibu' => 'beer_ibu'] as $css => $key) { if (preg_match('/([0-9]+(?:[.,][0-9]+)?)/', self::text($xp, '//p[' . self::cls($css) . ']'), $n)) { $beer[$key] = (float) str_replace(',', '.', $n[1]); } }
        return $beer;
    }
}
