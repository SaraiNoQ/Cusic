import { create } from 'zustand';

type UiStore = {
  isSearchOpen: boolean;
  isRecommendationOpen: boolean;
  isChatOverlayOpen: boolean;
  isImportsOpen: boolean;
  searchQuery: string;
  setSearchOpen: (isOpen: boolean) => void;
  setRecommendationOpen: (isOpen: boolean) => void;
  setChatOverlayOpen: (isOpen: boolean) => void;
  setImportsOpen: (isOpen: boolean) => void;
  setSearchQuery: (query: string) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  isSearchOpen: false,
  isRecommendationOpen: false,
  isChatOverlayOpen: false,
  isImportsOpen: false,
  searchQuery: '',
  setSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
  setRecommendationOpen: (isRecommendationOpen) =>
    set({ isRecommendationOpen }),
  setChatOverlayOpen: (isChatOverlayOpen) => set({ isChatOverlayOpen }),
  setImportsOpen: (isImportsOpen) => set({ isImportsOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
