import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Atom } from 'lucide-react';

interface Student {
  id: string;
  name: string;
}

interface StandardOrbEffectProps {
  students: Student[];
  currentCandidate: string;
  isAnimating: boolean;
  drawn: string[];
  primaryColor?: string;
}

export default function StandardOrbEffect({
  students,
  currentCandidate,
  isAnimating,
  drawn,
  primaryColor = '#fbbf24',
}: StandardOrbEffectProps) {
  return (
    <div className="relative w-full max-w-lg aspect-square flex items-center justify-center select-none py-6">
      {/* Outer Gyroscope Ring 1 */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: isAnimating ? 2 : 12, repeat: Infinity, ease: "linear" }}
        className="absolute w-72 sm:w-96 h-72 sm:h-96 rounded-full border-4 border-dashed border-indigo-500/40 shadow-[0_0_40px_rgba(99,102,241,0.3)] pointer-events-none"
      />

      {/* Outer Gyroscope Ring 2 (Reverse tilt) */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: isAnimating ? 3 : 16, repeat: Infinity, ease: "linear" }}
        className="absolute w-64 sm:w-80 h-64 sm:h-80 rounded-full border-2 border-amber-400/40 pointer-events-none"
      />

      {/* Orbiting Quantum Electrons when Animating */}
      {isAnimating && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {[0, 1, 2].map((idx) => (
            <motion.div
              key={idx}
              animate={{ rotate: 360 }}
              transition={{ duration: 1 + idx * 0.4, repeat: Infinity, ease: "linear" }}
              className="absolute w-60 h-60"
            >
              <div className="w-4 h-4 rounded-full bg-amber-400 shadow-[0_0_15px_#fde047] -top-2 left-1/2 -translate-x-1/2 absolute" />
            </motion.div>
          ))}
        </div>
      )}

      {/* Central High-Tech Arc Core */}
      <motion.div
        animate={isAnimating ? {
          scale: [0.95, 1.05, 0.95],
          boxShadow: [
            '0 0 30px rgba(99, 102, 241, 0.5)',
            '0 0 70px rgba(251, 191, 36, 0.8)',
            '0 0 30px rgba(99, 102, 241, 0.5)'
          ]
        } : { scale: 1, boxShadow: '0 0 30px rgba(99, 102, 241, 0.3)' }}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="relative w-56 sm:w-72 h-56 sm:h-72 rounded-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 border-4 border-indigo-400/60 p-4 flex flex-col items-center justify-center shadow-2xl overflow-hidden"
      >
        {/* Core Grid Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center">
          {isAnimating ? (
            <div className="flex flex-col items-center">
              <Atom className="w-10 h-10 text-amber-400 mb-2 animate-spin" style={{ animationDuration: '2s' }} />
              <span className="text-3xl sm:text-4xl font-black text-amber-300 tracking-wider truncate max-w-[180px] drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]">
                {currentCandidate || '추첨 중...'}
              </span>
              <span className="text-[10px] text-indigo-300 font-mono tracking-widest uppercase mt-2">
                QUANTUM LOTTO CORE
              </span>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentCandidate || 'CORE_READY'}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="flex flex-col items-center"
              >
                {currentCandidate ? (
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1.5 mb-2 bg-amber-400/20 px-3 py-1 rounded-full border border-amber-400/30">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="text-[10px] font-black text-amber-300 tracking-wider">SELECTED WINNER</span>
                    </div>
                    <h2 className="text-3xl sm:text-5xl font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] px-2">
                      {currentCandidate}
                    </h2>
                    <span className="text-xs text-amber-400 font-bold mt-2">당첨을 축하합니다! 🎉</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <Atom className="w-12 h-12 text-indigo-400 mb-2 opacity-80" />
                    <span className="text-sm font-black text-slate-200">로또 코어 준비 완료</span>
                    <span className="text-[11px] text-slate-500 mt-1">추첨 시작을 눌러주세요</span>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
}
