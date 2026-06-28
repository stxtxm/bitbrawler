import { useMemo } from 'react'
import { PIXEL_HEADS, PIXEL_BODIES, PIXEL_BODIES_RUN, PIXEL_PALETTES } from './PixelAssets'
import { mulberry32, getSeedFromText } from '../utils/randomUtils'
import { PixelItemAsset } from '../types/Item'

interface AnimatedPixelCharacterProps {
  seed: string
  gender: 'male' | 'female'
  scale?: number
  state: 'idle' | 'running' | 'attacking' | 'dead'
  equippedWeapon?: PixelItemAsset | null
  className?: string
  frame?: number
}

interface CharacterFeatures {
  skinColor: string
  hairColor: string
  shirtColor: string
  pantsColor: string
  shoesColor: string
  eyeColor: string
  logoColor: string
  headType: keyof typeof PIXEL_HEADS
  bodyType: string
}

function getCharacterFeatures(seed: string, gender: 'male' | 'female'): CharacterFeatures {
  const seedNum = getSeedFromText(seed)
  const rng = mulberry32(seedNum)

  const pick = <T,>(arr: readonly T[] | T[]) => arr[Math.floor(rng() * arr.length)]

  const headType: keyof typeof PIXEL_HEADS = gender === 'male'
    ? pick(['male', 'male_bald', 'male_cap', 'male_beard', 'male_mohawk', 'male_sidepart', 'male_spiky'] as const)
    : pick(['female', 'female_pigtails', 'female_braid', 'female_ponytail', 'female_short', 'female_bob', 'female_waves'] as const)

  const bodyType = pick(['basic', 'sleeveless', 'armor', 'jacket', 'vest', 'robe'] as const)

  return {
    skinColor: pick(PIXEL_PALETTES.skins) as string,
    hairColor: pick(PIXEL_PALETTES.hair) as string,
    shirtColor: pick(PIXEL_PALETTES.clothes) as string,
    pantsColor: pick(PIXEL_PALETTES.pants) as string,
    shoesColor: '#333',
    eyeColor: pick(PIXEL_PALETTES.eyes) as string,
    logoColor: pick(PIXEL_PALETTES.clothes) as string,
    headType,
    bodyType,
  }
}

function getBodyFrame(bodyType: string, state: string, frame: number): number[][] {
  if (state === 'idle' || state === 'dead') {
    return PIXEL_BODIES[bodyType as keyof typeof PIXEL_BODIES] || PIXEL_BODIES.basic
  }
  if (state === 'attacking') {
    const runData = (PIXEL_BODIES_RUN as any)[bodyType]
    if (runData?.attack) return runData.attack
    return PIXEL_BODIES[bodyType as keyof typeof PIXEL_BODIES] || PIXEL_BODIES.basic
  }
  // running: cycle through frames
  const runData = (PIXEL_BODIES_RUN as any)[bodyType]
  if (runData) {
    const frames = ['run1', 'run2', 'run3', 'run2']
    const frameName = frames[frame % frames.length] as 'run1' | 'run2' | 'run3'
    return runData[frameName] || PIXEL_BODIES[bodyType as keyof typeof PIXEL_BODIES] || PIXEL_BODIES.basic
  }
  return PIXEL_BODIES[bodyType as keyof typeof PIXEL_BODIES] || PIXEL_BODIES.basic
}

function renderGrid(grid: number[][], offsetX: number, offsetY: number, features: CharacterFeatures) {
  const result: React.ReactNode[] = []
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const type = grid[y][x]
      if (type === 0) continue

      let fill = '#000'
      switch (type) {
        case 1: fill = features.skinColor; break
        case 2: fill = '#FFF'; break
        case 3: fill = '#a00'; break
        case 4: fill = features.hairColor; break
        case 5: fill = features.shirtColor; break
        case 6: fill = features.pantsColor; break
        case 7: fill = features.shoesColor; break
        case 8: fill = features.eyeColor; break
        case 9: fill = '#95a5a6'; break
        case 11: fill = features.logoColor; break
        case 12: fill = features.hairColor; break
      }

      result.push(
        <rect key={`${offsetX}-${offsetY}-${x}-${y}`}
          x={offsetX + x} y={offsetY + y}
          width={1.01} height={1.01} fill={fill}
        />
      )
    }
  }
  return result
}

export const AnimatedPixelCharacter: React.FC<AnimatedPixelCharacterProps> = ({
  seed, gender, scale = 4, state, frame = 0, className,
}) => {
  const features = useMemo(() => getCharacterFeatures(seed, gender), [seed, gender])
  const bodyFrame = useMemo(() => getBodyFrame(features.bodyType, state, frame), [features.bodyType, state, frame])

  const headGrid = PIXEL_HEADS[features.headType]
  const bodyGrid = bodyFrame

  const stateClass = `char-${state}`

  return (
    <svg
      width={12 * scale}
      height={18 * scale}
      viewBox="0 0 12 18"
      className={`pixel-character pixel-character-animated ${stateClass} ${className || ''}`}
      style={{ imageRendering: 'pixelated' }}
      shapeRendering="crispEdges"
    >
      {renderGrid(bodyGrid, 0, 9, features)}
      {renderGrid(headGrid, 0, 1, features)}
    </svg>
  )
}
