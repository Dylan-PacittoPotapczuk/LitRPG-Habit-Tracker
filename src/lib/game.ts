import { habitXpForClass } from './classes'
import { previousDay, todayKey } from './date'
import {
  ATONEMENT_HEAL,
  BADGES,
  FULL_CLEAR_BONUS,
  HABIT_XP,
  HABITS,
  HEAL_PER_COMPLETION,
  MAX_HP,
  MISS_HP_HIT,
  MISS_XP_LOSS,
  TODO_XP,
  type AppState,
  type BadgeId,
  type DayRecord,
  type EquippedLoadout,
  type HabitId,
  type HeroClass,
  type HeroRace,
  type PlayerState,
  type ToastEvent,
  type TodoItem,
  type VibeId,
  type WearableId,
  type WearableSlot,
} from './types'
import { LEGACY_LOOT_MAP, WEARABLES, WEARABLE_IDS } from './wearables'

export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  return Math.floor(80 * Math.pow(level - 1, 1.65))
}

export function levelFromXp(xp: number): number {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level += 1
  return Math.min(level, 50)
}

export function progressInLevel(xp: number): { level: number; into: number; need: number; pct: number } {
  const level = levelFromXp(xp)
  const floor = xpForLevel(level)
  const next = xpForLevel(level + 1)
  const into = xp - floor
  const need = Math.max(1, next - floor)
  return { level, into, need, pct: Math.min(100, (into / need) * 100) }
}

export function titleForLevel(level: number): string {
  if (level >= 20) return 'Realm Walker'
  if (level >= 15) return 'Dawn Captain'
  if (level >= 10) return 'Quest Knight'
  if (level >= 7) return 'Pathfinder'
  if (level >= 5) return 'Adept Adventurer'
  if (level >= 3) return 'Squire of Habits'
  return 'Village Initiate'
}

export function avatarStage(level: number): 1 | 2 | 3 | 4 | 5 {
  if (level >= 12) return 5
  if (level >= 8) return 4
  if (level >= 5) return 3
  if (level >= 3) return 2
  return 1
}

function emptyDay(date: string): DayRecord {
  return {
    date,
    habitCompletions: {},
    vibe: null,
    xpEarned: 0,
    xpLost: 0,
    hpDelta: 0,
    fullClear: false,
    penaltyApplied: false,
    atonementDone: false,
    todos: [],
  }
}

export function createInitialState(): AppState {
  const now = todayKey()
  return {
    version: 2,
    player: {
      xp: 0,
      hp: MAX_HP,
      maxHp: MAX_HP,
      dayStreak: 0,
      longestStreak: 0,
      habitStreaks: {},
      badges: [],
      loot: ['cloth-tunic'],
      equipped: { chest: 'cloth-tunic' },
      gearDamaged: false,
      heroClass: null,
      heroRace: null,
      title: titleForLevel(1),
      lastPlayedDate: null,
      createdAt: new Date().toISOString(),
    },
    days: {
      [now]: emptyDay(now),
    },
  }
}

/** Migrate v1 (or partial) saves into the class + multi-slot wearable model. */
export function migrateState(raw: unknown): AppState {
  const base = createInitialState()
  if (!raw || typeof raw !== 'object') return base
  const incoming = raw as {
    version?: number
    player?: Partial<PlayerState> & {
      equippedLoot?: string | null
      loot?: string[]
    }
    days?: Record<string, DayRecord>
  }

  const player = { ...base.player, ...(incoming.player ?? {}) }

  // Normalize loot ids from legacy names
  const lootRaw = incoming.player?.loot ?? player.loot ?? []
  const loot: WearableId[] = []
  for (const id of lootRaw) {
    const mapped = (LEGACY_LOOT_MAP[id] ?? id) as WearableId
    if (WEARABLES[mapped] && !loot.includes(mapped)) loot.push(mapped)
  }
  if (!loot.includes('cloth-tunic')) loot.unshift('cloth-tunic')
  player.loot = loot

  // Build equipped loadout from v2 equipped or v1 single equippedLoot
  let equipped: EquippedLoadout = { ...(incoming.player?.equipped ?? {}) }
  if (incoming.player?.equippedLoot) {
    const mapped = (LEGACY_LOOT_MAP[incoming.player.equippedLoot] ??
      incoming.player.equippedLoot) as WearableId
    if (WEARABLES[mapped]) {
      equipped[WEARABLES[mapped].slot] = mapped
    }
  }
  if (!equipped.chest && loot.includes('cloth-tunic')) {
    equipped.chest = 'cloth-tunic'
  }
  // Drop equipped pieces that aren't owned
  for (const slot of Object.keys(equipped) as WearableSlot[]) {
    const id = equipped[slot]
    if (id && !loot.includes(id)) delete equipped[slot]
  }
  player.equipped = equipped
  player.gearDamaged = Boolean(incoming.player?.gearDamaged)
  player.heroClass = (incoming.player?.heroClass as HeroClass | null | undefined) ?? null
  player.heroRace = (incoming.player?.heroRace as HeroRace | null | undefined) ?? null

  return {
    version: 2,
    player,
    days: incoming.days ?? base.days,
  }
}

