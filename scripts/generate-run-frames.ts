// Génère les frames de course + attaque pour PIXEL_BODIES_RUN
// Exécuter : npx tsx scripts/generate-run-frames.ts > src/components/generated-run-frames.ts

type Grid = number[][]

interface BodyDef {
  name: string
  pixels: Grid
}

function cloneGrid(g: Grid): Grid {
  return g.map(row => [...row])
}

function generateRun1(base: Grid): Grid {
  const g = cloneGrid(base)
  const h = g.length
  if (h < 9) return g
  // Jambe gauche avancée, droite recule
  // Ligne 6-7 (jambes) : gauche décalée à gauche, droite rétrécie
  g[6] = [...base[6]]
  g[7] = [...base[7]]
  g[8] = [...base[8]]
  // Décaler jambe gauche vers la gauche (colonnes 1-3)
  g[6][0] = base[6][2]; g[6][1] = base[6][2]; g[6][2] = base[6][2]; g[6][3] = base[6][2];
  g[7][0] = base[7][2]; g[7][1] = base[7][2]; g[7][2] = base[7][2]; g[7][3] = base[7][2];
  g[8][0] = base[8][2]; g[8][1] = base[8][2]; g[8][2] = base[8][2]; g[8][3] = base[8][2];
  // Jambe droite recule (colonnes 6-8 → 7-9)
  g[6][6] = 0; g[6][7] = 0; g[6][8] = 0; g[6][9] = 0;
  g[7][6] = 0; g[7][7] = 0; g[7][8] = 0; g[7][9] = 0;
  g[8][6] = 0; g[8][7] = 0; g[8][8] = 0; g[8][9] = 0;
  // Bras : balancés en opposition
  if (g[3][1] !== 0 && g[4][1] !== 0) {
    // Bras gauche en avant
    g[3][0] = g[3][1]; g[3][9] = 0;
    g[4][0] = g[4][1]; g[4][9] = 0;
  }
  return g
}

function generateRun2(base: Grid): Grid {
  const g = cloneGrid(base)
  // Position médiane — jambes légèrement écartées, sous le corps
  // Les deux jambes visibles, serrées mais dynamiques
  for (let row = 6; row <= 8; row++) {
    for (let col = 0; col < 12; col++) {
      g[row][col] = base[row]?.[col] ?? 0
    }
  }
  // Bras en position de course (légèrement pliés)
  if (g[3][1] !== 0 && g[4][1] !== 0) {
    g[3][1] = 0; g[3][2] = g[4][1]; g[3][9] = 0; g[3][8] = g[4][1];
    g[4][1] = 0; g[4][2] = g[5][1]; g[4][9] = 0; g[4][8] = g[5][1];
  }
  return g
}

function generateRun3(base: Grid): Grid {
  const g = cloneGrid(base)
  // Symétrique de run1 — jambe droite avancée, gauche recule
  // Jambe droite avancée (colonnes 7-9)
  g[6][7] = base[6][6]; g[6][8] = base[6][6]; g[6][9] = base[6][7];
  g[7][7] = base[7][6]; g[7][8] = base[7][6]; g[7][9] = base[7][7];
  g[8][7] = base[8][6]; g[8][8] = base[8][6]; g[8][9] = base[8][7];
  // Jambe gauche recule
  g[6][1] = 0; g[6][2] = 0;
  g[7][1] = 0; g[7][2] = 0;
  g[8][1] = 0; g[8][2] = 0;
  // Bras : opposition
  if (g[3][1] !== 0 && g[4][1] !== 0) {
    g[3][9] = g[3][8]; g[3][0] = 0;
    g[4][9] = g[4][8]; g[4][0] = 0;
  }
  return g
}

function generateAttack1(base: Grid): Grid {
  const g = cloneGrid(base)
  // Wind-up : personnage en position de charge, bras en arrière, poids du corps déplacé vers l'arrière
  // Décaler le torse vers la droite (préparation)
  for (let row = 1; row <= 5; row++) {
    for (let col = 11; col > 0; col--) {
      g[row][col] = base[row]?.[col - 1] ?? 0
    }
    g[row][0] = 0
  }
  // Bras droit tiré en arrière (cols 9-10)
  if (g[2][8] !== 0) {
    g[1][9] = g[2][8]
    g[2][9] = g[2][8]
    g[3][9] = g[3][8]
    g[3][10] = g[3][8]
  }
  // Poids sur la jambe arrière (droite), jambe avant légère
  g[6][1] = 0; g[6][2] = 0;
  g[7][1] = 0; g[7][2] = 0;
  g[8][1] = 0; g[8][2] = 0;
  // Jambe arrière bien plantée
  g[6][6] = g[6][6]; g[6][7] = g[6][6];
  g[7][6] = g[7][6]; g[7][7] = g[7][6];
  g[8][6] = g[8][6]; g[8][7] = g[8][6];
  return g
}

