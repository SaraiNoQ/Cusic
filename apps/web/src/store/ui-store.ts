import { create } from 'zustand';

type UiStore = {
  isSearchOpen: boolean;
  searchQuery: string;
  setSearchOpen: (isOpen: boolean) => void;
  setSearchQuery: (query: string) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  isSearchOpen: false,
  searchQuery: '',
  setSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
