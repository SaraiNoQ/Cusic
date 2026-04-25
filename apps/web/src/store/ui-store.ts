import { create } from 'zustand';

type UiStore = {
  isSearchOpen: boolean;
  isRecommendationOpen: boolean;
  searchQuery: string;
  setSearchOpen: (isOpen: boolean) => void;
  setRecommendationOpen: (isOpen: boolean) => void;
  setSearchQuery: (query: string) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  isSearchOpen: false,
  isRecommendationOpen: false,
  searchQuery: '',
  setSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
  setRecommendationOpen: (isRecommendationOpen) =>
    set({ isRecommendationOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
