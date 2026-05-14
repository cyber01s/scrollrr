import React from 'react';
import { motion } from 'motion/react';

export default function TopBar() {
  return (
    <div className="fixed top-0 left-0 w-full h-[52px] flex items-center justify-between px-5 z-40 safe-top">
      <motion.div 
        className="text-[12px] font-light tracking-[0.15em] text-white uppercase"
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        SCROLLR
      </motion.div>
    </div>
  );
}
