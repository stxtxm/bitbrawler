/* eslint-disable react-refresh/only-export-components */
import React, { useMemo } from 'react';
import { PIXEL_HEADS, PIXEL_BODIES, PIXEL_PALETTES } from './PixelAssets';
import { mulberry32, getSeedFromText } from '../utils/randomUtils';
import type { CharacterAppearance } from '../types/Character';

export const MALE_HEAD_TYPES = ['male', 'male_bald', 'male_cap', 'male_beard', 'male_mohawk', 'male_sidepart', 'male_spiky', 'male_afro', 'male_helmet', 'male_glasses', 'male_hood', 'male_long'] as const;
export const FEMALE_HEAD_TYPES = ['female', 'female_pigtails', 'female_braid', 'female_ponytail', 'female_short', 'female_bob', 'female_waves', 'female_afro', 'female_helmet', 'female_pixie', 'female_bang', 'female_bun'] as const;
export const BODY_TYPES = ['basic', 'sleeveless', 'armor', 'jacket', 'vest', 'robe', 'hoodie', 'tunic', 'cape'] as const;

export type HeadType = keyof typeof PIXEL_HEADS;
export type BodyType = keyof typeof PIXEL_BODIES;

interface PixelCharacterProps {
    seed: string;
    gender: 'male' | 'female';
    scale?: number;
    className?: string;
    appearance?: CharacterAppearance | null;
}

export const PixelCharacter: React.FC<PixelCharacterProps> = ({ seed, gender, scale = 4, className, appearance }) => {
    // Generate features based on seed or explicit appearance override
    const features = useMemo(() => {
        const seedNum = getSeedFromText(seed);
        const rng = mulberry32(seedNum);

        const pick = <T,>(arr: readonly T[] | T[]) => arr[Math.floor(rng() * arr.length)];

        // Resolve head/body — appearance overrides seed, fallback to RNG with full variant pool
        const fallbackHead: HeadType = gender === 'male'
            ? pick(MALE_HEAD_TYPES)
            : pick(FEMALE_HEAD_TYPES);
        const fallbackBody: BodyType = pick(BODY_TYPES);

        const headType: HeadType = (appearance?.headType && (appearance.headType in PIXEL_HEADS) ? appearance.headType : fallbackHead) as HeadType;
        const bodyType: BodyType = (appearance?.bodyType && (appearance.bodyType in PIXEL_BODIES) ? appearance.bodyType : fallbackBody) as BodyType;

        return {
            skinColor: appearance?.skinColor ?? (pick(PIXEL_PALETTES.skins) as string),
            hairColor: appearance?.hairColor ?? (pick(PIXEL_PALETTES.hair) as string),
            shirtColor: appearance?.shirtColor ?? (pick(PIXEL_PALETTES.clothes) as string),
            pantsColor: appearance?.pantsColor ?? (pick(PIXEL_PALETTES.pants) as string),
            shoesColor: '#333',
            eyeColor: appearance?.eyeColor ?? (pick(PIXEL_PALETTES.eyes) as string),
            logoColor: pick(PIXEL_PALETTES.clothes) as string,
            headType,
            bodyType,
        };
    }, [seed, gender, appearance]);

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

    const headGrid = (PIXEL_HEADS as Record<string, number[][]>)[features.headType] ?? PIXEL_HEADS[gender === 'male' ? 'male' : 'female'];
    const bodyGrid = (PIXEL_BODIES as Record<string, number[][]>)[features.bodyType] ?? PIXEL_BODIES.basic;

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
