# LYZa Gestion

Outils internes de LYZa (Léo Yecora-Zorzano, hydrogéologue, Manche) : **devis**,
**factures** et **avis hydrogéologiques sommaires**, avec impression en PDF et
export Word. Une seule page web, protégée par mot de passe, publiée sur GitHub
Pages : `https://lyza-environnement.github.io/LYZa-Gestion/`.

Les documents reprennent la trame et le style des documents LYZa existants :
Verdana, titres numérotés en capitales vertes, tableaux encadrés, pied de page
légal sur chaque page.

## Ce que fait l'outil

**Devis**
- Catalogue de prestations, modifiable dans l'onglet Catalogue. Prix de départ
  : business plan forages (coupe géologique prévisionnelle 150 €, rapport de
  fin de travaux 300 €, déclaration loi sur l'eau 600 €, code minier 80 €,
  cas par cas 250 €, DUPLOS 40 €, accompagnement à la certification 1 010 €)
  et missions déjà facturées (prélèvement de sol et analyses, avis d'urgence
  à 76 € le site).
- Ensembles prêts à l'emploi : forage agricole avant ou après 2028, forage de
  50 m et plus, prélèvement de sol + 3 analyses.
- Les sections *Objet*, *Prestations incluses*, *Hypothèses et limites* et
  *Délai d'exécution* se composent depuis les prestations choisies, puis
  restent modifiables (une ligne = une puce, deux espaces = une sous-puce,
  `**texte**` = gras).
- Remise en %, numéro `AAAAMMJJ`, statut, encadré de signature pour le
  client, transformation en facture en un clic.

**Factures**
- Numéro `AAAAMMJJ_CODECLIENT` (ex. `20260713_DDPP50`), contrôle de la
  chronologie et des doublons.
- Client professionnel, particulier ou administration : les conditions de
  paiement et les mentions s'adaptent (pénalités de retard et indemnité de
  40 € ; mandat administratif, n° d'engagement, code service et Chorus Pro
  pour les clients publics). Champ SIREN du client, obligatoire sur les
  factures des micro-entreprises à partir du 1er septembre 2027.
- Tableau de synthèse des avis émis, RIB avec la référence à rappeler, suivi
  des paiements (encaissé, en attente, en retard).

**Avis sommaires**
- Modèle « enfouissement d'urgence de cadavres d'animaux » (repris de l'avis
  existant) et modèle libre.
- Identification de la demande, cadre et limites (avec ou sans visite),
  sources consultées, figure de localisation importée et réduite
  automatiquement, liens directs Géoportail et InfoTerre à partir des
  coordonnées, tableau d'analyse, prescriptions, avis favorable / sous
  réserves / défavorable.
- Les avis « à facturer » s'importent dans une facture, qui en déduit la
  quantité et note sur chaque avis le numéro de la facture.

**Analyses de laboratoire** (onglet Analyses)
- Import du catalogue du laboratoire : directement le classeur Excel envoyé
  par le laboratoire (`.xlsx`, feuille « Import à utiliser »), ou un fichier
  `.json` déjà extrait. Sont retenues les analyses de **sols**, d'**eaux peu
  chargées** et d'**eaux chargées**, avec leur délai standard et, quand
  l'annexe technique les donne, les paramètres de chaque pack ; plus les frais
  du laboratoire (prise en charge, flaconnage, élimination, collecte).
- **Prix de vente = coût laboratoire × (1 + marge) ÷ (1 − charges)**, arrondi à
  l'euro supérieur. Par défaut : charges 28 % (micro-BNC : 25,6 % de
  cotisations + 0,2 % de formation professionnelle + 2,2 % de versement
  libératoire), marge nette 20 %. Les deux se règlent dans l'onglet. Exemple :
  un pack à 52,10 € est vendu 87 € HT et laisse 10,54 € une fois les charges
  et le laboratoire payés. Revendre une analyse 30 % au-dessus du prix du
  laboratoire, sans tenir compte des charges, fait perdre de l'argent.
- Recherche multi-mots, sans accents, qui comprend les abréviations (HCT,
  HAP, BTEX, COHV, PCB, « 8 métaux » pour arsenic, plomb…, PFAS, POC/POP…),
  filtrable par matrice.
- Dans un devis ou une facture, **« Rechercher une analyse »** ouvre la même
  recherche : choisir le nombre d'échantillons, puis « Ajouter ». Les frais de
  laboratoire s'ajoutent une fois (par échantillon et par envoi), et le nombre
  d'échantillons facturé suit les analyses. Les sections du devis (prestations,
  hypothèses, délai du laboratoire) se complètent seules. Sous le total, un
  indicateur montre ce qui reste sur les analyses après charges et coût du
  laboratoire.

