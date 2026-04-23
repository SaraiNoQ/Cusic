'use client';

import { useQuery } from '@tanstack/react-query';
import { searchContent } from '../../../lib/api/content-api';
import { queryKeys } from '../../../lib/query/query-keys';
import { useUiStore } from '../../../store/ui-store';

export function useSearchController() {
  const isSearchOpen = useUiStore((state) => state.isSearchOpen);
  const searchQuery = useUiStore((state) => state.searchQuery);
  const setSearchQuery = useUiStore((state) => state.setSearchQuery);
  const setSearchOpen = useUiStore((state) => state.setSearchOpen);

  const searchQueryResult = useQuery({
    queryKey: queryKeys.search(searchQuery || 'night'),
    queryFn: async () => searchContent(searchQuery || 'night'),
    enabled: isSearchOpen,
  });

  return {
    isSearchOpen,
    searchQuery,
    setSearchQuery,
    openSearch: () => setSearchOpen(true),
    closeSearch: () => setSearchOpen(false),
    searchResults: searchQueryResult.data?.data.items ?? [],
    isSearching: searchQueryResult.isFetching,
    total:
      searchQueryResult.data?.meta?.total ??
      searchQueryResult.data?.data.items.length ??
      0,
  };
}
