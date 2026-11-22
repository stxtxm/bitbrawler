import { useEffect, useState } from 'react';

/**
 * Durée couvrant l'animation de sortie CSS d'une modale (0.2s de
 * modalSlideDown/fadeOut dans components/_containers + marge de rendu).
 */
export const MODAL_EXIT_MS = 220;

/**
 * Retient le montage d'une modale le temps de son animation de sortie.
 *
 * Sans ça, un démontage conditionnel (`{open && <Panel/>}`) coupe net la
 * fermeture : la modale disparaît instantanément au clic. Quand `open` passe
 * à false, `mounted` reste true pendant MODAL_EXIT_MS et `closing` permet au
 * CSS de jouer la transition inverse.
 */
export function useModalExitTransition(
  open: boolean,
): { mounted: boolean; closing: boolean } {
  const [state, setState] = useState({ mounted: open, closing: false });

  useEffect(() => {
    if (open) {
      setState({ mounted: true, closing: false });
      return;
    }
    setState((s) => (s.mounted ? { mounted: true, closing: true } : s));
    const timer = setTimeout(
      () => setState({ mounted: false, closing: false }),
      MODAL_EXIT_MS,
    );
    return () => clearTimeout(timer);
  }, [open]);

  return state;
}
