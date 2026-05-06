export const M = {
  spring: { type: 'spring' as const, stiffness: 320, damping: 26, mass: 0.8 },
  fast: { type: 'spring' as const, stiffness: 480, damping: 32 },
  ease: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
  slow: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  stagger: 0.04
}
