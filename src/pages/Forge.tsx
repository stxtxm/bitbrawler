import { useState, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { SalvagePanel } from '../components/forge/SalvagePanel';
import { FusionPanel } from '../components/forge/FusionPanel';
import { UpgradePanel } from '../components/forge/UpgradePanel';
import { ShopPanel } from '../components/forge/ShopPanel';
import { PROGRESSION_GATES, isFeatureUnlocked } from '../config/progressionConfig';
import '../styles/forge.scss';

type ForgeTab = 'salvage' | 'fusion' | 'upgrade' | 'shop';

const Forge = () => {
  const navigate = useNavigate();
  const { essence, activeCharacter } = useGame();
  const [activeTab, setActiveTab] = useState<ForgeTab>('salvage');

  const level = activeCharacter?.level ?? 1;
  const fusionUnlocked = isFeatureUnlocked(level, PROGRESSION_GATES.FUSION_UNLOCK_LEVEL);
  const shopUnlocked = isFeatureUnlocked(level, PROGRESSION_GATES.SHOP_UNLOCK_LEVEL);

  const handleBack = useCallback(() => {
    navigate('/arena');
  }, [navigate]);

  const handleTabChange = useCallback((tab: ForgeTab) => {
    if (tab === 'fusion' && !fusionUnlocked) return;
    if (tab === 'shop' && !shopUnlocked) return;
    setActiveTab(tab);
  }, [fusionUnlocked, shopUnlocked]);

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
          className={`forge-tab ${!fusionUnlocked ? 'locked' : ''} ${activeTab === 'fusion' ? 'active' : ''}`}
          onClick={() => handleTabChange('fusion')}
          role="tab"
          aria-selected={activeTab === 'fusion'}
          aria-controls="forge-panel-fusion"
          disabled={!fusionUnlocked}
          title={fusionUnlocked ? 'Fusion' : `Unlocks at LVL ${PROGRESSION_GATES.FUSION_UNLOCK_LEVEL}`}
        >
          {fusionUnlocked ? '🔗 Fusion' : `🔒 Fusion LVL ${PROGRESSION_GATES.FUSION_UNLOCK_LEVEL}`}
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
        <button
          className={`forge-tab ${!shopUnlocked ? 'locked' : ''} ${activeTab === 'shop' ? 'active' : ''}`}
          onClick={() => handleTabChange('shop')}
          role="tab"
          aria-selected={activeTab === 'shop'}
          aria-controls="forge-panel-shop"
          disabled={!shopUnlocked}
          title={shopUnlocked ? 'Shop' : `Unlocks at LVL ${PROGRESSION_GATES.SHOP_UNLOCK_LEVEL}`}
        >
          {shopUnlocked ? '🏪 Shop' : `🔒 Shop LVL ${PROGRESSION_GATES.SHOP_UNLOCK_LEVEL}`}
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
        <div
          id="forge-panel-shop"
          role="tabpanel"
          hidden={activeTab !== 'shop'}
        >
          {activeTab === 'shop' && <ShopPanel onClose={handleBack} />}
        </div>
      </div>
    </div>
  );
};

export default Forge;
