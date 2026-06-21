import { memo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ForgeEssenceDisplay } from '../components/forge/ForgeEssenceDisplay';
import { SalvagePanel } from '../components/forge/SalvagePanel';
import { FusionPanel } from '../components/forge/FusionPanel';
import { UpgradePanel } from '../components/forge/UpgradePanel';

type ForgeTab = 'salvage' | 'fusion' | 'upgrade';

const TABS: { key: ForgeTab; label: string; icon: string }[] = [
  { key: 'salvage', label: 'SALVAGE', icon: '⛏' },
  { key: 'fusion', label: 'FUSION', icon: '⚡' },
  { key: 'upgrade', label: 'UPGRADE', icon: '⬆' },
];

const Forge = memo(function Forge() {
  const navigate = useNavigate();
  const { activeCharacter, essence } = useGame();
  const [activeTab, setActiveTab] = useState<ForgeTab>('salvage');

  const handleBack = useCallback(() => {
    navigate('/arena');
  }, [navigate]);

  const handleClose = useCallback(() => {
    navigate('/arena');
  }, [navigate]);

  if (!activeCharacter) {
    navigate('/', { replace: true });
    return null;
  }

  return (
    <div className="container retro-container forge-container">
      {/* Header */}
      <div className="forge-header">
        <div className="forge-header-left">
          <button
            className="forge-back-btn"
            onClick={handleBack}
            aria-label="Back to Arena"
            title="Back to Arena"
          >
            ←
          </button>
          <div className="forge-header-title">
            <span className="forge-header-icon" aria-hidden="true">⚒</span>
            {' '}FORGE
          </div>
        </div>
        <ForgeEssenceDisplay essence={essence} />
      </div>

      {/* Decorative anvil */}
      <div className="forge-decoration" aria-hidden="true">
        <div className="forge-anvil">⛓</div>
        <div className="forge-sparkles">✦ ✦ ✦</div>
      </div>

      {/* Tab Navigation */}
      <nav className="forge-tabs" role="tablist" aria-label="Forge actions">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            className={`forge-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            aria-selected={activeTab === tab.key}
            aria-controls={`forge-panel-${tab.key}`}
          >
            <span className="forge-tab-icon" aria-hidden="true">{tab.icon}</span>
            <span className="forge-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Panel Content */}
      <div className="forge-panel-container">
        <div
          id="forge-panel-salvage"
          role="tabpanel"
          hidden={activeTab !== 'salvage'}
          aria-labelledby="forge-tab-salvage"
        >
          {activeTab === 'salvage' && <SalvagePanel onClose={handleClose} />}
        </div>
        <div
          id="forge-panel-fusion"
          role="tabpanel"
          hidden={activeTab !== 'fusion'}
          aria-labelledby="forge-tab-fusion"
        >
          {activeTab === 'fusion' && <FusionPanel onClose={handleClose} />}
        </div>
        <div
          id="forge-panel-upgrade"
          role="tabpanel"
          hidden={activeTab !== 'upgrade'}
          aria-labelledby="forge-tab-upgrade"
        >
          {activeTab === 'upgrade' && <UpgradePanel onClose={handleClose} />}
        </div>
      </div>

      {/* Footer */}
      <div className="forge-footer">
        <button className="forge-back-btn" onClick={handleBack}>
          ← BACK TO ARENA
        </button>
      </div>
    </div>
  );
});

export default Forge;
