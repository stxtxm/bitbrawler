import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MedalCard } from '../components/MedalCard';
import { PixelIcon } from '../components/PixelIcon';
import { useGame } from '../context/GameContext';
import {
  getMedalsByCategory,
  getUnlockedCount,
  getTotalMedalCount,
  type MedalCategory,
  type MedalProgressMap,
} from '../utils/medalUtils';
import '../styles/pages/_medal-hall.scss';

const CATEGORY_LABELS: Record<MedalCategory, string> = {
  combat: 'Combat',
  loot: 'Loot',
  progression: 'Progression',
  special: 'Special',
};

const CATEGORY_ORDERS: MedalCategory[] = ['combat', 'loot', 'progression', 'special'];

function getCategoryMedalCounts(
  progress: MedalProgressMap | undefined,
): Record<string, { total: number; unlocked: number }> {
  const counts: Record<string, { total: number; unlocked: number }> = {};
  const grouped = getMedalsByCategory();

  for (const cat of CATEGORY_ORDERS) {
    const medals = grouped[cat] || [];
    const total = medals.length;
    const unlocked = medals.filter((m) => progress?.[m.id]?.completed).length;
    counts[cat] = { total, unlocked };
  }

  return counts;
}

const MedalHall = () => {
  const { activeCharacter } = useGame();
  const medalProgress = activeCharacter?.medalProgress;

  const groupedMedals = useMemo(() => getMedalsByCategory(), []);
  const unlockedCount = useMemo(
    () => getUnlockedCount(medalProgress ?? {}),
    [medalProgress],
  );
  const totalCount = useMemo(() => getTotalMedalCount(), []);
  const categoryCounts = useMemo(
    () => getCategoryMedalCounts(medalProgress),
    [medalProgress],
  );

  return (
    <div className="container retro-container medal-hall-page">
      <header className="medal-hall-header">
        <div className="medal-hall-header__top">
          <Link to="/" className="medal-hall-back-btn" data-click-sound="nav">
            <PixelIcon type="close" size={12} />
            <span>BACK</span>
          </Link>
          <h1 className="medal-hall-title">Medal Hall</h1>
          <div className="medal-hall-counter">
            <PixelIcon type="trophy" size={16} />
            <span className="medal-hall-counter__text">
              Medals: {unlockedCount} / {totalCount}
            </span>
          </div>
        </div>
        <p className="medal-hall-subtitle">
          Achievements earned through combat, loot, and progression
        </p>
      </header>

      <main className="medal-hall-content">
        {CATEGORY_ORDERS.map((category) => {
          const medals = groupedMedals[category] || [];
          if (medals.length === 0) return null;

          const catCount = categoryCounts[category];

          return (
            <section key={category} className="medal-hall-section">
              <div className="medal-hall-section__header">
                <h2 className="medal-hall-section__title">
                  {CATEGORY_LABELS[category]}
                </h2>
                <span className="medal-hall-section__count">
                  {catCount?.unlocked ?? 0} / {catCount?.total ?? 0}
                </span>
              </div>
              <div className="medal-hall-grid">
                {medals.map((medalDef) => {
                  const progress = medalProgress?.[medalDef.id] ?? {
                    completed: false,
                    progress: 0,
                  };
                  return (
                    <MedalCard
                      key={medalDef.id}
                      medalDef={medalDef}
                      progress={progress}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
};

export default MedalHall;
