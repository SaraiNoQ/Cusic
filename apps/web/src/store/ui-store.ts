import { create } from 'zustand';

type UiStore = {
  theme: 'dark' | 'light';
  isSearchOpen: boolean;
  isRecommendationOpen: boolean;
  isChatOverlayOpen: boolean;
  isImportsOpen: boolean;
  isQueueOpen: boolean;
  searchQuery: string;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  setSearchOpen: (isOpen: boolean) => void;
  setRecommendationOpen: (isOpen: boolean) => void;
  setChatOverlayOpen: (isChatOverlayOpen: boolean) => void;
  setImportsOpen: (isImportsOpen: boolean) => void;
  setQueueOpen: (isQueueOpen: boolean) => void;
  setSearchQuery: (query: string) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  theme: 'dark',
  isSearchOpen: false,
  isRecommendationOpen: false,
  isChatOverlayOpen: false,
  isImportsOpen: false,
  isQueueOpen: false,
  searchQuery: '',
  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  setSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
  setRecommendationOpen: (isRecommendationOpen) =>
    set({ isRecommendationOpen }),
  setChatOverlayOpen: (isChatOverlayOpen) => set({ isChatOverlayOpen }),
  setImportsOpen: (isImportsOpen) => set({ isImportsOpen }),
  setQueueOpen: (isQueueOpen) => set({ isQueueOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
