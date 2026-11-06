<?php
defined('ABSPATH') || exit;

final class UAT_Admin {
    private const PAGE = 'untappd-atlas-statistiques';
    private const BATCH = 250;

    public static function install(): void {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $collate = $wpdb->get_charset_collate();
        dbDelta("CREATE TABLE {$wpdb->prefix}uat_archive (
            checkin_id varchar(64) NOT NULL,
            username varchar(100) NOT NULL,
            data longtext NOT NULL,
            PRIMARY KEY  (checkin_id)
        ) $collate;");
    }

    private static function ensure_archive(): void {
        global $wpdb;
        $sql = "SELECT checkin_id,username,data FROM {$wpdb->prefix}uat_archive LIMIT 0";
        if ($wpdb->query($sql) !== false) { return; }
        self::install();
        if ($wpdb->query($sql) === false) { throw new UAT_Storage_Exception('archive_schema'); }
    }

    public static function archive(string $username, array $items): int {
        global $wpdb;
        self::ensure_archive();
        // Keep fields used by Atlas and omit session data and full profile records.
        $fields = array_flip(['checkin_id', 'created_at', 'rating_score', 'checkin_comment', 'beer', 'brewery', 'venue', 'serving_type', 'media', 'comments', 'toasts', 'badges', 'badges_partial']);
        $count = 0;
        foreach ($items as $item) {
            $id = (string) ($item['checkin_id'] ?? '');
            if ($id === '') { continue; }
            $data = array_intersect_key($item, $fields);
            // The media, comments and toasts lists can include complete account profiles.
            if (isset($item['media']['count'])) { $data['media'] = ['count' => $item['media']['count']]; }
            elseif (isset($item['media']['items']) && is_array($item['media']['items'])) { $data['media'] = ['count' => count($item['media']['items'])]; }
            if (is_array($item['toasts'] ?? null)) {
                $data['toasts'] = ['count' => $item['toasts']['count'] ?? count((array) ($item['toasts']['items'] ?? []))];
            }
            if (isset($item['comments']) && is_array($item['comments'])) {
                $comments = array_values(array_filter((array) ($item['comments']['items'] ?? (array_is_list($item['comments']) ? $item['comments'] : [])), 'is_array'));
                $data['comments'] = [
                    'count' => $item['comments']['count'] ?? count($comments),
                    'items' => array_map(static fn($c) => [
                        'user' => array_intersect_key((array) ($c['user'] ?? []), ['uid' => true, 'user_name' => true]),
                        'comment' => $c['comment'] ?? '',
                        'created_at' => $c['created_at'] ?? '',
                    ], $comments),
                ];
            }
            $data += array_intersect_key($item, array_flip(['photo_count', 'comments_count', 'toasts_count', 'badges_count']));
            if ($wpdb->replace($wpdb->prefix . 'uat_archive', ['checkin_id' => $id, 'username' => $username, 'data' => wp_json_encode($data)], ['%s', '%s', '%s']) === false) {
                throw new UAT_Storage_Exception('archive_write');
            }
            $count++;
        }
        return $count;
    }

    public static function menu(): void {
        $hook = add_management_page('Statistiques Untappd Atlas', 'Statistiques Untappd Atlas', 'manage_options', self::PAGE, [self::class, 'page']);
        if ($hook) { add_action('load-' . $hook, [self::class, 'assets']); }
    }

    public static function assets(): void {
        uat_register_assets();
        wp_enqueue_style('uat-dashboard');
        wp_enqueue_style('uat-admin', plugins_url('assets/admin.css', UAT_FILE), ['uat-dashboard'], UAT_VERSION);
        wp_enqueue_script('uat-admin', plugins_url('assets/admin.js', UAT_FILE), ['uat-dashboard'], UAT_VERSION, true);
    }

