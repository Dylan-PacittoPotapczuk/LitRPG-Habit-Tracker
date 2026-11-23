import type { HabitId, HeroClass } from './types'

export interface ClassDef {
  id: HeroClass
  name: string
  blurb: string
  /** Soft XP bonus habits (~+20% on those quests). */
  biasHabits: HabitId[]
  biasLabel: string
  palette: {
    skin: string
    hair: string
    tunic: string
    accent: string
  }
}

export const CLASSES: ClassDef[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    blurb: 'Steel and sweat. Strength grows from the forge of the body.',
    biasHabits: ['workout', 'stretch', 'protein'],
    biasLabel: '+workout, stretch, protein',
    palette: {
      skin: '#c68642',
      hair: '#3a2415',
      tunic: '#8b3a2a',
      accent: '#d4894a',
    },
  },
  {
    id: 'mage',
    name: 'Mage',
    blurb: 'Ink and ember. Wisdom lights the lantern of the mind.',
    biasHabits: ['reading', 'sign-language'],
    biasLabel: '+reading, sign language',
    palette: {
      skin: '#dbb08a',
      hair: '#2a2a4a',
      tunic: '#3d4a8b',
      accent: '#7aa2ff',
    },
  },
  {
    id: 'ranger',
    name: 'Ranger',
    blurb: 'Trail and leaf. The wild path rewards steady feet.',
    biasHabits: ['steps', 'eat-healthy'],
    biasLabel: '+steps, eat healthy',
    palette: {
      skin: '#b87a4a',
      hair: '#1e3a28',
      tunic: '#2f6b45',
      accent: '#5ecf96',
    },
  },
  {
    id: 'rogue',
    name: 'Rogue',
    blurb: 'Shadow and plan. Quiet deeds unlock secret doors.',
    biasHabits: ['plan-tomorrow', 'text-call', 'make-bed'],
    biasLabel: '+plan, raven, make bed',
    palette: {
      skin: '#c9a07a',
      hair: '#1a1218',
      tunic: '#3a2a3a',
      accent: '#c45a8c',
    },
  },
]

export const CLASS_XP_BIAS = 0.2

export function classDef(id: HeroClass | null | undefined): ClassDef | null {
  if (!id) return null
  return CLASSES.find((c) => c.id === id) ?? null
}

export function habitXpForClass(base: number, habitId: HabitId, heroClass: HeroClass | null): number {
  const def = classDef(heroClass)
  if (!def) return base
  if (def.biasHabits.includes(habitId)) {
    return Math.round(base * (1 + CLASS_XP_BIAS))
  }
  return base
}
