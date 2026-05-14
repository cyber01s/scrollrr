import React, { useEffect, useRef, useCallback } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import ProductCard from './ProductCard';
import { useFeedStore } from '../store/feed';
import { Product } from '../types/product';

export default function Feed() {
  const queryClient = useQueryClient();
  const { currentIndex, setCurrentIndex, isSearchMode, searchResults } = useFeedStore();
  const observerTarget = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate once per session so the same scroll session never repeats products
  // but every new visit/refresh gets a fresh shuffle.
  const sessionSeed = React.useRef(
    parseInt(sessionStorage.getItem('scrollr-seed') || '0') ||
    (() => {
      const s = Math.floor(Math.random() * 0xffffffff);
      sessionStorage.setItem('scrollr-seed', String(s));
      return s;
    })()
  );

  const fetchFeed = useCallback(async ({ pageParam = 0 }) => {
    try {
      const url = `/api/feed?page=${pageParam}&seed=${sessionSeed.current}`;
      console.log(`[Feed] Fetching: ${url}`);
      
      let res;
      let attempts = 0;
      const maxAttempts = 2;
      
      while (attempts < maxAttempts) {
        attempts++;
        try {
          // Add a controller to timeout the fetch itself
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
          
          res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            console.log(`[Feed] Success: ${url}`);
            break;
          }
          
          if (res.status >= 500 && attempts < maxAttempts) {
            console.warn(`[Feed] Server error ${res.status}, retrying...`);
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          break;
        } catch (err: any) {
          console.error(`[Feed] Fetch error (attempt ${attempts}):`, err.name === 'AbortError' ? 'Timeout' : err.message);
          if (attempts >= maxAttempts) throw err;
          await new Promise(r => setTimeout(r, 1000));
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
  }, []);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError,
    error,
    isLoading
  } = useInfiniteQuery({
    queryKey: ['feed', sessionSeed.current],
    queryFn: fetchFeed,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => 
      (lastPage && Array.isArray(lastPage) && lastPage.length > 0) ? allPages.length : undefined,
    retry: 1,
    staleTime: 5000,
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Safety timeout for UI initial load
  const [isTimedOut, setIsTimedOut] = React.useState(false);
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        if (isLoading) {
          console.warn("[Feed] Initial load timed out after 15s");
          setIsTimedOut(true);
        }
      }, 15000);
      return () => clearTimeout(timer);
    } else {
      setIsTimedOut(false);
    }
  }, [isLoading]);

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
  }, [data?.pages, isFetchingNextPage, hasNextPage, fetchNextPage, setCurrentIndex, currentIndex, isSearchMode, searchResults.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const throttledHandleScroll = () => {
        if (window.requestAnimationFrame) {
          window.requestAnimationFrame(handleScroll);
        } else {
          handleScroll();
        }
      };
      container.addEventListener('scroll', throttledHandleScroll, { passive: true });
      return () => container.removeEventListener('scroll', throttledHandleScroll);
    }
  }, [handleScroll]);

  const [prevDbLength, setPrevDbLength] = React.useState(0);
  
  const allProducts = data?.pages.flat() || [];
  const displayCards = (isSearchMode && searchResults.length > 0) ? searchResults : allProducts;

  useEffect(() => {
    if (!isFetchingNextPage && displayCards.length > prevDbLength) {
      if (prevDbLength > 0 && containerRef.current) {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            const y = prevDbLength * window.innerHeight;
            containerRef.current.scrollTo({ top: y, behavior: 'auto' });
          }
        });
      }
      setPrevDbLength(displayCards.length);
    }
  }, [displayCards.length, isFetchingNextPage, prevDbLength]);


  if (isError || isTimedOut) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] w-full bg-black text-center p-8 gap-4">
        <div className="text-white text-xl">Connection to Scrollr interrupted</div>
        <div className="text-white/40 text-sm max-w-xs">
          {isTimedOut ? "The connection is taking longer than expected. Please check your network or try again." : (error instanceof Error ? error.message : "The product feed is temporarily unavailable.")}
        </div>
        <button 
          onClick={() => {
            setIsTimedOut(false);
            queryClient.resetQueries({ queryKey: ['feed'] });
          }} 
          className="px-6 py-3 mt-4 bg-white/10 rounded-full text-white text-sm font-medium hover:bg-white/20 transition-colors"
        >
          Try Again
        </button>
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

      {/* Auto Load More / End of Feed */}
      {!isSearchMode && (
        <div ref={observerTarget} className="snap-center h-[100dvh] w-full flex items-center justify-center p-6 relative">
          {isFetchingNextPage ? (
            <div className="flex gap-2 items-center opacity-50 absolute bottom-32">
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : !hasNextPage ? (
            <div className="font-serif text-lg text-white/50 absolute bottom-32">End of feed</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
