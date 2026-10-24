export interface SearchableProvider {
  service: string
  displayName: string
  categories: Array<{ id: string; displayName: string }>
  searchAliases: string[]
}

export function filterProvidersByQuery<T extends SearchableProvider>(providers: T[], query: string): T[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return providers
  return providers.filter((item) =>
    // Category ids stay English when display names are localized.
    [
      item.displayName,
      item.service,
      ...item.categories.flatMap((category) => [category.id, category.displayName]),
      ...item.searchAliases,
    ]
      .some((value) => value.toLowerCase().includes(normalized)),
  )
}
