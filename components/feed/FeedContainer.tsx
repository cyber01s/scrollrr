'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { ProductCard } from './ProductCard'
import { SearchOverlay } from '../search/SearchOverlay'
import { useFeedStore } from '@/store/feed'
import { Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { M } from '@/lib/motion'

export function FeedContainer() {
  const { isSearchMode, setIsSearchMode, activeCategory } = useFeedStore()
  const [currentIndex, setCurrentIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['feed', activeCategory],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await fetch(`/api/feed?page=${pageParam}&category=${activeCategory}`)
      return res.json()
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      if (!lastPage || lastPage.empty || lastPage.products?.length < 20) return undefined
      return pages.length
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  })

  const allProducts = data?.pages.flatMap((page: any) => page.products || []) || []

  // Prefetch logic
  useEffect(() => {
    if (hasNextPage && currentIndex >= allProducts.length - 5 && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [currentIndex, hasNextPage, isFetchingNextPage, allProducts.length, fetchNextPage])

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const index = Math.round(containerRef.current.scrollTop / window.innerHeight)
    if (index !== currentIndex) {
      setCurrentIndex(index)
    }
  }, [currentIndex])

  const handleSearchToggle = () => {
    setIsSearchMode(!isSearchMode)
  }

  if (isLoading) {
    return (
      <div className="w-full h-[100dvh] bg-black flex items-center justify-center">
        <div className="text-white/50 text-sm tracking-widest uppercase">Loading</div>
      </div>
    )
  }

  if (allProducts.length === 0) {
    return (
      <div className="w-full h-[100dvh] bg-black flex flex-col items-center justify-center p-8 text-center gap-6">
        <div className="text-white/80 text-lg font-light">Setting up your feed...</div>
        <div className="text-white/40 text-sm">Check back in a few minutes after the first sync completes.</div>
        <button 
           onClick={() => fetch('/api/admin/revalidate', { method: 'POST', headers: {'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}`} })}
           className="mt-4 px-6 py-2 rounded-full border border-white/20 text-white/80 text-xs tracking-wider uppercase"
        >
          Force Sync Now
        </button>
      </div>
    )
  }

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-black align-top m-0 p-0">
      {/* Top Bar Overlay */}
      <motion.div 
        animate={{ y: isSearchMode ? -72 : 0, opacity: isSearchMode ? 0 : 1 }}
        transition={M.fast}
        className="absolute top-0 left-0 w-full h-[72px] z-30 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between px-6 pointer-events-none"
      >
         <h1 className="text-white/90 tracking-[0.4em] text-[14px] font-light uppercase">SCROLLR</h1>
         
         <div className="flex items-center gap-4">
           <div className="hidden sm:block border-[1px] border-[var(--color-glass-border)] bg-[var(--color-glass)] rounded-full px-3.5 py-1.5 text-[11px] uppercase tracking-[0.1em] text-white/70">
             14 ACTIVE PARTNERS
           </div>
           <button 
             onClick={handleSearchToggle}
             className="w-10 h-10 flex items-center justify-end text-white pointer-events-auto"
           >
             <Search size={20} strokeWidth={2} />
           </button>
         </div>
      </motion.div>

      {/* Snap Scroll Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full h-[100dvh] overflow-y-scroll snap-y snap-mandatory scroll-smooth hide-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {allProducts.map((product: any, index: number) => {
          // Virtualize: only render ±3 cards from current
          const distance = Math.abs(index - currentIndex)
          const isMounted = distance <= 3
          const isVisible = distance === 0
          
          return (
            <div key={`${product.id}-${index}`} className="w-full h-[100dvh] snap-start">
               {isMounted && <ProductCard product={product} isVisible={isVisible} />}
            </div>
          )
        })}
        {isFetchingNextPage && (
          <div className="w-full h-[100dvh] snap-start flex items-center justify-center bg-black">
             <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      <SearchOverlay isVisible={isSearchMode} onClose={() => setIsSearchMode(false)} />
      
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
           display: none;
        }
      `}} />
    </div>
  )
}
