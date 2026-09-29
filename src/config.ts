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
 * Un morceau de cellule plus petit que ça (fraction de cellule) n'est pas une case : il agrandit
 * la case voisine. Au-dessus, c'est une vraie case à remplir (les demi-cases des arrondis
 * comprises). À 0,25, les bouts restants font au plus 16 % d'une case : la case qui les
 * absorbe n'est que légèrement plus grande.
 */
export const MIN_CELL_FRACTION = 0.25;

/** Épaisseur du contour noir de la forme active, en pixels. */
export const OUTLINE_PX = 2.5;

/** Taille d'une nouvelle forme, en nombre de cellules. */
export const SHAPE_MIN_CELLS = 10;
export const SHAPE_MAX_CELLS = 36;
/** Une forme ne dépasse jamais cette largeur ou hauteur (en cases), pour s'afficher toujours pareil. */
export const SHAPE_MAX_SPAN = 8;

/**
 * Part de la nouvelle forme qui chevauche la précédente (en cases). Cette zone compte comme
 * déjà remplie. À la fin, les formes s'y mêlent comme de l'encre.
 */
export const OVERLAP_MIN = 0.1;
export const OVERLAP_MAX = 0.2;

/**
 * Probabilité qu'une nouvelle forme vienne se coller contre la précédente (bord contre bord,
 * sans espace), plutôt que de la chevaucher. Donne une figure serrée, comme une affiche.
 * S'y ajoutent les formes noires, qui se collent toujours (le noir ne chevauche jamais).
 */
export const ADJACENT_SHAPE_CHANCE = 0.25;

/**
 * Probabilité de tirer une pièce de 1, 2, 3 ou 4 cellules.
 * Le cube seul peut arriver à tout moment (environ 1 fois sur 20), pas seulement pour finir.
 */
export const PIECE_SIZE_WEIGHTS = [0.05, 0.3, 0.34, 0.31];

/**
 * Une pièce posée est remplacée tout de suite (toujours 3 pièces en main). Sa taille est tirée
 * sans regarder la forme. Le plus souvent, l'aide discrète choisit la pièce (voir HELP_CHANCE) ;
 * sinon, on essaie PIECE_TRIES pièces ordinaires (barre, L, T, carré…) de cette taille, tirées
 * au hasard : la première qui rentre quelque part est donnée ; si aucune ne rentre, la pièce est
 * donnée quand même. Aucune pièce n'est jamais taillée sur mesure.
 */
export const PIECE_TRIES = 19;

/**
 * Aide discrète : probabilité qu'une nouvelle pièce soit choisie pour garder la forme finissable
 * avec les pièces déjà en main (toujours une pièce ordinaire, de la taille tirée si possible).
 * Les pièces qui finiront la forme arrivent ainsi bien avant la fin, mêlées aux autres. Une pièce
 * qui a la forme exacte d'un trou n'est donnée qu'en dernier recours (quand le joueur a posé une
 * pièce de travers). Baisse de HELP_CHANCE à HELP_CHANCE_LATE dans les longues parties ; toujours
 * active pendant la période de grâce.
 * Mesuré (npm run sim, joueur soigneux / expert) : en fin de forme, pièces à la forme exacte d'un
 * trou 38 % / 17 % (contre 63 % / 53 % avec l'ancienne pièce de fin taillée sur mesure) ; forme
 * finie avec une pièce reçue au coup d'avant 55 % / 33 % (contre 96 %). Interdire tout à fait de
 * donner le dernier bloc fait tomber les parties à 2 à 4 formes.
 */
export const HELP_CHANCE = 0.85;
export const HELP_CHANCE_LATE = 0.5;

/**
 * Fin de forme : quand il reste moins de END_SMALL_CELLS[1] cases libres, les tailles de pièce
 * glissent doucement vers END_SIZE_WEIGHTS (atteint à END_SMALL_CELLS[0] cases). Les petites
 * pièces arrivent avant que les derniers trous existent : elles donnent de la marge pour finir.
 */
export const END_SMALL_CELLS = [4, 14];
export const END_SIZE_WEIGHTS = [0.12, 0.45, 0.33, 0.1];

/**
 * Montée en difficulté : à partir de DIFFICULTY_RAMP_START formes terminées, les pièces
 * grossissent doucement (jusqu'aux probabilités PIECE_SIZE_WEIGHTS_LATE) et l'aide discrète
 * joue moins souvent (HELP_CHANCE_LATE), atteints à DIFFICULTY_RAMP_END formes.
 * Il faut jouer de plus en plus serré. Les parties ordinaires ne changent donc pas ; seules
 * les très longues sont raccourcies.
 * Mesuré : sans montée, un joueur appliqué a joué 24 min (114 formes) ; l'affiche devient
 * illisible et la partie ne finit plus. Visé : les bonnes parties s'arrêtent vers 25 à 40 formes.
 */
export const PIECE_SIZE_WEIGHTS_LATE = [0.02, 0.18, 0.3, 0.5];
export const DIFFICULTY_RAMP_START = 10;
export const DIFFICULTY_RAMP_END = 35;

/**
 * Période de grâce : pendant les premières formes de la partie, l'aide discrète joue à chaque
 * pièce : on ne perd que si on s'éloigne vraiment de toute façon de finir. Évite les parties
 * de moins d'une minute (mesuré : 44 s et 51 s, avec 1 et 2 formes seulement, frustrantes et
 * avec une affiche presque vide).
 */
export const GRACE_SHAPES = 3;

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
