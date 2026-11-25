import type { WearableId, WearableSlot } from './types'

export interface WearableDef {
  id: WearableId
  name: string
  blurb: string
  slot: WearableSlot
  glyph: string
  /** Unlock at this player level (0 = not level-gated alone). */
  level: number
  /** Unlock at this day streak (0 = not streak-gated alone). */
  streak: number
  /** Can drop from full-clear loot roll. */
  fullClearLoot: boolean
  /** Pixel layer tint colors used by the avatar renderer. */
  colors: {
    primary: string
    secondary: string
    highlight?: string
  }
}

/** ~12 unlockable armor / weapons / cosmetics. */
export const WEARABLES: Record<WearableId, WearableDef> = {
  'cloth-tunic': {
    id: 'cloth-tunic',
    name: 'Cloth Tunic',
    blurb: 'Humble thread for a new path',
    slot: 'chest',
    glyph: '👕',
    level: 1,
    streak: 0,
    fullClearLoot: false,
    colors: { primary: '#6b5a4a', secondary: '#4a3c32', highlight: '#8a7864' },
  },
  'leather-vest': {
    id: 'leather-vest',
    name: 'Leather Vest',
    blurb: 'Supple hide for trail work',
    slot: 'chest',
    glyph: '🦺',
    level: 3,
    streak: 0,
    fullClearLoot: false,
    colors: { primary: '#6b4423', secondary: '#3d2814', highlight: '#8b5a2b' },
  },
  'iron-mail': {
    id: 'iron-mail',
    name: 'Iron Mail',
    blurb: 'Rings that sing when you move',
    slot: 'chest',
    glyph: '🛡️',
    level: 6,
    streak: 0,
    fullClearLoot: false,
    colors: { primary: '#7a8490', secondary: '#4a525c', highlight: '#b0bcc8' },
  },
  'ember-plate': {
    id: 'ember-plate',
    name: 'Ember Plate',
    blurb: 'Forged in the heart of the path',
    slot: 'chest',
    glyph: '🔥',
    level: 10,
    streak: 14,
    fullClearLoot: true,
    colors: { primary: '#c45a2a', secondary: '#6b2410', highlight: '#f0b06a' },
  },
  'training-blade': {
    id: 'training-blade',
    name: 'Training Blade',
    blurb: 'Wood and hope — first steel of spirit',
    slot: 'weapon',
    glyph: '🗡️',
    level: 2,
    streak: 0,
    fullClearLoot: false,
    colors: { primary: '#c8c0b0', secondary: '#6b4a2a', highlight: '#ece6d8' },
  },
  'lantern-staff': {
    id: 'lantern-staff',
    name: 'Lantern Staff',
    blurb: 'Lights the next quest',
    slot: 'weapon',
    glyph: '🕯️',
    level: 5,
    streak: 0,
    fullClearLoot: false,
    colors: { primary: '#8b6a3a', secondary: '#f0b06a', highlight: '#ffe6a0' },
  },
  'hunter-bow': {
    id: 'hunter-bow',
    name: 'Hunter Bow',
    blurb: 'Quiet string, true aim',
    slot: 'weapon',
    glyph: '🏹',
    level: 7,
    streak: 5,
    fullClearLoot: true,
    colors: { primary: '#5a3a1a', secondary: '#2a4a28', highlight: '#8b6a3a' },
  },
  'ember-cloak': {
    id: 'ember-cloak',
    name: 'Ember Cloak',
    blurb: 'Warmth from a forge heart',
    slot: 'cape',
    glyph: '🧥',
    level: 2,
    streak: 0,
    fullClearLoot: false,
    colors: { primary: '#c4453a', secondary: '#6b1e14', highlight: '#e85d3a' },
  },
  'shadow-cape': {
    id: 'shadow-cape',
    name: 'Shadow Cape',
    blurb: 'Night folds around steadfast feet',
    slot: 'cape',
    glyph: '🌑',
    level: 0,
    streak: 7,
    fullClearLoot: true,
    colors: { primary: '#2a2230', secondary: '#121018', highlight: '#5a3a5a' },
  },
  'copper-ring': {
    id: 'copper-ring',
    name: 'Copper Ring',
    blurb: 'A quiet +1 to resolve',
    slot: 'accessory',
    glyph: '💍',
    level: 3,
    streak: 0,
    fullClearLoot: false,
    colors: { primary: '#d4894a', secondary: '#8b5a2b', highlight: '#f0b06a' },
  },
  'verdant-boots': {
    id: 'verdant-boots',
    name: 'Verdant Boots',
    blurb: 'Soft steps on wild paths',
    slot: 'accessory',
    glyph: '🥾',
    level: 8,
    streak: 0,
    fullClearLoot: false,
    colors: { primary: '#2f6b45', secondary: '#1a3a28', highlight: '#5ecf96' },
  },
  'crown-of-dawn': {
    id: 'crown-of-dawn',
    name: 'Crown of Dawn',
    blurb: 'Sunrise for the steadfast',
    slot: 'accessory',
    glyph: '👑',
    level: 10,
    streak: 0,
    fullClearLoot: false,
    colors: { primary: '#e6c35c', secondary: '#8b6a1a', highlight: '#fff0a8' },
  },
  'rune-bracers': {
    id: 'rune-bracers',
    name: 'Rune Bracers',
    blurb: 'Full-clear fortune etched in stone',
    slot: 'accessory',
    glyph: '🪬',
    level: 0,
    streak: 0,
    fullClearLoot: true,
    colors: { primary: '#4a6a8b', secondary: '#7aa2ff', highlight: '#c8e0ff' },
  },
}

export const WEARABLE_IDS = Object.keys(WEARABLES) as WearableId[]

export const SLOT_ORDER: WearableSlot[] = ['chest', 'weapon', 'cape', 'accessory']

export const SLOT_LABELS: Record<WearableSlot, string> = {
  chest: 'Chest',
  weapon: 'Weapon',
  cape: 'Cape',
  accessory: 'Accessory',
}

/** Legacy loot ids from v1 map onto the wearable catalog. */
export const LEGACY_LOOT_MAP: Record<string, WearableId> = {
  'ember-cloak': 'ember-cloak',
  'copper-ring': 'copper-ring',
  'lantern-staff': 'lantern-staff',
  'verdant-boots': 'verdant-boots',
  'crown-of-dawn': 'crown-of-dawn',
}

export function wearablesForSlot(slot: WearableSlot): WearableDef[] {
  return WEARABLE_IDS.map((id) => WEARABLES[id]).filter((w) => w.slot === slot)
}

export function unlockReason(w: WearableDef): string {
  const parts: string[] = []
  if (w.level > 0) parts.push(`Lv ${w.level}`)
  if (w.streak > 0) parts.push(`${w.streak}-day streak`)
  if (w.fullClearLoot) parts.push('full-clear loot')
  return parts.length ? parts.join(' · ') : 'Starter'
}
