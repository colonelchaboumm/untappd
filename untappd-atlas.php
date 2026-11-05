<?php
/**
 * Plugin Name: Untappd Atlas
 * Description: Statistiques Untappd, pyramides de canettes et exports PNG / Excel. Shortcode : [untappd_atlas].
 * Version: 1.10.0
 * Requires at least: 6.4
 * Requires PHP: 8.1
 * Author: Colonelchaboumm
 * License: GPL-2.0-or-later
 * Text Domain: untappd-atlas
 */
defined('ABSPATH') || exit;
if (defined('UAT_VERSION')) { return; }

// WordPress must find a plugin header at the root of GitHub's source archive.
define('UAT_MAIN_FILE', __FILE__);
$bootstrap = __DIR__ . '/untappd-atlas/bootstrap.php';
if (!is_file($bootstrap)) { $bootstrap = __DIR__ . '/bootstrap.php'; }
require_once $bootstrap;
