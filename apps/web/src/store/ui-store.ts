import { create } from 'zustand';

type UiStore = {
  isSearchOpen: boolean;
  isRecommendationOpen: boolean;
  isChatOverlayOpen: boolean;
  isImportsOpen: boolean;
  isQueueOpen: boolean;
  searchQuery: string;
  setSearchOpen: (isOpen: boolean) => void;
  setRecommendationOpen: (isOpen: boolean) => void;
  setChatOverlayOpen: (isOpen: boolean) => void;
  setImportsOpen: (isOpen: boolean) => void;
  setQueueOpen: (isOpen: boolean) => void;
  setSearchQuery: (query: string) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  isSearchOpen: false,
  isRecommendationOpen: false,
  isChatOverlayOpen: false,
  isImportsOpen: false,
  isQueueOpen: false,
  searchQuery: '',
  setSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
  setRecommendationOpen: (isRecommendationOpen) =>
    set({ isRecommendationOpen }),
  setChatOverlayOpen: (isChatOverlayOpen) => set({ isChatOverlayOpen }),
  setImportsOpen: (isImportsOpen) => set({ isImportsOpen }),
  setQueueOpen: (isQueueOpen) => set({ isQueueOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
