import { useState, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { SalvagePanel } from '../components/forge/SalvagePanel';
import { FusionPanel } from '../components/forge/FusionPanel';
import { UpgradePanel } from '../components/forge/UpgradePanel';
import '../styles/forge.scss';

type ForgeTab = 'salvage' | 'fusion' | 'upgrade';

const Forge = () => {
  const navigate = useNavigate();
  const { essence, activeCharacter } = useGame();
  const [activeTab, setActiveTab] = useState<ForgeTab>('salvage');

  const handleBack = useCallback(() => {
    navigate('/arena');
  }, [navigate]);

  const handleTabChange = useCallback((tab: ForgeTab) => {
    setActiveTab(tab);
  }, []);

  if (!activeCharacter) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="forge-page container retro-container">
      {/* Header */}
      <div className="forge-page-header">
        <button className="forge-back-btn" onClick={handleBack} aria-label="Back to Arena">
          ← Back
        </button>
        <h1 className="forge-page-title">⚒ FORGE</h1>
        <div className="forge-page-essence">
          <span className="forge-page-essence-icon">💎</span>
          <span className="forge-page-essence-value">{essence.toFixed(2)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="forge-tabs" role="tablist">
        <button
          className={`forge-tab ${activeTab === 'salvage' ? 'active' : ''}`}
          onClick={() => handleTabChange('salvage')}
          role="tab"
          aria-selected={activeTab === 'salvage'}
          aria-controls="forge-panel-salvage"
        >
          ⛏ Salvage
        </button>
        <button
          className={`forge-tab ${activeTab === 'fusion' ? 'active' : ''}`}
          onClick={() => handleTabChange('fusion')}
          role="tab"
          aria-selected={activeTab === 'fusion'}
          aria-controls="forge-panel-fusion"
        >
          🔗 Fusion
        </button>
        <button
          className={`forge-tab ${activeTab === 'upgrade' ? 'active' : ''}`}
          onClick={() => handleTabChange('upgrade')}
          role="tab"
          aria-selected={activeTab === 'upgrade'}
          aria-controls="forge-panel-upgrade"
        >
          ✨ Upgrade
        </button>
      </div>

      {/* Tab Content */}
      <div className="forge-tab-content">
        <div
          id="forge-panel-salvage"
          role="tabpanel"
          hidden={activeTab !== 'salvage'}
        >
          {activeTab === 'salvage' && <SalvagePanel onClose={handleBack} />}
        </div>
        <div
          id="forge-panel-fusion"
          role="tabpanel"
          hidden={activeTab !== 'fusion'}
        >
          {activeTab === 'fusion' && <FusionPanel onClose={handleBack} />}
        </div>
        <div
          id="forge-panel-upgrade"
          role="tabpanel"
          hidden={activeTab !== 'upgrade'}
        >
          {activeTab === 'upgrade' && <UpgradePanel onClose={handleBack} />}
        </div>
      </div>
    </div>
  );
};

export default Forge;
