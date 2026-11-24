/*
 * LYZa Gestion — analyses de laboratoire (eaux et sols).
 *
 * Le catalogue du laboratoire (prix d'achat négociés) n'est PAS dans ce dépôt
 * public : il s'importe dans l'onglet Analyses, directement depuis le classeur
 * Excel envoyé par le laboratoire (.xlsx) ou depuis un fichier JSON déjà
 * extrait, puis reste dans le navigateur comme le reste des données.
 *
 * Prix de vente = coût laboratoire × (1 + marge) ÷ (1 − charges), arrondi à
 * l'euro supérieur. Les charges (URSSAF + versement libératoire de l'impôt,
 * 28 % en micro-BNC) sont prélevées sur tout le chiffre d'affaires, analyses
 * comprises : sans ce calcul, une analyse revendue 30 % au-dessus du prix du
 * laboratoire fait perdre de l'argent.
 */
;(() => {
  const G = typeof window !== 'undefined' ? window : globalThis
  const L = (G.LYZA = G.LYZA || {})

  const MATRICES = {
    sol: 'Sol',
    epc: 'Eau peu chargée',
    ec: 'Eau chargée',
    frais: 'Frais de laboratoire',
  }
  // Sections du classeur retenues (les sédiments, boues et enrobés sont ignorés).
  const SECTIONS = { sols: 'sol', 'eaux peu chargees': 'epc', 'eaux chargees': 'ec' }

  const TARIF_DEFAUT = { charges: 28, marge: 20, arrondi: 1 }

  // Codes des frais du laboratoire regroupés en deux lignes de devis.
  const FRAIS = {
    echantillon: { codes: ['ZSFLA', 'ZSREC'], defaut: 9.5 },
    envoi: { codes: ['LSA4K', 'LS09V'], defaut: 7.2 },
  }

  // Abréviations courantes : ajoutées à l'index pour que « arsenic » trouve
  // les packs « 8 métaux », « hydrocarbures » trouve « HCT », etc.
  const DEVELOPPEMENTS = [
    [/\bhct\b|c10.?c40|c5.?c10/i, 'hydrocarbures totaux indice hydrocarbures'],
    [/\bhap\b/i, 'hydrocarbures aromatiques polycycliques naphtalene benzo pyrene'],
    [/\bbtex\b/i, 'benzene toluene ethylbenzene xylenes aromatiques volatils'],
    [/\bcohv\b/i, 'composes organo halogenes volatils solvants chlores trichloroethylene tetrachloroethylene chlorure de vinyle'],
    [/\bpcb\b/i, 'polychlorobiphenyles'],
    [/8 m[ée]t|m[ée]taux toxiques|metox/i, 'metaux lourds etm arsenic cadmium chrome cuivre mercure nickel plomb zinc'],
    [/12 m[ée]t/i, 'metaux lourds etm antimoine baryum molybdene selenium'],
    [/\bpo[cp]\b|pesticid|organo ?chlor|organo ?phosph/i, 'pesticides phytosanitaires'],
    [/glyphosate/i, 'pesticides herbicide ampa'],
    [/pfas/i, 'polyfluoroalkyles perfluores composes emergents'],
    [/lixi|isdi|inerte/i, 'lixiviation eluat acceptation installation de stockage dechets inertes isdi'],
    [/\bdco\b/i, 'demande chimique en oxygene'],
    [/\bdbo/i, 'demande biochimique en oxygene'],
    [/\bmes\b/i, 'matieres en suspension'],
    [/\bnh4\b|ammonium/i, 'azote ammoniacal'],
    [/\bno3\b|nitrate/i, 'azote nitrates'],
    [/\bcot\b/i, 'carbone organique total'],
    [/pollutest/i, 'screening large balayage'],
    [/\bfiltration\b|filtre/i, 'filtration eaux souterraines'],
  ]

  // Composition des familles d'analyses courantes. Elle sert quand l'annexe
  // technique du laboratoire ne détaille pas un pack : la composition est
  // alors déduite de l'outil « Recherche PACK » du classeur ou de l'intitulé.
  const GROUPES = {
    metaux8: {
      libelle: '8 métaux',
      parametres: ['Arsenic (As)', 'Cadmium (Cd)', 'Chrome (Cr)', 'Cuivre (Cu)', 'Mercure (Hg)', 'Nickel (Ni)', 'Plomb (Pb)', 'Zinc (Zn)'],
    },
    metaux12: {
      libelle: '12 métaux',
      parametres: [
        'Antimoine (Sb)', 'Arsenic (As)', 'Baryum (Ba)', 'Cadmium (Cd)', 'Chrome (Cr)', 'Cuivre (Cu)',
        'Mercure (Hg)', 'Molybdène (Mo)', 'Nickel (Ni)', 'Plomb (Pb)', 'Sélénium (Se)', 'Zinc (Zn)',
      ],
    },
    hap16: {
      libelle: 'HAP (16)',
      parametres: [
        'Naphtalène', 'Acénaphtylène', 'Acénaphtène', 'Fluorène', 'Phénanthrène', 'Anthracène', 'Fluoranthène', 'Pyrène',
        'Benzo(a)anthracène', 'Chrysène', 'Benzo(b)fluoranthène', 'Benzo(k)fluoranthène', 'Benzo(a)pyrène',
        'Dibenzo(a,h)anthracène', 'Benzo(ghi)pérylène', 'Indéno(1,2,3-cd)pyrène',
      ],
    },
    btex: { libelle: 'BTEX', parametres: ['Benzène', 'Toluène', 'Éthylbenzène', 'm+p-Xylène', 'o-Xylène'] },
    cohv: {
      libelle: 'COHV',
      parametres: [
        'Chlorure de vinyle', '1,1-Dichloroéthylène', 'Dichlorométhane', 'Trans-1,2-dichloroéthylène', '1,1-Dichloroéthane',
        'cis-1,2-Dichloroéthylène', 'Chloroforme', '1,1,1-Trichloroéthane', 'Tétrachlorométhane', '1,2-Dichloroéthane',
        'Trichloroéthylène', '1,1,2-Trichloroéthane', 'Tétrachloroéthylène', '1,2-Dibromoéthane', 'Bromoforme',
        'Dibromométhane', 'Bromochlorométhane', 'Bromodichlorométhane', 'Dibromochlorométhane',
      ],
    },
    cohvMacaoh: { libelle: 'COHV (liste MACAOH)', parametres: ['COHV liste MACAOH'] },
    pcb7: { libelle: 'PCB (7)', parametres: ['PCB 28', 'PCB 52', 'PCB 101', 'PCB 118', 'PCB 138', 'PCB 153', 'PCB 180'] },
    hct1040: { libelle: 'HCT C10-C40', parametres: ['Indice hydrocarbures (C10-C40)', 'Fractions C10 à C40'] },
    hct510: { libelle: 'HCT C5-C10', parametres: ['Hydrocarbures volatils (C5-C10)'] },
    naphtalene: { libelle: 'Naphtalène', parametres: ['Naphtalène'] },
    mtbe: { libelle: 'MTBE', parametres: ['Méthyl-tertio-butyléther (MTBE)'] },
    etbe: { libelle: 'ETBE', parametres: ['Éthyl-tertio-butyléther (ETBE)'] },
    azote: { libelle: 'Azote global', parametres: ['Azote Kjeldahl (NTK)', 'Nitrites (NO2)', 'Nitrates (NO3)'] },
    dcodbo: { libelle: 'DCO / DBO5', parametres: ['Demande chimique en oxygène (DCO)', 'Demande biochimique en oxygène (DBO5)'] },
    isdi: {
      libelle: 'Acceptation en ISDI (arrêté du 12/12/2014)',
      parametres: [
        'Lixiviation (éluat)', 'Chlorures (éluat)', 'Fluorures (éluat)', 'Sulfates (éluat)', 'Indice phénol (éluat)',
        'COT sur éluat', 'Fraction soluble', 'COT sur brut',
      ],
    },
  }

  // Intitulé -> familles. Les packs « 12 métaux » ne sont pas comptés aussi en « 8 métaux ».
  const DETECTION = [
    ['metaux12', /\b12\s*(m[ée]t|mtx)/i],
    ['metaux8', /\b8\s*(m[ée]t|mtx)/i],
    ['hap16', /\bhap|\b1[56]\s*hap/i],
    ['btex', /\bbtex\b/i],
    ['cohvMacaoh', /macaoh/i],
    ['cohv', /\bcohv\b/i],
    ['pcb7', /\bpcb\b/i],
    ['hct1040', /\bhct\b|c10\s*-?\s*c40|hydrocarbures totaux/i],
    ['hct510', /c5\s*-?\s*c10|>\s*(me)?c5|c5\s*-\s*c40|\(>c5/i],
    ['naphtalene', /naphtal[eè]ne|\+\s*n\b/i],
    ['mtbe', /\bmtbe\b/i],
    ['etbe', /\betbe\b/i],
    ['azote', /azote global|\bntk\b/i],
    ['dcodbo', /dco\s*\/\s*dbo/i],
    ['isdi', /lixitest|isdi|12\/12\/2014/i],
  ]

  // Colonnes de l'outil « Recherche PACK » du classeur -> familles.
  const COLONNES_PACK = [
    [/^hct c5/, 'hct510'],
    [/^hct c10/, 'hct1040'],
    [/^btex/, 'btex'],
    [/^cohv macaoh/, 'cohvMacaoh'],
    [/^cohv/, 'cohv'],
    [/^8 metaux/, 'metaux8'],
    [/^hap/, 'hap16'],
    [/^napht/, 'naphtalene'],
    [/^pcb/, 'pcb7'],
    [/^mtbe/, 'mtbe'],
    [/^etbe/, 'etbe'],
  ]

  const ESTPACK = /pack|bilan|paquet|package|lixitest|\+|pas s4/i

  /** Familles d'un pack d'après son intitulé (et sa description). */
  function familles(a) {
    const texte = `${a.nom} ${a.description || ''}`
    if (!ESTPACK.test(`${texte} ${a.rubrique || ''}`)) return []
    const out = []
    for (const [cle, re] of DETECTION) {
      if (!re.test(texte)) continue
      if (cle === 'metaux8' && out.includes('metaux12')) continue
      if (cle === 'cohv' && out.includes('cohvMacaoh')) continue
      out.push(cle)
    }
    // Un pack ISDI contient aussi les 12 métaux sur éluat et HCT, BTEX, PCB, HAP sur brut.
    if (out.includes('isdi')) for (const k of ['metaux12', 'hct1040', 'btex', 'pcb7', 'hap16']) if (!out.includes(k)) out.push(k)
    return out
  }

  /**
   * Complète la composition d'une analyse : familles (déduites ou fournies par
   * « Recherche PACK ») et liste des paramètres correspondants. Les paramètres
   * exacts de l'annexe technique, quand elle les donne, restent prioritaires.
   */
  function completer(a) {
    if (a._complete) return a
    const cles = [...new Set([...(a.familles || []), ...familles(a)])].filter((k) => GROUPES[k])
    a.familles = cles
    a.composants = cles.map((k) => GROUPES[k].libelle)
    const deduits = [...new Set(cles.flatMap((k) => GROUPES[k].parametres))]
    const exacts = a.parametres?.length > 1 ? a.parametres : []
    // Paramètres déduits absents de la liste du laboratoire (qui peut être partielle).
    const base = (x) => norm(x.replace(/\([^)]*\)/g, ''))
    const connus = new Set(exacts.map(base))
    const ajouts = deduits.filter((x) => !connus.has(base(x)))
    a.contenu = [...exacts, ...ajouts]
    a.contenuSource = exacts.length ? (ajouts.length ? 'laboratoire et intitulé' : 'laboratoire') : deduits.length ? 'intitulé' : ''
    Object.defineProperty(a, '_deduits', { value: deduits, enumerable: false, configurable: true })
    Object.defineProperty(a, '_complete', { value: true, enumerable: false })
    return a
  }

  function estPack(a) {
    completer(a)
    return a.composants.length > 0 || (a.parametres || []).length > 1 || ESTPACK.test(`${a.nom} ${a.rubrique || ''}`)
  }

  // ---------- Outils ----------

  function norm(s) {
    return String(s ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[’']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function nombre(v) {
    if (v === null || v === undefined || v === '') return NaN
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.'))
    return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : NaN
  }

  /** « J0+5 » -> 5 ; « Overnight » -> 1 ; « J0+5/J0+8 » -> [5, 8] selon la matrice. */
  function delaiJours(texte, rang = 0) {
    const parts = String(texte ?? '').split('/')
    const t = (parts[rang] ?? parts[0] ?? '').trim()
    if (/overnight/i.test(t)) return 1
    const m = /J0\s*\+\s*(\d+)/i.exec(t)
    return m ? Number(m[1]) : null
  }

  function enTete(rows, ...motsCles) {
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const cells = rows[i].map(norm)
      if (motsCles.every((k) => cells.some((c) => c.startsWith(k)))) return { index: i, cells }
    }
    return null
  }

  const colonne = (cells, pred) => cells.findIndex(pred)

  // ---------- Extraction depuis le classeur ----------

  /**
   * sheets : { "Nom de feuille": [[cellule, ...], ...] }
   * Retourne { source, date, analyses: [{ code, nom, matrice, rubrique, prix, delai, parametres }] }.
   */
  function extraireCatalogue(sheets, source = 'Catalogue laboratoire') {
    const feuille = (pred) => Object.entries(sheets).find(([n]) => pred(norm(n)))?.[1]

    const imp = feuille((n) => n.startsWith('import'))
    if (!imp) throw new Error('Feuille « Import à utiliser » introuvable dans le classeur.')
    const h = enTete(imp, 'code', 'name')
    if (!h) throw new Error('En-têtes de la feuille « Import à utiliser » non reconnus.')
    const cType = colonne(h.cells, (c) => c.startsWith('type level1'))
    const cCode = colonne(h.cells, (c) => c === 'code')
    const cNom = colonne(h.cells, (c) => c === 'name')
    const cPrix = colonne(h.cells, (c) => c.startsWith('prix'))

    // Délais et intitulés détaillés : feuilles « Catalogue Sols… » et « Catalogue Eaux ».
    const details = { sol: new Map(), epc: new Map(), ec: new Map() }
    const sols = feuille((n) => n.startsWith('catalogue sols'))
    if (sols) {
      const hs = enTete(sols, 'code', 'description')
      if (hs) {
        const cc = 0
        const cd = colonne(hs.cells, (c) => c.startsWith('description'))
        const cdel = colonne(hs.cells, (c) => c.startsWith('delai standard'))
        for (const r of sols.slice(hs.index + 1)) {
          const code = String(r[cc] ?? '').trim()
          if (/^[A-Z0-9]{4,6}$/.test(code)) details.sol.set(code, { nom: String(r[cd] ?? '').trim(), delai: delaiJours(r[cdel]) })
        }
      }
    }
    const eaux = feuille((n) => n.startsWith('catalogue eaux'))
    if (eaux) {
      const he = enTete(eaux, 'code epc', 'description')
      if (he) {
        const cepc = colonne(he.cells, (c) => c.startsWith('code epc'))
        const cec = colonne(he.cells, (c) => c.startsWith('code ec'))
        const cd = colonne(he.cells, (c) => c.startsWith('description'))
        const cdel = colonne(he.cells, (c) => c.startsWith('delai standard'))
        for (const r of eaux.slice(he.index + 1)) {
          const nom = String(r[cd] ?? '').trim()
          const epc = String(r[cepc] ?? '').trim()
          const ec = String(r[cec] ?? '').trim()
          if (/^[A-Z0-9]{4,6}$/.test(epc)) details.epc.set(epc, { nom, delai: delaiJours(r[cdel], 0) })
          if (/^[A-Z0-9]{4,6}$/.test(ec)) details.ec.set(ec, { nom, delai: delaiJours(r[cdel], 1) })
        }
      }
    }

    // Paramètres analysés par pack : feuille « Annexe brute » (ou « Annexe technique »).
    const parametres = new Map()
    for (const annexe of [feuille((n) => n.startsWith('annexe brute')), feuille((n) => n.startsWith('annexe technique'))]) {
      if (!annexe) continue
      const ha = enTete(annexe, 'code package', 'nom test')
      if (!ha) continue
      const cp = colonne(ha.cells, (c) => c === 'code package')
      const ct = colonne(ha.cells, (c) => c === 'code test')
      const cn = colonne(ha.cells, (c) => c === 'parametres')
      const cnt = colonne(ha.cells, (c) => c === 'nom test')
      // Dans l'annexe technique, le code du pack n'est écrit que sur sa
      // première ligne : les lignes suivantes sans code lui appartiennent.
      // Avant le premier pack, une ligne sans code est une analyse seule.
      let pack = ''
      let test = ''
      for (const r of annexe.slice(ha.index + 1)) {
        const cPack = String(r[cp] ?? '').trim()
        const cTest = String(r[ct] ?? '').trim()
        if (cPack) pack = cPack
        if (cTest) test = cTest
        const code = pack || test
        const p = String(r[cn] ?? '').trim() || String(r[cnt] ?? '').trim()
        if (!code || !p || p === '/' || /^\(vide\)$/.test(p)) continue
        if (!parametres.has(code)) parametres.set(code, new Set())
        parametres.get(code).add(p)
        if (pack && cTest && cTest !== pack) {
          // le test appartient aussi à lui-même (analyse seule)
          if (!parametres.has(cTest)) parametres.set(cTest, new Set())
          parametres.get(cTest).add(p)
        }
      }
    }

    // Outil « Recherche PACK » : composition des packs hydrocarbures / métaux par matrice.
    const famillesPack = new Map()
    const rp = feuille((n) => n.startsWith('recherche pack'))
    if (rp) {
      const hr = enTete(rp, 'code sol', 'nom du pack')
      if (hr) {
        const cols = []
        hr.cells.forEach((c, i) => {
          const f = COLONNES_PACK.find(([re]) => re.test(c))
          if (f) cols.push([i, f[1]])
        })
        const codes = { sol: colonne(hr.cells, (c) => c === 'code sol'), epc: colonne(hr.cells, (c) => c === 'code epc'), ec: colonne(hr.cells, (c) => c === 'code ec') }
        for (const r of rp.slice(hr.index + 1)) {
          const f = cols.filter(([i]) => /x/i.test(String(r[i] ?? ''))).map(([, k]) => k)
          if (!f.length) continue
          for (const [m, i] of Object.entries(codes)) {
            const code = String(r[i] ?? '').trim()
            if (i >= 0 && /^[A-Z0-9]{4,6}$/.test(code)) famillesPack.set(`${m}:${code}`, f)
          }
        }
      }
    }

    const analyses = []
    const vus = new Set()
    let section = null
    let rubrique = ''
    for (const r of imp.slice(h.index + 1)) {
      const type = String(r[cType] ?? '').trim()
      const code = String(r[cCode] ?? '').trim()
      const nom = String(r[cNom] ?? '').replace(/\s+/g, ' ').trim()
      if (type === 'ST') {
        section = norm(nom)
        rubrique = ''
        continue
      }
      if (!code) {
        if (nom) rubrique = nom.replace(/^\[[^\]]*\]\s*/, '')
        continue
      }
      const matrice = section === null ? 'frais' : SECTIONS[section]
      if (!matrice) continue
      const prix = nombre(r[cPrix])
      if (!Number.isFinite(prix)) continue
      const cle = `${matrice}:${code}`
      if (vus.has(cle)) continue
      vus.add(cle)
      const d = details[matrice]?.get(code)
      // L'intitulé de la feuille d'import est celui que le laboratoire facture ;
      // la description du catalogue, parfois plus explicite, sert à la recherche.
      const description = (d?.nom || '').replace(/\s+/g, ' ').trim()
      analyses.push({
        code,
        nom,
        description: description && norm(description) !== norm(nom) ? description : '',
        matrice,
        rubrique,
        prix,
        delai: d?.delai ?? null,
        parametres: [...(parametres.get(code) || [])].slice(0, 150),
        familles: famillesPack.get(cle) || [],
      })
    }
    if (!analyses.some((a) => a.matrice !== 'frais')) throw new Error('Aucune analyse de sol ou d’eau trouvée dans le classeur.')
    return { format: 'lyza-analyses', version: 1, source, date: new Date().toISOString(), analyses }
  }

  // ---------- Lecture d'un classeur .xlsx dans le navigateur ----------

  async function inflate(bytes) {
    const flux = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(flux).arrayBuffer())
  }

  async function lireZip(buffer) {
    const u8 = new Uint8Array(buffer)
    const dv = new DataView(buffer)
    let eocd = -1
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) {
        eocd = i
        break
      }
    }
    if (eocd < 0) throw new Error("Ce fichier n'est pas un classeur Excel (.xlsx) lisible.")
    const total = dv.getUint16(eocd + 10, true)
    let p = dv.getUint32(eocd + 16, true)
    const dec = new TextDecoder()
    const fichiers = new Map()
    for (let n = 0; n < total; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break
      const methode = dv.getUint16(p + 10, true)
      const taille = dv.getUint32(p + 20, true)
      const lgNom = dv.getUint16(p + 28, true)
      const lgExtra = dv.getUint16(p + 30, true)
      const lgCom = dv.getUint16(p + 32, true)
      const local = dv.getUint32(p + 42, true)
      const nom = dec.decode(u8.subarray(p + 46, p + 46 + lgNom))
      fichiers.set(nom, { methode, taille, local })
      p += 46 + lgNom + lgExtra + lgCom
    }
    return async (nom) => {
      const f = fichiers.get(nom)
      if (!f) return null
      const debut = f.local + 30 + dv.getUint16(f.local + 26, true) + dv.getUint16(f.local + 28, true)
      const brut = u8.subarray(debut, debut + f.taille)
      const octets = f.methode === 0 ? brut : await inflate(brut)
      return dec.decode(octets)
    }
  }

  function xml(texte) {
    return new DOMParser().parseFromString(texte, 'application/xml')
  }
  const tous = (noeud, nom) => [...noeud.getElementsByTagNameNS('*', nom)]

  function colIndex(ref) {
    const lettres = /^[A-Z]+/.exec(ref || '')?.[0] || 'A'
    let n = 0
    for (const ch of lettres) n = n * 26 + (ch.charCodeAt(0) - 64)
    return n - 1
  }

  /** Lit un .xlsx et retourne { "Nom de feuille": [[valeurs]] }. */
  async function lireXlsx(buffer) {
    const lire = await lireZip(buffer)
    const wb = await lire('xl/workbook.xml')
    if (!wb) throw new Error("Ce fichier n'est pas un classeur Excel (.xlsx).")
    const rels = xml((await lire('xl/_rels/workbook.xml.rels')) || '<Relationships/>')
    const cibles = new Map(tous(rels, 'Relationship').map((r) => [r.getAttribute('Id'), r.getAttribute('Target')]))
    const ssTexte = await lire('xl/sharedStrings.xml')
    const partages = ssTexte ? tous(xml(ssTexte), 'si').map((si) => tous(si, 't').map((t) => t.textContent).join('')) : []
    const sheets = {}
    for (const s of tous(xml(wb), 'sheet')) {
      const rid = s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || s.getAttribute('r:id')
      let cible = cibles.get(rid) || ''
      cible = cible.startsWith('/') ? cible.slice(1) : `xl/${cible}`
      const contenu = await lire(cible)
      if (!contenu) continue
      const rows = []
      for (const r of tous(xml(contenu), 'row')) {
        const ligne = []
        for (const c of tous(r, 'c')) {
          const t = c.getAttribute('t')
          const v = tous(c, 'v')[0]?.textContent ?? ''
          let val
          if (t === 's') val = partages[Number(v)] ?? ''
          else if (t === 'inlineStr') val = tous(c, 't').map((x) => x.textContent).join('')
          else if (t === 'str' || t === 'b' || t === 'e') val = v
          else val = v === '' ? '' : Number(v)
          ligne[colIndex(c.getAttribute('r'))] = val
        }
        const idx = Number(r.getAttribute('r') || rows.length + 1) - 1
        rows[idx] = Array.from(ligne, (x) => (x === undefined ? '' : x))
      }
      sheets[s.getAttribute('name')] = Array.from(rows, (x) => x || [])
    }
    return sheets
  }

  /** Importe un fichier (.xlsx du laboratoire ou .json déjà extrait). */
  async function importerFichier(file) {
    if (/\.json$/i.test(file.name) || file.type === 'application/json') {
      const json = JSON.parse(await file.text())
      if (json.format !== 'lyza-analyses' || !Array.isArray(json.analyses)) throw new Error("Ce fichier JSON n'est pas un catalogue d'analyses LYZa.")
      return json
    }
    const sheets = await lireXlsx(await file.arrayBuffer())
    return extraireCatalogue(sheets, file.name.replace(/\.xlsx$/i, ''))
  }

  // ---------- Prix ----------

  function tarif(params) {
    return { ...TARIF_DEFAUT, ...(params?.analyses || {}) }
  }

  /** Prix de vente HT d'un coût laboratoire, selon le réglage (charges, marge, arrondi). */
  function prixVente(cout, params) {
    const t = tarif(params)
    const charges = Math.min(Math.max(Number(t.charges) || 0, 0), 90) / 100
    const marge = Math.max(Number(t.marge) || 0, 0) / 100
    const brut = (Number(cout) * (1 + marge)) / (1 - charges)
    const pas = Number(t.arrondi) > 0 ? Number(t.arrondi) : 0.01
    return Math.round(Math.ceil(brut / pas - 1e-9) * pas * 100) / 100
  }

  /** Bénéfice net laissé par une vente, après charges et coût laboratoire. */
  function netApresCharges(vente, cout, params) {
    const charges = (Number(tarif(params).charges) || 0) / 100
    return Math.round((vente * (1 - charges) - cout) * 100) / 100
  }

  function coutFrais(catalogue, type) {
    const f = FRAIS[type]
    if (!catalogue?.analyses) return f.defaut
    const total = f.codes.reduce((s, code) => s + (catalogue.analyses.find((a) => a.matrice === 'frais' && a.code === code)?.prix || 0), 0)
    return total || f.defaut
  }

  function ligneFrais(type, catalogue, params, quantite = 1) {
    const cout = coutFrais(catalogue, type)
    return {
      id: L.uid ? L.uid() : String(Math.random()),
      code: type === 'echantillon' ? 'LAB-ECH' : 'LAB-ENVOI',
      designation:
        type === 'echantillon'
          ? 'Frais de laboratoire : flaconnage, prise en charge et élimination de l’échantillon'
          : 'Frais d’envoi au laboratoire : prise en charge du dossier et collecte des échantillons',
      unite: type === 'echantillon' ? 'Échantillon' : 'Envoi',
      quantite,
      prixUnitaire: prixVente(cout, params),
      prixLabo: cout,
    }
  }

  function ligneAnalyse(a, params, quantite = 1) {
    return {
      id: L.uid ? L.uid() : String(Math.random()),
      code: `LAB:${a.matrice}:${a.code}`,
      designation: `**Réalisation d’analyses environnementales** – ${a.nom} (${MATRICES[a.matrice].toLowerCase()})`,
      unite: 'Échantillon',
      quantite,
      prixUnitaire: prixVente(a.prix, params),
      prixLabo: a.prix,
      analyse: { code: a.code, nom: a.nom, matrice: a.matrice, delai: a.delai },
    }
  }

  // ---------- Recherche ----------

  function indexer(a) {
    if (a._index) return a._index
    completer(a)
    const base = [a.code, a.nom, a.description, a.rubrique, MATRICES[a.matrice], ...(a.parametres || []), ...a._deduits, ...a.composants].join(' ')
    const extras = DEVELOPPEMENTS.filter(([re]) => re.test(`${a.nom} ${a.description || ''}`)).map(([, mots]) => mots)
    Object.defineProperty(a, '_index', { value: norm(`${base} ${extras.join(' ')}`), enumerable: false })
    Object.defineProperty(a, '_nom', { value: norm(`${a.code} ${a.nom} ${a.description || ''}`), enumerable: false })
    return a._index
  }

  /** Recherche multi-mots, insensible aux accents ; les correspondances dans l'intitulé passent devant. */
  function rechercher(catalogue, texte, { matrice = '', limite = 80, packs = false } = {}) {
    const liste = (catalogue?.analyses || []).filter((a) => (!matrice || a.matrice === matrice) && (!packs || estPack(a)))
    const mots = norm(texte).split(' ').filter(Boolean)
    if (!mots.length) return liste.slice(0, limite)
    const res = []
    for (const a of liste) {
      const idx = indexer(a)
      if (!mots.every((m) => idx.includes(m))) continue
      let score = 0
      for (const m of mots) {
        if (a._nom.includes(m)) score += 3
        if (norm(a.code) === m) score += 10
      }
      score -= a.nom.length / 200 // à score égal, l'intitulé le plus court (le plus proche) d'abord
      res.push([score, a])
    }
    return res.sort((x, y) => y[0] - x[0] || x[1].prix - y[1].prix).slice(0, limite).map((x) => x[1])
  }

  /**
   * Paramètres d'un pack qui correspondent à la recherche, quand l'intitulé du
   * pack ne contient pas lui-même les mots cherchés (« aluminium » -> pack métaux).
   */
  function correspondances(a, texte) {
    indexer(a)
    const mots = norm(texte).split(' ').filter((m) => m.length > 1)
    if (!mots.length) return []
    if (mots.every((m) => a._nom.includes(m))) return []
    const tous = [...new Set([...(a.parametres || []), ...a._deduits])]
    return tous.filter((p) => mots.some((m) => norm(p).includes(m))).slice(0, 4)
  }

  Object.assign(L, {
    MATRICES,
    GROUPES,
    completerAnalyse: completer,
    estPack,
    correspondances,
    TARIF_DEFAUT,
    extraireCatalogue,
    lireXlsx,
    importerFichier,
    prixVente,
    netApresCharges,
    ligneAnalyse,
    ligneFrais,
    rechercherAnalyses: rechercher,
    normRecherche: norm,
  })
})()
