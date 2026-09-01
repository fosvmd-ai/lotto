import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Crown, Sparkles, Monitor } from 'lucide-react';

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
  const count = students.length;

  // Dynamically calculate optimal grid columns so no scrollbar is needed
  const getGridCols = () => {
    if (count <= 8) return "grid-cols-2 sm:grid-cols-4";
    if (count <= 15) return "grid-cols-3 sm:grid-cols-5";
    if (count <= 24) return "grid-cols-3 sm:grid-cols-4 md:grid-cols-6";
    if (count <= 35) return "grid-cols-4 sm:grid-cols-6 md:grid-cols-7";
    return "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10";
  };

  // Dynamically adjust tile height and text size based on student count
  const isDense = count > 20;
  const isSuperDense = count > 32;

  return (
    <div className="relative w-full max-w-5xl bg-slate-950/85 backdrop-blur-xl p-4 sm:p-7 rounded-[2.5rem] border-2 border-indigo-500/40 shadow-[0_0_60px_rgba(99,102,241,0.25)] select-none">
      {/* Top Cyberpunk Neon Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-indigo-500/20 text-xs font-bold">
        <div className="flex items-center gap-2.5 text-indigo-400">
          <div className="w-3 h-3 rounded-full bg-indigo-400 animate-ping" />
          <div className="flex items-center gap-1.5 font-mono tracking-widest uppercase text-sm">
            <Monitor className="w-4 h-4 text-cyan-400" />
            <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent font-black">
              CYBER STAGE MATRIX
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-slate-400 font-mono text-xs">
          <span>전체 인원: <strong className="text-white">{students.length}명</strong></span>
          <span>•</span>
          <span className="text-emerald-400">당첨: <strong>{drawn.length}명</strong></span>
        </div>
      </div>

      {/* Dynamic Candidate Highlight Banner when Animating */}
      <div className="mb-4 py-2 px-4 rounded-2xl bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-between">
        <span className="text-xs font-mono text-indigo-300 font-bold flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
          {isAnimating ? "스캐너 탐색 중..." : "추첨 대기 중"}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">현재 포커스:</span>
          <span className="text-sm font-black text-amber-300 font-mono bg-amber-500/20 px-3 py-0.5 rounded-lg border border-amber-400/40">
            {currentCandidate || "---"}
          </span>
        </div>
      </div>

      {/* Student Tiles Grid - Fully visible without scrollbar */}
      <div className={cn("grid gap-2 sm:gap-2.5 w-full", getGridCols())}>
        {students.map((s) => {
          const isWinner = drawn.includes(s.name);
          const isCurrent = currentCandidate === s.name;

          return (
            <motion.div
              key={s.id}
              animate={isCurrent ? {
                scale: [1, 1.06, 1],
                borderColor: ['#fbbf24', '#f59e0b', '#fbbf24']
              } : {}}
              transition={{ duration: 0.15, repeat: isCurrent ? Infinity : 0 }}
              className={cn(
                "relative rounded-xl flex flex-col items-center justify-center text-center transition-all border duration-150 overflow-hidden",
                isSuperDense ? "h-11 sm:h-12 px-1 py-0.5" : isDense ? "h-13 sm:h-14 px-2 py-1" : "h-14 sm:h-16 px-2.5 py-1.5",
                isWinner
                  ? "bg-gradient-to-br from-emerald-500/30 via-emerald-600/20 to-slate-900 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                  : isCurrent
                    ? "bg-gradient-to-br from-amber-500/40 via-yellow-500/30 to-slate-900 border-yellow-400 text-yellow-200 shadow-[0_0_20px_rgba(251,191,36,0.7)] z-10 scale-105"
                    : "bg-slate-900/70 border-slate-800/80 text-slate-300 hover:border-indigo-500/40"
              )}
            >
              {/* Active Laser Sweep */}
              {isCurrent && (
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 0.25, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-300/40 to-transparent pointer-events-none"
                />
              )}

              {/* Student Name */}
              <span className={cn(
                "font-black truncate max-w-full tracking-tight",
                isSuperDense ? "text-[11px] sm:text-xs" : isDense ? "text-xs sm:text-sm" : "text-sm sm:text-base",
                isWinner ? "text-emerald-300" : isCurrent ? "text-yellow-200 font-extrabold" : "text-slate-200"
              )}>
                {s.name}
              </span>

              {/* Winner Badge */}
              {isWinner && (
                <div className="absolute top-1 right-1 bg-emerald-500 rounded-full p-0.5 shadow-md">
                  <CheckCircle2 className="w-3 h-3 text-slate-950 stroke-[3]" />
                </div>
              )}

              {/* Current Focus Crown */}
              {isCurrent && (
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 px-1 py-0.2 rounded-full shadow-lg flex items-center justify-center">
                  <Crown className="w-2.5 h-2.5 fill-current" />
                </div>
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
