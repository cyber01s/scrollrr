'use client'

import { Product } from '@/types/product'
import { CardBackground } from './CardBackground'
import { CardPanel } from './CardPanel'
import { CardActions } from './CardActions'
import { motion, useAnimation } from 'framer-motion'
import { useFeedStore } from '@/store/feed'
import { useRef, useEffect, useState } from 'react'
import { M } from '@/lib/motion'

interface ProductCardProps {
  product: Product
  isVisible: boolean
}

export function ProductCard({ product, isVisible }: ProductCardProps) {
  const { toggleLike, isSearchMode } = useFeedStore()
  const controls = useAnimation()
  const lastTap = useRef<number>(0)

  // Handle double tap for like
  const handleTap = () => {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      toggleLike(product.id)
      // Burst effect
      controls.start({
        scale: [1, 1.02, 1],
        transition: M.fast
      })
    }
    lastTap.current = now
  }

  // Virtualization creates unmounting. We keep standard render.
  return (
    <motion.div 
      animate={controls}
      onClick={handleTap}
      className={`relative w-full h-[100dvh] snap-start flex-shrink-0 overflow-hidden ${
        isSearchMode ? 'pointer-events-none' : ''
      }`}
    >
      <CardBackground imageUrl={product.imageUrl} isVisible={isVisible} />
      <CardPanel product={product} isVisible={isVisible} />
      <CardActions product={product} isVisible={isVisible} />
    </motion.div>
  )
}
