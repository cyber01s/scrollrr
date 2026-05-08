import React, { useEffect, useRef, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import ProductCard from './ProductCard';
import { useFeedStore } from '../store/feed';
import { Product } from '../types/product';

export default function Feed() {
  const { cards, appendCards, setCurrentIndex, isSearchMode, searchResults } = useFeedStore();
  const observerTarget = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchFeed = async ({ pageParam = 0 }) => {
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${API_BASE}/api/feed?page=${pageParam}`);
    return res.json();
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError,
    isLoading
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: fetchFeed,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => 
      (lastPage && Array.isArray(lastPage) && lastPage.length > 0) ? allPages.length : undefined,
  });

  useEffect(() => {
    if (data) {
      const allProducts = data.pages.flat();
      if (allProducts.length > 0) {
        appendCards(allProducts);
      }
    }
  }, [data, appendCards]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollY = containerRef.current.scrollTop;
    const index = Math.round(scrollY / window.innerHeight);
    setCurrentIndex(index);

    // Infinite scroll trigger: when we are 4 cards from the end
    if (index >= cards.length - 4 && !isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [cards.length, isFetchingNextPage, hasNextPage, fetchNextPage, setCurrentIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const displayCards = isSearchMode && searchResults.length > 0 ? searchResults : cards;

  if (isLoading && displayCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] w-full bg-black text-center p-8">
        <div className="text-[14px] opacity-40 animate-pulse">Initializing Scrollr...</div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="snap-container scrollbar-hide no-scrollbar relative w-full h-full"
    >
      {displayCards.map((product, index) => (
        <ProductCard 
          key={product.id + index} 
          product={product} 
          index={index} 
        />
      ))}
      
      {/* Scroll Indicator on first slide */}
      {displayCards.length > 0 && currentIndex === 0 && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center pointer-events-none opacity-60 animate-bounce z-50">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
             <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      )}

      {/* Manual Load More / End of Feed */}
      {!isSearchMode && (
        <div className="snap-center h-[100dvh] w-full flex flex-col items-center justify-center bg-black text-white p-6">
          {hasNextPage ? (
            <div className="flex flex-col items-center gap-6">
              <button 
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-8 py-4 bg-[#FF5A25] rounded-full text-sm font-bold tracking-widest uppercase transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {isFetchingNextPage ? 'Loading...' : 'Load More'}
              </button>
            </div>
          ) : (
            <div className="font-serif text-2xl text-white/80">End of current feed</div>
          )}
        </div>
      )}
    </div>
  );
}
