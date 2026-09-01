import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Crown, Sparkles } from 'lucide-react';

interface Student {
  id: string;
  name: string;
}

interface CyberBoardEffectProps {
  students: Student[];
  currentCandidate: string;
  isAnimating: boolean;
  drawn: string[];
  primaryColor?: string;
}

export default function CyberBoardEffect({
  students,
  currentCandidate,
  isAnimating,
  drawn,
  primaryColor = '#fbbf24',
}: CyberBoardEffectProps) {
  return (
    <div className="relative w-full max-w-4xl bg-slate-950/80 backdrop-blur-xl p-6 sm:p-8 rounded-[2.5rem] border-2 border-indigo-500/30 shadow-[0_0_50px_rgba(99,102,241,0.2)] select-none">
      {/* Top Cyberpunk Neon Header */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-indigo-500/20 text-xs font-bold">
        <div className="flex items-center gap-2 text-indigo-400">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
          <span className="font-mono tracking-wider uppercase">STAGE MATRIX LOTTO</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
          <span>TOTAL: {students.length}</span>
          <span>•</span>
          <span className="text-emerald-400">DRAWN: {drawn.length}</span>
        </div>
      </div>

      {/* Student Tiles Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 max-h-[380px] overflow-y-auto p-1 scrollbar-hide">
        {students.map((s) => {
          const isWinner = drawn.includes(s.name);
          const isCurrent = currentCandidate === s.name;

          return (
            <motion.div
              key={s.id}
              animate={isCurrent ? {
                scale: [1, 1.08, 1],
                borderColor: ['#fbbf24', '#f59e0b', '#fbbf24']
              } : {}}
              transition={{ duration: 0.15, repeat: isCurrent ? Infinity : 0 }}
              className={cn(
                "relative h-16 sm:h-20 rounded-2xl p-3 flex flex-col items-center justify-center text-center transition-all border duration-200 overflow-hidden",
                isWinner
                  ? "bg-gradient-to-br from-emerald-500/30 via-emerald-600/20 to-slate-900 border-emerald-400 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                  : isCurrent
                    ? "bg-gradient-to-br from-amber-500/40 via-yellow-500/30 to-slate-900 border-yellow-400 text-yellow-200 shadow-[0_0_25px_rgba(251,191,36,0.6)] z-10"
                    : "bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700"
              )}
            >
              {/* Active Scanner Line sweep when selected */}
              {isCurrent && (
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 0.3, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-300/30 to-transparent pointer-events-none"
                />
              )}

              {/* Student Name */}
              <span className="font-black text-sm sm:text-base truncate max-w-full tracking-tight">
                {s.name}
              </span>

              {/* Winner Badge */}
              {isWinner && (
                <div className="absolute top-1.5 right-1.5 bg-emerald-500 rounded-full p-0.5 shadow-md">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />
                </div>
              )}

              {/* Candidate Crown */}
              {isCurrent && (
                <motion.div
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="absolute -top-1 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 p-0.5 rounded-full shadow-lg"
                >
                  <Crown className="w-3 h-3 fill-current" />
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
