<?php
defined('ABSPATH') || exit;

final class UAT_History {
    private const PAGE_SIZE = 250;
    private const BATCH_SIZE = 100;

    public static function routes(): void {
        register_rest_route('untappd-atlas/v1', '/history', [
            ['methods' => 'GET', 'permission_callback' => 'is_user_logged_in', 'callback' => [self::class, 'read']],
            ['methods' => 'POST', 'permission_callback' => 'is_user_logged_in', 'callback' => [self::class, 'save']],
            ['methods' => 'DELETE', 'permission_callback' => 'is_user_logged_in', 'callback' => [self::class, 'erase']],
        ]);
    }

    private static function table(): string {
        global $wpdb;
        return $wpdb->prefix . 'uat_history';
    }

    private static function ensure_table(): void {
        global $wpdb;
        $table = self::table();
        if ($wpdb->query("SELECT user_id,row_key,data FROM $table LIMIT 0") !== false) { return; }
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta("CREATE TABLE $table (
            user_id bigint(20) unsigned NOT NULL,
            row_key char(64) NOT NULL,
            data longtext NOT NULL,
            PRIMARY KEY  (user_id,row_key)
        ) " . $wpdb->get_charset_collate() . ';');
        if ($wpdb->query("SELECT user_id,row_key,data FROM $table LIMIT 0") === false) {
            throw new UAT_Storage_Exception('history_schema');
        }
    }

    private static function respond(callable $operation) {
        global $wpdb;
        $quiet = $wpdb->suppress_errors(true);
        try {
            self::ensure_table();
            $result = $operation(get_current_user_id(), self::table());
            if (is_wp_error($result)) { return $result; }
            $response = new WP_REST_Response($result);
            $response->header('Cache-Control', 'private, no-store');
            return $response;
        } catch (Throwable $error) {
            return new WP_Error('uat_history_storage', 'Le serveur WordPress n’a pas pu accéder à votre historique. Réessayez dans un instant.', ['status' => 503]);
        } finally {
            $wpdb->suppress_errors($quiet);
        }
    }

    public static function read(WP_REST_Request $request) {
        $after = $request->get_param('after');
        $after = is_string($after) && preg_match('/^[a-f0-9]{64}$/D', $after) ? $after : '';
        return self::respond(static function ($user, $table) use ($after) {
            global $wpdb;
            $rows = $wpdb->get_results($wpdb->prepare("SELECT row_key,data FROM $table WHERE user_id=%d AND row_key>%s ORDER BY row_key LIMIT %d",
                $user, $after, self::PAGE_SIZE), ARRAY_A);
            if ($wpdb->last_error) { throw new UAT_Storage_Exception('history_read'); }
            $items = array_map(static fn($row) => json_decode($row['data'], true), $rows);
            return ['entries' => array_values(array_filter($items)), 'next' => count($rows) === self::PAGE_SIZE ? end($rows)['row_key'] : null];
        });
    }

    private static function strings(array $row, array $fields): array {
        $result = [];
        foreach ($fields as $field) {
            $value = $row[$field] ?? '';
            $result[$field] = is_string($value) ? sanitize_textarea_field($value) : '';
        }
        return $result;
    }

