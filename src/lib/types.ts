export type HabitId =
  | 'make-bed'
  | 'steps'
  | 'protein'
  | 'stretch'
  | 'sign-language'
  | 'reading'
  | 'text-call'
  | 'eat-healthy'
  | 'plan-tomorrow'
  | 'workout'

export type VibeId = 'radiant' | 'meh-dragon' | 'chaotic' | 'weary' | 'fire'

export type LootId =
  | 'ember-cloak'
  | 'copper-ring'
  | 'lantern-staff'
  | 'verdant-boots'
  | 'crown-of-dawn'

export type BadgeId =
  | 'first-quest'
  | 'full-clear'
  | 'week-warrior'
  | 'iron-will'
  | 'vibe-chronicler'
  | 'atoned'
  | 'loot-hoarder'

export interface HabitDef {
  id: HabitId
  title: string
  blurb: string
  icon: string
}

export interface TodoItem {
  id: string
  title: string
  createdOn: string
  completedOn: string | null
}

export interface DayRecord {
  date: string
  habitCompletions: Partial<Record<HabitId, boolean>>
  vibe: VibeId | null
  xpEarned: number
  xpLost: number
  hpDelta: number
  fullClear: boolean
  penaltyApplied: boolean
  atonementDone: boolean
  todos: TodoItem[]
}

export interface PlayerState {
  xp: number
  hp: number
  maxHp: number
  dayStreak: number
  longestStreak: number
  habitStreaks: Partial<Record<HabitId, number>>
  badges: BadgeId[]
  loot: LootId[]
  equippedLoot: LootId | null
  title: string
  lastPlayedDate: string | null
  createdAt: string
}

export interface AppState {
  player: PlayerState
  days: Record<string, DayRecord>
  version: 1
}

export interface ToastEvent {
  id: string
  kind: 'xp' | 'level' | 'loot' | 'badge' | 'penalty' | 'heal' | 'info'
  title: string
  detail?: string
}

export const HABITS: HabitDef[] = [
  { id: 'make-bed', title: 'Make bed', blurb: 'Tidy the nest', icon: '🛏️' },
  { id: 'steps', title: '5k steps', blurb: 'Wander the realm', icon: '🥾' },
  { id: 'protein', title: '80g protein', blurb: 'Feast for power', icon: '🍖' },
  { id: 'stretch', title: '15 min stretch', blurb: 'Loosen the armor', icon: '🧘' },
  { id: 'sign-language', title: 'Sign language practice', blurb: 'Speak with hands', icon: '🤟' },
  { id: 'reading', title: '15 minute reading', blurb: 'Study the scrolls', icon: '📖' },
  { id: 'text-call', title: 'Text/call someone', blurb: 'Send a raven', icon: '🕊️' },
  { id: 'eat-healthy', title: 'Eat healthy', blurb: 'Herb & hearth', icon: '🥗' },
  { id: 'plan-tomorrow', title: 'Plan tomorrow', blurb: 'Chart the path', icon: '🗺️' },
  { id: 'workout', title: 'Workout minimum 15 minutes', blurb: 'Train for battle', icon: '⚔️' },
]

export const VIBES: { id: VibeId; emoji: string; label: string; quip: string }[] = [
  { id: 'radiant', emoji: '✨', label: 'Radiant', quip: 'Glowing like a loot drop' },
  { id: 'meh-dragon', emoji: '🐉', label: 'Meh-dragon', quip: 'Could nap on a pile of gold' },
  { id: 'chaotic', emoji: '⚡', label: 'Chaotic', quip: 'Critting at life, randomly' },
  { id: 'weary', emoji: '🪨', label: 'Weary', quip: 'HP low, caffeine empty' },
  { id: 'fire', emoji: '🔥', label: 'Fire', quip: 'Ready to raid the day' },
]

export const LOOT: Record<LootId, { name: string; level: number; blurb: string; glyph: string }> = {
  'ember-cloak': { name: 'Ember Cloak', level: 2, blurb: 'Warmth from a forge heart', glyph: '🧥' },
  'copper-ring': { name: 'Copper Ring', level: 3, blurb: 'A quiet +1 to resolve', glyph: '💍' },
  'lantern-staff': { name: 'Lantern Staff', level: 5, blurb: 'Lights the next quest', glyph: '🕯️' },
  'verdant-boots': { name: 'Verdant Boots', level: 8, blurb: 'Soft steps on wild paths', glyph: '🥾' },
  'crown-of-dawn': { name: 'Crown of Dawn', level: 10, blurb: 'Sunrise for the steadfast', glyph: '👑' },
}

export const BADGES: Record<BadgeId, { name: string; blurb: string; glyph: string }> = {
  'first-quest': { name: 'First Quest', blurb: 'Completed your first habit', glyph: '🏁' },
  'full-clear': { name: 'Full Clear', blurb: 'Cleared every habit in a day', glyph: '🏆' },
  'week-warrior': { name: 'Week Warrior', blurb: '7-day streak', glyph: '🗡️' },
  'iron-will': { name: 'Iron Will', blurb: '30-day streak', glyph: '🛡️' },
  'vibe-chronicler': { name: 'Vibe Chronicler', blurb: 'Logged 7 vibes', glyph: '📜' },
  atoned: { name: 'Atoned', blurb: 'Healed after a miss', glyph: '🌿' },
  'loot-hoarder': { name: 'Loot Hoarder', blurb: 'Unlocked 3 loot pieces', glyph: '💎' },
}

export const HABIT_XP = 15
export const TODO_XP = 10
export const FULL_CLEAR_BONUS = 40
export const MISS_XP_LOSS = 25
export const MISS_HP_HIT = 20
export const HEAL_PER_COMPLETION = 5
export const ATONEMENT_HEAL = 15
export const MAX_HP = 100
