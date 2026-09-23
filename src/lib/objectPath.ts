/** Nokta ayrımlı yollarla değişmez (immutable) okuma/yazma: 'a.b.0.c'. */

export function getIn(obj: unknown, path: string): unknown {
  let node: unknown = obj
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return node
}

export function setIn<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.')
  const source = obj as unknown as Record<string, unknown> | unknown[]
  const current = Array.isArray(source) ? source[Number(head)] : source[head]
  const nextValue = rest.length === 0 ? value : setIn(current, rest.join('.'), value)
  if (Array.isArray(source)) {
    const copy = [...source]
    copy[Number(head)] = nextValue
    return copy as unknown as T
  }
  return { ...source, [head]: nextValue } as T
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-12
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)
  if (ka.length !== kb.length) return false
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}
