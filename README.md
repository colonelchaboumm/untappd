# Untappd Atlas — plugin WordPress

Un tableau de bord français qui transforme un historique Untappd en disque chronologique, graphiques et statistiques. Le visiteur colle son profil, autorise éventuellement son compte ou importe un export, puis consulte et télécharge ses résultats **sur la même page**.

## Installation

1. Téléverser `untappd-atlas-1.0.0.zip` dans **Extensions → Ajouter une extension → Téléverser**, puis activer le plugin.
2. Créer une page et ajouter un bloc **Code court** contenant :

   ```text
   [untappd_atlas]
   ```

3. Choisir une mise en page large si le thème le permet. Le plugin utilise `alignwide` et s’adapte aussi aux colonnes étroites et aux mobiles.
4. Sans accès API, importer un fichier CSV/JSON Untappd : l’analyse et les exports fonctionnent entièrement dans le navigateur.

Prérequis : WordPress 6.4+, PHP 8.1+. OpenSSL est nécessaire pour enregistrer les identifiants API et les jetons OAuth. Testé sur WordPress 7.1.4 / PHP 8.4.11. Pas de compilation, de CDN, de bibliothèque JavaScript externe ou de dépendance Composer.

## Import automatique et connexion Untappd

**Un lien public ne suffit pas à obtenir tout l’historique sans accès API.** L’API officielle exige un Client ID et un Client Secret, ou un jeton OAuth. Le plugin ne contourne pas cette exigence et ne récupère pas les pages par scraping.

1. Obtenir des identifiants d’application autorisés par Untappd. La disponibilité et les conditions de cet accès dépendent d’Untappd.
2. Renseigner le **Client ID** et le **Client Secret** dans **Réglages → Untappd Atlas**.
3. Copier l’URL de retour indiquée par le plugin dans les paramètres de l’application Untappd. Exemple : `https://monsite.fr/wp-admin/admin-post.php?action=uat_callback`.
4. Le visiteur colle `https://untappd.com/user/Colonelchaboum` ou un autre profil accessible, puis lance l’import. Il peut aussi utiliser **Connecter Untappd** pour autoriser son compte. OAuth nécessite HTTPS.
5. Les pages sont importées progressivement, avec pause et reprise. Fermer la page suspend l’import ; revenir dans le même onglet permet de le reprendre pendant la durée de vie de la session.

La documentation officielle indique **25 check-ins par page et 100 appels par heure** par clé, ou par utilisateur authentifié. Le plugin réserve un budget prudent de 95 appels par heure et tient compte de l’en-tête de quota restant. Un historique volumineux peut donc nécessiter plusieurs heures ; la progression n’est pas présentée comme complète avant la fin de la pagination.

L’option **Approfondir les commentaires et les toasts** effectue ensuite un appel de détail par check-in. Elle augmente fortement la durée d’import. Les identités de commentateurs peuvent rester partielles si l’API ne fournit pas la liste complète ; le résultat indique alors un **minimum observé**.

