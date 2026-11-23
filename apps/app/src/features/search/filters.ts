import { useSyncExternalStore } from 'react';

/** Search filters, shared between the search tab and the filter sheet. */
export interface SearchFilters {
  book?: string;
  chapter?: string;
}

let filters: SearchFilters = {};
const listeners = new Set<() => void>();

export function setSearchFilters(next: SearchFilters) {
  filters = next;
  listeners.forEach((l) => l());
}

export function useSearchFilters(): SearchFilters {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => filters,
    () => filters,
  );
}
