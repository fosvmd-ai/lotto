import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Wind } from 'lucide-react';

interface Student {
  id: string;
  name: string;
}

interface AeroMachineEffectProps {
  students: Student[];
  currentCandidate: string;
  isAnimating: boolean;
  drawn: string[];
  primaryColor?: string;
}

const BALL_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', 
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6'
];

export default function AeroMachineEffect({
  students,
  currentCandidate,
  isAnimating,
  drawn,
  primaryColor = '#fbbf24',
}: AeroMachineEffectProps) {
  return (
    <div className="relative w-full max-w-lg flex flex-col items-center select-none py-6">
      {/* Top Extraction Tube */}
      <div className="relative w-20 h-16 bg-gradient-to-b from-slate-700 via-slate-600 to-slate-800 rounded-t-2xl border-2 border-slate-500 shadow-xl flex items-center justify-center -mb-2 z-20">
        <div className="w-12 h-6 bg-slate-900 rounded-full border border-cyan-400/40 shadow-inner flex items-center justify-center">
          <Wind className={cn("w-4 h-4 text-cyan-400", isAnimating && "animate-spin")} />
        </div>
      </div>

      {/* Glass Sphere Chamber (Aero Lottery Drum) */}
      <div className="relative w-72 sm:w-88 h-72 sm:h-88 rounded-full bg-gradient-to-b from-cyan-500/10 via-slate-900/40 to-slate-950/80 backdrop-blur-md border-4 border-cyan-400/60 shadow-[0_0_60px_rgba(6,182,212,0.25)] flex items-center justify-center overflow-hidden z-10">
        {/* Glass reflection highlight curves */}
        <div className="absolute top-4 left-10 w-32 h-16 rounded-full bg-white/15 blur-[2px] -rotate-45 pointer-events-none" />
        <div className="absolute inset-0 rounded-full border-t-2 border-white/40 pointer-events-none" />

        {/* Air Jet Tornado Whirlwind when Animating */}
        {isAnimating && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            className="absolute inset-8 rounded-full border-2 border-dashed border-cyan-400/30 pointer-events-none"
          />
        )}

        {/* Bouncing Aero Lotto Balls inside Sphere */}
        {isAnimating && students.slice(0, 16).map((s, i) => {
          const color = BALL_COLORS[i % BALL_COLORS.length];
          const radius = 90;
          const initialAngle = (i * 2 * Math.PI) / 16;
          return (
            <motion.div
              key={s.id}
              animate={{
                x: [
                  Math.cos(initialAngle) * radius,
                  Math.cos(initialAngle + Math.PI) * (radius * 0.7),
                  Math.cos(initialAngle + 2 * Math.PI) * radius
                ],
                y: [
                  Math.sin(initialAngle) * radius,
                  Math.sin(initialAngle + Math.PI) * (radius * 0.7),
                  Math.sin(initialAngle + 2 * Math.PI) * radius
                ],
                rotate: [0, 360]
              }}
              transition={{
                duration: 0.8 + (i % 4) * 0.15,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-xs shadow-lg border border-white/40"
              style={{
                background: `radial-gradient(circle at 35% 35%, #ffffff, ${color})`
              }}
            >
              <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{s.name[0]}</span>
            </motion.div>
          );
        })}

        {/* Center Winner / Candidate Ball */}
        <AnimatePresence mode="wait">
          {!isAnimating && currentCandidate ? (
            <motion.div
              initial={{ scale: 0, y: 100, rotate: -180 }}
              animate={{ scale: 1.15, y: 0, rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 16 }}
              className="relative w-36 h-36 rounded-full flex flex-col items-center justify-center text-center p-2 shadow-[0_0_40px_rgba(251,191,36,0.6)] border-4 border-white z-30"
              style={{
                background: 'radial-gradient(circle at 35% 35%, #ffffff, #fbbf24, #d97706)'
              }}
            >
              <Sparkles className="w-5 h-5 text-slate-900 mb-0.5 animate-spin" style={{ animationDuration: '4s' }} />
              <span className="text-slate-950 font-black text-2xl truncate max-w-[120px] drop-shadow-sm">
                {currentCandidate}
              </span>
              <span className="text-[9px] font-extrabold text-amber-950 uppercase tracking-widest bg-white/40 px-2 py-0.5 rounded-full mt-1">
                LUCKY BALL
              </span>
            </motion.div>
          ) : (
            !isAnimating && (
              <div className="flex flex-col items-center text-cyan-300/60 font-bold text-center z-20">
                <span className="text-4xl mb-2">🎱</span>
                <span className="text-xs uppercase tracking-wider text-slate-300 font-black">
                  에어로 머신 대기 중
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">추첨 시작을 눌러 바람을 일으키세요</span>
              </div>
            )
          )}
        </AnimatePresence>
      </div>

      {/* Heavy Steel Support Pedestal */}
      <div className="w-48 sm:w-60 h-10 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 rounded-t-3xl border-t-4 border-slate-500 shadow-2xl -mt-4 z-0 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[10px] font-mono font-bold text-cyan-300 tracking-widest uppercase">
            AERO SPHERE PRO
          </span>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
