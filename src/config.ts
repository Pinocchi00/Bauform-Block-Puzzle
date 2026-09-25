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

/** Couleurs possibles pour une forme, et leur fréquence (le gris est plus rare). */
export const SHAPE_COLORS = [COLORS.red, COLORS.blue, COLORS.yellow, COLORS.black, COLORS.grey];
export const SHAPE_COLOR_WEIGHTS = [1, 1, 1, 0.8, 0.5];

/** Espace entre deux tuiles, en pixels à l'écran. Le même partout. */
export const GAP_PX = 3;

/**
 * Un morceau de cellule plus petit que ça (fraction de cellule) est exclu de la forme.
 * Assez haut pour que les cases de bord (pointes, arrondis) soient bien visibles et
 * qu'on comprenne qu'on peut y poser une pièce.
 */
export const MIN_CELL_FRACTION = 0.45;

/** Épaisseur du contour noir de la forme active, en pixels. */
export const OUTLINE_PX = 2.5;

/** Taille d'une nouvelle forme, en nombre de cellules. */
export const SHAPE_MIN_CELLS = 10;
export const SHAPE_MAX_CELLS = 36;
/** Une forme ne dépasse jamais cette largeur ou hauteur (en cases), pour s'afficher toujours pareil. */
export const SHAPE_MAX_SPAN = 8;

/** Part de la nouvelle forme qui chevauche la précédente. */
export const OVERLAP_MIN = 0.1;
export const OVERLAP_MAX = 0.2;

/**
 * Parfois, la nouvelle forme ne chevauche pas la précédente : elle est posée à côté,
 * séparée par un espace de 10 à 20 % de sa taille (au moins une case).
 */
export const SPACED_SHAPE_CHANCE = 0.35;
export const SPACING_MIN = 0.1;
export const SPACING_MAX = 0.2;

/**
 * Probabilité de tirer une pièce de 1, 2, 3 ou 4 cellules.
 * Les pièces d'une seule case sont rares : elles ne servent surtout qu'à boucher un trou isolé.
 */
export const PIECE_SIZE_WEIGHTS = [0.03, 0.3, 0.35, 0.32];

/**
 * Une pièce posée est remplacée tout de suite (toujours 3 pièces en main).
 * La nouvelle pièce est le plus souvent tirée des cases libres de la forme (elle rentre),
 * mais avec cette probabilité c'est une pièce au hasard, qui peut ne rentrer nulle part.
 * C'est ce qui rend la défaite possible : plus la valeur est haute, plus le jeu est dur.
 */
export const RANDOM_REFILL_CHANCE = 0.1;

/**
 * Quand il ne reste que des cases isolées, probabilité que la pièce de remplacement soit
 * un cube seul pour les boucher. Sinon, c'est une pièce au hasard : laisser des trous se paie.
 */
export const SINGLE_PIECE_CHANCE = 0.6;

/** Score. */
export const POINTS_PER_CELL = 10;
export const BONUS_PER_SHAPE_CELL = 10;

/** Pubs (simulées en phase 1). */
export const INTERSTITIAL_EVERY_N_GAMES = 3;
export const FAKE_AD_SECONDS = 3;

/** Nombre de parties gardées pour l'écran de debug. */
export const STATS_KEEP = 20;

/** La pièce tenue est affichée au-dessus du doigt : écart en pixels entre le doigt et le bas de la pièce. */
export const DRAG_LIFT_PX = 40;

/** Taille maximale d’une cellule à l’écran (pixels). */
export const MAX_CELL_PX = 56;

/**
 * Pendant la partie, la caméra suit la forme à remplir, toujours au même zoom :
 * la zone de jeu montre environ ce nombre de cases en largeur (et en hauteur).
 * La figure entière ne se voit qu'à la fin.
 */
export const VIEW_CELLS = 8.6;
