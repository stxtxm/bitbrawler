import React from 'react';
import { PixelCharacter } from './PixelCharacter';

interface GameLogoProps {
    showTagline?: boolean;
    scale?: number;
}

export const GameLogo: React.FC<GameLogoProps> = ({ showTagline = true, scale = 1 }) => {
    return (
        <div className="game-logo-container" style={{ transform: `scale(${scale})` }}>
            <div className="logo-main-row">
                <div className="logo-character-wrapper">
                    <div className="character-aura"></div>
                    <PixelCharacter seed="LogoHero" gender="male" scale={6} />
                </div>

                <div className="logo-text-wrapper">
                    <h1 className="logo-title">
                        <span className="bit">BIT</span>
                        <span className="brawler hero-text">BRAWLER</span>
                    </h1>
                    {showTagline && <span className="logo-tagline">8-BIT BATTLE ARENA</span>}
                </div>

                <div className="logo-character-wrapper flip-x">
                    <div className="character-aura energy-blue"></div>
                    <PixelCharacter seed="LogoRival" gender="female" scale={6} />
                </div>
            </div>

            <div className="logo-decoration">
                <div className="pixel-divider"></div>
            </div>
        </div>
    );
};
