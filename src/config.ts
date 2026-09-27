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

/**
 * Part de la nouvelle forme qui chevauche la précédente (en cases). Le chevauchement ne se
 * fait que sur des cases pleines des deux formes : jamais sur un arrondi ni une diagonale.
 */
export const OVERLAP_MIN = 0.05;
export const OVERLAP_MAX = 0.15;

/**
 * Probabilité qu'une nouvelle forme vienne se coller contre la précédente (bord contre bord,
 * sans espace), plutôt que de la chevaucher. Donne une figure serrée, comme une affiche.
 */
export const ADJACENT_SHAPE_CHANCE = 0.5;

/**
 * Probabilité de tirer une pièce de 1, 2, 3 ou 4 cellules.
 * Le cube seul peut arriver à tout moment (environ 1 fois sur 20), pas seulement pour finir.
 */
export const PIECE_SIZE_WEIGHTS = [0.05, 0.3, 0.34, 0.31];

/**
 * Une pièce posée est remplacée tout de suite (toujours 3 pièces en main).
 * La nouvelle pièce est une forme ordinaire (barre, L, T, carré…) tirée au hasard, gardée
 * seulement si elle rentre quelque part : elle n'est pas taillée sur mesure pour un trou.
 * On fait jusqu'à NATURAL_PIECE_TRIES essais.
 */
export const NATURAL_PIECE_TRIES = 25;

/**
 * Probabilité que la nouvelle pièce soit tirée au hasard sans vérifier qu'elle rentre.
 * C'est ce qui rend la défaite possible : plus la valeur est haute, plus le jeu est dur.
 */
export const RANDOM_REFILL_CHANCE = 0.06;

/**
 * Période de grâce : pendant les premières formes de la partie, pas de pièce au hasard.
 * Évite les défaites en quelques secondes (mesuré : des parties de 15 à 30 s, frustrantes).
 */
export const GRACE_SHAPES = 1;

/**
 * Quand plus aucune pièce ne rentre, ni dans la main ni parmi les pièces ordinaires,
 * probabilité de recevoir un morceau découpé dans les cases libres. Sinon, pièce au hasard.
 */
export const EXACT_PIECE_CHANCE = 1;

/** Score. */
export const POINTS_PER_CELL = 10;
export const BONUS_PER_SHAPE_CELL = 10;

/** Pubs (simulées en phase 1). */
/**
 * Pub entre deux parties : seulement si on a joué au moins ce temps (secondes) depuis
 * la dernière pub. Mesuré : une partie dure 1 min 40 en moyenne, mais beaucoup durent
 * moins d'une minute ; compter le temps plutôt que les parties évite d'enchaîner des pubs
 * après des défaites rapides (environ une pub toutes les 3 minutes de jeu).
 */
export const INTERSTITIAL_MIN_PLAY_SECONDS = 180;
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