Le catalogue du laboratoire contient des **prix d'achat négociés** : il n'est
pas dans ce dépôt public. Il reste dans le navigateur (et dans les
sauvegardes), à importer une fois par appareil.

**Sorties** : impression / PDF depuis le navigateur (le bouton ou Ctrl+P) et
export Word `.docx` (styles, puces, tableaux, images, pied de page numéroté),
produit sans bibliothèque. Les deux sorties partent de la même description du
document (`src/js/05-modele.js`), elles restent donc identiques.

## Où sont les données ?

Tout reste **dans le navigateur**, sur l'appareil utilisé (IndexedDB) :
aucun serveur, aucune donnée client dans ce dépôt. Conséquences :

- exporter régulièrement une **sauvegarde** (Paramètres → Exporter une
  sauvegarde) ; c'est aussi elle qui permet de passer d'un ordinateur à
  l'autre (Importer une sauvegarde) ;
- vider les données du site dans le navigateur efface les documents ;
- les sauvegardes contiennent les clients, les factures et le RIB : ne pas
  les déposer dans ce dépôt (le `.gitignore` les exclut).

Les coordonnées bancaires et la signature se saisissent dans Paramètres. Le
catalogue du laboratoire s'importe dans l'onglet Analyses.

## Protection par mot de passe

Le dépôt et la page publiée sont publics. Un simple formulaire de mot de passe
en JavaScript ne protégerait rien : `scripts/build.mjs` assemble l'outil en une
seule page puis la **chiffre** (AES-256-GCM, clé dérivée du mot de passe par
PBKDF2-SHA256, 600 000 itérations). La page publiée ne contient que le
formulaire et le contenu chiffré, déchiffré dans le navigateur. « Rester
déverrouillé dans cet onglet » garde la clé jusqu'à la fermeture de l'onglet ;
le bouton Verrouiller l'oublie.

Limite à connaître : **le code et le catalogue de prix**
(`src/js/03-catalogue.js`) sont lisibles dans ce dépôt public. Le mot de passe
protège l'usage de l'outil en ligne et le RIB injecté, pas le code. Les prix
modifiés dans l'onglet Catalogue restent, eux, dans le navigateur.

## Mise en service (une fois)

1. **Secrets** : Settings → Secrets and variables → Actions → New repository
   secret.

   | Secret | Rôle |
   | --- | --- |
   | `LYZA_OUTILS_MDP` | Mot de passe (obligatoire). Une phrase de passe de 4 mots ou plus. Sans lui, la page publiée indique seulement « non configuré ». |
   | `LYZA_IBAN`, `LYZA_BIC`, `LYZA_BANQUE`, `LYZA_TITULAIRE` | Facultatifs : pré-remplissent le RIB des factures, uniquement dans la page chiffrée. |

2. **Pages** : Settings → Pages → Build and deployment → Source =
   **GitHub Actions**.
3. Lancer le déploiement : onglet Actions → *Déploiement GitHub Pages* → Run
   workflow (il se relance aussi à chaque push sur `main`).

Changer le mot de passe = modifier le secret, puis relancer le workflow.

## Travailler en local

Node 20 ou plus, aucune dépendance à installer.

```bash
npm run dev          # sert src/ sur http://localhost:8080/ (sans mot de passe)
npm run build        # page chiffrée dans dist/ (LYZA_OUTILS_MDP=… npm run build)
npm run build:clair  # page assemblée en clair dans dist/, pour essai : ne pas publier
npm run preview      # sert dist/ sur http://localhost:8080/
```

## Organisation

```
src/
  index.html          coquille de la page
  outils.css          interface + mise en page A4 des documents (écran et impression)
  logo-lyza.png
  js/01-utils.js      fonctions communes (DOM, nombres, dates, images)
  js/02-config.js     identité, mentions, textes types des avis
  js/03-catalogue.js  prestations et prix de départ
  js/04-stockage.js   IndexedDB, sauvegarde / restauration
  js/05-modele.js     calculs et description des documents (devis, facture, avis)
  js/06-rendu-html.js aperçu et impression
  js/07-docx.js       export Word (ZIP + WordprocessingML)
  js/08-analyses.js   analyses de laboratoire : import du catalogue, prix, recherche
  js/09-app.js        interface
scripts/
  build.mjs           assemblage + chiffrement
  serveur.mjs         serveur local
.github/workflows/deploy.yml
```

La plaquette commerciale et la plateforme de données environnementales sont
dans le dépôt du site : [LYZa-Environnement/LYZa](https://github.com/LYZa-Environnement/LYZa).
