=== Untappd Atlas ===
Contributors: colonelchaboumm
Tags: untappd, statistics, beer, dashboard, export
Requires at least: 6.4
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Votre historique Untappd en disque chronologique, graphiques et statistiques, avec exports PNG et Excel.

== Description ==

Collez le shortcode [untappd_atlas] dans une page. Vos visiteurs peuvent y importer un profil avec l’API officielle, autoriser leur compte avec OAuth, ou analyser localement un export CSV/JSON.

Volume par jour/semaine ISO/mois/année, styles par période, moyennes, notes, bières et brasseries uniques, lieux, pays, services, photos, textes personnels, commentaires et auteurs observés. Les données manquantes sont distinguées des valeurs nulles.

== Installation ==

1. Téléversez le ZIP dans Extensions > Ajouter une extension > Téléverser.
2. Activez Untappd Atlas.
3. Ajoutez [untappd_atlas] dans une page avec un bloc Code court.
4. Pour l’import par lien / OAuth, configurez les clés d’application dans Réglages > Untappd Atlas et recopiez l’URL de retour dans votre application Untappd.

== External services ==

Untappd is used only when a visitor explicitly starts a profile import or account connection. Requests to https://api.untappd.com/v4/ transmit the requested username/check-in IDs and server-side application credentials or an OAuth token. OAuth uses https://untappd.com/oauth/authenticate/ and https://untappd.com/oauth/authorize/. API access must be granted by Untappd. No scraping is performed.

Terms: https://untappd.com/terms
Privacy: https://untappd.com/privacy
API: https://untappd.com/api/docs/v4

CSV/JSON file imports and exports are processed in the visitor’s browser and are not uploaded. API imports are isolated by session, expire after 24 hours of inactivity, and are removed by hourly WP-Cron cleanup. An Erase button deletes the current API session immediately. OAuth tokens are encrypted at rest with AES-256-GCM and the WordPress authentication salt. Uninstalling deletes plugin tables, settings and transients.

== Frequently Asked Questions ==

= Peut-on tout importer avec un simple lien sans clés API ? =
Non. L’accès officiel nécessite des identifiants d’application autorisés par Untappd, même pour un profil public. Utilisez un export CSV/JSON si cet accès n’est pas disponible.

= L’import peut-il être long ? =
Oui. L’API documente 25 check-ins par page et 100 appels/heure par clé ou utilisateur authentifié. Le plugin utilise un budget prudent de 95 appels/heure et permet pause et reprise. Approfondir les commentaires ajoute un appel par check-in.

= Les auteurs des commentaires sont-ils tous disponibles ? =
Pas nécessairement. Les identités peuvent être limitées à une liste partielle dans la réponse. Le tableau de bord indique alors un minimum observé. Un export sans ces champs affiche des valeurs inconnues.

== Changelog ==

= 1.0.0 =
* Première version : imports API/OAuth/CSV/JSON, tableau de bord français, disque chronologique, exports PNG et XLSX.