    public static function page(): void {
        if (!current_user_can('manage_options')) { wp_die('Accès réservé à l’administration.'); }
        $config = [
            'endpoint' => rest_url('untappd-atlas/v1/admin/imports'),
            'nonce' => wp_create_nonce('wp_rest'),
            'timezone' => wp_timezone_string() ?: 'UTC',
        ];
        ?>
        <div class="wrap">
            <h1>Statistiques Untappd Atlas</h1>
            <p>Ce rapport cumule les imports de profil encore disponibles et ceux que les visiteurs ont choisi de conserver. Chaque check-in est compté une seule fois.</p>
            <?php if (isset($_GET['archive-effacee'])) : ?>
                <div class="notice notice-success"><p>Les copies conservées ont été effacées.</p></div>
            <?php endif; ?>
            <div class="uat-app uat-admin" data-uat-admin="<?php echo esc_attr(wp_json_encode($config)); ?>"></div>
            <details>
                <summary>Gérer les copies conservées</summary>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                    <input type="hidden" name="action" value="uat_clear_archive">
                    <?php wp_nonce_field('uat_clear_archive'); ?>
                    <p><label><input type="checkbox" name="confirm" value="1" required> Confirmer l’effacement définitif des copies conservées</label></p>
                    <?php submit_button('Effacer les copies conservées', 'secondary'); ?>
                </form>
            </details>
        </div>
        <?php
    }

    public static function clear_archive(): void {
        global $wpdb;
        if (!current_user_can('manage_options')) { wp_die('Accès réservé à l’administration.'); }
        check_admin_referer('uat_clear_archive');
        if (($_POST['confirm'] ?? '') !== '1') { wp_die('Confirmez l’effacement des copies conservées.'); }
        $quiet = $wpdb->suppress_errors(true);
        try {
            self::ensure_archive();
            if ($wpdb->query("DELETE FROM {$wpdb->prefix}uat_archive") === false) { throw new UAT_Storage_Exception('archive_delete'); }
        } catch (Throwable $error) {
            wp_die('Impossible d’effacer les copies conservées.');
        } finally {
            $wpdb->suppress_errors($quiet);
        }
        wp_safe_redirect(add_query_arg(['page' => self::PAGE, 'archive-effacee' => '1'], admin_url('tools.php')));
        exit;
    }

    public static function routes(): void {
        register_rest_route('untappd-atlas/v1', '/admin/imports', [
            'methods' => 'GET',
            'permission_callback' => static fn() => current_user_can('manage_options'),
            'callback' => [self::class, 'imports'],
        ]);
    }

    public static function imports(WP_REST_Request $request) {
        global $wpdb;
        $archive = $request->get_param('source') === 'archive';
        $after = $request->get_param('after');
        $session = $request->get_param('session');
        $after = is_string($after) ? substr($after, 0, 64) : '';
        $session = is_string($session) ? substr($session, 0, 64) : '';
        $quiet = $wpdb->suppress_errors(true);
        try {
            if ($archive) {
                self::ensure_archive();
                $sql = $wpdb->prepare("SELECT checkin_id,username,data FROM {$wpdb->prefix}uat_archive WHERE checkin_id > %s ORDER BY checkin_id LIMIT %d", $after, self::BATCH);
            } else {
                $sql = $wpdb->prepare(
                    "SELECT c.session_id,c.checkin_id,c.data,s.data AS state FROM {$wpdb->prefix}uat_checkins c
                    JOIN {$wpdb->prefix}uat_sessions s ON s.id=c.session_id
                    LEFT JOIN {$wpdb->options} l ON l.option_name=CONCAT('uat_lock_', c.session_id) AND l.option_value>%s
                    WHERE s.expires>%d AND l.option_id IS NULL AND (c.session_id>%s OR (c.session_id=%s AND c.checkin_id>%s))
                    ORDER BY c.session_id,c.checkin_id LIMIT %d",
                    (string) (time() - 90), time(), $session, $session, $after, self::BATCH
                );
            }
            $rows = $wpdb->get_results($sql, ARRAY_A);
            if ($wpdb->last_error) { throw new UAT_Storage_Exception('admin_read'); }
            $last = end($rows);
            $records = [];
            foreach ($rows as $row) {
                $item = json_decode($row['data'], true);
                if (!is_array($item)) { continue; }
                $state = $archive ? [] : json_decode($row['state'], true);
                $profile = $row['username'] ?? $state['profile']['username'] ?? $state['username'] ?? '';
                $records[] = ['profile' => sanitize_text_field($profile), 'item' => $item];
            }
            $response = new WP_REST_Response([
                'records' => $records,
                'next' => count($rows) === self::BATCH ? ['after' => $last['checkin_id'], 'session' => $last['session_id'] ?? ''] : null,
            ]);
            $response->header('Cache-Control', 'no-store, private');
            return $response;
        } catch (Throwable $error) {
            return new WP_Error('uat_admin_read', 'Impossible de lire les imports Untappd Atlas dans la base WordPress.', ['status' => 503]);
        } finally {
            $wpdb->suppress_errors($quiet);
        }
    }
}
