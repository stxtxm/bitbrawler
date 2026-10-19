/**
 * Nombre ENTIER de pixels physiques (device) par pixel de sprite.
 *
 * C'est la clé d'un pixel-art net : si chaque pixel de sprite occupe un nombre
 * entier de pixels physiques, aucun rééchantillonnage n'a lieu, les pixels
 * restent carrés et de taille constante d'une frame à l'autre (sinon les
 * animations « grésillent » — des pixels tantôt 2, tantôt 3 px).
 *
 * La taille visée vient, par ordre de priorité :
 *  1. `--sprite-box-h` — la hauteur de boîte déclarée par le CSS du contexte
 *     (donc responsive : `.combat-fighters .pixel-character` etc.) ;
 *  2. à défaut de boîte CSS, la taille intrinsèque historique
 *     (`gridHeight * fallbackScale` en px CSS).
 */
export function spritePixelScale(opts: {
  boxHeight: number | null;
  gridHeight: number;
  fallbackScale: number;
  dpr: number;
}): number {
  const { boxHeight, gridHeight, fallbackScale, dpr } = opts;
  if (gridHeight <= 0) return 1;
  const targetCss = boxHeight && boxHeight > 0 ? boxHeight : gridHeight * fallbackScale;
  const ratio = (targetCss * dpr) / gridHeight;
  return Math.max(1, Math.round(ratio));
}
