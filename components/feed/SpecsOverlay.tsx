'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { M } from '@/lib/motion'
import { X, Sparkles, AlertCircle } from 'lucide-react'
import { GoogleGenAI } from '@google/genai'
import Markdown from 'react-markdown'
import { Product } from '@/types/product'

interface SpecsOverlayProps {
  product: Product
  isVisible: boolean
  onClose: () => void
}

export function SpecsOverlay({ product, isVisible, onClose }: SpecsOverlayProps) {
  const [specs, setSpecs] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (isVisible && product && !specs && !loading && !error) {
      generateSpecs()
    }
  }, [isVisible, product])

  const generateSpecs = async () => {
    setLoading(true)
    setError(false)
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
      if (!apiKey) throw new Error('No API Key')
      const ai = new GoogleGenAI({ apiKey })
      
      const prompt = `You are a tech product expert. Provide a concise, highly formatted markdown list of 5 key specifications for this product. Use bold tags for labels. Make it sound professional and engaging.

Product Name: ${product.name}
Brand: ${product.brand || 'Unknown'}
Category: ${product.category || 'Tech'}
Description: ${product.description || 'No description available'}
Price: $${product.price}

Output MUST be ONLY a markdown list. No intro, no outro.`

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      })
      
      setSpecs(response.text || 'No specs generated.')
    } catch (err) {
      console.error('Error generating specs:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm pointer-events-auto"
          onClick={onClose}
        >
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={M.spring}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-h-[70vh] bg-[#111] border-t border-white/20 rounded-t-[32px] overflow-hidden flex flex-col shadow-2xl"
          >
            <div className="w-full h-1.5 flex justify-center pt-3 pb-5 cursor-pointer shrink-0" onClick={onClose}>
              <div className="w-12 h-1.5 bg-white/30 rounded-full" />
            </div>

            <div className="px-6 pb-4 shrink-0 flex items-center justify-between border-b border-white/10">
              <h3 className="text-xl font-[family-name:var(--font-serif)] font-medium text-white flex items-center gap-2 tracking-wide">
                <Sparkles size={20} className="text-[var(--color-accent)]" /> 
                Smart Specs
              </h3>
              <button onClick={onClose} className="w-8 h-8 flex flex-col items-center justify-center rounded-full bg-white/10 text-white/70 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto overflow-x-hidden relative min-h-[200px]">
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-[var(--color-accent)] rounded-full animate-spin" />
                  <span className="text-white/50 text-xs tracking-widest uppercase">Analyzing...</span>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-400">
                  <AlertCircle size={32} />
                  <span className="text-sm">Could not generate specs.</span>
                  <button onClick={generateSpecs} className="text-xs uppercase tracking-wider underline mt-2">Retry</button>
                </div>
              )}

              {specs && !loading && !error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="markdown-body prose prose-invert max-w-none text-[15px] prose-p:leading-relaxed prose-li:my-1.5"
                >
                  <Markdown>{specs}</Markdown>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
