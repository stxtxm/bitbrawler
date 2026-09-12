/* eslint-disable react-refresh/only-export-components */
import { memo, useEffect, useState } from 'react'
import { BIOMES, BiomeId } from '../../data/biomes'
import { MONSTER_PALETTES, MonsterId } from '../../data/monsterAssets'
import { BiomeTerrain } from '../procedural/BiomeTerrain'

export interface LiveOpsHudProps {
  activeSurge: BiomeId | null
  burstActive: boolean
  burstEndsAt: number | null
  surgeModifier: number
}

const SURGE_EMOJI: Record<string, string> = {
  plains: '🌿',
  volcanic: '🌋',
  abyssal: '🌊',
  forest: '🌲',
  desert: '🏜️',
  abyss: '🌊',
}

const BIOME_HUE_SHIFT: Record<string, number> = {
  plains: 0,
  volcanic: 28,
  abyssal: 210,
  forest: -18,
  desert: 42,
  abyss: 210,
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '')
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16)
    const g = parseInt(clean[1] + clean[1], 16)
    const b = parseInt(clean[2] + clean[2], 16)
    return { r, g, b }
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16)
    const g = parseInt(clean.slice(2, 4), 16)
    const b = parseInt(clean.slice(4, 6), 16)
    return { r, g, b }
  }
  return null
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6
    else if (max === gn) h = (bn - rn) / delta + 2
    else h = (rn - gn) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))
  return { h, s, l }
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let rp = 0
  let gp = 0
  let bp = 0
  if (h >= 0 && h < 60) { rp = c; gp = x; bp = 0 }
  else if (h >= 60 && h < 120) { rp = x; gp = c; bp = 0 }
  else if (h >= 120 && h < 180) { rp = 0; gp = c; bp = x }
  else if (h >= 180 && h < 240) { rp = 0; gp = x; bp = c }
  else if (h >= 240 && h < 300) { rp = x; gp = 0; bp = c }
  else { rp = c; gp = 0; bp = x }
  const r = Math.round((rp + m) * 255)
  const g = Math.round((gp + m) * 255)
  const b = Math.round((bp + m) * 255)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function shiftHex(hex: string, hueDelta: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const nextH = (hsl.h + hueDelta) % 360
  return hslToHex(nextH < 0 ? nextH + 360 : nextH, hsl.s, hsl.l)
}

export function getBiomeVariantPalette(monsterId: MonsterId, biomeId: BiomeId): Record<number, string> {
  const base = MONSTER_PALETTES[monsterId]
  if (!base) return {}
  const shift = BIOME_HUE_SHIFT[biomeId] ?? 0
  if (shift === 0) return { ...base }
  const out: Record<number, string> = {}
  for (const [k, v] of Object.entries(base)) {
    const idx = Number(k)
    if (v === 'transparent') out[idx] = v
    else out[idx] = shiftHex(v, shift)
  }
  return out
}

export function getMonsterPaletteForBiome(monsterId: MonsterId, biomeId: BiomeId): Record<number, string> {
  return getBiomeVariantPalette(monsterId, biomeId)
}

export function formatBurstCountdown(burstEndsAt: number, now: number = Date.now()): string {
  const remaining = Math.max(0, burstEndsAt - now)
  const totalSeconds = Math.floor(remaining / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  if (days > 0) return `${days}j ${hh}:${mm}:${ss}`
  return `${hh}:${mm}:${ss}`
}

export function getBiomeLabel(biomeId: BiomeId): string {
  return BIOMES.find(b => b.id === biomeId)?.label ?? biomeId
}

export const LiveOpsHud = memo(function LiveOpsHud({
  activeSurge,
  burstActive,
  burstEndsAt,
  surgeModifier,
}: LiveOpsHudProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!burstActive || burstEndsAt === null) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [burstActive, burstEndsAt])

  const hasSurge = activeSurge !== null && activeSurge !== undefined
  const hasBurst = burstActive && burstEndsAt !== null
  if (!hasSurge && !hasBurst) return null

  const surgeLabel = hasSurge ? getBiomeLabel(activeSurge as BiomeId) : null
  const surgeEmoji = hasSurge ? (SURGE_EMOJI[activeSurge as string] ?? '✨') : ''
  const burstCountdown = hasBurst ? formatBurstCountdown(burstEndsAt as number, now) : null
  const surgePct = Math.round((surgeModifier - 1) * 100)

  return (
    <div className="liveops-hud shop-panel" data-testid="liveops-hud" role="status" aria-live="polite">
      {hasSurge && surgeLabel && (
        <span
          className="liveops-surge-badge surge-badge"
          data-testid="liveops-surge-badge"
          title={`Biome Surge: ${surgeLabel} — +${surgePct}% essence & XP`}
          aria-label={`Biome Surge ${surgeLabel}, bonus +${surgePct}%`}
        >
          <span aria-hidden="true">{surgeEmoji}</span>
          <span className="surge-badge-label">{surgeLabel}</span>
          <span className="surge-badge-pct">+{surgePct}%</span>
        </span>
      )}
      {hasBurst && burstCountdown && (
        <span className="liveops-burst-badge" data-testid="liveops-burst-countdown" title="Fin du burst">
          <span aria-hidden="true">⚡</span> BURST {burstCountdown}
        </span>
      )}
      {hasSurge && activeSurge === 'volcanic' && (
        <div data-testid="liveops-biome-terrain" aria-hidden="true" style={{ position: 'relative', height: 48, overflow: 'hidden', marginTop: 6, border: '2px solid #3a2818' }}>
          <BiomeTerrain biomeId={activeSurge} seed="liveops-preview" animated={false} />
        </div>
      )}
    </div>
  )
})
