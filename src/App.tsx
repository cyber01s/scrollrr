/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Heart, Share2, Info, Search, ArrowRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  oldPrice: number;
  discount: string;
  rating: number;
  reviews: number;
  imageUrl: string;
  affiliateLink: string;
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async (pageNum: number) => {
    try {
      setError(null);
      const res = await fetch(`/api/products?page=${pageNum}&limit=3`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || `API Error: ${res.status}`);
      }
      
      if (!data.products || data.products.length === 0) {
        throw new Error(data.message || 'No products found. Please check your Impact.com credentials.');
      }
      
      if (pageNum === 1) {
        setProducts(data.products || []);
      } else {
        setProducts(prev => [...prev, ...(data.products || [])]);
      }
      
      setHasMore(data.hasMore ?? false);
      setLoading(false);
      setLoadingMore(false);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err.message || 'Failed to fetch products');
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchProducts(1);
  }, []);

  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      setLoadingMore(true);
      const nextPage = page + 1;
      setPage(nextPage);
      fetchProducts(nextPage);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center text-white">
        {error ? (
          <div className="flex flex-col items-center justify-center text-center px-6 max-w-md">
            <div className="mb-4 text-4xl">⚠️</div>
            <h2 className="text-2xl font-bold mb-2">Configuration Error</h2>
            <p className="text-gray-400 mb-4">{error}</p>
            <p className="text-sm text-gray-500">
              Make sure your Impact.com credentials are set in environment variables:
              <br />
              <code className="text-xs bg-black/50 p-1 rounded">IMPACT_ACCOUNT_SID</code>
              <br />
              <code className="text-xs bg-black/50 p-1 rounded">IMPACT_AUTH_TOKEN</code>
            </p>
          </div>
        ) : (
          <div className="animate-pulse text-center">
            <div className="mb-2">Loading your affiliate products...</div>
            <div className="text-sm text-gray-500">Fetching from Impact.com</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-black text-white overflow-hidden flex flex-col font-sans">
      {/* Top Navigation */}
      <nav className="absolute top-0 left-0 w-full z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
        <h1 className="text-sm font-semibold tracking-widest text-[#f5f5f5]">SCROLLR</h1>
        <button className="p-2 -mr-2 bg-transparent text-white">
          <Search className="w-5 h-5" />
        </button>
      </nav>

      {/* Scrolling Feed */}
      <div className="flex-1 h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
        {products.map((product) => (
          <ProductSlide key={product.id} product={product} />
        ))}
        
        {/* Load More Slide */}
        <div className="relative h-[100dvh] w-full snap-start snap-always bg-black flex flex-col items-center justify-center p-6 text-center">
          <div className="mb-8 p-4 rounded-full bg-white/5 border border-white/10">
             <ChevronDown className="w-12 h-12 text-white/20 animate-bounce" />
          </div>
          
          <h2 className="text-2xl font-bold mb-4">Reached the end!</h2>
          <p className="text-gray-400 mb-8 max-w-xs">
            {hasMore 
              ? "We have more amazing deals waiting for you. Tap below to see more." 
              : "That's all for today! Check back later for fresh impact.com deals."}
          </p>

          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-10 py-4 bg-white text-black font-bold rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center space-x-3 disabled:opacity-50 disabled:scale-100"
            >
              {loadingMore ? (
                <>
                  <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <span>Load More Deals</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          )}

          {!hasMore && (
            <button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-10 py-4 bg-white/10 text-white font-bold rounded-full hover:bg-white/20 transition-all"
            >
              Back to top
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductSlide({ product }: { product: Product }) {
  const [isLiked, setIsLiked] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [imageError, setImageError] = useState(!product.imageUrl);

  // Lazy fetching AI description when requested
  const handleShowInfo = async () => {
    setShowInfo(true);
    if (!aiDescription && !loadingAi) {
      setLoadingAi(true);
      try {
        const res = await fetch('/api/ai-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productName: product.name })
        });
        const data = await res.json();
        setAiDescription(data.description);
      } catch (err) {
        console.error(err);
        setAiDescription("An awesome product that will upgrade your daily life.");
      } finally {
        setLoadingAi(false);
      }
    }
  };

  // Verify affiliate link is valid
  const isValidAffiliateLink = product.affiliateLink && 
    product.affiliateLink !== '#' && 
    (product.affiliateLink.startsWith('http://') || product.affiliateLink.startsWith('https://'));

  return (
    <div className="relative h-[100dvh] w-full snap-start snap-always bg-black">
      {/* Image / Video Layer with fallback gradient */}
      <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-blue-900/40 via-purple-900/40 to-black/40">
        {product.imageUrl && !imageError && (
          <img
            src={product.imageUrl}
            alt={product.name}
            onError={() => setImageError(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
        )}
      </div>
      {/* Dark overlay for text readability */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" />

      {/* Content Container */}
      <div className="absolute inset-x-0 bottom-0 pb-24 px-4 flex justify-between items-end">
        {/* Left Side: Product Info */}
        <div className="flex-1 pr-16 mb-4">
          <p className="text-xs font-semibold tracking-wider text-gray-300 mb-2 uppercase">
            {product.category}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold leading-tight mb-2 text-white drop-shadow-md">
            {product.name}
          </h2>
          
          <div className="flex items-center space-x-2 text-sm text-gray-300 mb-3 drop-shadow">
            <span className="text-white font-medium flex items-center">
              <span className="text-xs mr-1">★</span> {product.rating}
            </span>
            <span>|</span>
            <span>{product.reviews} reviews</span>
          </div>

          <div className="flex items-end space-x-3 drop-shadow-md">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">
              ${product.price.toFixed(2)}
            </span>
            <span className="text-gray-400 line-through text-sm sm:text-base mb-1">
              ${product.oldPrice.toFixed(2)}
            </span>
            <span className="bg-[#ff5522] text-white text-xs font-bold px-2 py-1 rounded mb-1">
              {product.discount}
            </span>
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="absolute right-4 bottom-28 flex flex-col space-y-4 pb-4">
          <button 
            onClick={() => setIsLiked(!isLiked)}
            className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-transform active:scale-95"
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
          </button>
          <button className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-transform active:scale-95">
            <Share2 className="w-5 h-5" />
          </button>
          <button 
            onClick={handleShowInfo}
            className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-transform active:scale-95"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Swipe Down Indicator */}
      <div className="absolute bottom-[88px] left-1/2 -translate-x-1/2 text-gray-400 animate-bounce">
        <ChevronDown className="w-6 h-6 opacity-60" />
      </div>

      {/* Bottom CTA (Affiliate Link) */}
      <div className="absolute bottom-6 left-4 right-4 z-20">
        {isValidAffiliateLink ? (
          <a 
            href={product.affiliateLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-white text-black font-bold py-4 px-6 rounded-full flex items-center justify-center space-x-2 shadow-lg scale-100 hover:scale-[1.02] transition-transform"
          >
            <span>Shop Now via Partner</span>
            <ArrowRight className="w-5 h-5" />
          </a>
        ) : (
          <div className="w-full bg-gray-600 text-white font-bold py-4 px-6 rounded-full flex items-center justify-center space-x-2 shadow-lg opacity-50 cursor-not-allowed">
            <span>Link Not Available</span>
          </div>
        )}
      </div>

      {/* AI Description Overlay */}
      <AnimatePresence>
        {showInfo && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="absolute bottom-0 left-0 w-full bg-[#111111] rounded-t-3xl p-6 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10"
          >
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold flex items-center space-x-2">
                <span className="bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">✨ AI Summary</span>
              </h3>
              <button onClick={() => setShowInfo(false)} className="text-gray-400 p-1">Close</button>
            </div>
            
            <div className="text-gray-300 text-base leading-relaxed min-h-[80px]">
              {loadingAi ? (
                <div className="flex space-x-1 items-center h-full text-sm text-gray-400">
                  <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }}>Gen</motion.div>
                  <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}>erating</motion.div>
                  <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }}>...</motion.div>
                </div>
              ) : (
                <p>{aiDescription}</p>
              )}
            </div>
            
            <div className="mt-8">
              {isValidAffiliateLink ? (
                <a 
                  href={product.affiliateLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#ff5522] text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center space-x-2 hover:bg-[#ff6633] transition-colors"
                >
                  <span>Buy it via our Partner Link</span>
                </a>
              ) : (
                <div className="w-full bg-gray-600 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center space-x-2 opacity-50">
                  <span>Affiliate link not available</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
