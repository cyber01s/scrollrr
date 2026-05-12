import React, { useState, useEffect, useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "motion/react";
import { Heart, Share2, Info, Star, ArrowRight, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { Product } from "../types/product";
import { useFeedStore } from "../store/feed";
import { MOTION } from "../lib/motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ProductCardProps {
  key?: React.Key;
  product: Product;
  index: number;
}

export default function ProductCard({ product, index }: ProductCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleLike = useFeedStore((state) => state.toggleLike);
  const isLiked = useFeedStore((state) => state.likedIds.has(product.id));

  const [imgMeta, setImgMeta] = useState<{
    hasBg: boolean;
    dominantColor: string;
    aspectRatio: number;
  } | null>(null);

  useEffect(() => {
    if (!product.imageUrl) return;
    const url = `/api/image?url=${encodeURIComponent(product.imageUrl)}`;
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject("Not ok")))
      .then((data) => {
        if (data && data.dominantColor) setImgMeta(data);
        else throw new Error("No color");
      })
      .catch(() =>
        setImgMeta({
          hasBg: true,
          dominantColor: "rgb(255, 255, 255)",
          aspectRatio: 1,
        }),
      );
  }, [product.imageUrl]);

  const handleShopNow = async () => {
    const url = `/api/track`;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        timestamp: Date.now(),
        source: "feed",
      }),
    });
    window.open(product.affiliateUrl, "_blank", "noopener");
  };

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const particles = Array.from({ length: 6 });

  const [lastTap, setLastTap] = useState(0);
  const [showSheet, setShowSheet] = useState(false);
  const [smartSpecs, setSmartSpecs] = useState<string[] | null>(null);
  const [specsLoading, setSpecsLoading] = useState(false);
  const [specsError, setSpecsError] = useState(false);

  const fetchSmartSpecs = async () => {
    setSpecsLoading(true);
    setSpecsError(false);
    try {
      const qs = new URLSearchParams({
        name: product.name,
        category: product.category || ""
      });
      const res = await fetch(`/api/specs?${qs}`);
      if (!res.ok) throw new Error("Failed to fetch specs");
      const specs = await res.json();
      setSmartSpecs(specs);
    } catch (error) {
      console.error("AI Analysis error:", error);
      setSpecsError(true);
    } finally {
      setSpecsLoading(false);
    }
  };

  useEffect(() => {
    if (showSheet && !smartSpecs && !specsError) {
      fetchSmartSpecs();
    }
  }, [showSheet]);

  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(
    null,
  );

  const handleTouchStart = () => {
    const timer = setTimeout(() => {
      setShowSheet(true);
    }, 600);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) clearTimeout(longPressTimer);
  };

  const handleImageTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      if (!isLiked) toggleLike(product.id);
    }
    setLastTap(now);
  };

  return (
    <div
      ref={containerRef}
      className="snap-section relative bg-black overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
    >
      {/* Background Layer */}
      <div
        className="absolute inset-0 z-0 cursor-pointer"
        onClick={handleImageTap}
      >
        <motion.div
          className="w-full h-full relative"
          style={{ y }}
          initial={{ scale: 1.04 }}
          whileInView={{ scale: 1.0 }}
          transition={MOTION.easeSlow}
        >
          <div
            className="w-full h-full flex items-center justify-center relative overflow-hidden transition-colors duration-1000"
            style={{
              backgroundColor: imgMeta?.dominantColor || "rgb(15, 15, 15)",
            }}
          >
            {/* Immersive Blurred Background */}
            <motion.div 
              className="absolute inset-0 opacity-40 scale-110 blur-3xl saturate-150 pointer-events-none"
              style={{
                backgroundImage: product.imageUrl ? `url(${product.imageUrl})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ duration: 1.5 }}
            />

            {/* Modern Mesh Gradient Overlay */}
            <div 
              className="absolute inset-0 opacity-40 pointer-events-none"
              style={{
                background: `radial-gradient(circle at 20% 20%, rgba(255,255,255,0.1) 0%, transparent 40%),
                             radial-gradient(circle at 80% 80%, rgba(0,0,0,0.3) 0%, transparent 40%)`
              }}
            />
            
            <div
              className="absolute inset-0 opacity-[0.05] pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle, white 0.5px, transparent 0.5px)",
                backgroundSize: "40px 40px",
              }}
            />
            
            {product.imageUrl ? (
              <motion.img
                src={product.imageUrl}
                alt={product.name}
                className="relative z-10 w-[85%] h-[85%] object-contain drop-shadow-[0_25px_60px_rgba(0,0,0,0.5)]"
                initial={{ opacity: 0, scale: 0.92, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              />
            ) : (
              <div className="relative z-10 w-[85%] h-[85%] flex items-center justify-center opacity-30 text-white font-mono text-sm">
                No Preview Available
              </div>
            )}
          </div>
          <div className="absolute inset-0 vignette pointer-events-none" />
        </motion.div>
      </div>

      {/* Bottom Content Panel */}
      <motion.div
        className="absolute bottom-0 left-0 w-full px-[20px] pb-[32px] pt-[60px] z-10 safe-bottom flex flex-col bg-gradient-to-t from-black/90 via-black/50 to-transparent"
        initial={{ y: 24, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ ...MOTION.easeSlow, delay: 0.3 }}
      >
        <motion.div
          className="text-[10px] uppercase font-normal tracking-[0.12em] text-white/80 mb-2 drop-shadow-sm"
          initial={{ letterSpacing: "0.08em" }}
          whileInView={{ letterSpacing: "0.12em" }}
          transition={{ duration: 0.4 }}
        >
          {product.category}
        </motion.div>

        <h1 
          className="text-[20px] font-medium leading-[1.2] text-white max-w-[75%] mb-3 drop-shadow-md"
          style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {product.name}
        </h1>

        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center gap-2 text-[13px] text-white/90 font-medium tracking-wide drop-shadow-sm">
            <span>★ {product.rating}</span>
            <div className="w-[1px] h-3 bg-white/30" />
            <span>{product.reviewCount > 999
                ? `${(product.reviewCount / 1000).toFixed(1)}k`
                : product.reviewCount}{" "} reviews</span>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <span className="text-[24px] font-bold tracking-tight text-white drop-shadow-md">${product.price}</span>
          {product.originalPrice && (
            <>
              <span className="text-[14px] font-normal text-white/60 line-through drop-shadow-sm">
                ${product.originalPrice}
              </span>
              <span className="text-[11px] font-bold px-2 py-[2px] bg-[#FF5A25] rounded-[100px] text-white shadow-lg">
                -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
              </span>
            </>
          )}
        </div>

        <motion.button
          onClick={handleShopNow}
          className="w-full h-[52px] rounded-[100px] bg-white text-black text-[14px] font-bold tracking-wide flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          whileHover={{ backgroundColor: "rgba(255,255,255,0.22)" }}
          whileTap={{ scale: 0.97 }}
          transition={MOTION.springFast}
        >
          Shop Now
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </motion.div>

      {/* Right Side Actions */}
      <div className="absolute right-4 bottom-[160px] flex flex-col gap-4 z-20">
        <div className="relative">
          <motion.button
            onClick={() => toggleLike(product.id)}
            className="w-11 h-11 rounded-full flex items-center justify-center glass"
            whileTap={{ scale: 1.4 }}
            transition={MOTION.springFast}
          >
            <Heart
              className={cn(
                "w-[18px] transition-colors",
                isLiked ? "fill-white text-white" : "text-white",
              )}
            />
          </motion.button>

          <AnimatePresence>
            {isLiked && (
              <div className="absolute inset-0 pointer-events-none">
                {particles.map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-white rounded-full"
                    initial={{ scale: 0, opacity: 1 }}
                    animate={{
                      scale: [0, 1, 0],
                      x: [0, Math.cos((i * 60 * Math.PI) / 180) * 40],
                      y: [0, Math.sin((i * 60 * Math.PI) / 180) * 40],
                      opacity: [1, 1, 0],
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>

        <motion.button className="w-11 h-11 rounded-full flex items-center justify-center glass">
          <Share2 className="w-[18px] text-white" />
        </motion.button>

        <motion.button
          onClick={() => setShowSheet(true)}
          className="w-11 h-11 rounded-full flex items-center justify-center glass"
        >
          <Info className="w-[18px] text-white" />
        </motion.button>
      </div>

      {/* Detail Bottom Sheet */}
      <AnimatePresence>
        {showSheet && (
          <>
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSheet(false)}
            />
            <motion.div
              className="absolute bottom-0 left-0 w-full bg-[#0A0A0A]/95 backdrop-blur-[20px] rounded-t-[24px] p-8 pb-12 z-50 border-t border-white/10"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={MOTION.spring}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
              <div className="text-[10px] text-white/50 uppercase tracking-widest mb-2">
                {product.category}
              </div>
              <h3 className="text-xl font-light mb-6 pr-8">{product.name}</h3>

              <div className="space-y-6">
                <div className="min-h-[140px] flex flex-col">
                  {/* Smart Specs Header */}
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-[#FF5A25]" />
                    <span className="font-semibold text-[15px] text-white">Smart Specs</span>
                  </div>

                  {/* Loading State */}
                  {specsLoading && (
                    <div className="flex-1 flex flex-col items-center justify-center py-6 gap-3">
                      <Loader2 className="w-5 h-5 text-white/50 animate-spin" />
                      <span className="text-[13px] text-white/50 font-light">Analyzing product...</span>
                    </div>
                  )}

                  {/* Error State */}
                  {specsError && !specsLoading && (
                    <div className="flex-1 flex flex-col items-center justify-center py-6 gap-3">
                      <AlertCircle className="w-6 h-6 text-[#FF5A25]" />
                      <span className="text-[14px] text-[#FF5A25] font-light">Could not generate specs.</span>
                      <button 
                        onClick={fetchSmartSpecs}
                        className="text-[11px] uppercase tracking-widest text-[#FF5A25] mt-2 underline underline-offset-4"
                      >
                        RETRY
                      </button>
                    </div>
                  )}

                  {/* Success State */}
                  {smartSpecs && !specsLoading && !specsError && (
                    <ul className="space-y-3 mt-2">
                      {smartSpecs.map((spec, i) => (
                        <li
                          key={i}
                          className="text-[14px] font-light text-white/90 flex items-start gap-3"
                        >
                          <div className="w-1 h-1 bg-[#FF5A25] rounded-full mt-[8px] shrink-0" />
                          <span className="leading-relaxed">{spec}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Fallback to static if AI didn't run at all but not loading (shouldn't happen but just in case) */}
                  {!specsLoading && !specsError && !smartSpecs && (
                    <ul className="space-y-3 mt-2">
                      {product.specs.map((spec, i) => (
                        <li
                          key={i}
                          className="text-[14px] font-light text-white/90 flex items-start gap-3"
                        >
                          <div className="w-1 h-1 bg-white/30 rounded-full mt-[8px]" />
                          <span>{spec}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex gap-4">
                  <motion.button
                    onClick={handleShopNow}
                    className="flex-1 h-12 rounded-full bg-white text-black text-[14px] font-medium"
                    whileTap={{ scale: 0.97 }}
                  >
                    View on site
                  </motion.button>
                  <motion.button
                    className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"
                    whileTap={{ scale: 0.97 }}
                  >
                    <Share2 className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Feed Snap Indicator (Side) */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
        <div className="w-[2px] h-8 bg-white" />
        <div className="w-[2px] h-2 bg-white/20" />
        <div className="w-[2px] h-2 bg-white/20" />
        <div className="w-[2px] h-2 bg-white/20" />
      </div>
    </div>
  );
}
