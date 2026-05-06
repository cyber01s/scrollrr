'use client'

import { motion } from 'framer-motion'
import { M } from '@/lib/motion'

interface CardBackgroundProps {
  imageUrl: string | null
  isVisible: boolean
}

export function CardBackground({ imageUrl, isVisible }: CardBackgroundProps) {
  if (!imageUrl) {
    return <div className="absolute inset-0 bg-neutral-900" />
  }

  // Upgrade insecure http:// URLs to https:// to prevent mixed content errors
  const secureImageUrl = imageUrl.replace(/^http:\/\//i, 'https://')

  return (
    <motion.div
      initial={{ scale: 1.04 }}
      animate={{ scale: isVisible ? 1 : 1.04 }}
      transition={M.slow}
      className="absolute inset-0 w-full h-full bg-[var(--color-bg)]"
    >
      <div 
        className="absolute inset-0 opacity-60 pointer-events-none z-0" 
        style={{
          background: 'radial-gradient(circle at 70% 20%, #3a1510 0%, transparent 60%), radial-gradient(circle at 10% 80%, var(--color-accent) 0%, transparent 40%)'
        }}
      />
      
      {/* Product Image */}
      <img 
        src={secureImageUrl} 
        alt="" 
        className="absolute inset-0 w-full h-full object-cover object-center opacity-90 z-0 mix-blend-overlay"
      />
      <img 
        src={secureImageUrl} 
        alt="" 
        className="absolute inset-0 w-full h-full object-cover object-center opacity-[0.85] z-0"
      />
      
      {/* Vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent bottom-0 z-10" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent top-0 h-40 z-10" />
    </motion.div>
  )
}
