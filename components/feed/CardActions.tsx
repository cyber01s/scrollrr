'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { M } from '@/lib/motion'
import { Heart, Share2, Info } from 'lucide-react'
import { useFeedStore } from '@/store/feed'
import { Product } from '@/types/product'
import { SpecsOverlay } from './SpecsOverlay'

interface CardActionsProps {
  product: Product
  isVisible: boolean
}

export function CardActions({ product, isVisible }: CardActionsProps) {
  const { likedProductIds, toggleLike } = useFeedStore()
  const isLiked = likedProductIds.includes(product.id)
  const [showSpecs, setShowSpecs] = useState(false)

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: product.name,
        text: `Check out ${product.name}!`,
        url: window.location.href
      }).catch(console.error)
    }
  }

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: isVisible && !showSpecs ? 1 : 0, x: isVisible && !showSpecs ? 0 : 20 }}
        transition={{ delay: 0.35, ...M.spring }}
        className="absolute right-4 bottom-[140px] flex flex-col gap-4 z-20 pointer-events-auto"
      >
        <button 
          onClick={(e) => {
            e.stopPropagation();
            toggleLike(product.id);
          }}
          className="w-16 h-16 rounded-full bg-[var(--color-glass)] backdrop-blur-[10px] border border-[var(--color-glass-border)] flex flex-col items-center justify-center text-white relative"
        >
          <motion.div
             className="mb-0.5"
            initial={false}
            animate={{ scale: isLiked ? [1, 1.4, 1] : 1 }}
            transition={M.fast}
          >
            <Heart size={20} className={isLiked ? 'fill-[var(--color-accent)] text-[var(--color-accent)]' : ''} />
          </motion.div>
          <span className="text-[10px] font-semibold opacity-60 uppercase">
            {isLiked ? '1.2k' : 'Like'}
          </span>
        </button>

        <button 
          onClick={(e) => {
            e.stopPropagation();
            handleShare();
          }}
          className="w-16 h-16 rounded-full bg-[var(--color-glass)] backdrop-blur-[10px] border border-[var(--color-glass-border)] flex flex-col items-center justify-center text-white"
        >
          <Share2 size={20} className="mb-0.5" />
          <span className="text-[10px] font-semibold opacity-60 uppercase">Share</span>
        </button>

        <button 
          onClick={(e) => {
            e.stopPropagation();
            setShowSpecs(true);
          }}
          className="w-16 h-16 rounded-full bg-[var(--color-glass)] backdrop-blur-[10px] border border-[var(--color-glass-border)] flex flex-col items-center justify-center text-white"
        >
          <Info size={20} className="mb-0.5" />
          <span className="text-[10px] font-semibold opacity-60 uppercase">Specs</span>
        </button>
      </motion.div>

      <SpecsOverlay 
        product={product} 
        isVisible={showSpecs} 
        onClose={() => setShowSpecs(false)} 
      />
    </>
  )
}