Documentation : [API et OAuth Untappd](https://untappd.com/api/docs/v4).

## Statistiques disponibles

| Domaine | Résultats |
| --- | --- |
| Vue d’ensemble | Check-ins, notés/non notés, bières uniques, brasseries identifiées, bières et brasseries avec une note |
| Temps | Nombre par jour, semaine ISO, mois et année ; jours actifs ; moyenne par jour actif et calendaire ; premier et dernier check-in ; jour le plus actif |
| Disque | Un cercle par jour, angle selon l’heure, couleur selon le style ; chronologie du centre vers l’extérieur |
| Styles | Classement, moyennes, évolution par jour/semaine/mois/année et style favori de chaque année |
| Notes | Histogramme, moyenne, médiane, minimum, maximum, évolution des moyennes par période |
| Bières et brasseries | Classements par check-ins, bières uniques et moyennes par groupe dans Excel |
| Photos | Check-ins avec/sans photo, données inconnues et total de photos connu |
| Textes et échanges | Textes personnels, commentaires sur les check-ins, auteurs distincts observés, commentaires par auteur, toasts connus |
| Autres | Lieux, villes dans l’historique, pays des lieux et des brasseries, types de service, degré alcoolique moyen et IBU moyen |
| Excel seulement | Série de jours actifs, plus grand intervalle entre jours actifs, listes exhaustives, commentaires identifiés et données ligne par ligne |

Filtres communs : dates de début et fin, style et fuseau horaire. Les semaines suivent ISO 8601 (lundi–dimanche). Les graphiques regroupent visuellement les séries trop longues ; l’Excel conserve chaque période. L’historique à l’écran est limité à 500 lignes ; l’Excel contient tous les check-ins filtrés.

### Sens des chiffres

- Un check-in peut être non noté. Les moyennes excluent les notes manquantes et les zéros retournés comme « non noté » par Untappd.
- Une donnée absente reste inconnue : elle ne devient pas artificiellement « sans photo », « zéro commentaire » ou « zéro toast ».
- Les bières/brasseries utilisent leurs identifiants lorsqu’ils existent. Sans identifiant, un regroupement par nom est utilisé ; les homonymes peuvent se confondre.
- Les doublons d’import sont éliminés par ID de check-in. Les lignes sans ID sont conservées, sans déduplication approximative.
- Les dates ISO sans fuseau sont interprétées en UTC. Les formats numériques ambigus, comme `01/02/2024`, sont refusés et les lignes ignorées sont signalées.
- Les statistiques décrivent les données importées et le filtre actif. Un export incomplet ou une réponse API tronquée ne permet pas de reconstituer les champs absents.

## Exports

- **PNG** : affiche de 1 800 × 3 410 pixels, inspirée du disque de référence, avec les principaux graphiques, chiffres et classements.
- **Excel `.xlsx`** : véritable classeur OpenXML à **21 onglets**, sans dépendance externe : synthèse, quatre granularités temporelles, styles par granularité, classements, notes, heures, auteurs, commentaires observés et tous les check-ins filtrés. Les noms et textes sont enregistrés comme chaînes, jamais comme formules.
- Les exports suivent les filtres actifs. La démonstration est marquée **DEMO** dans le nom de fichier et dans le rapport.

## Confidentialité

- Les fichiers CSV/JSON restent dans le navigateur et ne sont pas téléversés.
- Les imports API utilisent un jeton de session aléatoire de 256 bits, stocké dans `sessionStorage`. Aucun historique personnel n’est intégré au HTML public ou au cache de page.
- Les données de chaque session sont séparées dans deux tables WordPress. Les réponses REST personnelles envoient `Cache-Control: no-store, private` ; les routes doivent être exclues de tout cache qui ignorerait cet en-tête.
- Le Client Secret et les jetons OAuth sont chiffrés au repos en AES-256-GCM avec une clé dérivée du sel d’authentification WordPress. Aucun secret n’est envoyé au navigateur. Changer les sels WordPress invalide les secrets déjà enregistrés.
- Les sessions expirent après **24 h d’inactivité**. WP-Cron supprime les sessions expirées chaque heure ; un site sans trafic doit exécuter WP-Cron régulièrement. Le bouton **Effacer** supprime immédiatement la session et ses données. Il efface aussi les données affichées du navigateur.
- OAuth utilise un état aléatoire à usage unique, lié à un cookie HttpOnly/Secure/SameSite=Lax, valable dix minutes.
- La désinstallation supprime tables, réglages et transients du plugin. Désactiver le plugin conserve les données jusqu’à leur suppression ou à sa réactivation et au nettoyage.

Services externes utilisés uniquement pour l’import API ou la connexion demandée : `api.untappd.com` et `untappd.com/oauth/`. Aucun suivi analytique, police distante ou collecte de fichiers.

## Développement et validation

```sh
node --test tests/core.test.js
php -l untappd-atlas/untappd-atlas.php
php -l untappd-atlas/includes/class-uat-api.php
php -l untappd-atlas/uninstall.php
```

Le test d’intégration se lance contre une installation WordPress **locale et isolée**, avec le plugin activé :

```sh
php tests/integration.php /chemin/vers/wordpress
```

Il remplace les réponses HTTP d’Untappd par des fixtures et vérifie les profils, le chiffrement et son intégrité, les origines, les sessions, la pagination, les détails, le quota et l’effacement. Il modifie temporairement les réglages du plugin : ne pas l’exécuter en production.

Générer un aperçu autonome avec données fictives :

```sh
node tests/build-preview.js
```

Ouvrir `preview.html` dans un navigateur. Ce fichier n’est pas le plugin WordPress ; il sert à examiner le design et tester l’import local et les exports sans configurer de site.

**Limite de validation :** le flux REST a été testé dans WordPress avec des réponses API simulées. La connexion OAuth et les réponses du profil réel nécessitent vos identifiants d’application autorisés ; ils n’ont pas été testés avec un compte Untappd réel.

Licence : GPL-2.0-or-later. Projet indépendant, sans affiliation avec Untappd.
