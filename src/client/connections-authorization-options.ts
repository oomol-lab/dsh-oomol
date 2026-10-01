export type AuthorizationOptionRisk = "standard" | "sensitive" | "destructive"

export interface AuthorizationOption {
  id: string
  label: string
  description?: string
  required: boolean
  defaultSelected: boolean
  risk: AuthorizationOptionRisk
  requires?: string[]
}

/**
 * Mirrors Connector Console: start from the existing grant (reconnect) when it matches declared
 * options, otherwise from the required and default-selected options, then add required options and their `requires`.
 * The result follows the Provider declaration order.
 */
export function createInitialAuthorizationOptionIds(
  options: AuthorizationOption[] | undefined,
  currentScopes?: string[],
): string[] {
  if (!options?.length) return []
  // Providers may map option ids to different native scopes. When the existing grant matches no
  // option, fall back to the defaults instead of silently narrowing the reconnect to required ones.
  const granted = currentScopes?.filter((scope) => options.some((option) => option.id === scope))
  const selected = granted?.length
    ? new Set(granted)
    : new Set(options.filter((option) => option.required || option.defaultSelected).map((option) => option.id))
  for (const option of options) {
    if (option.required) selected.add(option.id)
  }
  addDependencies(options, selected, [...selected])
  return orderedSelection(options, selected)
}

/**
 * Selecting an option also selects everything it `requires`. Deselecting only removes that option:
 * Connector treats `requires` as a selection hint and never re-adds or cascades dependencies.
 * Required options cannot be deselected.
 */
export function updateAuthorizationOptionIds(
  options: AuthorizationOption[],
  selectedIds: string[],
  optionId: string,
  checked: boolean,
): string[] {
  const option = options.find((candidate) => candidate.id === optionId)
  if (!option || (!checked && option.required)) return selectedIds
  const selected = new Set(selectedIds)
  if (checked) {
    selected.add(optionId)
    addDependencies(options, selected, [optionId])
  } else {
    selected.delete(optionId)
  }
  return orderedSelection(options, selected)
}

function addDependencies(options: AuthorizationOption[], selected: Set<string>, optionIds: string[]) {
  const optionById = new Map(options.map((option) => [option.id, option]))
  const pending = [...optionIds]
  while (pending.length > 0) {
    const optionId = pending.pop()
    if (optionId === undefined) continue
    for (const requiredId of optionById.get(optionId)?.requires ?? []) {
      if (selected.has(requiredId) || !optionById.has(requiredId)) continue
      selected.add(requiredId)
      pending.push(requiredId)
    }
  }
}

function orderedSelection(options: AuthorizationOption[], selected: Set<string>) {
  return options.filter((option) => selected.has(option.id)).map((option) => option.id)
}
