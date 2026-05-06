'use client'

import { Search, X } from 'lucide-react'
import { motion } from 'framer-motion'

interface SearchInputProps {
  value: string
  onChange: (val: string) => void
  onClose: () => void
}

export function SearchInput({ value, onChange, onClose }: SearchInputProps) {
  return (
    <div className="relative flex items-center w-full h-12 bg-white/10 rounded-xl px-4 border border-white/5 focus-within:border-white/20 transition-colors backdrop-blur-xl">
      <Search size={18} className="text-white/50" />
      <input 
        autoFocus
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search products, brands..."
        className="flex-1 bg-transparent border-none outline-none text-white text-[15px] px-3 font-light placeholder:text-white/30"
      />
      {value.length > 0 ? (
        <button onClick={() => onChange('')} className="p-1 rounded-full bg-white/10 text-white/70">
          <X size={14} />
        </button>
      ) : (
        <button onClick={onClose} className="p-1 text-white/50 hover:text-white transition-colors text-xs font-medium uppercase tracking-wider">
          Cancel
        </button>
      )}
    </div>
  )
}
