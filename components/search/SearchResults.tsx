'use client'

import { motion } from 'framer-motion'
import { Product } from '@/types/product'
import { buildAffiliateUrl } from '@/lib/affiliate'
import { useFeedStore } from '@/store/feed'
import { useEffect, useState } from 'react'

interface SearchResultsProps {
  products: Product[]
  isLoading: boolean
  hasQuery: boolean
}

export function SearchResults({ products, isLoading, hasQuery }: SearchResultsProps) {
  const { isSearchMode } = useFeedStore()
  const [sessionId, setSessionId] = useState('')
  
  useEffect(() => {
    setSessionId(sessionStorage.getItem('scrollr_session') || '')
  }, [])
  
  const handleItemClick = (product: Product) => {
    navigator.sendBeacon('/api/track', JSON.stringify({
      productId: product.id,
      partnerId: product.partnerId,
      source: 'search',
      sessionId: sessionId
    }))
    window.open(buildAffiliateUrl(product), '_blank', 'noopener,noreferrer')
  }

  if (!hasQuery) {
    return (
      <div className="mt-12 text-center text-white/40 text-sm font-light">
        Discover products from all partners
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="mt-8 flex justify-center">
         <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="mt-12 text-center text-white/40 text-[15px] font-light">
        No products found
      </div>
    )
  }

  return (
    <div className="flex flex-col py-4">
      {products.map((product, i) => (
        <motion.div
           key={product.id}
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: i * 0.04, ease: "easeOut", duration: 0.3 }}
           onClick={() => handleItemClick(product)}
           className="flex items-center gap-4 py-3 w-full border-b border-white/5 active:bg-white/5 transition-colors cursor-pointer"
        >
           <div className="w-12 h-12 rounded-lg bg-white/10 flex-shrink-0 overflow-hidden relative">
              {product.imageUrl && (
                 <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
              )}
           </div>
           
           <div className="flex-1 min-w-0 pr-2">
              <h3 className="text-white text-[14px] font-light truncate">{product.name}</h3>
              <p className="text-white/45 text-[11px] truncate uppercase tracking-wide mt-0.5">
                 {product.brand || product.category || 'Product'} {product.partnerId && <span className="opacity-50 ml-1">· {product.partnerId}</span>}
              </p>
           </div>
           
           {product.price && (
             <div className="text-right flex-shrink-0">
                <div className="text-white text-[13px] font-medium">${product.price.toFixed(2)}</div>
                {product.originalPrice && product.originalPrice > product.price && (
                   <div className="text-white/30 text-[10px] line-through mt-0.5">${product.originalPrice.toFixed(2)}</div>
                )}
             </div>
           )}
        </motion.div>
      ))}
    </div>
  )
}
