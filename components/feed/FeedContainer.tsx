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

  // Prefetch logic removed to save API requests and DB quota
  // Users must click "Load More" when they reach the end

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

  const handleLoadMore = async () => {
    if (hasNextPage) {
      await fetchNextPage()
      // Optional: scroll to the newly loaded item
    } else {
      // Smart mechanism: if we run out, just reset to top to simulate infinite feed,
      // or shuffle if we had a shuffle mechanism. For now, scroll to top.
      if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
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
           <a 
             href="https://newfortech.com" 
             target="_blank" 
             rel="noopener noreferrer"
             className="pointer-events-auto border-[1px] border-white/20 bg-white/10 hover:bg-white/20 transition-colors rounded-full px-3.5 py-1.5 text-[11px] uppercase tracking-[0.1em] text-white/90"
           >
             NewForTech
           </a>
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
        <div className="w-full h-[100dvh] snap-start flex flex-col items-center justify-center bg-black gap-6">
           <h2 className="text-white/80 font-[family-name:var(--font-serif)] text-2xl tracking-wide">
             {hasNextPage ? "End of current feed" : "You've seen everything!"}
           </h2>
           <button 
             onClick={handleLoadMore}
             disabled={isFetchingNextPage}
             className="px-8 py-3 rounded-full bg-[var(--color-accent)] text-white font-bold uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(255,99,33,0.3)] hover:scale-105 transition-transform disabled:opacity-50"
           >
             {isFetchingNextPage ? 'Loading...' : (hasNextPage ? 'Load More' : 'Back to Top')}
           </button>
        </div>
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
