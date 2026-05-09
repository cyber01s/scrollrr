import React, { useEffect, useRef, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import ProductCard from './ProductCard';
import { useFeedStore } from '../store/feed';
import { Product } from '../types/product';

export default function Feed() {
  const { currentIndex, setCurrentIndex, isSearchMode, searchResults } = useFeedStore();
  const observerTarget = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchFeed = async ({ pageParam = 0 }) => {
    try {
      const url = `/api/feed?page=${pageParam}`;
      console.log("Fetching feed from:", url);
      
      let res;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        attempts++;
        try {
          res = await fetch(url);
          if (res.ok) break;
          // If 5xx error, maybe retry
          if (res.status >= 500 && attempts < maxAttempts) {
            console.warn(`Server error ${res.status}, retrying... attempt ${attempts}`);
            await new Promise(r => setTimeout(r, 1000 * attempts));
            continue;
          }
          break;
        } catch (err) {
          if (attempts >= maxAttempts) throw err;
          console.warn(`Network error, retrying... attempt ${attempts}`);
          await new Promise(r => setTimeout(r, 1000 * attempts));
        }
      }

      if (!res) throw new Error("Connection failed after multiple attempts.");

      if (!res.ok) {
        let errorData;
        try {
          errorData = await res.json();
        } catch (e) {
          errorData = { message: res.statusText || "Internal Server Error" };
        }
        throw new Error(`Server ${res.status}: ${errorData.message || res.statusText || 'Internal Server Error (No details)'}`);
      }
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response received:", text.substring(0, 200));
        throw new Error(`Expected JSON but received ${contentType}. Check your build or Vercel route configuration.`);
      }
      
      return await res.json();
    } catch (e) {
      console.error("Feed fetch failed:", e);
      throw e;
    }
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError,
    error,
    isLoading
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: fetchFeed,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => 
      (lastPage && Array.isArray(lastPage) && lastPage.length > 0) ? allPages.length : undefined,
  });

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollY = containerRef.current.scrollTop;
    const h = window.innerHeight;
    const index = Math.round(scrollY / h);
    
    if (index !== currentIndex) {
      setCurrentIndex(index);
    }

    const allProducts = data?.pages.flat() || [];
    const totalCards = isSearchMode ? searchResults.length : allProducts.length;
    
    if (!isSearchMode && totalCards > 0 && index >= totalCards - 2 && !isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [data?.pages, isFetchingNextPage, hasNextPage, fetchNextPage, setCurrentIndex, currentIndex, isSearchMode, searchResults.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const displayCards = (isSearchMode && searchResults.length > 0) ? searchResults : (data?.pages.flat() || []);

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] w-full bg-black text-center p-8 gap-4">
        <div className="text-white text-xl">Error loading feed</div>
        <div className="text-red-400 text-sm">{error instanceof Error ? error.message : "Unknown error"}</div>
        <button onClick={() => window.location.reload()} className="px-4 py-2 mt-4 bg-white/10 rounded-full text-white">Retry</button>
      </div>
    );
  }

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
          key={product.id} 
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
