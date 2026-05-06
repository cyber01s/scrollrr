'use client'

import { motion } from 'framer-motion'
import { M } from '@/lib/motion'
import { Heart, Share2, Info } from 'lucide-react'
import { useFeedStore } from '@/store/feed'

interface CardActionsProps {
  productId: string
  isVisible: boolean
}

export function CardActions({ productId, isVisible }: CardActionsProps) {
  const { likedProductIds, toggleLike } = useFeedStore()
  const isLiked = likedProductIds.includes(productId)

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: 'Check out this product',
        url: window.location.href
      }).catch(console.error)
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : 20 }}
      transition={{ delay: 0.35, ...M.spring }}
      className="absolute right-4 bottom-[140px] flex flex-col gap-4 z-20"
    >
      <button 
        onClick={() => toggleLike(productId)}
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
        onClick={handleShare}
        className="w-16 h-16 rounded-full bg-[var(--color-glass)] backdrop-blur-[10px] border border-[var(--color-glass-border)] flex flex-col items-center justify-center text-white"
      >
        <Share2 size={20} className="mb-0.5" />
        <span className="text-[10px] font-semibold opacity-60 uppercase">Share</span>
      </button>

      <button 
        className="w-16 h-16 rounded-full bg-[var(--color-glass)] backdrop-blur-[10px] border border-[var(--color-glass-border)] flex flex-col items-center justify-center text-white"
      >
        <Info size={20} className="mb-0.5" />
        <span className="text-[10px] font-semibold opacity-60 uppercase">Specs</span>
      </button>
    </motion.div>
  )
}
