=== Untappd Atlas ===
Contributors: colonelchaboumm
Tags: untappd, statistics, beer, dashboard, export
Requires at least: 6.4
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 1.5.3
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Votre historique Untappd en pyramides de canettes, graphiques et statistiques, avec exports PNG et Excel.

== Description ==

Collez le shortcode [untappd_atlas] dans une page. Vos visiteurs peuvent y importer un profil avec l’API officielle, autoriser leur compte avec OAuth, ou analyser localement un export CSV/JSON.

Volume par jour/semaine ISO/mois/année, styles par période, moyennes, notes, bières et brasseries uniques, lieux, pays, services, photos, textes personnels, commentaires et auteurs observés. Les données manquantes sont distinguées des valeurs nulles.

== Installation ==

1. Téléversez le ZIP dans Extensions > Ajouter une extension > Téléverser.
2. Activez Untappd Atlas.
3. Ajoutez [untappd_atlas] dans une page avec un bloc Code court.
4. Pour l’import par lien / OAuth, configurez les clés d’application dans Réglages > Untappd Atlas et recopiez l’URL de retour dans votre application Untappd.
5. Dans Elementor, utilisez le widget Untappd Atlas et son onglet Style : 49 couleurs personnalisables, chacune reliables aux couleurs globales avec le globe. La palette générale reste disponible dans Réglages > Untappd Atlas.
6. L’onglet Contenu du widget propose 75 textes personnalisables. L’onglet Style > Typographie des textes règle les polices, tailles, graisses et espacements. Les textes communs peuvent être définis dans Réglages > Untappd Atlas.

== External services ==

Public mode fetches only unauthenticated HTML on https://untappd.com. It does not collect passwords, login cookies, or bypass sign-in restrictions. Public HTML is cached for one hour. Badge images may load from assets.untappd.com, images.untp.beer or untappd.s3.amazonaws.com.

Untappd is used only when a visitor explicitly starts a profile import or account connection. Requests to https://api.untappd.com/v4/ transmit the requested username/check-in IDs and server-side application credentials or an OAuth token. OAuth uses https://untappd.com/oauth/authenticate/ and https://untappd.com/oauth/authorize/. API access must be granted by Untappd. No scraping is performed.

Terms: https://untappd.com/terms
Privacy: https://untappd.com/privacy
API: https://untappd.com/api/docs/v4

CSV/JSON file imports and exports are processed in the visitor’s browser and are not uploaded. API imports are isolated by session, expire after 24 hours of inactivity, and are removed by hourly WP-Cron cleanup. An Erase button deletes the current API session immediately. OAuth tokens are encrypted at rest with AES-256-GCM and the WordPress authentication salt. Uninstalling deletes plugin tables, settings and transients.

== Frequently Asked Questions ==

= Peut-on tout importer avec un simple lien sans clés API ? =
Le bouton sans clés lit les pages publiques accessibles et signale l’historique partiel ; il ne donne pas accès au compte connecté ni au catalogue complet des badges. L’accès officiel nécessite des identifiants d’application autorisés par Untappd, même pour un profil public. Utilisez un export CSV/JSON si cet accès n’est pas disponible.

= L’import peut-il être long ? =
Oui. L’API documente 25 check-ins par page et 100 appels/heure par clé ou utilisateur authentifié. Le plugin utilise un budget prudent de 95 appels/heure et permet pause et reprise. Approfondir les commentaires ajoute un appel par check-in.

= Les auteurs des commentaires sont-ils tous disponibles ? =
Pas nécessairement. Les identités peuvent être limitées à une liste partielle dans la réponse. Le tableau de bord indique alors un minimum observé. Un export sans ces champs affiche des valeurs inconnues.

== Changelog ==

= 1.5.3 =
* Volume des canettes accentué : ombre cylindrique, reflet principal et centre coloré.
* Couvercle embouti avec rebord épais, cuvette métallique et ombre sous la languette.
* Col et pied biseautés ; ombre métallique plus sombre par défaut, toujours personnalisable dans Elementor.
* Même relief dans le PNG, sans modifier les appuis ni le nombre de canettes.

= 1.5.2 =
* Perspective commune aux couvercles, bases et rangées : appuis alignés entre les canettes.
* Rangées peintes du bas vers le haut et petites pyramides avancées avec une échelle progressive.
* Ombres portées réservées au sol, ombres de contact fines entre les étages.
* Chevauchement des pyramides limité et cadrage calculé avec les ombres et la perspective.

= 1.5.1 =
* Panneaux agrandis, deux années par ligne et canettes plus lisibles.
* Éclairage, reflets et ombres de contact affinés, fond doux et contrastes métalliques renforcés.
* Barre de répartition des styles sous chaque année.
* PNG adapté aux nouvelles proportions, sans réduction du nombre de canettes.

= 1.5.0 =
* Canettes redessinées : épaules, étiquettes colorées, emblème de houblon, reflets et rebords métalliques.
* Couleur par style de bière, stable entre années et filtres du même import.
* Palette Elementor de dix couleurs et nuances dérivées pour les styles suivants.
* Légende complète et couleurs cohérentes dans les graphiques et le PNG.

= 1.4.1 =
* Canettes en relief avec couvercles en perspective, reflets métalliques et ombres au sol.
* Pyramides décalées et légèrement superposées, les petites devant les grandes.
* Même rendu sur la page et dans le PNG, une canette par check-in conservée.

= 1.4.0 =
* Pyramides de canettes grises à la place du disque, une canette par check-in importé.
* Regroupement par année, pyramides complètes et conservation exacte de chaque évaluation.
* Informations au survol et six couleurs de canettes personnalisables dans Elementor.
* Export PNG adapté automatiquement au nombre d’années.

= 1.3.0 =
* Import par bouton sans clé API des pages publiques accessibles, avec historique partiel clairement indiqué.
* Badges observés, niveaux, compteurs, galerie et exports Excel / PNG.
* Aucun accès aux pages réservées à la connexion ; aucun mot de passe ou cookie Untappd collecté.

= 1.2.1 =
* Installation directe de l’archive GitHub avec un fichier principal à la racine du dépôt.
* Activation, désactivation, chemins des ressources et désinstallation adaptés aux deux archives.

= 1.2.0 =
* 65 textes personnalisables : introduction, titres, sous-titres, boutons, classements, tableaux, pied de page et export PNG.
* Six groupes de typographie Elementor, avec tailles responsives et styles globaux.
* Textes communs WordPress, remplacements par widget et variables de rapport.
* Textes personnalisés échappés en HTML et repris dans l’affiche PNG.

= 1.1.0 =
* Widget Elementor natif : 52 réglages de couleurs avec couleurs globales et transparence.
* Palette générale WordPress et héritage automatique des couleurs globales Elementor.
* Couleurs des graphiques et de l’export PNG synchronisées avec chaque widget.
* Initialisation des widgets ajoutés dynamiquement dans l’éditeur et isolation des dégradés entre widgets.

= 1.0.0 =
* Première version : imports API/OAuth/CSV/JSON, tableau de bord français, disque chronologique, exports PNG et XLSX.
