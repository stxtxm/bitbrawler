import React from 'react';

interface PixelIconProps {
    type: 'fighters' | 'arena' | 'levels' | 'updates' | 'user' | 'trophy' | 'power' | 'sword' | 'backpack' | 'dice' | 'history' | 'skull' | 'swords' | 'strength' | 'vitality' | 'dexterity' | 'luck' | 'intelligence' | 'focus' | 'chest' | 'gear' | 'close';
    size?: number;
}

export const PixelIcon: React.FC<PixelIconProps> = ({ type, size = 32 }) => {
    const renderIcon = () => {
        switch (type) {
            case 'dice':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="1" y="1" width="6" height="6" fill="#fff" />
                        <rect x="2" y="2" width="1" height="1" fill="#000" />
                        <rect x="5" y="2" width="1" height="1" fill="#000" />
                        <rect x="3" y="3" width="2" height="2" fill="#000" />
                        <rect x="2" y="5" width="1" height="1" fill="#000" />
                        <rect x="5" y="5" width="1" height="1" fill="#000" />
                        {/* Shading */}
                        <rect x="1" y="7" width="6" height="1" fill="#ccc" />
                        <rect x="7" y="1" width="1" height="6" fill="#ccc" />
                    </svg>
                );
            case 'fighters':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="2" y="1" width="4" height="3" fill="#ffcc00" />
                        <rect x="1" y="4" width="6" height="3" fill="#fff" />
                        <rect x="2" y="7" width="1" height="1" fill="#fff" />
                        <rect x="5" y="7" width="1" height="1" fill="#fff" />
                    </svg>
                );
            case 'arena':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="1" y="2" width="6" height="1" fill="#ff0000" />
                        <rect x="1" y="5" width="6" height="1" fill="#ff0000" />
                        <rect x="2" y="1" width="1" height="6" fill="#fff" />
                        <rect x="5" y="1" width="1" height="6" fill="#fff" />
                    </svg>
                );
            case 'levels':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="1" y="6" width="2" height="1" fill="#0f0" />
                        <rect x="3" y="4" width="2" height="3" fill="#0f0" />
                        <rect x="5" y="2" width="2" height="5" fill="#0f0" />
                    </svg>
                );
            case 'updates':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="3" y="1" width="2" height="4" fill="#0af" />
                        <rect x="2" y="5" width="4" height="2" fill="#0af" />
                        <rect x="1" y="3" width="6" height="1" fill="#fff" />
                    </svg>
                );
            case 'user':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="2" y="1" width="4" height="3" fill="#ffcc00" />
                        <rect x="1" y="4" width="6" height="4" fill="#666" />
                        <rect x="2" y="5" width="4" height="1" fill="#888" />
                    </svg>
                );
            case 'trophy':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="2" y="1" width="4" height="2" fill="#ffcc00" />
                        <rect x="1" y="2" width="1" height="2" fill="#ffcc00" />
                        <rect x="6" y="2" width="1" height="2" fill="#ffcc00" />
                        <rect x="3" y="3" width="2" height="3" fill="#ffcc00" />
                        <rect x="2" y="6" width="4" height="1" fill="#ffcc00" />
                    </svg>
                );
            case 'power':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="3" y="1" width="2" height="3" fill="#ff3333" />
                        <rect x="1" y="2" width="1" height="4" fill="#ff3333" />
                        <rect x="6" y="2" width="1" height="4" fill="#ff3333" />
                        <rect x="2" y="6" width="4" height="1" fill="#ff3333" />
                        <rect x="3" y="4" width="2" height="1" fill="#000" />
                    </svg>
                );
            case 'sword':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="5" y="1" width="2" height="2" fill="#fff" />
                        <rect x="4" y="2" width="2" height="2" fill="#fff" />
                        <rect x="3" y="3" width="2" height="2" fill="#fff" />
                        <rect x="2" y="4" width="2" height="2" fill="#aaa" />
                        <rect x="1" y="6" width="2" height="1" fill="#844" />
                        <rect x="1" y="5" width="1" height="3" fill="#844" />
                    </svg>
                );
            case 'backpack':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="3" y="0" width="2" height="1" fill="#7a3f12" />
                        <rect x="1" y="1" width="1" height="1" fill="#7a3f12" />
                        <rect x="6" y="1" width="1" height="1" fill="#7a3f12" />
                        <rect x="2" y="1" width="4" height="1" fill="#d9a441" />
                        <rect x="3" y="1" width="2" height="1" fill="#fff0a0" />
                        <rect x="1" y="2" width="1" height="4" fill="#7a3f12" />
                        <rect x="6" y="2" width="1" height="4" fill="#7a3f12" />
                        <rect x="2" y="2" width="4" height="1" fill="#d9a441" />
                        <rect x="2" y="3" width="4" height="2" fill="#c67b2a" />
                        <rect x="2" y="4" width="4" height="2" fill="#a85b1d" />
                        <rect x="3" y="4" width="2" height="1" fill="#fff0a0" />
                        <rect x="3" y="5" width="2" height="1" fill="#d9d9d9" />
                        <rect x="0" y="3" width="1" height="3" fill="#7a3f12" />
                        <rect x="7" y="3" width="1" height="3" fill="#7a3f12" />
                        <rect x="1" y="6" width="6" height="1" fill="#7a3f12" />
                    </svg>
                );
            case 'history':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="1" y="1" width="6" height="1" fill="#fff" />
                        <rect x="1" y="3" width="2" height="1" fill="#ffcc00" />
                        <rect x="4" y="3" width="3" height="1" fill="#fff" />
                        <rect x="1" y="5" width="2" height="1" fill="#ffcc00" />
                        <rect x="4" y="5" width="3" height="1" fill="#fff" />
                        <rect x="1" y="7" width="6" height="1" fill="#fff" />
                    </svg>
                );
            case 'gear':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="3" y="0" width="2" height="1" fill="#c0c0c0" />
                        <rect x="2" y="1" width="1" height="1" fill="#c0c0c0" />
                        <rect x="5" y="1" width="1" height="1" fill="#c0c0c0" />
                        <rect x="1" y="2" width="1" height="1" fill="#c0c0c0" />
                        <rect x="6" y="2" width="1" height="1" fill="#c0c0c0" />
                        <rect x="1" y="5" width="1" height="1" fill="#c0c0c0" />
                        <rect x="6" y="5" width="1" height="1" fill="#c0c0c0" />
                        <rect x="2" y="6" width="1" height="1" fill="#c0c0c0" />
                        <rect x="5" y="6" width="1" height="1" fill="#c0c0c0" />
                        <rect x="3" y="7" width="2" height="1" fill="#c0c0c0" />
                        <rect x="2" y="2" width="4" height="4" fill="#888" />
                        <rect x="3" y="3" width="2" height="2" fill="#111" />
                    </svg>
                );
            case 'close':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="1" y="1" width="1" height="1" fill="#ff3333" />
                        <rect x="2" y="2" width="1" height="1" fill="#ff3333" />
                        <rect x="3" y="3" width="2" height="2" fill="#ff3333" />
                        <rect x="5" y="2" width="1" height="1" fill="#ff3333" />
                        <rect x="6" y="1" width="1" height="1" fill="#ff3333" />
                        <rect x="1" y="6" width="1" height="1" fill="#ff3333" />
                        <rect x="2" y="5" width="1" height="1" fill="#ff3333" />
                        <rect x="5" y="5" width="1" height="1" fill="#ff3333" />
                        <rect x="6" y="6" width="1" height="1" fill="#ff3333" />
                    </svg>
                );
            case 'skull':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="2" y="1" width="4" height="1" fill="#e6e6e6" />
                        <rect x="1" y="2" width="6" height="3" fill="#e6e6e6" />
                        <rect x="2" y="5" width="4" height="1" fill="#e6e6e6" />
                        <rect x="2" y="6" width="1" height="1" fill="#e6e6e6" />
                        <rect x="5" y="6" width="1" height="1" fill="#e6e6e6" />
                        <rect x="2" y="3" width="1" height="1" fill="#111" />
                        <rect x="5" y="3" width="1" height="1" fill="#111" />
                        <rect x="3" y="4" width="2" height="1" fill="#111" />
                        <rect x="3" y="6" width="2" height="1" fill="#111" />
                    </svg>
                );
            case 'swords':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="1" y="1" width="1" height="2" fill="#fff" />
                        <rect x="2" y="2" width="1" height="2" fill="#fff" />
                        <rect x="3" y="3" width="1" height="2" fill="#fff" />
                        <rect x="4" y="4" width="1" height="2" fill="#fff" />
                        <rect x="6" y="1" width="1" height="2" fill="#fff" />
                        <rect x="5" y="2" width="1" height="2" fill="#fff" />
                        <rect x="4" y="3" width="1" height="2" fill="#fff" />
                        <rect x="3" y="4" width="1" height="2" fill="#fff" />
                        <rect x="1" y="5" width="2" height="1" fill="#844" />
                        <rect x="5" y="5" width="2" height="1" fill="#844" />
                        <rect x="3" y="6" width="2" height="1" fill="#888" />
                    </svg>
                );
            case 'strength':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="2" y="1" width="4" height="1" fill="#f0c7a4" />
                        <rect x="1" y="2" width="6" height="2" fill="#f0c7a4" />
                        <rect x="1" y="4" width="5" height="2" fill="#f0c7a4" />
                        <rect x="2" y="6" width="3" height="1" fill="#d9a07a" />
                        <rect x="5" y="2" width="2" height="1" fill="#d9a07a" />
                        <rect x="0" y="3" width="1" height="2" fill="#d9a07a" />
                    </svg>
                );
            case 'vitality':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="2" y="1" width="1" height="1" fill="#ff4d4d" />
                        <rect x="5" y="1" width="1" height="1" fill="#ff4d4d" />
                        <rect x="1" y="2" width="2" height="1" fill="#ff4d4d" />
                        <rect x="5" y="2" width="2" height="1" fill="#ff4d4d" />
                        <rect x="1" y="3" width="6" height="2" fill="#ff4d4d" />
                        <rect x="2" y="5" width="4" height="1" fill="#ff4d4d" />
                        <rect x="3" y="6" width="2" height="1" fill="#d93636" />
                    </svg>
                );
            case 'dexterity':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="3" y="1" width="2" height="1" fill="#9adf6b" />
                        <rect x="2" y="2" width="3" height="1" fill="#9adf6b" />
                        <rect x="1" y="3" width="4" height="1" fill="#9adf6b" />
                        <rect x="1" y="4" width="4" height="1" fill="#9adf6b" />
                        <rect x="1" y="5" width="5" height="1" fill="#7fb955" />
                        <rect x="1" y="6" width="6" height="1" fill="#5c4a3a" />
                    </svg>
                );
            case 'luck':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="2" y="1" width="2" height="2" fill="#4cd964" />
                        <rect x="4" y="1" width="2" height="2" fill="#4cd964" />
                        <rect x="1" y="3" width="2" height="2" fill="#4cd964" />
                        <rect x="5" y="3" width="2" height="2" fill="#4cd964" />
                        <rect x="3" y="3" width="2" height="2" fill="#4cd964" />
                        <rect x="3" y="5" width="2" height="2" fill="#3aa64c" />
                    </svg>
                );
            case 'intelligence':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="3" y="0" width="2" height="1" fill="#63b3ff" />
                        <rect x="2" y="1" width="4" height="1" fill="#63b3ff" />
                        <rect x="1" y="2" width="6" height="2" fill="#63b3ff" />
                        <rect x="2" y="4" width="4" height="2" fill="#63b3ff" />
                        <rect x="3" y="6" width="2" height="1" fill="#3f7bd6" />
                    </svg>
                );
            case 'focus':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="3" y="0" width="2" height="1" fill="#ffcc00" />
                        <rect x="0" y="3" width="1" height="2" fill="#ffcc00" />
                        <rect x="7" y="3" width="1" height="2" fill="#ffcc00" />
                        <rect x="3" y="7" width="2" height="1" fill="#ffcc00" />
                        <rect x="2" y="2" width="4" height="4" fill="#111" />
                        <rect x="3" y="3" width="2" height="2" fill="#ffcc00" />
                    </svg>
                );
            case 'chest':
                return (
                    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="1" y="2" width="6" height="4" fill="#8b5a2b" />
                        <rect x="1" y="1" width="6" height="1" fill="#9b6a3a" />
                        <rect x="1" y="6" width="6" height="1" fill="#6f3f1e" />
                        <rect x="3" y="2" width="2" height="3" fill="#ffcc00" />
                        <rect x="0" y="3" width="1" height="2" fill="#111" />
                        <rect x="7" y="3" width="1" height="2" fill="#111" />
                    </svg>
                );
            default:
                return null;
        }
    };

    return <div className="pixel-icon-wrapper" style={{ display: 'inline-block', lineHeight: 0 }}>{renderIcon()}</div>;
};
