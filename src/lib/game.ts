import { previousDay, todayKey } from './date'
import {
  ATONEMENT_HEAL,
  BADGES,
  FULL_CLEAR_BONUS,
  HABIT_XP,
  HABITS,
  HEAL_PER_COMPLETION,
  LOOT,
  MAX_HP,
  MISS_HP_HIT,
  MISS_XP_LOSS,
  TODO_XP,
  type AppState,
  type BadgeId,
  type DayRecord,
  type HabitId,
  type LootId,
  type PlayerState,
  type ToastEvent,
  type TodoItem,
  type VibeId,
} from './types'

export function xpForLevel(level: number): number {
  // Cumulative XP to reach `level` (level 1 starts at 0)
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
    version: 1,
    player: {
      xp: 0,
      hp: MAX_HP,
      maxHp: MAX_HP,
      dayStreak: 0,
      longestStreak: 0,
      habitStreaks: {},
      badges: [],
      loot: [],
      equippedLoot: null,
      title: titleForLevel(1),
      lastPlayedDate: null,
      createdAt: new Date().toISOString(),
    },
    days: {
      [now]: emptyDay(now),
    },
  }
}

export function ensureDay(state: AppState, date = todayKey()): DayRecord {
  if (!state.days[date]) state.days[date] = emptyDay(date)
  return state.days[date]
}

function clampHp(player: PlayerState) {
  player.hp = Math.max(0, Math.min(player.maxHp, player.hp))
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

function grantLootForLevel(player: PlayerState, level: number, toasts: ToastEvent[]) {
  ;(Object.keys(LOOT) as LootId[]).forEach((id) => {
    if (LOOT[id].level <= level && !player.loot.includes(id)) {
      player.loot.push(id)
      if (!player.equippedLoot) player.equippedLoot = id
      toasts.push({
        id: crypto.randomUUID(),
        kind: 'loot',
        title: `Loot unlocked: ${LOOT[id].name}`,
        detail: LOOT[id].blurb,
      })
    }
  })
  if (player.loot.length >= 3) grantBadge(player, 'loot-hoarder', toasts)
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
    grantLootForLevel(player, after, toasts)
  }
}

function dayHadActivity(day: DayRecord | undefined): boolean {
  if (!day) return false
  const habits = Object.values(day.habitCompletions).some(Boolean)
  const todos = day.todos.some((t) => t.completedOn)
  return habits || todos
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

  // Only penalize the immediate previous day if it had no activity and we skipped past it
  const prev = previousDay(today)
  const prevDay = state.days[prev]
  const missed = !dayHadActivity(prevDay)

  if (missed && last !== prev) {
    // Came back after a gap — previous day empty
    const day = ensureDay(state, prev)
    if (!day.penaltyApplied) {
      day.penaltyApplied = true
      day.xpLost += MISS_XP_LOSS
      day.hpDelta -= MISS_HP_HIT
      applyXp(player, -MISS_XP_LOSS, toasts, 'Missed previous day')
      player.hp -= MISS_HP_HIT
      clampHp(player)
      player.dayStreak = 0
      toasts.push({
        id: crypto.randomUUID(),
        kind: 'penalty',
        title: 'The realm noticed your absence',
        detail: `−${MISS_XP_LOSS} XP · −${MISS_HP_HIT} HP. Heal by completing quests or atone.`,
      })
    }
  } else if (missed && last === prev) {
    // Opened today; yesterday empty after playing yesterday start — still a miss if no activity
    const day = ensureDay(state, prev)
    if (!day.penaltyApplied && !dayHadActivity(day)) {
      day.penaltyApplied = true
      day.xpLost += MISS_XP_LOSS
      day.hpDelta -= MISS_HP_HIT
      applyXp(player, -MISS_XP_LOSS, toasts, 'Missed previous day')
      player.hp -= MISS_HP_HIT
      clampHp(player)
      player.dayStreak = 0
      toasts.push({
        id: crypto.randomUUID(),
        kind: 'penalty',
        title: 'The realm noticed your absence',
        detail: `−${MISS_XP_LOSS} XP · −${MISS_HP_HIT} HP. Heal by completing quests or atone.`,
      })
    }
  } else if (dayHadActivity(prevDay)) {
    // Continuity already counted when they completed; leave streak
  }

  // If gap > 1 day, reset streak
  if (last && last < prev) {
    player.dayStreak = 0
  }

  player.lastPlayedDate = today
  return toasts
}

function recomputeFullClear(day: DayRecord, player: PlayerState, toasts: ToastEvent[]) {
  const allDone = HABITS.every((h) => day.habitCompletions[h.id])
  if (allDone && !day.fullClear) {
    day.fullClear = true
    day.xpEarned += FULL_CLEAR_BONUS
    applyXp(player, FULL_CLEAR_BONUS, toasts, 'Full clear bonus')
    grantBadge(player, 'full-clear', toasts)
    // Soft loot chance: if unlucky level gap, still celebrate
    if (Math.random() < 0.35) {
      toasts.push({
        id: crypto.randomUUID(),
        kind: 'loot',
        title: 'A spark of fortune!',
        detail: 'Full clear shimmer — keep the streak for real loot unlocks.',
      })
    }
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
    day.xpEarned += HABIT_XP
    applyXp(player, HABIT_XP, toasts, HABITS.find((h) => h.id === habitId)?.title ?? 'Habit')
    player.hp += HEAL_PER_COMPLETION
    clampHp(player)
    toasts.push({
      id: crypto.randomUUID(),
      kind: 'heal',
      title: `+${HEAL_PER_COMPLETION} HP`,
      detail: 'Quest completion soothes the spirit',
    })
    player.habitStreaks[habitId] = (player.habitStreaks[habitId] ?? 0) + 1
    grantBadge(player, 'first-quest', toasts)
    maybeBumpStreak(state, date, toasts)
    recomputeFullClear(day, player, toasts)
  } else {
    day.xpEarned = Math.max(0, day.xpEarned - HABIT_XP)
    applyXp(player, -HABIT_XP, toasts, 'Unchecked habit')
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
    // Continuing — only set if we haven't already counted today as continuation
    // Heuristic: if lastPlayed was yesterday or streak already running and today first completion
    if (player.lastPlayedDate === previousDay(date) || player.dayStreak > 0) {
      // Increment only on first activity of the day
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
    // First activity today without yesterday — restart at 1 unless already set today
    const completions =
      Object.values(day.habitCompletions).filter(Boolean).length +
      day.todos.filter((t) => t.completedOn).length
    if (completions === 1) player.dayStreak = 1
  }

  player.longestStreak = Math.max(player.longestStreak, player.dayStreak)
  if (player.dayStreak >= 7) grantBadge(player, 'week-warrior', toasts)
  if (player.dayStreak >= 30) grantBadge(player, 'iron-will', toasts)
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
  toasts.push({
    id: crypto.randomUUID(),
    kind: 'heal',
    title: 'Atonement complete',
    detail: `+${ATONEMENT_HEAL} HP — the path forgives.`,
  })
  return toasts
}

export function equipLoot(state: AppState, id: LootId | null): void {
  if (id && !state.player.loot.includes(id)) return
  state.player.equippedLoot = id
}

export function resetToday(state: AppState, date = todayKey()): void {
  const old = state.days[date]
  // Reverse today's XP roughly by subtracting xpEarned (best-effort for demo)
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
