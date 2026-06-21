import { PixelIcon } from './PixelIcon';
import type { MedalDef, MedalProgress } from '../utils/medalUtils';
import '../styles/components/_medal-card.scss';

const PIXEL_ICON_TYPES = [
  'fighters', 'arena', 'levels', 'updates', 'user', 'trophy', 'power',
  'sword', 'backpack', 'dice', 'history', 'skull', 'swords', 'strength',
  'vitality', 'dexterity', 'luck', 'intelligence', 'focus', 'chest', 'gear', 'close',
] as const;

type PixelIconType = (typeof PIXEL_ICON_TYPES)[number];

function isPixelIconType(value: string): value is PixelIconType {
  return PIXEL_ICON_TYPES.includes(value as PixelIconType);
}

function getIconType(medalDef: MedalDef): PixelIconType {
  if (isPixelIconType(medalDef.icon)) {
    return medalDef.icon;
  }
  return 'trophy';
}

interface MedalCardProps {
  medalDef: MedalDef;
  progress: MedalProgress;
}

export function MedalCard({ medalDef, progress }: MedalCardProps) {
  const isUnlocked = progress.completed;
  const isInProgress = !progress.completed && progress.progress > 0;
  const isHidden = medalDef.hidden && !isUnlocked;

  const progressPercent = medalDef.requiredProgress > 0
    ? Math.min((progress.progress / medalDef.requiredProgress) * 100, 100)
    : 0;

  const stateClass = isUnlocked
    ? 'medal-card--unlocked'
    : isInProgress
      ? 'medal-card--in-progress'
      : 'medal-card--locked';

  const classNames = [
    'medal-card',
    stateClass,
    isHidden ? 'medal-card--hidden' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      <div className="medal-card__header">
        <div className="medal-card__icon">
          <PixelIcon type={getIconType(medalDef)} size={32} />
        </div>
        <div className="medal-card__info">
          <h3 className="medal-card__name">{medalDef.name}</h3>
          <p className="medal-card__description">{medalDef.description}</p>
        </div>
      </div>

      <div className="medal-card__progress">
        <div className="medal-card__progress-bar">
          <div
            className="medal-card__progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
          <span className="medal-card__progress-text">
            {progress.progress}/{medalDef.requiredProgress}
          </span>
        </div>
      </div>

      <div className="medal-card__reward">
        <span className="medal-card__reward-text">{medalDef.reward.label}</span>
      </div>
    </div>
  );
}
