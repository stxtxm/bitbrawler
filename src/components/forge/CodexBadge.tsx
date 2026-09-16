/* eslint-disable react-refresh/only-export-components */
import { memo } from 'react';

export interface CodexBadgeProps {
  completionPct: number;
  claimed?: boolean;
  onClaim?: () => void;
  className?: string;
}

export function isCodexBadgeEligible(completionPct: number, claimed?: boolean): boolean {
  return completionPct > 0 && completionPct % 10 === 0 && !claimed;
}

export const CodexBadge = memo(function CodexBadge({ completionPct, claimed, onClaim, className }: CodexBadgeProps) {
  const eligible = isCodexBadgeEligible(completionPct, claimed);
  if (!eligible) return null;
  return (
    <div
      className={`codex-badge codex-badge--pulse ${className ?? ''}`.trim()}
      role="status"
      aria-label={`Codex ${completionPct}% reward available`}
    >
      <span className="codex-badge-icon">✦</span>
      <span className="codex-badge-text">CODEX {completionPct}%</span>
      {onClaim ? (
        <button className="codex-badge-claim" onClick={onClaim} aria-label="Claim codex reward">
          CLAIM
        </button>
      ) : null}
    </div>
  );
});