export function ensureDay(state: AppState, date = todayKey()): DayRecord {
  if (!state.days[date]) state.days[date] = emptyDay(date)
  return state.days[date]
}

function clampHp(player: PlayerState) {
  player.hp = Math.max(0, Math.min(player.maxHp, player.hp))
}

function maybeClearDamage(player: PlayerState, toasts: ToastEvent[]) {
  if (player.gearDamaged && player.hp >= player.maxHp) {
    player.gearDamaged = false
    toasts.push({
      id: crypto.randomUUID(),
      kind: 'heal',
      title: 'Gear mended',
      detail: 'Your armor shines again.',
    })
  }
}

function grantBadge(player: PlayerState, id: BadgeId, toasts: ToastEvent[]) {
  if (player.badges.includes(id)) return
  player.badges.push(id)
  const b = BADGES[id]
  toasts.push({
    id: crypto.randomUUID(),
    kind: 'badge',
    title: `Badge: ${b.name}`,
    detail: b.blurb,
  })
}

function grantWearable(player: PlayerState, id: WearableId, toasts: ToastEvent[], reason: string) {
  if (player.loot.includes(id)) return false
  player.loot.push(id)
  const w = WEARABLES[id]
  const slotEmpty = !player.equipped[w.slot]
  if (slotEmpty) player.equipped[w.slot] = id
  toasts.push({
    id: crypto.randomUUID(),
    kind: 'loot',
    title: `Loot unlocked: ${w.name}`,
    detail: reason || w.blurb,
  })
  if (player.loot.length >= 3) grantBadge(player, 'loot-hoarder', toasts)
  return true
}

function checkUnlocks(player: PlayerState, toasts: ToastEvent[]) {
  const level = levelFromXp(player.xp)
  for (const id of WEARABLE_IDS) {
    const w = WEARABLES[id]
    if (player.loot.includes(id)) continue
    const levelOk = w.level > 0 && level >= w.level
    const streakOk = w.streak > 0 && player.dayStreak >= w.streak
    // Full-clear-only pieces (no level/streak gate) wait for loot rolls.
    if (!levelOk && !streakOk) continue
    const reason = levelOk ? `Reached level ${level}` : `${player.dayStreak}-day streak`
    grantWearable(player, id, toasts, reason)
  }
}

function applyXp(player: PlayerState, amount: number, toasts: ToastEvent[], label: string) {
  if (amount === 0) return
  const before = levelFromXp(player.xp)
  player.xp = Math.max(0, player.xp + amount)
  const after = levelFromXp(player.xp)
  player.title = titleForLevel(after)
  if (amount > 0) {
    toasts.push({
      id: crypto.randomUUID(),
      kind: 'xp',
      title: `+${amount} XP`,
      detail: label,
    })
  }
  if (after > before) {
    toasts.push({
      id: crypto.randomUUID(),
      kind: 'level',
      title: `Level up! → ${after}`,
      detail: player.title,
    })
    checkUnlocks(player, toasts)
  }
}

function dayHadActivity(day: DayRecord | undefined): boolean {
  if (!day) return false
  const habits = Object.values(day.habitCompletions).some(Boolean)
  const todos = day.todos.some((t) => t.completedOn)
  return habits || todos
}