function generateAttack2(base: Grid): Grid {
  const g = cloneGrid(base)
  // Strike : frame de frappe active (contenu actuel de generateAttack)
  // Bras droit levé, corps penché avant, fente avant
  for (let row = 1; row <= 5; row++) {
    for (let col = 0; col < 11; col++) {
      g[row][col] = base[row]?.[col + 1] ?? 0
    }
    g[row][11] = 0
  }
  // Bras droit levé
  if (g[2][8] !== 0) {
    g[1][8] = g[2][8]
    g[1][9] = g[1][8]
    g[2][9] = g[2][8]
    g[0][8] = g[1][8]
    g[0][9] = g[1][8]
  }
  // Jambe avant en fente
  g[6][3] = g[6][2]; g[6][4] = g[6][2]; g[6][6] = g[6][7]; g[6][7] = 0;
  g[7][3] = g[7][2]; g[7][4] = g[7][2]; g[7][6] = g[7][7]; g[7][7] = 0;
  g[8][3] = g[8][2]; g[8][4] = g[8][2]; g[8][6] = g[8][7]; g[8][7] = 0;
  return g
}

function generateAttack3(base: Grid): Grid {
  const g = cloneGrid(base)
  // Recovery : retour progressif vers la position idle, bras qui redescend
  // Torse centré (position de base)
  for (let row = 1; row <= 5; row++) {
    for (let col = 0; col < 11; col++) {
      g[row][col] = base[row]?.[col] ?? 0
    }
    g[row][11] = 0
  }
  // Bras en position intermédiaire (mi-hauteur, en train de redescendre)
  if (g[3][8] !== 0) {
    g[2][8] = g[3][8]
    g[2][9] = g[3][8]
    g[1][9] = g[3][8]
    g[3][9] = g[3][8]
    g[0][8] = 0
    g[0][9] = 0
    g[1][8] = 0
  }
  // Jambes en retour de fente (position resserrée)
  g[6][3] = g[6][2]; g[6][4] = 0;
  g[7][3] = g[7][2]; g[7][4] = 0;
  g[8][3] = g[8][2]; g[8][4] = 0;
  // Jambe droite revient
  g[6][6] = g[6][7];
  g[7][6] = g[7][7];
  g[8][6] = g[8][7];
  return g
}

