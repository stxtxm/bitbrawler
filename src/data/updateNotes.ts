export type UpdateNote = {
  version: string;
  date: string;
  title: string;
  changes: string[];
};

export const UPDATE_NOTES: UpdateNote[] = [
  {
    version: '0.8.0',
    date: '2026-02-15',
    title: 'Organic combat activity',
    changes: [
      'Bots now attack random targets with organic pacing and finish remaining fights before daily reset.',
      'Arena settings combat logs now include incoming attacks without exposing attacker type and without XP lines.',
      'Early lootboxes now include extra low-power level 1 common and uncommon items.',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-02-15',
    title: 'Daily reset reliability',
    changes: [
      'Reset window now covers 23:00-01:00 (Europe/Paris).',
      'Duplicate scheduled runs are deduped with a maintenance reset key.',
      'Daily lootbox and fight reset stay aligned to the same Paris day.',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-02-14',
    title: 'Bot progression & fairness',
    changes: [
      'Minimum level 1 bot population is enforced each run.',
      'Bots use same-level opponent pools and shared combat logic.',
      'Bot growth and activity cadence were tuned for stable matchmaking pools.',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-02-11',
    title: 'Arena UX refresh',
    changes: [
      'Settings modal now owns auto mode, logs, and safe delete flow.',
      'Combat logs moved into settings for cleaner arena HUD.',
      'Rankings list became read-only with internal scrolling.',
    ],
  },
];
