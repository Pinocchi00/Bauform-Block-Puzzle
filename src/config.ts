// Tous les réglages du jeu au même endroit : on peut les ajuster ici sans toucher au reste.

export const COLORS = {
  background: '#C1BAAE',
  shapeInside: '#CFC8BC',
  lines: '#ACA597',
  black: '#141414',
  grey: '#8F8A82',
  textSecondary: '#5F5A51',
  red: '#AE3622',
  blue: '#223F80',
  yellow: '#BE921F',
};

/** Couleurs possibles pour une forme (deux formes qui se suivent n'ont jamais la même). */
export const SHAPE_COLORS = [COLORS.red, COLORS.blue, COLORS.yellow, COLORS.black, COLORS.grey];

/** Espace entre deux tuiles, en pixels à l'écran. Le même partout. */
export const GAP_PX = 3;

/** Un morceau de cellule plus petit que ça (fraction de cellule) est exclu de la forme. */
export const MIN_CELL_FRACTION = 0.25;

/** Épaisseur du contour noir de la forme active, en pixels. */
export const OUTLINE_PX = 2.5;

/** Taille d'une nouvelle forme, en nombre de cellules. */
export const SHAPE_MIN_CELLS = 10;
export const SHAPE_MAX_CELLS = 36;

/** Part de la nouvelle forme qui chevauche la précédente. */
export const OVERLAP_MIN = 0.1;
export const OVERLAP_MAX = 0.3;

/** Probabilité de tirer une pièce de 1, 2, 3 ou 4 cellules. */
export const PIECE_SIZE_WEIGHTS = [0.12, 0.28, 0.32, 0.28];

/** Probabilité qu'une pièce parte d'une case de bord (pointue ou arrondie) quand il en reste. */
export const EDGE_PIECE_CHANCE = 0.5;

/** Score. */
export const POINTS_PER_CELL = 10;
export const BONUS_PER_SHAPE_CELL = 10;

/** Pubs (simulées en phase 1). */
export const INTERSTITIAL_EVERY_N_GAMES = 3;
export const FAKE_AD_SECONDS = 3;

/** Nombre de parties gardées pour l'écran de debug. */
export const STATS_KEEP = 20;

/** La pièce tenue est affichée au-dessus du doigt, de cette distance (pixels). */
export const DRAG_LIFT_PX = 70;
