/** Local calendar date as YYYY-MM-DD */
export function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key)
  d.setDate(d.getDate() + n)
  return todayKey(d)
}

export function previousDay(key: string): string {
  return addDays(key, -1)
}

export function formatPretty(key: string): string {
  return parseKey(key).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function weekKeys(endingOn: string): string[] {
  const keys: string[] = []
  for (let i = 6; i >= 0; i--) keys.push(addDays(endingOn, -i))
  return keys
}

export function lastNDays(endingOn: string, n: number): string[] {
  const keys: string[] = []
  for (let i = n - 1; i >= 0; i--) keys.push(addDays(endingOn, -i))
  return keys
}
