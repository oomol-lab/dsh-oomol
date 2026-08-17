export interface ListRequestSnapshot {
  activated: boolean
  revision: number
}

export class ConnectionsListRequests {
  #snapshot: ListRequestSnapshot = { activated: false, revision: 0 }
  #listeners = new Set<() => void>()

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }

  getSnapshot = () => this.#snapshot

  request = () => {
    this.publish()
  }

  invalidate = () => {
    if (this.#snapshot.activated) this.publish()
  }

  private publish() {
    this.#snapshot = {
      activated: true,
      revision: this.#snapshot.revision + 1,
    }
    for (const listener of this.#listeners) listener()
  }
}
