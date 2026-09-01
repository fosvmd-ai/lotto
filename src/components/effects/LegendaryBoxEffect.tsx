import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Gift, Sparkles, Star } from 'lucide-react';

interface Student {
  id: string;
  name: string;
}

interface LegendaryBoxEffectProps {
  students: Student[];
  currentCandidate: string;
  isAnimating: boolean;
  drawn: string[];
  primaryColor?: string;
}

export default function LegendaryBoxEffect({
  students,
  currentCandidate,
  isAnimating,
  drawn,
  primaryColor = '#fbbf24',
}: LegendaryBoxEffectProps) {
  return (
    <div className="relative w-full max-w-lg min-h-[400px] flex flex-col items-center justify-center select-none py-6">
      {/* Light God Rays when opened or animating */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20"
      >
        <div className="w-96 h-96 bg-[conic-gradient(from_0deg,_transparent_0deg_30deg,_#fbbf24_30deg_60deg,_transparent_60deg_90deg,_#fbbf24_90deg_120deg,_transparent_120deg_150deg,_#fbbf24_150deg_180deg,_transparent_180deg_210deg,_#fbbf24_210deg_240deg,_transparent_240deg_270deg,_#fbbf24_270deg_300deg,_transparent_300deg_330deg,_#fbbf24_330deg_360deg)] rounded-full blur-sm" />
      </motion.div>

      {/* Floating Winner Announcement when box opened */}
      <AnimatePresence>
        {!isAnimating && currentCandidate && (
          <motion.div
            initial={{ y: 80, scale: 0.3, opacity: 0 }}
            animate={{ y: -80, scale: 1.1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 15 }}
            className="absolute top-12 z-30 flex flex-col items-center text-center"
          >
            <div className="p-3 bg-amber-400 text-slate-950 rounded-2xl shadow-[0_0_30px_rgba(251,191,36,0.8)] border-2 border-white mb-2 flex items-center gap-2">
              <Trophy className="w-6 h-6 fill-current animate-bounce" />
              <span className="font-black text-sm uppercase tracking-wider">TREASURE WINNER</span>
            </div>
            <h2 className="text-4xl sm:text-6xl font-black text-white drop-shadow-[0_4px_20px_rgba(251,191,36,0.9)] px-4">
              {currentCandidate}
            </h2>
            <div className="flex items-center gap-1.5 mt-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 text-yellow-300 fill-current animate-pulse" />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Golden Chest Body */}
      <motion.div
        animate={isAnimating ? {
          rotate: [0, -6, 6, -6, 6, 0],
          y: [0, -16, 0, -16, 0],
          scale: [1, 1.06, 1, 1.06, 1]
        } : { rotate: 0, y: 0, scale: 1 }}
        transition={{ duration: 0.35, repeat: Infinity }}
        className="relative z-10 flex flex-col items-center mt-12"
      >
        {/* Chest Lid */}
        <motion.div
          animate={(!isAnimating && currentCandidate) ? {
            y: -60,
            rotateX: 60,
            opacity: 0.9
          } : { y: 0, rotateX: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="relative w-64 sm:w-80 h-24 bg-gradient-to-b from-amber-400 via-yellow-500 to-amber-600 rounded-t-3xl border-4 border-yellow-300 shadow-2xl flex items-center justify-center"
        >
          {/* Iron Trim & Golden Studs */}
          <div className="absolute inset-x-0 bottom-0 h-4 bg-amber-800 border-t-2 border-yellow-200" />
          <div className="absolute top-2 w-16 h-4 bg-amber-800 rounded-full border border-yellow-300 flex items-center justify-center">
            <div className="w-8 h-2 bg-yellow-300 rounded-full" />
          </div>
          <Gift className="w-8 h-8 text-amber-950 opacity-40" />
        </motion.div>

        {/* Chest Main Base */}
        <div className="relative w-64 sm:w-80 h-36 bg-gradient-to-b from-amber-600 via-amber-700 to-amber-950 rounded-b-3xl border-4 border-yellow-400 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden">
          {/* Chest Lock Emblem */}
          <div className="absolute -top-4 w-12 h-14 bg-gradient-to-b from-yellow-300 to-amber-500 rounded-b-2xl border-2 border-yellow-100 shadow-xl flex items-center justify-center z-20">
            <div className="w-3 h-5 bg-amber-950 rounded-full" />
          </div>

          {/* Chest Wood Planks Texture */}
          <div className="w-full h-full flex justify-between px-6 opacity-30 pointer-events-none">
            <div className="w-2 h-full bg-black/40" />
            <div className="w-2 h-full bg-black/40" />
            <div className="w-2 h-full bg-black/40" />
          </div>

          {/* Inside Glow / Candidate name while shaking */}
          <div className="absolute inset-4 rounded-xl bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center p-2">
            {isAnimating ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.15, repeat: Infinity }}
                className="text-center"
              >
                <Sparkles className="w-6 h-6 text-yellow-300 mx-auto mb-1 animate-spin" />
                <span className="text-2xl sm:text-3xl font-black text-amber-300 truncate max-w-[200px] block">
                  {currentCandidate || '???'}
                </span>
                <span className="text-[10px] text-amber-400 uppercase tracking-widest font-bold">
                  OPENING CHEST...
                </span>
              </motion.div>
            ) : (
              !currentCandidate && (
                <div className="flex flex-col items-center text-amber-300/60 font-bold text-xs">
                  <Sparkles className="w-5 h-5 mb-1" />
                  <span>황금 보물상자가 닫혀있습니다</span>
                </div>
              )
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
