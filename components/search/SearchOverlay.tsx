'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { M } from '@/lib/motion'
import { useState, useEffect } from 'react'
import { SearchInput } from './SearchInput'
import { SearchResults } from './SearchResults'
import { useQuery } from '@tanstack/react-query'

interface SearchOverlayProps {
  isVisible: boolean
  onClose: () => void
}

export function SearchOverlay({ isVisible, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 280)
    return () => clearTimeout(t)
  }, [query])

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return { products: [] }
      const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      return res.json()
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60 * 5,
  })

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 z-40 bg-black/60 backdrop-blur-md flex flex-col"
        >
           {/* Clickable background to close */}
           <div className="absolute inset-0 z-0" onClick={onClose} />
           
           <motion.div 
             initial={{ y: -56 }}
             animate={{ y: 0 }}
             exit={{ y: -56 }}
             transition={M.spring}
             className="relative z-10 w-full pt-[env(safe-area-inset-top,44px)] pb-4 px-4 bg-black/40 border-b border-white/10 flex flex-col gap-4"
           >
              <SearchInput value={query} onChange={setQuery} onClose={onClose} />
           </motion.div>

           <div className="relative z-10 flex-1 overflow-y-auto px-4 py-2 hide-scrollbar">
              <SearchResults 
                 products={data?.products || []} 
                 isLoading={isLoading && debouncedQuery.length >= 2} 
                 hasQuery={debouncedQuery.length >= 2}
              />
           </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