function applyMissPenalty(player: PlayerState, day: DayRecord, toasts: ToastEvent[]) {
  if (day.penaltyApplied) return
  day.penaltyApplied = true
  day.xpLost += MISS_XP_LOSS
  day.hpDelta -= MISS_HP_HIT
  applyXp(player, -MISS_XP_LOSS, toasts, 'Missed previous day')
  player.hp -= MISS_HP_HIT
  clampHp(player)
  player.dayStreak = 0
  player.gearDamaged = true
  toasts.push({
    id: crypto.randomUUID(),
    kind: 'penalty',
    title: 'The realm noticed your absence',
    detail: `−${MISS_XP_LOSS} XP · −${MISS_HP_HIT} HP. Armor scuffed until you heal.`,
  })
}

/** Apply missed-day penalties when opening a new calendar day. */
export function rolloverIfNeeded(state: AppState, today = todayKey()): ToastEvent[] {
  const toasts: ToastEvent[] = []
  const player = state.player
  const last = player.lastPlayedDate

  ensureDay(state, today)

  if (!last) {
    player.lastPlayedDate = today
    return toasts
  }

  if (last === today) return toasts

  const prev = previousDay(today)
  const prevDay = state.days[prev]
  const missed = !dayHadActivity(prevDay)

  if (missed && last !== prev) {
    const day = ensureDay(state, prev)
    applyMissPenalty(player, day, toasts)
  } else if (missed && last === prev) {
    const day = ensureDay(state, prev)
    if (!dayHadActivity(day)) applyMissPenalty(player, day, toasts)
  }

  if (last && last < prev) {
    player.dayStreak = 0
  }

  player.lastPlayedDate = today
  return toasts
}

function rollFullClearLoot(player: PlayerState, toasts: ToastEvent[]) {
  const pool = WEARABLE_IDS.filter(
    (id) => WEARABLES[id].fullClearLoot && !player.loot.includes(id),
  )
  if (!pool.length) {
    if (Math.random() < 0.35) {
      toasts.push({
        id: crypto.randomUUID(),
        kind: 'loot',
        title: 'A spark of fortune!',
        detail: 'Full clear shimmer — keep the streak for real loot unlocks.',
      })
    }
    return
  }
  if (Math.random() < 0.45) {
    const pick = pool[Math.floor(Math.random() * pool.length)]
    grantWearable(player, pick, toasts, 'Full-clear loot roll')
  } else {
    toasts.push({
      id: crypto.randomUUID(),
      kind: 'loot',
      title: 'A spark of fortune!',
      detail: 'The chest rattled — no piece this time. Tomorrow, perhaps.',
    })
  }
}

function recomputeFullClear(day: DayRecord, player: PlayerState, toasts: ToastEvent[]) {
  const allDone = HABITS.every((h) => day.habitCompletions[h.id])
  if (allDone && !day.fullClear) {
    day.fullClear = true
    day.xpEarned += FULL_CLEAR_BONUS
    applyXp(player, FULL_CLEAR_BONUS, toasts, 'Full clear bonus')
    grantBadge(player, 'full-clear', toasts)
    rollFullClearLoot(player, toasts)
  }
}

export function toggleHabit(
  state: AppState,
  habitId: HabitId,
  date = todayKey(),
): ToastEvent[] {
  const toasts: ToastEvent[] = []
  const day = ensureDay(state, date)
  const player = state.player
  const was = !!day.habitCompletions[habitId]
  day.habitCompletions[habitId] = !was

  if (!was) {
    const xp = habitXpForClass(HABIT_XP, habitId, player.heroClass)
    const bias =
      xp > HABIT_XP ? ` (class +${xp - HABIT_XP})` : ''
    day.xpEarned += xp
    applyXp(
      player,
      xp,
      toasts,
      `${HABITS.find((h) => h.id === habitId)?.title ?? 'Habit'}${bias}`,
    )
    player.hp += HEAL_PER_COMPLETION
    clampHp(player)
    toasts.push({
      id: crypto.randomUUID(),
      kind: 'heal',
      title: `+${HEAL_PER_COMPLETION} HP`,
      detail: 'Quest completion soothes the spirit',
    })
    maybeClearDamage(player, toasts)
    player.habitStreaks[habitId] = (player.habitStreaks[habitId] ?? 0) + 1
    grantBadge(player, 'first-quest', toasts)
    maybeBumpStreak(state, date, toasts)
    recomputeFullClear(day, player, toasts)
  } else {
    const xp = habitXpForClass(HABIT_XP, habitId, player.heroClass)
    day.xpEarned = Math.max(0, day.xpEarned - xp)
    applyXp(player, -xp, toasts, 'Unchecked habit')
    player.habitStreaks[habitId] = Math.max(0, (player.habitStreaks[habitId] ?? 1) - 1)
    if (day.fullClear) {
      day.fullClear = false
      day.xpEarned = Math.max(0, day.xpEarned - FULL_CLEAR_BONUS)
      applyXp(player, -FULL_CLEAR_BONUS, toasts, 'Full clear revoked')
    }
  }

  player.lastPlayedDate = date
  return toasts
}

