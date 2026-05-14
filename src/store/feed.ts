import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product } from '../types/product';

interface FeedState {
  cards: Product[];
  currentIndex: number;
  likedIds: Set<string>;
  isLoading: boolean;
  specsCache: Record<string, string[]>;
  
  // Actions
  setCards: (cards: Product[]) => void;
  appendCards: (cards: Product[]) => void;
  setSpecsCache: (id: string, specs: string[]) => void;
  setCurrentIndex: (index: number) => void;
  toggleLike: (id: string) => void;
  setIsLoading: (loading: boolean) => void;
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set) => ({
      cards: [],
      currentIndex: 0,
      likedIds: new Set<string>(),
      isLoading: false,
      specsCache: {},

      setCards: (cards) => set({ cards }),
      appendCards: (newCards) => set((state) => {
        const filtered = newCards.filter(nc => !state.cards.find(c => c.id === nc.id));
        if (filtered.length === 0) return state;
        return { cards: [...state.cards, ...filtered] };
      }),
      setCurrentIndex: (currentIndex) => set({ currentIndex }),
      toggleLike: (id) => set((state) => {
        const nextLikedIds = new Set(state.likedIds);
        if (nextLikedIds.has(id)) {
          nextLikedIds.delete(id);
        } else {
          nextLikedIds.add(id);
        }
        return { likedIds: nextLikedIds };
      }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setSpecsCache: (id, specs) => set((state) => ({
        specsCache: { ...state.specsCache, [id]: specs }
      })),
    }),
    {
      name: 'scrollr-storage',
      partialize: (state) => ({ likedIds: Array.from(state.likedIds) }),
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        likedIds: new Set(persistedState.likedIds || []),
      }),
    }
  )
);
