import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { clearState, loadState, saveState } from './db'
import { addDays, todayKey } from './date'
import {
  addTodo,
  atone,
  createInitialState,
  equipLoot,
  needsAtonement,
  removeTodo,
  resetToday,
  rolloverIfNeeded,
  setVibe,
  toggleHabit,
  toggleTodo,
} from './game'
import type { AppState, HabitId, LootId, ToastEvent, VibeId } from './types'

interface StoreApi {
  state: AppState
  ready: boolean
  toasts: ToastEvent[]
  dismissToast: (id: string) => void
  today: string
  showAtonement: boolean
  checkHabit: (id: HabitId) => void
  pickVibe: (id: VibeId) => void
  createTodo: (title: string) => void
  checkTodo: (id: string) => void
  deleteTodo: (id: string) => void
  doAtone: () => void
  setEquipped: (id: LootId | null) => void
  demoResetDay: () => void
  exportJson: () => string
  factoryReset: () => Promise<void>
  seedDemoHistory: () => void
}

const StoreContext = createContext<StoreApi | null>(null)

const HABIT_IDS: HabitId[] = [
  'make-bed',
  'steps',
  'protein',
  'stretch',
  'sign-language',
  'reading',
  'text-call',
  'eat-healthy',
  'plan-tomorrow',
  'workout',
]

function pushToasts(
  setToasts: React.Dispatch<React.SetStateAction<ToastEvent[]>>,
  events: ToastEvent[],
) {
  if (!events.length) return
  setToasts((prev) => [...prev, ...events].slice(-6))
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null)
  const [toasts, setToasts] = useState<ToastEvent[]>([])
  const saveTimer = useRef<number | null>(null)
  const today = todayKey()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const loaded = await loadState()
      const events = rolloverIfNeeded(loaded, todayKey())
      if (cancelled) return
      setState(loaded)
      pushToasts(setToasts, events)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!state) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void saveState(state)
    }, 120)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [state])

  const mutate = useCallback((fn: (draft: AppState) => ToastEvent[]) => {
    setState((prev) => {
      if (!prev) return prev
      const draft = structuredClone(prev)
      const events = fn(draft)
      pushToasts(setToasts, events)
      return draft
    })
  }, [])

  const api: StoreApi = useMemo(() => {
    const s = state ?? createInitialState()
    return {
      state: s,
      ready: !!state,
      toasts,
      dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
      today,
      showAtonement: state ? needsAtonement(state, today) : false,
      checkHabit: (id) => mutate((d) => toggleHabit(d, id, today)),
      pickVibe: (id) => mutate((d) => setVibe(d, id, today)),
      createTodo: (title) =>
        mutate((d) => {
          addTodo(d, title, today)
          return []
        }),
      checkTodo: (id) => mutate((d) => toggleTodo(d, id, today)),
      deleteTodo: (id) =>
        mutate((d) => {
          removeTodo(d, id, today)
          return []
        }),
      doAtone: () => mutate((d) => atone(d, today)),
      setEquipped: (id) =>
        mutate((d) => {
          equipLoot(d, id)
          return []
        }),
      demoResetDay: () =>
        mutate((d) => {
          resetToday(d, today)
          return [{ id: crypto.randomUUID(), kind: 'info', title: 'Today reset for demo' }]
        }),
      exportJson: () => JSON.stringify(s, null, 2),
      factoryReset: async () => {
        await clearState()
        setState(createInitialState())
        setToasts([
          {
            id: crypto.randomUUID(),
            kind: 'info',
            title: 'Fresh adventurer',
            detail: 'All local progress cleared.',
          },
        ])
      },
      seedDemoHistory: () =>
        mutate((d) => {
          for (let i = 1; i <= 10; i++) {
            const key = addDays(today, -i)
            if (d.days[key]) continue
            const vibes: VibeId[] = ['radiant', 'meh-dragon', 'chaotic', 'weary', 'fire']
            const completions: Partial<Record<HabitId, boolean>> = {}
            HABIT_IDS.forEach((hid, idx) => {
              completions[hid] = (i + idx) % 3 !== 0
            })
            const done = Object.values(completions).filter(Boolean).length
            d.days[key] = {
              date: key,
              habitCompletions: completions,
              vibe: vibes[i % vibes.length],
              xpEarned: done * 15,
              xpLost: 0,
              hpDelta: 0,
              fullClear: done === 10,
              penaltyApplied: false,
              atonementDone: false,
              todos: [],
            }
          }
          return [
            {
              id: crypto.randomUUID(),
              kind: 'info',
              title: 'Chronicle seeded',
              detail: 'Sample past days added (local only).',
            },
          ]
        }),
    }
  }, [state, toasts, today, mutate])

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore outside provider')
  return ctx
}