function maybeBumpStreak(state: AppState, date: string, toasts: ToastEvent[]) {
  const player = state.player
  const day = state.days[date]
  if (!dayHadActivity(day)) return

  const prev = state.days[previousDay(date)]
  if (dayHadActivity(prev)) {
    if (player.lastPlayedDate === previousDay(date) || player.dayStreak > 0) {
      const completions =
        Object.values(day.habitCompletions).filter(Boolean).length +
        day.todos.filter((t) => t.completedOn).length
      if (completions === 1) {
        player.dayStreak += 1
      }
    }
  } else if (player.dayStreak === 0) {
    player.dayStreak = 1
  } else {
    const completions =
      Object.values(day.habitCompletions).filter(Boolean).length +
      day.todos.filter((t) => t.completedOn).length
    if (completions === 1) player.dayStreak = 1
  }

  player.longestStreak = Math.max(player.longestStreak, player.dayStreak)
  if (player.dayStreak >= 7) grantBadge(player, 'week-warrior', toasts)
  if (player.dayStreak >= 30) grantBadge(player, 'iron-will', toasts)
  checkUnlocks(player, toasts)
}

export function setVibe(state: AppState, vibe: VibeId, date = todayKey()): ToastEvent[] {
  const day = ensureDay(state, date)
  if (day.vibe) return []
  day.vibe = vibe
  const toasts: ToastEvent[] = [
    {
      id: crypto.randomUUID(),
      kind: 'info',
      title: 'Vibe locked in',
      detail: 'One feeling per day — the chronicle remembers.',
    },
  ]
  const vibeDays = Object.values(state.days).filter((d) => d.vibe).length
  if (vibeDays >= 7) grantBadge(state.player, 'vibe-chronicler', toasts)
  state.player.lastPlayedDate = date
  return toasts
}

export function addTodo(state: AppState, title: string, date = todayKey()): void {
  const day = ensureDay(state, date)
  const item: TodoItem = {
    id: crypto.randomUUID(),
    title: title.trim(),
    createdOn: date,
    completedOn: null,
  }
  if (!item.title) return
  day.todos.push(item)
}

export function toggleTodo(state: AppState, todoId: string, date = todayKey()): ToastEvent[] {
  const toasts: ToastEvent[] = []
  const day = ensureDay(state, date)
  const todo = day.todos.find((t) => t.id === todoId)
  if (!todo) return toasts
  const player = state.player

  if (!todo.completedOn) {
    todo.completedOn = date
    day.xpEarned += TODO_XP
    applyXp(player, TODO_XP, toasts, todo.title)
    player.hp += HEAL_PER_COMPLETION
    clampHp(player)
    maybeClearDamage(player, toasts)
    grantBadge(player, 'first-quest', toasts)
    maybeBumpStreak(state, date, toasts)
  } else {
    todo.completedOn = null
    day.xpEarned = Math.max(0, day.xpEarned - TODO_XP)
    applyXp(player, -TODO_XP, toasts, 'Unchecked todo')
  }
  player.lastPlayedDate = date
  return toasts
}

export function removeTodo(state: AppState, todoId: string, date = todayKey()): void {
  const day = ensureDay(state, date)
  day.todos = day.todos.filter((t) => t.id !== todoId)
}

