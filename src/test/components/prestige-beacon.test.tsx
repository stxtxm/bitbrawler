import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PrestigeBeacon } from '../../components/prestige/PrestigeBeacon';
import { calcFaith, capOfflineHours, getFaithBonus } from '../../utils/prestigeUtils';

describe('PrestigeBeacon', () => {
  const baseProps = {
    faith: 3,
    nextFaith: 4,
    faithPerHour: 0.3,
    xpTotal: 200_000,
    hoursPlayed: 10,
    onPrestige: vi.fn(),
    isPeak: false,
  };

  it('affiche Faith +3 (→ +12% global) pour 6 faith', () => {
    render(<PrestigeBeacon {...baseProps} faith={6} nextFaith={7} />);
    expect(screen.getByText(/Faith \+6/)).toBeTruthy();
    expect(screen.getByText(/\+12%/)).toBeTruthy();
    expect(getFaithBonus(6)).toBeCloseTo(1.12);
  });

  it('signal Reset now quand payback <25%', () => {
    render(<PrestigeBeacon {...baseProps} faith={6} nextFaith={7} hoursPlayed={10} />);
    expect(screen.getByTestId('payback-signal').textContent).toMatch(/Reset now/);
  });

  it('signal Good but not urgent quand payback 25-60%', () => {
    render(<PrestigeBeacon {...baseProps} faith={0} nextFaith={5} hoursPlayed={10} />);
    expect(screen.getByTestId('payback-signal').textContent).toMatch(/Good but not urgent/);
  });

  it('signal Borderline/delay quand payback >60%', () => {
    render(<PrestigeBeacon {...baseProps} faith={0} nextFaith={20} hoursPlayed={10} />);
    expect(screen.getByTestId('payback-signal').textContent).toMatch(/Borderline/);
  });

  it('square-root 4×→2×: xp 100k→1, 400k→2', () => {
    expect(calcFaith(100_000)).toBe(1);
    expect(calcFaith(400_000)).toBe(2);
    expect(calcFaith(900_000)).toBe(3);
    expect(calcFaith(1_600_000)).toBe(4);
  });

  it('plafond offline 8h 50%: 10h → 9h effectives', () => {
    expect(capOfflineHours(10)).toBe(9);
    expect(capOfflineHours(8)).toBe(8);
    expect(capOfflineHours(12)).toBe(10);
    expect(capOfflineHours(6)).toBe(6);
  });

  it('bouton central isPeak true → visible + animé', () => {
    render(<PrestigeBeacon {...baseProps} isPeak={true} />);
    const btn = screen.getByRole('button', { name: /prestige/i });
    expect(btn).toBeTruthy();
    expect(btn.className).toMatch(/prestige-beacon-btn--pulse/);
    expect(btn.getAttribute('title')).toMatch(/second run 40-60% faster/);
  });

  it('bouton central isPeak false → hidden', () => {
    render(<PrestigeBeacon {...baseProps} isPeak={false} />);
    expect(screen.queryByRole('button', { name: /prestige/i })).toBeNull();
  });

  it('affiche Faith/hour peak dans 12min', () => {
    render(<PrestigeBeacon {...baseProps} faith={2} nextFaith={3} xpTotal={300_000} hoursPlayed={5} />);
    expect(screen.getByText(/Faith\/hour peak dans 12min/)).toBeTruthy();
  });

  it('appelle onPrestige au clic', () => {
    const onPrestige = vi.fn();
    render(<PrestigeBeacon {...baseProps} isPeak={true} onPrestige={onPrestige} />);
    fireEvent.click(screen.getByRole('button', { name: /prestige/i }));
    expect(onPrestige).toHaveBeenCalledTimes(1);
  });

  it('capOfflineHours utilisé: faithPerHour avec heures plafonnées', () => {
    const hours = 10;
    const capped = capOfflineHours(hours);
    expect(capped).toBe(9);
    expect(capped).toBeLessThan(hours);
  });
});
