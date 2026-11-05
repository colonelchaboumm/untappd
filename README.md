# Untappd Atlas — plugin WordPress

Un tableau de bord français qui transforme un historique Untappd en pyramides de canettes, graphiques et statistiques. Le visiteur colle son profil, autorise éventuellement son compte ou importe un export, puis consulte et télécharge ses résultats **sur la même page**.

## Télécharger le plugin installable

**[Télécharger Untappd Atlas 1.9.0-v4 pour WordPress](https://github.com/colonelchaboumm/untappd/raw/refs/heads/main/downloads/untappd-atlas-1.9.0-v4.zip)**

Ce ZIP contient uniquement le plugin et s’installe directement dans WordPress, sans le décompresser. Depuis la version **1.2.1**, le téléchargement GitHub **Code → Download ZIP** est également installable : le dépôt possède maintenant un fichier principal d’extension à sa racine. Les deux archives chargent le même code et les mêmes ressources. Le ZIP dédié reste le téléchargement conseillé pour les mises à jour, car il conserve le dossier `untappd-atlas`.

## Installation

1. Téléverser `untappd-atlas-1.9.0-v4.zip` dans **Extensions → Ajouter une extension → Téléverser**, puis activer le plugin. WordPress affiche la version interne 1.9.0. Si elle est déjà installée, choisir **Remplacer l’extension actuelle par celle téléversée**.
2. Créer une page et ajouter un bloc **Code court** contenant :

   ```text
   [untappd_atlas]
   ```

3. Choisir une mise en page large si le thème le permet. Le plugin utilise `alignwide` et s’adapte aussi aux colonnes étroites et aux mobiles.
4. Sans accès API, importer un fichier CSV/JSON Untappd : l’analyse et les exports fonctionnent entièrement dans le navigateur.

Prérequis : WordPress 6.4+, PHP 8.1+. L’extension PHP DOM est nécessaire pour le mode public. OpenSSL est nécessaire pour enregistrer les identifiants API et les jetons OAuth. Testé sur WordPress 7.1.4 / PHP 8.4.11. Pas de compilation, de CDN, de bibliothèque JavaScript externe ou de dépendance Composer.

## Correction de l’import — version 1.7.1

Au démarrage de l’import, le plugin vérifie ses tables et tente de recréer celles qui manquent. Cela couvre notamment une mise à jour ou une copie de fichiers dont le hook d’activation n’a pas été exécuté. Un refus de création ou d’écriture produit une erreur JSON explicite. Les exceptions des routes REST du plugin sont interceptées et fournissent une référence à rechercher dans le journal PHP de l’hébergement. La ligne de diagnostic contient la référence, l’opération, le type d’exception et l’emplacement du code ; elle n’inclut ni requête SQL, ni message interne d’exception, ni jeton de session.

Une session endommagée est refusée avec un message de relance. Lors d’un échec d’enregistrement pendant l’enrichissement, le curseur sauvegardé n’avance pas et l’étape peut être reprise. Si WordPress ou l’hébergement interrompt la requête avant la réponse du plugin, le tableau de bord indique une erreur serveur et demande de consulter le journal PHP. Les erreurs fatales de mémoire, de délai d’exécution ou d’autres extensions peuvent encore nécessiter un diagnostic sur le site concerné.

Une erreur de stockage avec tables absentes a été reproduite et corrigée localement. Le message générique « erreur critique » ne permet pas à lui seul d’identifier la cause d’un autre site : en cas de persistance, transmettre la ligne `PHP Fatal error` du journal de l’hébergeur ou la nouvelle référence affichée.

Cette correction ne change pas les droits d’accès Untappd. Sans application autorisée, le bouton importe les pages publiques accessibles ; se connecter à Untappd dans un autre onglet ne transmet pas la session au serveur WordPress. La connexion officielle OAuth exige toujours les identifiants d’application. La couverture des données et des badges reste indiquée sur le rapport.

## Pyramides de canettes — édition 1.9.0-v4

La page et le PNG affichent des canettes dessinées au trait et colorées selon le style. **Une canette représente exactement un check-in importé**, noté ou non. Les filtres de date et de style déterminent les canettes affichées ; les années suivent le fuseau horaire choisi.

Depuis la version 1.8.2, les canettes adoptent une silhouette plus haute, inspirée des proportions du [format 44 cl standard de CANPACK](https://www.canpack.com/capabilities/beverage-cans/44-cl-standard/). Le corps est allongé ; le couvercle et le logo gardent leurs proportions. Le logo est recentré et les appuis, l’écartement vertical des rangées et les limites du graphique sont recalculés pour ce nouveau format visuel, sur la page comme dans le PNG.

L’édition 1.9.0-v4 dessine les canettes dans un style bande dessinée, avec des hachures, des reflets contrastés, un couvercle elliptique et la mention 44CL. Le fond du graphique reste noir par défaut. Toutes les années partagent **un seul graphique**, avec **une pyramide par année**. L’année la plus récente est centrée au premier plan. La précédente apparaît derrière à gauche, la suivante derrière à droite, puis les années continuent en alternance. Chaque plan recule et rétrécit progressivement vers un même point de fuite. Les plans arrière sont abaissés et rapprochés de l’axe central pour se superposer davantage derrière la pyramide du premier plan. Les rangées sont courbées en arc. Les canettes des bords remontent et passent derrière celles du centre, ce qui donne du relief à chaque pyramide. Les années et leurs totaux sont indiqués sur les côtés, avec un trait jusqu’à la base ; le total de l’année récente reste sous la pyramide centrale. Cette composition est reprise dans le PNG.

Les contours et les ombres de contact sont sombres par défaut (`#151515`). Les couvercles, les socles et les reflets sont clairs. Les couleurs personnalisées dans Elementor ou dans les réglages du plugin restent prioritaires.

Depuis la version 1.8.1, le logo fourni des **deux bouteilles croisées** remplace l’épi au centre des canettes. Sa transparence est conservée ; le motif est affiché en aplat dans le nouveau dessin. Il est noir par défaut ; sa couleur se règle dans **Elementor → Style → Pyramides de canettes → Canettes : logo**, avec les couleurs globales disponibles. Le PNG contient lui aussi le logo : l’image est embarquée dans le SVG, sans requête d’image externe. Le fichier source est conservé dans `untappd-atlas/assets/can-logo.png`.

Le corps adopte la couleur du style de bière ; les couvercles, languettes, contours et socles utilisent leurs couleurs dédiées. Dans **Elementor → Style → Palette des 10 styles**, les dix couleurs de base suivent le classement des styles sur tout le fichier importé, hors filtres ; les styles suivants reçoivent des mélanges de ces couleurs. La correspondance reste stable entre années et lors des changements de filtres. Un nouvel import peut modifier le classement et donc l’attribution. Un style inconnu utilise la couleur neutre configurée pour ce cas. La légende affiche tous les styles ; les classements, favoris annuels et graphiques de styles réutilisent les mêmes couleurs. Le PNG inclut la légende complète et adapte sa hauteur.

La scène remplace les panneaux annuels séparés. Sous chaque repère annuel, une barre indique la répartition des styles. Une pyramide complète est construite à partir des check-ins de l’année ; le reste prolonge son bord en conservant les appuis entre les rangées. Par exemple, 37 check-ins donnent **une seule pyramide de 37 canettes**. Les pyramides peuvent donc être incomplètes : aucune canette de remplissage n’est ajoutée.

Les check-ins sont attribués chronologiquement, du bas vers le haut et de gauche à droite. Depuis la version 1.7.2, les pyramides sont statiques : aucun clic nécessaire, aucune infobulle, aucun curseur d’aide « ? » et aucun éclaircissement au survol. Les détails sont disponibles dans l’export Excel. Certaines canettes des années du fond peuvent être masquées par celles de devant ; les totaux, tableaux et exports de données conservent toutes les évaluations. Les années sans check-in dans le filtre ne créent pas de pyramide vide.

En colonne étroite, **le graphique se fait défiler horizontalement** pour préserver la lisibilité. La zone peut recevoir le focus au clavier et se parcourir avec les flèches. Le défilement reste à l’intérieur du graphique. Le PNG reprend toute la scène sur une seule image.

Le **fond du graphique derrière les pyramides est noir par défaut**. Dans **Elementor → Style → Pyramides de canettes**, utilisez **Fond du graphique** et **Contour du graphique** pour choisir leurs couleurs séparément. Les réglages **Années du graphique** et **Totaux et repères du graphique** adaptent les légendes au fond choisi ; leurs valeurs initiales sont blanc et gris clair. Chaque réglage accepte les couleurs globales avec le globe, les couleurs locales et la transparence. Ces quatre couleurs sont propres au graphique et n’affectent pas le fond des autres cartes. Le PNG reprend le fond, le contour et les textes du widget exporté.

Dans **Elementor → Style → Pyramides de canettes**, les couleurs des canettes règlent notamment le corps si le style est inconnu, les reflets, l’ouverture, les contours, le couvercle et le socle. Le logo possède un réglage séparé. Ces couleurs peuvent être reliées aux couleurs globales avec le globe. Les titres et unités des pyramides sont modifiables dans Contenu. Le PNG reprend toutes les canettes et adapte sa hauteur au nombre d’années. Les limites de l’import public restent indiquées : les canettes représentent les données effectivement importées.

## Textes et typographie

Dans Elementor, sélectionnez le widget **Untappd Atlas**, puis ouvrez **Contenu**. Les onze sections proposent **160 textes personnalisables** : introduction, titres et descriptions du rapport, sections et graphiques, titres et descriptions de chaque compteur, badges et niveaux, filtres, boutons, repères des pyramides, pied de page et textes du PNG. Les retours à la ligne sont conservés sur la page.

Pour définir des textes communs au shortcode et à tous les widgets, utilisez **Réglages → Untappd Atlas → Textes du tableau de bord**. La priorité est : texte du widget, puis texte commun, puis valeur initiale. Un champ vide rétablit l’héritage. Les textes acceptent du texte simple ; le HTML est supprimé.

Pour retirer un titre ou une description, choisissez **Visibilité → Masquer** sous son champ. Dans Elementor, **Hériter des réglages du plugin** reprend la visibilité commune ; **Afficher** permet de réafficher ce texte sur un widget même s’il est masqué globalement. Les descriptions masquées ne laissent pas de paragraphe vide. Le PNG reprend les textes et leur visibilité. Les blocs retirés des versions précédentes restent supprimés et leurs anciens champs ne sont plus présentés comme des réglages actifs.

Certains champs acceptent des variables, indiquées sous le champ :

- Titre du rapport : `{profile}`, `{count}`, `{years}`, `{years_label}`.
- Sous-titres des cartes : `{rated}`, `{median}`, `{styles}`, `{breweries}`, `{beers}`, `{venues}` selon la carte.
- Fuseau horaire : `{timezone}`.

Exemple : `{profile} : {count} découvertes` affiche le profil et le nombre de check-ins du filtre actif. Les valeurs des statistiques restent calculées à partir des données importées. Les avis de démonstration et de couverture des données restent affichés.

Dans **Style → Typographie des textes**, six groupes permettent de choisir la police, la taille, la graisse, l’interligne, l’espacement et les réglages responsives : texte courant, titres des sections et cartes, titre principal, sous-titres, chiffres clés et boutons. Le globe permet de choisir une typographie globale Elementor. Les polices sont chargées suivant la configuration d’Elementor.

Les titres et légendes personnalisés utilisés dans l’affiche sont repris dans l’export **PNG**, avec un titre d’export dédié si souhaité. L’affiche conserve son gabarit et sa police d’export ; les textes très longs sont raccourcis pour y tenir. Les réglages de typographie Elementor pilotent la page. Le classeur Excel conserve ses libellés et tableaux de données.

## Couleurs et Elementor — depuis la version 1.1.0

Le plugin fournit un **widget Elementor natif « Untappd Atlas »**, utilisable avec Elementor gratuit. Ajoutez ce widget à votre page, puis ouvrez **Style**. Six sections donnent accès à **54 couleurs** : fonds et textes, champs et boutons, messages, pyramides, graphiques et palette des dix styles de bière.

- Cliquez sur le **globe** d’un réglage pour le relier à une couleur globale Elementor, y compris une couleur personnalisée de votre kit. Une modification de cette couleur globale s’applique aux éléments qui lui sont liés.
- Choisissez une couleur locale pour personnaliser uniquement ce widget. Plusieurs widgets peuvent avoir des palettes différentes sur la même page.
- Pour régler une base commune à tous les tableaux de bord, ouvrez **Réglages → Untappd Atlas → Couleurs et Elementor**. Cette palette s’applique aussi au shortcode.
- L’option **Suivre automatiquement les couleurs globales Elementor** est activée par défaut : titres et boutons → Principale ; texte → Texte ; texte secondaire → Secondaire ; accent → Accent ; séries 1/2/3 → Accent/Principale/Secondaire. Les autres couleurs gardent la palette du plugin tant qu’elles ne sont pas personnalisées.
- Une couleur vide dans le widget hérite de la palette du plugin. Une couleur vide dans les réglages WordPress suit le lien automatique, ou le défaut si l’option est désactivée. Une couleur définie dans le widget est prioritaire sur la palette WordPress.
- L’export **PNG conserve les couleurs réellement affichées par le widget exporté**, y compris les couleurs globales résolues et les transparences. Le classeur Excel conserve ses tableaux de données.

L’éditeur Elementor affiche une démonstration clairement identifiée ; la page publiée affiche le formulaire d’import. Aucun jeu de données personnel n’est enregistré dans la page Elementor. Les sélecteurs de couleurs utilisent des variables CSS : leurs changements s’appliquent aussi aux graphiques déjà affichés.

Le shortcode existant continue de fonctionner. Pour disposer des 53 réglages directement dans l’onglet Style d’Elementor, utilisez le widget **Untappd Atlas**, plutôt que le widget générique **Code court**. Sans Elementor, les réglages WordPress et le shortcode restent utilisables.

Intégration testée avec **Elementor 4.3.5** sur WordPress 7.1.4 : contrôles natifs, couleurs globales, deux palettes indépendantes sur une même page et export PNG. [Documentation Elementor sur les couleurs globales](https://developers.elementor.com/docs/editor-controls/global-style/).

## Import par bouton sans API — version 1.3.0

Sans identifiants API, le visiteur colle son profil et clique sur **Créer mes statistiques**. Le serveur lit la page publique du profil, importe les check-ins visibles et complète leurs styles, ABV et IBU depuis les pages publiques des bières. Le bouton de connexion et l’option d’approfondissement API sont masqués dans ce mode. Aucun mot de passe, cookie de connexion ou jeton Untappd n’est demandé.

**Ce mode ne peut pas récupérer tout le compte.** Untappd affiche seulement une partie de l’historique aux visiteurs non connectés et réserve le catalogue complet des badges à la connexion. L’autorisation du visiteur sur WordPress ne modifie pas ces restrictions. Le rapport indique le nombre importé et le total annoncé par le profil, signale un **historique partiel**, et affiche séparément le total de badges annoncé et les badges effectivement observés. Aucun contournement de connexion, redirection vers une connexion ou CAPTCHA n’est effectué. Les noms de styles peuvent manquer si Untappd limite aussi une page de bière.

La lecture est plafonnée à 100 pages non mises en cache par heure pour le site. Les pages HTML publiques sont mises en cache pendant une heure ; les données de session restent effaçables et expirent après 24 h. Pause et reprise sont disponibles. La lecture des pages publiques dépend du format HTML et de l’accès accordé par Untappd à l’hébergeur : une modification ou un refus est signalé, sans prétendre que l’import est complet.

## Badges obtenus

Galerie des badges observés (100 premiers à l’écran), noms, images lorsque disponibles, niveau maximal observé, nombre d’obtentions connues et nombre de check-ins sans information badges. Le classement regroupe les niveaux successifs d’un même badge ; les obtentions restent détaillées dans **Badges obtenus** dans Excel. Les tableaux **Badges par jour/semaine/mois/année** suivent la date du check-in. Les champs absents ne deviennent pas zéro ; les totaux partiels sont présentés comme un minimum. Sans identifiant, les badges sont regroupés par nom.

Les formats JSON API `badges.items`, les tableaux de badges et les colonnes CSV `badges` / `badge_names` sont pris en charge. En CSV, plusieurs noms peuvent être séparés par `|` ; un tableau JSON peut aussi être placé dans la cellule. Les champs de titre, sous-titre et compteurs de badges sont personnalisables dans Elementor. Le PNG contient une synthèse textuelle des badges ; les images de badges restent dans la page et ne sont pas incorporées au PNG.

## Import API et connexion Untappd (facultatif)

**Un lien public ne suffit pas à obtenir tout l’historique sans accès API.** L’API officielle exige un Client ID et un Client Secret, ou un jeton OAuth. La connexion OAuth officielle conserve cette exigence. Le mode sans clé décrit ci-dessus lit uniquement les pages HTML publiques et ne donne pas accès au compte connecté.

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
| Pyramides | Une canette colorée selon le style par check-in importé, regroupement par année ; affichage statique sans survol ni clic |
| Styles | Classement, moyennes, évolution par jour/semaine/mois/année et style favori de chaque année |
| Notes | Histogramme, moyenne, médiane, minimum, maximum, évolution des moyennes par période |
| Bières et brasseries | Classements par check-ins, bières uniques et moyennes par groupe dans Excel |
| Photos | Check-ins avec/sans photo, données inconnues et total de photos connu |
| Textes et échanges | Textes personnels, commentaires sur les check-ins, auteurs distincts observés, commentaires par auteur, toasts connus |
| Badges | Badges distincts observés, niveaux, obtentions, images disponibles et couverture ; détails et périodes dans Excel |
| Autres | Lieux, villes dans l’historique, pays des lieux et des brasseries, types de service, degré alcoolique moyen et IBU moyen |
| Excel seulement | Série de jours actifs, plus grand intervalle entre jours actifs, listes exhaustives, commentaires identifiés et données ligne par ligne |

Filtres communs : dates de début et fin, style et fuseau horaire. Les semaines suivent ISO 8601 (lundi–dimanche). Les graphiques regroupent visuellement les séries trop longues ; l’Excel conserve chaque période. L’historique détaillé et les tableaux par période sont disponibles dans l’Excel, qui contient tous les check-ins filtrés.

### Sens des chiffres

- Un check-in peut être non noté. Les moyennes excluent les notes manquantes et les zéros retournés comme « non noté » par Untappd.
- Une donnée absente reste inconnue : elle ne devient pas artificiellement « sans photo », « zéro commentaire » ou « zéro toast ».
- Les bières/brasseries utilisent leurs identifiants lorsqu’ils existent. Sans identifiant, un regroupement par nom est utilisé ; les homonymes peuvent se confondre.
- Les doublons d’import sont éliminés par ID de check-in. Les lignes sans ID sont conservées, sans déduplication approximative.
- Les dates ISO sans fuseau sont interprétées en UTC. Les formats numériques ambigus, comme `01/02/2024`, sont refusés et les lignes ignorées sont signalées.
- Les statistiques décrivent les données importées et le filtre actif. Un export incomplet ou une réponse API tronquée ne permet pas de reconstituer les champs absents.

## Exports

- **PNG** : affiche de 1 800 pixels de large, dont la hauteur s’adapte au nombre d’années, avec les pyramides, les principaux graphiques, chiffres et classements.
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

Services externes utilisés par l’import API ou la connexion demandée : `api.untappd.com` et `untappd.com/oauth/`. Les pages publiques sont lues sur `untappd.com` sans connexion ; les images de badges approuvées sont chargées depuis les domaines Untappd `assets.untappd.com`, `images.untp.beer` ou `untappd.s3.amazonaws.com`. Aucun suivi analytique ou téléversement de fichiers. Le chargement des polices sélectionnées dans le widget utilise les réglages d’Elementor.

## Développement et validation

Générer le ZIP installable et sa somme SHA-256 :

```sh
python tests/build-package.py
```

Sur une installation WordPress **locale et isolée**, vérifier l’installation du ZIP, son activation, ses ressources, son shortcode et sa désactivation :

```sh
php tests/package-install.php /chemin/vers/wordpress test-artifacts/untappd-atlas-1.9.0.zip
```

Ce test accepte aussi l’archive complète du dépôt GitHub et fonctionne avec ZipArchive ou avec le décompresseur PclZip de WordPress. Il restaure les options de plugins actifs et de tâches planifiées ; ne pas l’exécuter en production.

```sh
node --test tests/core.test.js tests/theme.test.js tests/content.test.js tests/badges.test.js tests/pyramids.test.js tests/transport.test.js
php -l untappd-atlas.php
php -l untappd-atlas/bootstrap.php
php -l untappd-atlas/includes/class-uat-api.php
php -l untappd-atlas/uninstall.php
```

Le test d’intégration se lance contre une installation WordPress **locale et isolée**, avec le plugin activé :

```sh
php tests/integration.php /chemin/vers/wordpress
```

Il remplace les réponses HTTP d’Untappd par des fixtures et vérifie les profils, le chiffrement et son intégrité, les origines, les sessions, la pagination, les détails, le quota et l’effacement. Il modifie temporairement les réglages du plugin : ne pas l’exécuter en production.

Le test `php tests/elementor.php /chemin/vers/wordpress` vérifie également les 54 couleurs, les 160 champs de texte et leur visibilité, les six groupes typographiques, les liens globaux et la priorité des textes sur une installation locale isolée avec Elementor activé. Il restaure les réglages de couleurs, de textes et de visibilité du plugin à la fin du test : ne pas l’exécuter en production.

Générer un aperçu autonome avec données fictives :

```sh
node tests/build-preview.js
```

Ouvrir `preview.html` dans un navigateur. Ce fichier n’est pas le plugin WordPress ; il sert à examiner le design et tester l’import local et les exports sans configurer de site.

**Limite de validation :** le flux REST a été testé dans WordPress avec des réponses API simulées. La connexion OAuth et les réponses du profil réel nécessitent vos identifiants d’application autorisés ; ils n’ont pas été testés avec un compte Untappd réel.

Le test `php tests/public.php /chemin/vers/wordpress` vérifie le parcours public sans clés avec des pages fictives, les restrictions d’accès et la distinction entre import partiel et historique complet.

Le test `php tests/import-errors.php /chemin/vers/wordpress` vérifie sur une base isolée temporaire la réparation des tables manquantes, les refus d’écriture et de création, la reprise, les sessions corrompues et les références de diagnostic sans données sensibles. GitHub Actions exécute ces tests d’import dans WordPress avec MySQL 8. Ne pas lancer ces scripts sur un site de production.

Test de navigateur facultatif : `node tests/browser-content.cjs` avec Node 22+ et Chrome installé (Node 20 : ajouter `--experimental-websocket`). La variable `CHROME_BIN` permet d’indiquer un autre chemin vers Chrome. Le test ouvre un profil isolé, contrôle deux widgets, l’import d’un fichier, les variables après filtrage, les textes masqués et la génération effective du PNG. Ses captures restent dans `test-artifacts/`.

Licence : GPL-2.0-or-later. Projet indépendant, sans affiliation avec Untappd.