export function atone(state: AppState, date = todayKey()): ToastEvent[] {
  const toasts: ToastEvent[] = []
  const day = ensureDay(state, date)
  const prev = ensureDay(state, previousDay(date))
  if (!prev.penaltyApplied || day.atonementDone) return toasts
  day.atonementDone = true
  state.player.hp += ATONEMENT_HEAL
  clampHp(state.player)
  day.hpDelta += ATONEMENT_HEAL
  grantBadge(state.player, 'atoned', toasts)
  maybeClearDamage(state.player, toasts)
  toasts.push({
    id: crypto.randomUUID(),
    kind: 'heal',
    title: 'Atonement complete',
    detail: `+${ATONEMENT_HEAL} HP — the path forgives.`,
  })
  return toasts
}

export function equipWearable(state: AppState, id: WearableId | null, slot?: WearableSlot): void {
  if (!id) {
    if (slot) delete state.player.equipped[slot]
    return
  }
  if (!state.player.loot.includes(id)) return
  const w = WEARABLES[id]
  const target = slot ?? w.slot
  if (target !== w.slot) return
  const current = state.player.equipped[target]
  if (current === id) {
    delete state.player.equipped[target]
  } else {
    state.player.equipped[target] = id
  }
}

/** @deprecated use equipWearable */
export function equipLoot(state: AppState, id: WearableId | null): void {
  equipWearable(state, id)
}

export function chooseHero(
  state: AppState,
  heroRace: HeroRace,
  heroClass: HeroClass,
): ToastEvent[] {
  state.player.heroRace = heroRace
  state.player.heroClass = heroClass
  if (!state.player.loot.includes('cloth-tunic')) {
    state.player.loot.unshift('cloth-tunic')
  }
  if (!state.player.equipped.chest) {
    state.player.equipped.chest = 'cloth-tunic'
  }
  const raceName = heroRace[0].toUpperCase() + heroRace.slice(1)
  const className = heroClass[0].toUpperCase() + heroClass.slice(1)
  return [
    {
      id: crypto.randomUUID(),
      kind: 'info',
      title: `${raceName} ${className} ready`,
      detail: 'Soft habit XP bias is active. Respec race or class anytime in Settings.',
    },
  ]
}

/** @deprecated prefer chooseHero */
export function chooseClass(state: AppState, heroClass: HeroClass): ToastEvent[] {
  return chooseHero(state, state.player.heroRace ?? 'human', heroClass)
}

export function respecClass(state: AppState, heroClass: HeroClass): ToastEvent[] {
  state.player.heroClass = heroClass
  return [
    {
      id: crypto.randomUUID(),
      kind: 'info',
      title: `Class respec → ${heroClass[0].toUpperCase()}${heroClass.slice(1)}`,
      detail: 'XP bias habits updated. Race and gear stay.',
    },
  ]
}

export function respecRace(state: AppState, heroRace: HeroRace): ToastEvent[] {
  state.player.heroRace = heroRace
  return [
    {
      id: crypto.randomUUID(),
      kind: 'info',
      title: `Race respec → ${heroRace[0].toUpperCase()}${heroRace.slice(1)}`,
      detail: 'Silhouette and skin updated. Class and gear stay.',
    },
  ]
}

export function resetToday(state: AppState, date = todayKey()): void {
  const old = state.days[date]
  if (old) {
    state.player.xp = Math.max(0, state.player.xp - old.xpEarned + old.xpLost)
    state.player.title = titleForLevel(levelFromXp(state.player.xp))
  }
  state.days[date] = emptyDay(date)
}

export function completionPct(day: DayRecord | undefined): number {
  if (!day) return 0
  const done = HABITS.filter((h) => day.habitCompletions[h.id]).length
  return Math.round((done / HABITS.length) * 100)
}

export function needsAtonement(state: AppState, date = todayKey()): boolean {
  const prev = state.days[previousDay(date)]
  const day = state.days[date]
  return !!(prev?.penaltyApplied && day && !day.atonementDone)
}

/** Demo helper: unlock a wearable as if looted. */
export function debugGrantWearable(state: AppState, id: WearableId): ToastEvent[] {
  const toasts: ToastEvent[] = []
  grantWearable(state.player, id, toasts, 'Demo unlock')
  return toasts
}
