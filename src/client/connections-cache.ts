export interface CacheEntry<T> {
  value: T
  updatedAt: number
}

export class TimedMemoryCache<Key, Value> {
  #entries = new Map<Key, CacheEntry<Value>>()

  constructor(
    private readonly freshMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: Key): CacheEntry<Value> | undefined {
    return this.#entries.get(key)
  }

  set(key: Key, value: Value): void {
    this.#entries.set(key, { value, updatedAt: this.now() })
  }

  isFresh(key: Key): boolean {
    const cached = this.#entries.get(key)
    return cached !== undefined && this.now() - cached.updatedAt < this.freshMs
  }

  clear(): void {
    this.#entries.clear()
  }
}
