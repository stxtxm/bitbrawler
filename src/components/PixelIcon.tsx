import React from 'react';

interface PixelIconProps {
    type: 'fighters' | 'arena' | 'levels' | 'updates' | 'user';
    size?: number;
}

export const PixelIcon: React.FC<PixelIconProps> = ({ type, size = 32 }) => {
    const renderIcon = () => {
        switch (type) {
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
            default:
                return null;
        }
    };

    return <div className="pixel-icon-wrapper" style={{ display: 'inline-block', lineHeight: 0 }}>{renderIcon()}</div>;
};
