import React, { useMemo } from 'react';
import { PIXEL_HEADS, PIXEL_BODIES, PIXEL_PALETTES } from './PixelAssets';
import { mulberry32, getSeedFromText } from '../utils/randomUtils';

interface PixelCharacterProps {
    seed: string;
    gender: 'male' | 'female';
    scale?: number;
    className?: string;
}

export const PixelCharacter: React.FC<PixelCharacterProps> = ({ seed, gender, scale = 4, className }) => {
    // Generate features based on seed
    const features = useMemo(() => {
        const seedNum = getSeedFromText(seed);
        const rng = mulberry32(seedNum);

        const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];

        return {
            skinColor: pick(PIXEL_PALETTES.skins),
            hairColor: pick(PIXEL_PALETTES.hair),
            shirtColor: pick(PIXEL_PALETTES.clothes),
            pantsColor: pick(PIXEL_PALETTES.pants),
            shoesColor: '#333',
            eyeColor: pick(PIXEL_PALETTES.eyes),
            logoColor: pick(PIXEL_PALETTES.clothes),
            // Randomly select head variation based on gender
            headType: gender === 'male'
                ? pick(['male', 'male_bald', 'male_cap', 'male_beard', 'male_mohawk'])
                : pick(['female', 'female_pigtails', 'female_braid', 'female_ponytail', 'female_short']),
            // Randomly select body variation
            bodyType: pick(['basic', 'sleeveless', 'armor', 'jacket'])
        };
    }, [seed, gender]);

    // Render a grid
    const renderGrid = (grid: number[][], offsetX: number, offsetY: number) => {

        const result = [];

        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                const type = grid[y][x];
                if (type === 0) continue; // Transparent

                let fill = '#000';
                switch (type) {
                    case 1: fill = features.skinColor; break;
                    case 2: fill = '#FFF'; break; // Eyes white
                    case 3: fill = '#a00'; break; // Mouth
                    case 4: fill = features.hairColor; break;
                    case 5: fill = features.shirtColor; break;
                    case 6: fill = features.pantsColor; break;
                    case 7: fill = features.shoesColor; break;
                    case 8: fill = features.eyeColor; break;
                    case 9: fill = '#95a5a6'; break; // Metal
                    case 11: fill = features.logoColor; break;
                    case 12: fill = features.hairColor; break; // Beard matches hair
                }

                result.push(
                    <rect
                        key={`${offsetX}-${offsetY}-${x}-${y}`}
                        x={offsetX + x}
                        y={offsetY + y}
                        width={1.01}
                        height={1.01}
                        fill={fill}
                    />
                );
            }
        }
        return result;
    }

    // @ts-ignore
    const headGrid = PIXEL_HEADS[features.headType];
    // @ts-ignore
    const bodyGrid = PIXEL_BODIES[features.bodyType];

    // Grid size is roughly 12 wide x 20 high combined
    // Head is 12x8, Body is 12x9. 
    // Overlap neck by 1 pixel?

    return (
        <svg
            width={12 * scale}
            height={18 * scale}
            viewBox="0 0 12 18"
            className={`pixel-character ${className || ''}`}
            style={{ imageRendering: 'pixelated' }}
            shapeRendering="crispEdges"
        >
            {/* Draw Body first (lower) at y=9 */}
            {renderGrid(bodyGrid, 0, 9)}

            {/* Draw Head on top at y=1 */}
            {renderGrid(headGrid, 0, 1)}
        </svg>
    );
};
