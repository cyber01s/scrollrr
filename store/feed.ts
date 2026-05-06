import { create } from 'zustand'
import { Product } from '@/types/product'

interface FeedState {
  searchQuery: string
  isSearchMode: boolean
  activeCategory: string
  setSearchQuery: (query: string) => void
  setIsSearchMode: (isSearch: boolean) => void
  setActiveCategory: (category: string) => void
  
  likedProductIds: string[]
  toggleLike: (productId: string) => void
}

export const useFeedStore = create<FeedState>((set) => ({
  searchQuery: '',
  isSearchMode: false,
  activeCategory: 'all',
  setSearchQuery: (query) => set({ searchQuery: query }),
  setIsSearchMode: (isSearchMode) => set({ isSearchMode }),
  setActiveCategory: (activeCategory) => set({ activeCategory }),
  
  likedProductIds: [],
  toggleLike: (productId) => set((state) => {
    const isLiked = state.likedProductIds.includes(productId)
    if (isLiked) {
      return { likedProductIds: state.likedProductIds.filter(id => id !== productId) }
    }
    return { likedProductIds: [...state.likedProductIds, productId] }
  })
}))
