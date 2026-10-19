import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { CompendiumUnlockToast } from '../../components/compendium/CompendiumUnlockToast';
import { COMPENDIUM_UNLOCK_EVENT } from '../../utils/compendiumEvents';

describe('CompendiumUnlockToast', () => {
  it('renders a bestiary discovery toast from the global event', () => {
    render(<CompendiumUnlockToast />);
    act(() => {
      window.dispatchEvent(new CustomEvent(COMPENDIUM_UNLOCK_EVENT, {
        detail: { kind: 'bestiary', id: 'chimera', name: 'Chimera' },
      }));
    });
    expect(screen.getByText(/New bestiary entry/i)).toBeInTheDocument();
    expect(screen.getByText('Chimera')).toBeInTheDocument();
  });

  it('renders an armory discovery toast', () => {
    render(<CompendiumUnlockToast />);
    act(() => {
      window.dispatchEvent(new CustomEvent(COMPENDIUM_UNLOCK_EVENT, {
        detail: { kind: 'armory', id: 'rusty_sword', name: 'Rusty Sword' },
      }));
    });
    expect(screen.getByText(/New armory entry/i)).toBeInTheDocument();
  });
});
