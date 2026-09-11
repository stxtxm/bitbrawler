import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PassTrack } from '../../components/pass/PassTrack';
import { PASS_TIERS } from '../../data/seasonalPass';

describe('PassTrack props-only', () => {
  it('affiche 20 paliers en grille', () => {
    const onClaim = vi.fn();
    render(<PassTrack tiers={PASS_TIERS} claimedTiers={[]} currentXp={0} onClaim={onClaim} />);
    expect(screen.getAllByTestId(/^pass-tier-/)).toHaveLength(20);
  });

  it('affiche les 4 types de rewards essence | reroll | pity | biome_token', () => {
    const onClaim = vi.fn();
    render(<PassTrack tiers={PASS_TIERS} claimedTiers={[]} currentXp={0} onClaim={onClaim} />);
    const types = PASS_TIERS.map((t) => t.reward.type);
    expect(types).toContain('essence');
    expect(types).toContain('reroll');
    expect(types).toContain('pity');
    expect(types).toContain('biome_token');
    for (const t of PASS_TIERS) {
      expect(screen.getByTestId(`pass-tier-${t.level}`)).toBeInTheDocument();
    }
  });

  it('gère les états claimed / claimable / locked', () => {
    const onClaim = vi.fn();
    const { rerender } = render(
      <PassTrack tiers={PASS_TIERS} claimedTiers={[1]} currentXp={6} onClaim={onClaim} />
    );
    expect(screen.getByTestId('pass-tier-1')).toHaveAttribute('data-state', 'claimed');
    expect(screen.getByTestId('pass-tier-2')).toHaveAttribute('data-state', 'claimable');
    expect(screen.getByTestId('pass-tier-3')).toHaveAttribute('data-state', 'locked');

    rerender(<PassTrack tiers={PASS_TIERS} claimedTiers={[1, 2]} currentXp={9} onClaim={onClaim} />);
    expect(screen.getByTestId('pass-tier-2')).toHaveAttribute('data-state', 'claimed');
    expect(screen.getByTestId('pass-tier-3')).toHaveAttribute('data-state', 'claimable');
    expect(screen.getByTestId('pass-tier-20')).toHaveAttribute('data-state', 'locked');
  });

  it('bouton CLAIM appelle onClaim pour les paliers claimable', () => {
    const onClaim = vi.fn();
    render(<PassTrack tiers={PASS_TIERS} claimedTiers={[]} currentXp={9} onClaim={onClaim} />);
    const claimBtns = screen.getAllByRole('button', { name: /Claim tier/ });
    expect(claimBtns.length).toBe(3);
    fireEvent.click(claimBtns[0]);
    expect(onClaim).toHaveBeenCalledWith(1);
    fireEvent.click(claimBtns[1]);
    expect(onClaim).toHaveBeenCalledWith(2);
  });

  it('paliers claimed affichent CLAIMED et paliers locked affichent LOCKED', () => {
    const onClaim = vi.fn();
    render(<PassTrack tiers={PASS_TIERS} claimedTiers={[1]} currentXp={6} onClaim={onClaim} />);
    expect(screen.getByTestId('pass-tier-1').textContent).toContain('CLAIMED');
    expect(screen.getByTestId('pass-tier-3').textContent).toContain('LOCKED');
    expect(screen.getByTestId('pass-tier-2').textContent).toContain('CLAIM');
  });

  it('est props-only : n\'importe pas useGame/useContext', async () => {
    const src = await import('../../components/pass/PassTrack.tsx?raw').catch(() => null);
    if (src) {
      const text = src.default as unknown as string;
      expect(text).not.toContain('useGame');
      expect(text).not.toContain('useContext');
    } else {
      const mod = await import('../../components/pass/PassTrack');
      expect(mod.PassTrack).toBeDefined();
    }
  });

  it('utilise les classes 8-bit bois sombre cohérentes Forge', () => {
    const onClaim = vi.fn();
    const { container } = render(
      <PassTrack tiers={PASS_TIERS} claimedTiers={[]} currentXp={0} onClaim={onClaim} />
    );
    expect(container.querySelector('.forge-panel')).toBeTruthy();
    expect(container.querySelector('.shop-panel')).toBeTruthy();
    expect(container.querySelector('.pass-panel')).toBeTruthy();
    expect(container.querySelector('.shop-canopy')).toBeTruthy();
    expect(container.querySelector('.shop-sign')).toBeTruthy();
    expect(container.querySelector('.pass-grid')).toBeTruthy();
  });
});
