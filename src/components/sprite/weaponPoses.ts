import type { SpriteAnimKind } from './spriteTypes';
import type { WeaponVisualKind } from './equipOverlays';

/**
 * Angle of the whole weapon around the palm, in radians. 0 = vertical,
 * positive = tip leans outboard (to the right for the player fighter).
 *
 * The weapon is a rigid object: every frame uses one angle for the entire
 * blade/shaft/head, instead of shearing each row independently. That keeps a
 * sword straight and stops the old "rubber band" look.
 *
 * La grille fait 24 px de large et l'arme est tenue sur le bord droit : la
 * pointe ne peut pas balayer 90°. L'amplitude de la frappe est donc plafonnée
 * par la place restante à droite de la paume, mesurée arme par arme
 * (WEAPON_STRIKE_ANGLE). Le corps porte le reste du mouvement.
 */
export const WEAPON_REST_ANGLE = 0.34;

export const WEAPON_ANGLES: Record<SpriteAnimKind, readonly number[]> = {
  idle: [WEAPON_REST_ANGLE],
  // No free wrist wobble while running: the hand is glued to the body, so a
  // weapon that rotates by itself reads as a floppy rubber prop. The whole
  // silhouette already bobs with the run cycle.
  run: [WEAPON_REST_ANGLE],
  // Recul → chambre → frappe → garde. La chambre (index 2) ramène l'arme à la
  // verticale : la pointe recule de 3 à 5 px, c'est l'armé. La frappe (index 3)
  // l'envoie au bord de la grille. L'angle de la frappe n'est qu'un repli : en
  // jeu, chaque famille utilise son propre budget mesuré (WEAPON_STRIKE_ANGLE)
  // — une dague peut balayer 50°, un bâton 14°. Les index 0, 1 et 4 gardent
  // l'angle de repos : le poing recule et remonte sans faire pivoter l'arme,
  // et la dernière frame retrouve exactement la posture d'attente.
  attack: [WEAPON_REST_ANGLE, WEAPON_REST_ANGLE, 0.0, 0.78, WEAPON_REST_ANGLE],
  hit: [WEAPON_REST_ANGLE, 0.46, 0.38],
  victory: [WEAPON_REST_ANGLE, 0.2, 0.08, 0.24],
};

/**
 * Angle de frappe par famille, mesuré pour que **toutes** les cellules de
 * l'arme restent dans la grille au moment de l'impact (paume à x18, poing
 * avancé de 2 px) : au-delà, la pointe ou la tête sort du sprite et se fait
 * couper. Chaque famille balaie ainsi le maximum que la grille autorise, ce
 * qui donne la même amplitude *visible* (4 à 7 px de course de pointe) à une
 * dague courte et à un bâton long.
 */
export const WEAPON_STRIKE_ANGLE: Record<WeaponVisualKind, number> = {
  blade: 0.6,
  dagger: 0.85,
  scepter: 0.6,
  staff: 0.24,
  spear: 0.34,
  haft: 0.3,
  scythe: 0.18,
  // L'arc est large de 6 px à hauteur de paume : c'est l'allonge du poing
  // (+2 px), pas l'angle, qui lui coûte son dernier pixel ; un angle plus
  // grand ne changerait rien. Petite amplitude quand même, pour que la corde
  // accompagne le coup.
  bow: 0.2,
  // Les knuckles sont portés PAR le poing : pas de manche à balayer.
  fist: WEAPON_REST_ANGLE,
};

/** Angle de l'arme à la frame d'impact de l'attaque, pour une famille donnée. */
export function weaponStrikeAngle(kind?: WeaponVisualKind): number {
  if (!kind) return WEAPON_ANGLES.attack[3] ?? WEAPON_REST_ANGLE;
  return WEAPON_STRIKE_ANGLE[kind] ?? WEAPON_ANGLES.attack[3] ?? WEAPON_REST_ANGLE;
}

export function weaponAngleFor(anim: SpriteAnimKind, frameIdx: number): number {
  const angles = WEAPON_ANGLES[anim];
  return angles[frameIdx % angles.length] ?? WEAPON_REST_ANGLE;
}