const BODY_TYPES: BodyDef[] = [
  { name: 'basic', pixels: [
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 5, 5, 5, 5, 5, 5, 0, 0, 0, 0],
    [0, 5, 5, 5, 11, 11, 5, 5, 5, 0, 0, 0],
    [0, 1, 5, 5, 5, 5, 5, 5, 1, 0, 0, 0],
    [0, 1, 5, 5, 5, 5, 5, 5, 1, 0, 0, 0],
    [0, 1, 6, 6, 6, 6, 6, 6, 1, 0, 0, 0],
    [0, 0, 6, 6, 0, 0, 6, 6, 0, 0, 0, 0],
    [0, 0, 6, 6, 0, 0, 6, 6, 0, 0, 0, 0],
    [0, 0, 7, 7, 0, 0, 7, 7, 0, 0, 0, 0],
  ]},
  { name: 'sleeveless', pixels: [
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 5, 5, 5, 5, 1, 0, 0, 0, 0],
    [0, 1, 5, 5, 5, 5, 5, 5, 1, 0, 0, 0],
    [0, 1, 5, 5, 11, 11, 5, 5, 1, 0, 0, 0],
    [0, 1, 5, 5, 5, 5, 5, 5, 1, 0, 0, 0],
    [0, 1, 6, 6, 6, 6, 6, 6, 1, 0, 0, 0],
    [0, 0, 6, 6, 0, 0, 6, 6, 0, 0, 0, 0],
    [0, 0, 6, 6, 0, 0, 6, 6, 0, 0, 0, 0],
    [0, 0, 7, 7, 0, 0, 7, 7, 0, 0, 0, 0],
  ]},
  { name: 'armor', pixels: [
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 9, 9, 9, 9, 9, 9, 0, 0, 0, 0],
    [0, 9, 9, 9, 9, 9, 9, 9, 9, 0, 0, 0],
    [0, 1, 9, 9, 11, 11, 9, 9, 1, 0, 0, 0],
    [0, 1, 9, 9, 5, 5, 9, 9, 1, 0, 0, 0],
    [0, 1, 9, 9, 9, 9, 9, 9, 1, 0, 0, 0],
    [0, 0, 6, 6, 0, 0, 6, 6, 0, 0, 0, 0],
    [0, 0, 6, 6, 0, 0, 6, 6, 0, 0, 0, 0],
    [0, 0, 9, 9, 0, 0, 9, 9, 0, 0, 0, 0],
  ]},
  { name: 'jacket', pixels: [
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 5, 5, 5, 5, 5, 5, 0, 0, 0, 0],
    [0, 5, 5, 11, 11, 11, 11, 5, 5, 0, 0, 0],
    [0, 1, 5, 5, 5, 5, 5, 5, 1, 0, 0, 0],
    [0, 1, 5, 5, 5, 5, 5, 5, 1, 0, 0, 0],
    [0, 1, 5, 5, 5, 5, 5, 5, 1, 0, 0, 0],
    [0, 0, 6, 6, 0, 0, 6, 6, 0, 0, 0, 0],
    [0, 0, 6, 6, 0, 0, 6, 6, 0, 0, 0, 0],
    [0, 0, 7, 7, 0, 0, 7, 7, 0, 0, 0, 0],
  ]},
  { name: 'vest', pixels: [
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 5, 5, 5, 5, 5, 5, 0, 0, 0, 0],
    [0, 5, 5, 11, 11, 11, 11, 5, 5, 0, 0, 0],
    [0, 1, 5, 5, 0, 0, 5, 5, 1, 0, 0, 0],
    [0, 1, 5, 5, 0, 0, 5, 5, 1, 0, 0, 0],
    [0, 1, 6, 6, 6, 6, 6, 6, 1, 0, 0, 0],
    [0, 0, 6, 6, 0, 0, 6, 6, 0, 0, 0, 0],
    [0, 0, 6, 6, 0, 0, 6, 6, 0, 0, 0, 0],
    [0, 0, 7, 7, 0, 0, 7, 7, 0, 0, 0, 0],
  ]},
  { name: 'robe', pixels: [
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 5, 5, 5, 5, 5, 5, 0, 0, 0, 0],
    [0, 5, 5, 11, 11, 11, 11, 5, 5, 0, 0, 0],
    [0, 1, 5, 5, 5, 5, 5, 5, 1, 0, 0, 0],
    [0, 1, 5, 5, 5, 5, 5, 5, 1, 0, 0, 0],
    [0, 1, 5, 5, 5, 5, 5, 5, 1, 0, 0, 0],
    [0, 0, 5, 5, 0, 0, 5, 5, 0, 0, 0, 0],
    [0, 0, 5, 5, 0, 0, 5, 5, 0, 0, 0, 0],
    [0, 0, 7, 7, 0, 0, 7, 7, 0, 0, 0, 0],
  ]},
]

function gridToTsString(grid: Grid, indent: string): string {
  const rows = grid.map(row => `[${row.join(',')}]`)
  return `[\n${indent}${rows.join(`,\n${indent}`)},\n${indent.slice(0, -2)}}]`
}

function generateBodyBlock(name: string, base: Grid): string {
  const run1 = generateRun1(base)
  const run2 = generateRun2(base)
  const run3 = generateRun3(base)
  const attack1 = generateAttack1(base)
  const attack2 = generateAttack2(base)
  const attack3 = generateAttack3(base)
  return `  ${name}: {\n` +
    `    run1: ${gridToTsString(run1, '      ')},\n` +
    `    run2: ${gridToTsString(run2, '      ')},\n` +
    `    run3: ${gridToTsString(run3, '      ')},\n` +
    `    attack1: ${gridToTsString(attack1, '      ')},\n` +
    `    attack2: ${gridToTsString(attack2, '      ')},\n` +
    `    attack3: ${gridToTsString(attack3, '      ')},\n` +
    `  }`
}

const blocks = BODY_TYPES.map(bt => generateBodyBlock(bt.name, bt.pixels))

console.log(`export const PIXEL_BODIES_RUN: Record<string, { run1: number[][]; run2: number[][]; run3: number[][]; attack1: number[][]; attack2: number[][]; attack3: number[][] }> = {`)
console.log(blocks.join(',\n'))
console.log('};')
