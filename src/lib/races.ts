import type { HeroRace } from './types'

export interface RaceDef {
  id: HeroRace
  name: string
  blurb: string
  /** Vertical scale of the body (1 = human baseline). */
  height: number
  /** Horizontal stoutness (1 = human). */
  build: number
  skin: { light: string; mid: string; shade: string; deep: string }
  hair: { light: string; mid: string; shade: string }
  eye: string
  lip: string
  /** Pointed ears, tusks, beard density cues for the renderer. */
  traits: {
    ears: 'round' | 'pointed' | 'small'
    tusks: boolean
    beard: 'none' | 'stubble' | 'full'
    brow: 'soft' | 'heavy'
  }
}

export const RACES: RaceDef[] = [
  {
    id: 'human',
    name: 'Human',
    blurb: 'Versatile folk of the ember roads — balanced frame, warm skin.',
    height: 1,
    build: 1,
    skin: { light: '#e8b88a', mid: '#c68642', shade: '#8f5a2e', deep: '#5c3a1c' },
    hair: { light: '#6b4423', mid: '#3a2415', shade: '#1e120a' },
    eye: '#2a4a6b',
    lip: '#a85a4a',
    traits: { ears: 'round', tusks: false, beard: 'stubble', brow: 'soft' },
  },
  {
    id: 'elf',
    name: 'Elf',
    blurb: 'Tall and lithe, with moonlit skin and long pointed ears.',
    height: 1.06,
    build: 0.88,
    skin: { light: '#f2d4b8', mid: '#d4a882', shade: '#a87858', deep: '#6e4a38' },
    hair: { light: '#d8e0f0', mid: '#9aa8c8', shade: '#4a5678' },
    eye: '#3d8f6a',
    lip: '#c47878',
    traits: { ears: 'pointed', tusks: false, beard: 'none', brow: 'soft' },
  },
  {
    id: 'dwarf',
    name: 'Dwarf',
    blurb: 'Stout and steady — broad shoulders, full beard, short stature.',
    height: 0.82,
    build: 1.22,
    skin: { light: '#d4a070', mid: '#b07a48', shade: '#7a4e2e', deep: '#4a2e18' },
    hair: { light: '#c45a2a', mid: '#8b3a1a', shade: '#4a1e0c' },
    eye: '#4a6a8b',
    lip: '#8b4a3a',
    traits: { ears: 'small', tusks: false, beard: 'full', brow: 'heavy' },
  },
  {
    id: 'orc',
    name: 'Orc',
    blurb: 'Powerful build, olive hide, tusks, and a heavy brow ridge.',
    height: 1.04,
    build: 1.18,
    skin: { light: '#8fbf6a', mid: '#5a8a42', shade: '#3a5e2a', deep: '#243818' },
    hair: { light: '#2a2218', mid: '#1a1210', shade: '#0a0806' },
    eye: '#c8a020',
    lip: '#4a6a38',
    traits: { ears: 'pointed', tusks: true, beard: 'none', brow: 'heavy' },
  },
]

export function raceDef(id: HeroRace | null | undefined): RaceDef | null {
  if (!id) return null
  return RACES.find((r) => r.id === id) ?? null
}