    private static function clean($row): ?array {
        if (!is_array($row)) { return null; }
        $result = self::strings($row, ['id', 'date', 'beer', 'beerId', 'brewery', 'breweryId', 'style', 'shout', 'venue', 'city', 'country', 'breweryCountry', 'serving']);
        if ($result['beer'] === '' || $result['beerId'] === '' || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/D', $result['date']) || strtotime($result['date']) === false) { return null; }
        foreach (['abv', 'ibu', 'rating', 'photos', 'commentsCount', 'toasts', 'badgesCount'] as $field) {
            $value = $row[$field] ?? null;
            $result[$field] = (is_int($value) || is_float($value)) && is_finite((float) $value) && $value >= 0 ? $value : null;
        }
        if ($result['rating'] <= 0 || $result['rating'] > 5) { $result['rating'] = null; }
        foreach (['synthetic', 'commentsComplete', 'badgesComplete'] as $field) { $result[$field] = ($row[$field] ?? false) === true; }
        if (!$result['synthetic'] && $result['id'] === '') { return null; }
        $result['commenters'] = [];
        foreach ((array) ($row['commenters'] ?? []) as $comment) {
            if (is_array($comment)) { $result['commenters'][] = self::strings($comment, ['id', 'name', 'text', 'date']); }
        }
        $result['badges'] = [];
        foreach ((array) ($row['badges'] ?? []) as $badge) {
            if (!is_array($badge)) { continue; }
            $clean = self::strings($badge, ['id', 'name', 'image']);
            if ($clean['id'] === '' || $clean['name'] === '') { continue; }
            $clean['level'] = isset($badge['level']) && is_numeric($badge['level']) && $badge['level'] > 0 ? (int) $badge['level'] : null;
            $clean['earnedAt'] = is_string($badge['earnedAt'] ?? null) && strtotime($badge['earnedAt']) !== false ? $badge['earnedAt'] : null;
            $result['badges'][] = $clean;
        }
        return $result;
    }

    private static function combine(array $old, array $new): array {
        $unknown = ['style' => 'Style inconnu', 'brewery' => 'Brasserie inconnue'];
        foreach ($new as $field => $value) {
            if (($value === null || $value === '' || ($unknown[$field] ?? null) === $value) && isset($old[$field]) && $old[$field] !== '') {
                $new[$field] = $old[$field];
            }
        }
        foreach (['commenters' => 'commentsComplete', 'badges' => 'badgesComplete'] as $list => $complete) {
            if (!$new[$complete] && count($old[$list]) > count($new[$list])) {
                $new[$list] = $old[$list];
                $new[$complete] = $old[$complete];
            }
        }
        return $new;
    }

    private static function write_lock(int $user, callable $operation) {
        $key = 'uat_lock_history_' . $user;
        if (!add_option($key, time(), '', false)) {
            $timestamp = (int) get_option($key);
            if (!$timestamp || $timestamp >= time() - 120 || !delete_option($key) || !add_option($key, time(), '', false)) {
                return new WP_Error('uat_history_busy', 'Une mise à jour de votre historique est en cours. Réessayez dans un instant.', ['status' => 409]);
            }
        }
        try { return $operation(); }
        finally { delete_option($key); }
    }

    public static function save(WP_REST_Request $request) {
        if (strlen($request->get_body()) > 2 * MB_IN_BYTES) {
            return new WP_Error('uat_history_size', 'Ce lot de check-ins est trop volumineux.', ['status' => 413]);
        }
        $entries = $request->get_json_params()['entries'] ?? null;
        if (!is_array($entries) || !$entries || count($entries) > self::BATCH_SIZE) {
            return new WP_Error('uat_history_batch', 'Lot de check-ins invalide.', ['status' => 400]);
        }
        $clean = [];
        foreach ($entries as $entry) {
            $key = $entry['key'] ?? '';
            $row = self::clean($entry['row'] ?? null);
            if (!is_string($key) || strlen($key) > 2048 || $key === '' || !$row) {
                return new WP_Error('uat_history_row', 'Un check-in de ce lot est invalide.', ['status' => 400]);
            }
            $clean[] = ['key' => $row['synthetic'] ? $key : 'id:' . $row['id'], 'row' => $row];
        }
        return self::respond(static fn($user, $table) => self::write_lock($user, static function () use ($user, $table, $clean) {
            global $wpdb;
            $saved = [];
            foreach ($clean as $entry) {
                $hash = hash('sha256', $entry['key']);
                $prior = $wpdb->get_var($wpdb->prepare("SELECT data FROM $table WHERE user_id=%d AND row_key=%s", $user, $hash));
                if ($wpdb->last_error) { throw new UAT_Storage_Exception('history_previous'); }
                $old = $prior ? json_decode($prior, true) : null;
                if (is_array($old['row'] ?? null)) { $entry['row'] = self::combine($old['row'], $entry['row']); }
                if ($entry['row']['synthetic']) { $entry['row']['id'] = 'saved:' . $hash; }
                $encoded = wp_json_encode($entry);
                if ($encoded !== $prior && $wpdb->replace($table, ['user_id' => $user, 'row_key' => $hash, 'data' => $encoded], ['%d', '%s', '%s']) === false) {
                    throw new UAT_Storage_Exception('history_write');
                }
                $saved[] = $entry;
            }
            return ['entries' => $saved];
        }));
    }

    public static function erase() {
        return self::respond(static fn($user, $table) => self::write_lock($user, static function () use ($user, $table) {
            global $wpdb;
            if ($wpdb->delete($table, ['user_id' => $user], ['%d']) === false) { throw new UAT_Storage_Exception('history_erase'); }
            return ['erased' => true];
        }));
    }

    public static function delete_user(int $user): void {
        global $wpdb;
        $quiet = $wpdb->suppress_errors(true);
        try { $wpdb->delete(self::table(), ['user_id' => $user], ['%d']); }
        finally { $wpdb->suppress_errors($quiet); }
    }
}
