import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Crown } from 'lucide-react';

interface Student {
  id: string;
  name: string;
}

interface MythicCardEffectProps {
  students: Student[];
  currentCandidate: string;
  isAnimating: boolean;
  drawn: string[];
  primaryColor?: string;
}

export default function MythicCardEffect({
  students,
  currentCandidate,
  isAnimating,
  drawn,
  primaryColor = '#fbbf24',
}: MythicCardEffectProps) {
  return (
    <div className="relative w-full max-w-xl min-h-[380px] flex items-center justify-center select-none py-6">
      {/* Background Magical Runes Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="w-72 sm:w-96 h-72 sm:h-96 rounded-full border border-indigo-500/20 border-dashed"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
          className="w-60 sm:w-80 h-60 sm:h-80 rounded-full border border-purple-500/20"
        />
      </div>

      {/* When Animating: 5 Floating Shuffling Cards Fan */}
      {isAnimating ? (
        <div className="relative w-72 h-96 flex items-center justify-center">
          {[-2, -1, 0, 1, 2].map((offset, i) => (
            <motion.div
              key={i}
              animate={{
                x: [offset * 25, offset * -25, offset * 25],
                y: [Math.abs(offset) * 8, Math.abs(offset) * -8, Math.abs(offset) * 8],
                rotate: [offset * 12, offset * -12, offset * 12],
                scale: offset === 0 ? [1, 1.08, 1] : 0.92
              }}
              transition={{
                duration: 0.45,
                repeat: Infinity,
                delay: i * 0.06,
                ease: "easeInOut"
              }}
              className="absolute w-48 sm:w-56 h-72 sm:h-80 rounded-3xl bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900 border-2 border-indigo-400/50 shadow-2xl p-4 flex flex-col items-center justify-between"
              style={{ zIndex: 10 - Math.abs(offset) }}
            >
              <div className="w-full flex justify-between items-center text-indigo-400 opacity-60 text-xs">
                <span>✦</span>
                <Crown className="w-4 h-4" />
                <span>✦</span>
              </div>
              <div className="w-20 h-20 rounded-full border border-indigo-400/30 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-amber-400 animate-spin" style={{ animationDuration: '2s' }} />
              </div>
              <span className="text-amber-300 font-bold text-sm tracking-widest uppercase">
                SHUFFLING...
              </span>
            </motion.div>
          ))}
        </div>
      ) : (
        /* Winner Revealed: 3D Holographic Card Flip */
        <div className="perspective-1000">
          <motion.div
            key={currentCandidate || 'CARD_BACK'}
            initial={{ rotateY: 90, scale: 0.8, opacity: 0 }}
            animate={{ rotateY: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="relative w-64 sm:w-72 h-88 sm:h-96 rounded-3xl p-1 bg-gradient-to-br from-yellow-300 via-amber-500 to-purple-600 shadow-[0_20px_50px_rgba(251,191,36,0.3)] border border-yellow-200/50"
          >
            {/* Card Inner Face */}
            <div className="w-full h-full bg-slate-950 rounded-[22px] p-6 flex flex-col items-center justify-between relative overflow-hidden">
              
              {/* Holographic Shine Overlay */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />

              {/* Card Header */}
              <div className="w-full flex items-center justify-between text-amber-400">
                <Crown className="w-5 h-5 fill-current" />
                <span className="text-[11px] font-black tracking-widest uppercase bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/30">
                  LUCKY TAROT
                </span>
                <Crown className="w-5 h-5 fill-current" />
              </div>

              {/* Card Center Medallion */}
              <div className="flex flex-col items-center text-center my-auto">
                {currentCandidate ? (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.15, type: "spring" }}
                      className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 p-1 shadow-[0_0_30px_rgba(251,191,36,0.5)] mb-4 flex items-center justify-center"
                    >
                      <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                        <Sparkles className="w-10 h-10 text-amber-400 fill-current" />
                      </div>
                    </motion.div>
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">
                      CHOSEN WINNER
                    </span>
                    <h3 className="text-3xl sm:text-4xl font-black text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.7)] px-2">
                      {currentCandidate}
                    </h3>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-slate-500">
                    <div className="w-20 h-20 rounded-full border-2 border-slate-700 flex items-center justify-center mb-3">
                      <span className="text-4xl">🔮</span>
                    </div>
                    <span className="text-sm font-bold text-slate-400">카드가 뒤집힐 준비가 되었습니다</span>
                    <span className="text-xs text-slate-500 mt-1">추첨 시작을 눌러보세요</span>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="w-full flex items-center justify-center border-t border-slate-800 pt-3">
                <span className="text-[10px] text-slate-500 font-mono tracking-wider">
                  ★ DESTINY EDITION ★
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
