'use client'

import { motion } from 'framer-motion'
import { M } from '@/lib/motion'
import { Product } from '@/types/product'
import { buildAffiliateUrl } from '@/lib/affiliate'
import { useFeedStore } from '@/store/feed'
import { useEffect, useState } from 'react'

interface CardPanelProps {
  product: Product
  isVisible: boolean
}

export function CardPanel({ product, isVisible }: CardPanelProps) {
  const { isSearchMode } = useFeedStore()
  const [sessionId, setSessionId] = useState('')
  
  useEffect(() => {
    let sid = sessionStorage.getItem('scrollr_session')
    if (!sid) {
      sid = crypto.randomUUID()
      sessionStorage.setItem('scrollr_session', sid)
    }
    setSessionId(sid)
  }, [])
  
  const handleShopNow = async () => {
    // 1. Fire-and-forget click log (non-blocking)
    navigator.sendBeacon('/api/track', JSON.stringify({
      productId: product.id,
      partnerId: product.partnerId,
      source: isSearchMode ? 'search' : 'feed',
      sessionId: sessionId
    }))
    
    // 2. Open affiliate link
    window.open(buildAffiliateUrl(product), '_blank', 'noopener,noreferrer')
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 12 }}
      transition={{ delay: 0.25, ...M.spring }}
      className="absolute bottom-0 w-full pt-10 pb-[env(safe-area-inset-bottom)] px-6 z-20"
      style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}
    >
      <div className="flex flex-col gap-3 max-w-[calc(100%-80px)]">
        <div>
          <span className="text-[12px] uppercase tracking-[0.2em] font-bold text-[var(--color-accent)]">
            {product.brand || product.category || 'Featured Partner'}
          </span>
        </div>
        
        <h2 className="font-[family-name:var(--font-serif)] text-[32px] sm:text-[42px] font-light text-white leading-[1.1] drop-shadow-md">
          {product.name}
        </h2>
        
        <div className="flex flex-wrap items-center gap-4 text-[13px] text-white/50 mt-1">
          {product.rating && (
            <div className="flex items-center">
              <span className="text-white/80 mr-1 opacity-90">★</span> 
              <span>{product.rating}</span>
            </div>
          )}
          {product.rating && product.reviewCount && <span>|</span>}
          {product.reviewCount && <span>{product.reviewCount} reviews</span>}
          {(!product.rating && !product.reviewCount && product.category) && <span>{product.category}</span>}
        </div>

        <div className="flex items-baseline gap-3 mt-1">
          {product.price && (
            <span className="text-[28px] font-semibold tracking-tight text-white shadow-black drop-shadow-sm">
              ${product.price.toFixed(2)}
            </span>
          )}
          {product.originalPrice && product.originalPrice > (product.price || 0) && (
            <span className="text-[18px] text-white/40 line-through">
              ${product.originalPrice.toFixed(2)}
            </span>
          )}
          {product.originalPrice && product.price && product.originalPrice > product.price && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-accent)] text-white tracking-widest uppercase ml-2">
              Sale
            </span>
          )}
        </div>

        <div className="mt-4">
          <motion.button 
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.02 }}
            transition={M.fast}
            onClick={handleShopNow}
            className="h-[60px] px-10 rounded-full bg-white text-black font-bold uppercase tracking-[0.1em] text-[14px] shadow-[0_10px_30px_rgba(0,0,0,0.5)] border-none shrink-0"
          >
            Shop Now
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
