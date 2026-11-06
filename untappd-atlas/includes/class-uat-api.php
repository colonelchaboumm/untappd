<?php
defined('ABSPATH') || exit;

final class UAT_Storage_Exception extends RuntimeException {}

final class UAT_API {
    private const TTL = DAY_IN_SECONDS;
    public static function install() {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $collate = $wpdb->get_charset_collate();
        dbDelta("CREATE TABLE {$wpdb->prefix}uat_sessions (
            id varchar(64) NOT NULL,
            expires bigint(20) unsigned NOT NULL,
            data longtext NOT NULL,
            PRIMARY KEY  (id),
            KEY expires (expires)
        ) $collate;");
        dbDelta("CREATE TABLE {$wpdb->prefix}uat_checkins (
            session_id varchar(64) NOT NULL,
            checkin_id varchar(64) NOT NULL,
            data longtext NOT NULL,
            PRIMARY KEY  (session_id,checkin_id)
        ) $collate;");
        if (!wp_next_scheduled('uat_cleanup')) { wp_schedule_event(time() + HOUR_IN_SECONDS, 'hourly', 'uat_cleanup'); }
    }
    public static function cleanup() {
        global $wpdb;
        $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->prefix}uat_checkins WHERE session_id IN (SELECT id FROM {$wpdb->prefix}uat_sessions WHERE expires < %d)", time()));
        $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->prefix}uat_sessions WHERE expires < %d", time()));
    }
    public static function seal($plain) {
        if (!function_exists('openssl_encrypt')) { return ''; }
        $iv = random_bytes(12);
        $cipher = openssl_encrypt($plain, 'aes-256-gcm', hash('sha256', wp_salt('auth'), true), OPENSSL_RAW_DATA, $iv, $tag);
        return $cipher === false ? '' : base64_encode($iv . $tag . $cipher);
    }
    public static function unseal($value) {
        if (!function_exists('openssl_decrypt')) { return ''; }
        $raw = base64_decode($value, true);
        if ($raw === false || strlen($raw) < 29) { return ''; }
        return openssl_decrypt(substr($raw, 28), 'aes-256-gcm', hash('sha256', wp_salt('auth'), true), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16)) ?: '';
    }
    public static function username($value) {
        if (!is_scalar($value)) { return new WP_Error('profile', 'Pseudo Untappd invalide.', ['status' => 400]); }
        $value = trim((string) $value);
        if (preg_match('~^https?://~i', $value)) {
            $parts = wp_parse_url($value);
            if (!in_array(strtolower($parts['host'] ?? ''), ['untappd.com', 'www.untappd.com'], true) || !preg_match('~^/user/([A-Za-z0-9_.-]+)/?$~', $parts['path'] ?? '', $m)) {
                return new WP_Error('profile', 'Utilisez un lien https://untappd.com/user/votre-pseudo.', ['status' => 400]);
            }
            $value = $m[1];
        }
        if (!preg_match('/^[A-Za-z0-9_.-]{1,64}$/D', $value)) { return new WP_Error('profile', 'Pseudo Untappd invalide.', ['status' => 400]); }
        return $value;
    }
    public static function origin() {
        $origin = get_http_origin();
        // These endpoints use their own high-entropy bearer token, never WordPress cookies.
        if ($origin && strtolower($origin) !== strtolower(rtrim(home_url(), '/')) && strtolower($origin) !== strtolower((is_ssl() ? 'https://' : 'http://') . wp_parse_url(home_url(), PHP_URL_HOST) . (wp_parse_url(home_url(), PHP_URL_PORT) ? ':' . wp_parse_url(home_url(), PHP_URL_PORT) : ''))) {
            return new WP_Error('origin', 'Origine de requête refusée.', ['status' => 403]);
        }
        return true;
    }
    public static function routes() {
        foreach (['session' => 'POST', 'status' => 'GET', 'start' => 'POST', 'step' => 'POST', 'oauth' => 'POST', 'erase' => 'POST', 'share' => 'POST'] as $name => $method) {
            $callback = $name === 'session' ? 'create' : $name;
            $permission = $name === 'session' ? 'origin' : 'permission';
            register_rest_route('untappd-atlas/v1', '/' . $name, ['methods' => $method,
                'callback' => fn($r) => self::endpoint($callback, $r),
                'permission_callback' => fn($r) => self::endpoint($permission, $r)]);
        }
    }
    // Keep failures inside this plugin's REST endpoints; never install a global error handler.
    private static function endpoint($callback, $request) {
        global $wpdb;
        $quiet = $wpdb->suppress_errors(true);
        try { return self::$callback($request); }
        catch (Throwable $error) {
            $reference = substr(str_replace('-', '', wp_generate_uuid4()), 0, 12);
            // No SQL, request bodies, session tokens or exception messages in the log.
            error_log(sprintf('[Untappd Atlas %s] %s: %s at %s:%d', $reference, $callback, get_class($error), $error->getFile(), $error->getLine()));
            if ($error instanceof UAT_Storage_Exception) {
                return new WP_Error('storage', 'WordPress ne peut pas enregistrer l’import. Vérifiez les droits de création et d’écriture des tables du plugin auprès de votre hébergeur. Référence : ' . $reference . '.', ['status' => 503]);
            }
            return new WP_Error('import_server', 'WordPress a interrompu l’import. Consultez le journal PHP de l’hébergement avec cette référence : ' . $reference . '.', ['status' => 500]);
        } finally { $wpdb->suppress_errors($quiet); }
    }
    private static function storage_available() {
        global $wpdb;
        foreach (['uat_sessions' => 'id,expires,data', 'uat_checkins' => 'session_id,checkin_id,data'] as $table => $columns) {
            if ($wpdb->query("SELECT $columns FROM {$wpdb->prefix}$table LIMIT 0") === false) { return false; }
        }
        return true;
    }
    private static function storage() {
        // Updates and copied plugins do not necessarily execute the activation hook.
        if (self::storage_available()) { return; }
        self::install();
        if (!self::storage_available()) { throw new UAT_Storage_Exception('schema'); }
    }
    private static function id($request) { return hash('sha256', $request->get_header('x-uat-session')); }
    private static function read($id) {
        global $wpdb;
        $raw = $wpdb->get_var($wpdb->prepare("SELECT data FROM {$wpdb->prefix}uat_sessions WHERE id=%s AND expires>%d", $id, time()));
        if ($wpdb->last_error) { throw new UAT_Storage_Exception('read'); }
        $data = $raw ? json_decode($raw, true) : null;
        // An expired or damaged session must be rejected, not passed into array operations.
        if (!is_array($data) || !isset($data['phase'], $data['count']) || !in_array($data['phase'], ['idle', 'feed', 'details', 'public_beers', 'done'], true)) { return null; }
        return $data;
    }
    private static function save($id, $data) {
        global $wpdb;
        $ok = $wpdb->replace($wpdb->prefix . 'uat_sessions', ['id' => $id, 'expires' => time() + self::TTL, 'data' => wp_json_encode($data)], ['%s', '%d', '%s']);
        if ($ok === false) { throw new UAT_Storage_Exception('session_write'); }
    }
    public static function permission($request) {
        $origin = self::origin();
        if (is_wp_error($origin)) { return $origin; }
        $token = (string) $request->get_header('x-uat-session');
        if (!preg_match('/^[a-f0-9]{64}$/D', $token)) { return self::session_error(); }
        self::storage();
        if (!self::read(self::id($request))) { return self::session_error(); }
        return true;
    }
    private static function session_error() { return new WP_Error('session', 'Session expirée ou endommagée. Relancez l’import.', ['status' => 401]); }
    public static function create() {
        $ip = hash_hmac('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown', wp_salt('nonce'));
        $key = 'uat_new_' . substr($ip, 0, 32);
        $n = (int) get_transient($key);
        if ($n >= 12) { return new WP_Error('rate', 'Trop de nouvelles sessions. Réessayez dans une heure.', ['status' => 429]); }
        set_transient($key, $n + 1, HOUR_IN_SECONDS);
        self::storage();
        $token = bin2hex(random_bytes(32));
        self::save(hash('sha256', $token), ['phase' => 'idle', 'count' => 0, 'cursor' => null, 'profile' => null, 'token' => '', 'retry_at' => 0, 'enrich' => false, 'detail_cursor' => '', 'details_done' => 0]);
        return self::response(['session' => $token]);
    }
    private static function response($data) {
        $response = new WP_REST_Response($data);
        $response->header('Cache-Control', 'no-store, private');
        $response->header('Vary', 'X-UAT-Session');
        return $response;
    }
    private static function public_state($s) {
        $public = array_intersect_key($s, array_flip(['phase', 'count', 'cursor', 'profile', 'retry_at', 'enrich', 'details_done', 'connected_username', 'source', 'public_complete']));
        if ($s['phase'] === 'public_beers' && is_array($s['beer_paths'] ?? null)) {
            $public['beer_total'] = count($s['beer_paths']);
        }
        return $public;
    }
    public static function status($r) {
        $id = self::id($r); $s = self::read($id);
        if (!$s) { return self::session_error(); }
        return self::response(['state' => self::public_state($s), 'items' => self::items($id)]);
    }
    private static function items($id) {
        global $wpdb;
        $stored = $wpdb->get_col($wpdb->prepare("SELECT data FROM {$wpdb->prefix}uat_checkins WHERE session_id=%s", $id));
        if ($wpdb->last_error) { throw new UAT_Storage_Exception('checkins_read'); }
        return array_map(function($json) {
            $item = json_decode($json, true);
            if (!is_array($item)) { throw new UAT_Storage_Exception('checkin_data'); }
            return $item;
        }, $stored);
    }
    private static function lock($id) {
        $key = 'uat_lock_' . $id;
        if (add_option($key, time(), '', false)) { return true; }
        if ((int) get_option($key) < time() - 90) { delete_option($key); return add_option($key, time(), '', false); }
        return false;
    }
    public static function start($r) {
        global $wpdb;
        $id = self::id($r);
        if (!self::lock($id)) { return new WP_Error('busy', 'Import déjà en cours.', ['status' => 409]); }
        try {
            $s = self::read($id);
            if (!$s) { return self::session_error(); }
            $username = self::username($r->get_param('profile'));
            if (is_wp_error($username)) { return $username; }
            if ($r->get_param('source') === 'public' || is_wp_error(self::credentials($s))) {
                $data = UAT_Public::profile($username);
                if (is_wp_error($data)) { return $data; }
                if ($wpdb->delete($wpdb->prefix . 'uat_checkins', ['session_id' => $id]) === false) { throw new UAT_Storage_Exception('checkins_reset'); }
                foreach ($data['items'] as $item) { self::put($id, $item); }
                $s = array_merge($s, ['source' => 'public', 'phase' => $data['beer_paths'] ? 'public_beers' : 'done', 'username' => $username, 'profile' => $data['profile'], 'count' => count($data['items']), 'public_complete' => $data['complete'], 'beer_paths' => $data['beer_paths'], 'beer_index' => 0, 'details_done' => 0, 'retry_at' => 0, 'token' => '']);
                self::save($id, $s);
                return self::response(['state' => self::public_state($s), 'items' => $data['items']]);
            }
            $data = self::call('user/info/' . rawurlencode($username), $s);
            if (is_wp_error($data)) { return $data; }
            $u = $data['response']['user'] ?? null;
            if (!$u || empty($u['user_name'])) { return new WP_Error('profile', 'Profil introuvable ou inaccessible.', ['status' => 404]); }
            if ($wpdb->delete($wpdb->prefix . 'uat_checkins', ['session_id' => $id]) === false) { throw new UAT_Storage_Exception('checkins_reset'); }
            $s = array_merge($s, ['source' => 'api', 'phase' => 'feed', 'username' => $u['user_name'], 'count' => 0, 'cursor' => null, 'retry_at' => 0, 'enrich' => (bool) $r->get_param('enrich'), 'detail_cursor' => '', 'details_done' => 0, 'profile' => ['username' => sanitize_text_field($u['user_name']), 'name' => sanitize_text_field(trim(($u['first_name'] ?? '') . ' ' . ($u['last_name'] ?? ''))) ?: $u['user_name'], 'expected' => (int) ($u['stats']['total_checkins'] ?? 0)]]);
            self::save($id, $s);
            return self::response(['state' => self::public_state($s)]);
        } finally { delete_option('uat_lock_' . $id); }
    }
    private static function credentials($s) {
        if (!empty($s['token'])) { $token = self::unseal($s['token']); if ($token) { return ['access_token' => $token]; } }
        $c = get_option('uat_credentials', []); $secret = self::unseal($c['secret'] ?? '');
        if (empty($c['id']) || !$secret) { return new WP_Error('config', 'L’administrateur doit configurer l’API Untappd. Vous pouvez déjà importer votre export CSV/JSON.', ['status' => 503]); }
        return ['client_id' => $c['id'], 'client_secret' => $secret];
    }
    private static function call($path, $s, $extra = []) {
        $auth = self::credentials($s);
        if (is_wp_error($auth)) { return $auth; }
        $scope = substr(hash('sha256', wp_json_encode($auth)), 0, 32);
        // Atomic scope lock prevents concurrent visitors from overspending a shared key.
        if (!self::lock('api_' . $scope)) { return new WP_Error('busy', 'API occupée, réessayez dans quelques secondes.', ['status' => 409]); }
        try {
            $budget = get_transient('uat_budget_' . $scope) ?: ['used' => 0, 'reset' => time() + 3660];
            if ($budget['reset'] < time()) { $budget = ['used' => 0, 'reset' => time() + 3660]; }
            if ($budget['used'] >= 95) { return new WP_Error('quota', 'Quota API atteint. L’import peut être repris.', ['status' => 429, 'retry_at' => $budget['reset']]); }
            $budget['used']++;
            set_transient('uat_budget_' . $scope, $budget, 3700);
            $res = wp_remote_get(add_query_arg(array_merge($auth, $extra), 'https://api.untappd.com/v4/' . $path), ['timeout' => 25, 'redirection' => 0, 'user-agent' => 'UntappdAtlas/' . UAT_VERSION . ' (' . home_url() . ')', 'limit_response_size' => 4 * MB_IN_BYTES]);
            if (is_wp_error($res)) { return new WP_Error('network', 'Untappd ne répond pas. Réessayez ; votre progression est conservée.', ['status' => 502]); }
            $body = json_decode(wp_remote_retrieve_body($res), true);
            $code = wp_remote_retrieve_response_code($res);
            $meta = (int) ($body['meta']['code'] ?? $code);
            $remaining = wp_remote_retrieve_header($res, 'x-ratelimit-remaining');
            if (($remaining !== '' && (int) $remaining <= 1) || $code === 429 || $meta === 429) { $budget['used'] = 95; set_transient('uat_budget_' . $scope, $budget, 3700); }
            if ($code === 429 || $meta === 429) { return new WP_Error('quota', 'Quota API atteint. Reprenez après l’heure indiquée.', ['status' => 429, 'retry_at' => $budget['reset']]); }
            if ($code >= 400 || $meta >= 400) { return new WP_Error('untappd', 'Untappd refuse cette requête. Vérifiez les droits API et la confidentialité du profil.', ['status' => 502]); }
            if (!is_array($body) || !isset($body['response'])) { return new WP_Error('format', 'Réponse Untappd illisible. La progression est conservée.', ['status' => 502]); }
            return $body;
        } finally { delete_option('uat_lock_api_' . $scope); }
    }
    public static function step($r) {
        global $wpdb;
        $id = self::id($r);
        if (!self::lock($id)) { return new WP_Error('busy', 'Import déjà en cours.', ['status' => 409]); }
        try {
            $s = self::read($id);
            if (!$s) { return self::session_error(); }
            if ($s['phase'] === 'public_beers') {
                $path = $s['beer_paths'][$s['beer_index']] ?? null;
                if (!$path) { $s['phase'] = 'done'; self::save($id, $s); return self::response(['state' => self::public_state($s), 'items' => []]); }
                $beer = UAT_Public::beer($path);
                if (is_wp_error($beer)) { return self::step_error($id, $s, $beer); }
                $changed = [];
                foreach (self::items($id) as $item) {
                    if ((string) ($item['beer']['bid'] ?? '') === (string) $beer['bid']) { $item['beer'] = array_replace($item['beer'], $beer); self::put($id, $item); $changed[] = $item; }
                }
                $s['beer_index']++; $s['details_done']++; $s['retry_at'] = 0;
                if ($s['beer_index'] >= count($s['beer_paths'])) { $s['phase'] = 'done'; }
                self::save($id, $s);
                return self::response(['state' => self::public_state($s), 'items' => $changed]);
            }
            if (!in_array($s['phase'], ['feed', 'details'], true)) { return self::response(['state' => self::public_state($s), 'items' => []]); }
            if ($s['phase'] === 'details') {
                $row = $wpdb->get_row($wpdb->prepare("SELECT checkin_id,data FROM {$wpdb->prefix}uat_checkins WHERE session_id=%s AND checkin_id>%s ORDER BY checkin_id LIMIT 1", $id, $s['detail_cursor']), ARRAY_A);
                if ($wpdb->last_error) { throw new UAT_Storage_Exception('detail_read'); }
                if (!$row) { $s['phase'] = 'done'; self::save($id, $s); return self::response(['state' => self::public_state($s), 'items' => []]); }
                $data = self::call('checkin/view/' . rawurlencode($row['checkin_id']), $s);
                if (is_wp_error($data)) { return self::step_error($id, $s, $data); }
                $item = $data['response']['checkin'] ?? null;
                if (!$item || (string) ($item['checkin_id'] ?? '') !== $row['checkin_id']) { return new WP_Error('format', 'Détail de check-in absent ou incohérent.', ['status' => 502]); }
                $previous = json_decode($row['data'], true);
                if (!is_array($previous)) { throw new UAT_Storage_Exception('checkin_data'); }
                $detail = $item;
                $item = array_replace_recursive($previous, $detail);
                foreach (['comments', 'toasts', 'media', 'badges'] as $key) { if (isset($detail[$key])) { $item[$key] = $detail[$key]; } }
                self::put($id, $item);
                $s['detail_cursor'] = $row['checkin_id']; $s['details_done']++;
                self::save($id, $s);
                return self::response(['state' => self::public_state($s), 'items' => [$item]]);
            }
            $params = ['limit' => 25];
            if ($s['cursor']) { $params['max_id'] = $s['cursor']; }
            $data = self::call('user/checkins/' . rawurlencode($s['username']), $s, $params);
            if (is_wp_error($data)) { return self::step_error($id, $s, $data); }
            $items = $data['response']['checkins']['items'] ?? null;
            if (!is_array($items)) { return new WP_Error('format', 'Liste de check-ins absente. Import non terminé.', ['status' => 502]); }
            $added = 0;
            foreach ($items as $item) {
                if (empty($item['checkin_id']) || empty($item['created_at'])) { return new WP_Error('format', 'Check-in incomplet. Import interrompu pour éviter une perte silencieuse.', ['status' => 502]); }
                $added += self::put($id, $item);
            }
            $s['count'] = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}uat_checkins WHERE session_id=%s", $id));
            if ($wpdb->last_error) { throw new UAT_Storage_Exception('count_read'); }
            $next = $data['response']['pagination']['max_id'] ?? null;
            if ($items && !$next) { $ids = array_map(fn($x) => (int) $x['checkin_id'], $items); $next = (string) min($ids); }
            if (!$items) { $s['phase'] = $s['enrich'] ? 'details' : 'done'; }
            elseif ((string) $next === (string) $s['cursor'] || !$added) { return new WP_Error('pagination', 'Untappd répète une page. Progression conservée ; l’historique reste incomplet.', ['status' => 502]); }
            $s['cursor'] = $next; $s['retry_at'] = 0;
            self::save($id, $s);
            return self::response(['state' => self::public_state($s), 'items' => $items]);
        } finally { delete_option('uat_lock_' . $id); }
    }
    private static function step_error($id, $s, $e) {
        $s['retry_at'] = $e->get_error_data()['retry_at'] ?? 0;
        self::save($id, $s);
        return $e;
    }
    private static function put($id, $item) {
        global $wpdb;
        $result = $wpdb->replace($wpdb->prefix . 'uat_checkins', ['session_id' => $id, 'checkin_id' => (string) $item['checkin_id'], 'data' => wp_json_encode($item)], ['%s', '%s', '%s']);
        if ($result === false) { throw new UAT_Storage_Exception('checkin_write'); }
        return $result === 1 ? 1 : 0;
    }
    public static function erase($r) {
        global $wpdb;
        $id = self::id($r);
        if (!self::lock($id)) { return new WP_Error('busy', 'Attendez la fin de la requête en cours puis réessayez.', ['status' => 409]); }
        try {
            if ($wpdb->delete($wpdb->prefix . 'uat_checkins', ['session_id' => $id]) === false || $wpdb->delete($wpdb->prefix . 'uat_sessions', ['id' => $id]) === false) { throw new UAT_Storage_Exception('erase'); }
            return self::response(['erased' => true]);
        } finally { delete_option('uat_lock_' . $id); }
    }
    public static function share($r) {
        $id = self::id($r);
        if (!self::lock($id)) { return new WP_Error('busy', 'Attendez la fin de la requête en cours puis réessayez.', ['status' => 409]); }
        try {
            $state = self::read($id);
            if (!$state) { return self::session_error(); }
            $username = $state['profile']['username'] ?? '';
            if ($username === '' || empty($state['count'])) {
                return new WP_Error('empty_import', 'Importez un profil avec des check-ins avant de le partager.', ['status' => 400]);
            }
            return self::response(['shared' => UAT_Admin::archive($username, self::items($id))]);
        } finally { delete_option('uat_lock_' . $id); }
    }
    public static function oauth($r) {
        if (!is_ssl()) { return new WP_Error('https', 'La connexion Untappd nécessite un site HTTPS.', ['status' => 400]); }
        $c = get_option('uat_credentials', []);
        if (empty($c['id']) || !self::unseal($c['secret'] ?? '')) { return new WP_Error('config', 'Configurez les identifiants API dans Réglages → Untappd Atlas.', ['status' => 503]); }
        $state = bin2hex(random_bytes(32)); $bind = bin2hex(random_bytes(32));
        $return = wp_validate_redirect($r->get_param('return'), home_url('/'));
        // Enforce the current site's host even when other redirect hosts are allowed by plugins.
        if (wp_parse_url($return, PHP_URL_HOST) !== wp_parse_url(home_url(), PHP_URL_HOST)) { $return = home_url('/'); }
        set_transient('uat_oauth_' . $state, ['id' => self::id($r), 'bind' => hash('sha256', $bind), 'return' => $return], 600);
        setcookie('uat_oauth', $bind, ['expires' => time() + 600, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
        return self::response(['url' => add_query_arg(['client_id' => $c['id'], 'response_type' => 'code', 'redirect_url' => admin_url('admin-post.php?action=uat_callback'), 'state' => $state], 'https://untappd.com/oauth/authenticate/')]);
    }
    public static function callback() {
        $state = sanitize_text_field(wp_unslash($_GET['state'] ?? ''));
        $pending = preg_match('/^[a-f0-9]{64}$/D', $state) ? get_transient('uat_oauth_' . $state) : false;
        if (!$pending || !hash_equals($pending['bind'], hash('sha256', $_COOKIE['uat_oauth'] ?? ''))) { wp_die('Connexion expirée ou non valide. Revenez à la page et réessayez.', 'Untappd Atlas', ['response' => 403]); }
        delete_transient('uat_oauth_' . $state);
        setcookie('uat_oauth', '', ['expires' => time() - 3600, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
        $code = sanitize_text_field(wp_unslash($_GET['code'] ?? ''));
        if (!$code) { wp_safe_redirect($pending['return'] . '#uat-denied'); exit; }
        $c = get_option('uat_credentials', []);
        $res = wp_remote_get(add_query_arg(['client_id' => $c['id'], 'client_secret' => self::unseal($c['secret']), 'response_type' => 'code', 'redirect_url' => admin_url('admin-post.php?action=uat_callback'), 'code' => $code], 'https://untappd.com/oauth/authorize/'), ['timeout' => 25, 'redirection' => 0, 'user-agent' => 'UntappdAtlas/' . UAT_VERSION, 'limit_response_size' => MB_IN_BYTES]);
        $body = !is_wp_error($res) ? json_decode(wp_remote_retrieve_body($res), true) : [];
        $s = self::read($pending['id']);
        if (!$s || empty($body['access_token'])) { wp_safe_redirect($pending['return'] . '#uat-denied'); exit; }
        $s['token'] = self::seal($body['access_token']);
        $user = self::call('user/info', $s);
        if (is_wp_error($user) || empty($user['response']['user']['user_name'])) { wp_safe_redirect($pending['return'] . '#uat-denied'); exit; }
        $s['connected_username'] = sanitize_text_field($user['response']['user']['user_name']);
        self::save($pending['id'], $s);
        wp_safe_redirect($pending['return'] . '#uat-connected'); exit;
    }
}
