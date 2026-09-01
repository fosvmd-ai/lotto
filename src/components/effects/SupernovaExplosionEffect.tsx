import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Sparkles } from 'lucide-react';

interface Student {
  id: string;
  name: string;
}

interface SupernovaExplosionEffectProps {
  students: Student[];
  currentCandidate: string;
  isAnimating: boolean;
  drawn: string[];
  primaryColor?: string;
}

export default function SupernovaExplosionEffect({
  students,
  currentCandidate,
  isAnimating,
  drawn,
  primaryColor = '#fbbf24',
}: SupernovaExplosionEffectProps) {
  return (
    <div className="relative w-full max-w-lg aspect-square flex items-center justify-center select-none">
      {/* Background Shockwave Rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          animate={isAnimating ? { scale: [1, 1.8, 1], opacity: [0.2, 0.7, 0.2] } : { scale: 1, opacity: 0.1 }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="w-72 sm:w-96 h-72 sm:h-96 rounded-full border-2 border-rose-500/40 shadow-[0_0_50px_rgba(244,63,94,0.3)]"
        />
        <motion.div
          animate={isAnimating ? { scale: [1.2, 2.2, 1.2], opacity: [0.1, 0.5, 0.1] } : { scale: 1.2, opacity: 0.05 }}
          transition={{ duration: 0.7, repeat: Infinity, delay: 0.2 }}
          className="w-72 sm:w-96 h-72 sm:h-96 rounded-full border-2 border-amber-500/40 shadow-[0_0_60px_rgba(245,158,11,0.3)]"
        />
      </div>

      {/* Explosive Emitted Sparks & Fireballs when Animating */}
      {isAnimating && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
          {[...Array(18)].map((_, i) => {
            const angle = (i * 20 * Math.PI) / 180;
            const distance = 130 + (i % 3) * 40;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance;
            return (
              <motion.div
                key={i}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{
                  x: [0, tx],
                  y: [0, ty],
                  scale: [0.5, 1.5, 0],
                  opacity: [1, 0.8, 0]
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: (i * 0.04) % 0.4,
                  ease: "easeOut"
                }}
                className="absolute w-4 h-4 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 shadow-[0_0_15px_#f59e0b]"
              />
            );
          })}
        </div>
      )}

      {/* Central Cosmic Plasma Core */}
      <motion.div
        animate={isAnimating ? {
          scale: [0.85, 1.15, 0.9, 1.2],
          rotate: [0, 90, 180, 360],
          boxShadow: [
            '0 0 40px rgba(239, 68, 68, 0.6)',
            '0 0 90px rgba(245, 158, 11, 0.9)',
            '0 0 40px rgba(239, 68, 68, 0.6)'
          ]
        } : {
          scale: 1,
          boxShadow: '0 0 35px rgba(245, 158, 11, 0.4)'
        }}
        transition={{ duration: 0.4, repeat: Infinity }}
        className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-gradient-to-tr from-rose-600 via-amber-500 to-yellow-300 p-2 flex items-center justify-center"
      >
        {/* Core Corona Texture Layer */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-slate-950 via-slate-900 to-black flex items-center justify-center p-4 border-2 border-yellow-300/60 overflow-hidden">
          
          {/* Internal rotating sun ray effect */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-400 via-transparent to-transparent pointer-events-none"
          />

          {/* Core Content */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center">
            {isAnimating ? (
              <div className="flex flex-col items-center">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.15, repeat: Infinity }}
                  className="p-3 bg-rose-500/30 rounded-full mb-3 border border-rose-400/40"
                >
                  <Flame className="w-10 h-10 text-rose-400 fill-current animate-pulse" />
                </motion.div>
                <span className="text-3xl sm:text-5xl font-black text-amber-300 tracking-wider truncate max-w-[200px] drop-shadow-[0_0_15px_rgba(251,191,36,0.9)]">
                  {currentCandidate || '폭발 직전!'}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-rose-400 mt-2">
                  CRITICAL CHARGING...
                </span>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentCandidate || 'READY'}
                  initial={{ scale: 0.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  className="flex flex-col items-center"
                >
                  {currentCandidate ? (
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1.5 mb-2 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-400/40">
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span className="text-xs font-black text-amber-300 uppercase tracking-widest">SUPERNOVA</span>
                      </div>
                      <h2 className="text-4xl sm:text-5xl font-black text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.9)] px-2">
                        {currentCandidate}
                      </h2>
                      <span className="text-xs text-amber-400 font-bold mt-2">당첨 확정! 💥</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-slate-400">
                      <Flame className="w-14 h-14 text-amber-500 mb-2 opacity-80" />
                      <span className="text-sm font-black tracking-wide text-slate-300">
                        에너지가 충전 중입니다
                      </span>
                      <span className="text-[11px] text-slate-500 mt-1">추첨 시작을 눌러 폭발시키세요</span>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
