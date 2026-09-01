import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Coins } from 'lucide-react';

interface Student {
  id: string;
  name: string;
}

interface SlotMachineEffectProps {
  students: Student[];
  currentCandidate: string;
  isAnimating: boolean;
  drawn: string[];
  primaryColor?: string;
}

const SYMBOLS = ['👑', '💎', '7️⃣', '⭐', '🍀', '🎯', '🔥', '🏆'];

export default function SlotMachineEffect({
  students,
  currentCandidate,
  isAnimating,
  drawn,
  primaryColor = '#fbbf24',
}: SlotMachineEffectProps) {
  const [reel1, setReel1] = useState('7️⃣');
  const [reel2, setReel2] = useState('👑');
  const [reel3, setReel3] = useState('💎');
  const [leverPulled, setLeverPulled] = useState(false);

  useEffect(() => {
    if (!isAnimating) {
      setLeverPulled(false);
      return;
    }

    setLeverPulled(true);
    const names = students.map(s => s.name);
    const pool = [...SYMBOLS, ...names];

    const timer1 = setInterval(() => {
      setReel1(pool[Math.floor(Math.random() * pool.length)]);
    }, 60);

    const timer2 = setInterval(() => {
      setReel2(pool[Math.floor(Math.random() * pool.length)]);
    }, 75);

    const timer3 = setInterval(() => {
      setReel3(pool[Math.floor(Math.random() * pool.length)]);
    }, 90);

    return () => {
      clearInterval(timer1);
      clearInterval(timer2);
      clearInterval(timer3);
    };
  }, [isAnimating, students]);

  return (
    <div className="relative w-full max-w-xl flex flex-col items-center select-none">
      {/* Las Vegas Casino Golden Cabinet */}
      <div className="relative w-full bg-gradient-to-b from-amber-600 via-amber-700 to-amber-950 p-6 sm:p-8 rounded-[3rem] shadow-[0_25px_60px_rgba(0,0,0,0.8)] border-4 border-yellow-400/80">
        
        {/* Top Casino Crown Banner */}
        <div className="relative bg-gradient-to-r from-red-700 via-rose-600 to-red-700 py-2.5 px-6 rounded-2xl border-2 border-yellow-300 shadow-inner flex items-center justify-between mb-6">
          {/* Flashing bulbs */}
          <div className="flex items-center gap-2">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }}
                className="w-3 h-3 rounded-full bg-yellow-300 shadow-[0_0_10px_#fde047]"
              />
            ))}
          </div>

          <div className="text-center flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-300 animate-spin" style={{ animationDuration: '3s' }} />
            <span className="font-black text-lg sm:text-xl text-yellow-200 tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              LUCKY JACKPOT
            </span>
            <Sparkles className="w-5 h-5 text-yellow-300 animate-spin" style={{ animationDuration: '3s' }} />
          </div>

          <div className="flex items-center gap-2">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }}
                className="w-3 h-3 rounded-full bg-yellow-300 shadow-[0_0_10px_#fde047]"
              />
            ))}
          </div>
        </div>

        {/* 3-Reel Window Frame */}
        <div className="relative bg-slate-950 p-4 rounded-3xl border-4 border-yellow-500/90 shadow-[inset_0_10px_30px_rgba(0,0,0,0.9)] overflow-hidden">
          {/* Glass reflection gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/15 via-transparent to-black/60 pointer-events-none z-20 rounded-2xl" />

          {/* Winning Payline Red Laser */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-rose-500/60 shadow-[0_0_12px_#f43f5e] z-10 pointer-events-none" />

          {/* When Animating: 3 Separate Drums */}
          {isAnimating ? (
            <div className="grid grid-cols-3 gap-3 h-40 sm:h-48">
              {[reel1, reel2, reel3].map((val, idx) => (
                <div 
                  key={idx} 
                  className="relative bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700 flex items-center justify-center overflow-hidden shadow-inner"
                >
                  <motion.div
                    key={val}
                    initial={{ y: 60, filter: 'blur(4px)' }}
                    animate={{ y: 0, filter: 'blur(0px)' }}
                    transition={{ duration: 0.07 }}
                    className="text-3xl sm:text-4xl font-black text-amber-300 text-center px-1 truncate max-w-full"
                  >
                    {val}
                  </motion.div>
                </div>
              ))}
            </div>
          ) : (
            /* When Stopped: Big Unified Display of Candidate / Winner */
            <div className="h-40 sm:h-48 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-amber-400/50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentCandidate || 'READY'}
                  initial={{ scale: 0.6, opacity: 0, y: 30 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="text-center"
                >
                  {currentCandidate ? (
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">🎉</span>
                        <span className="text-xs font-black uppercase tracking-widest text-amber-400 bg-amber-500/20 px-3 py-0.5 rounded-full border border-amber-400/30">
                          JACKPOT WINNER
                        </span>
                        <span className="text-2xl">🎉</span>
                      </div>
                      <h2 className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-400 to-yellow-100 drop-shadow-[0_4px_15px_rgba(251,191,36,0.6)]">
                        {currentCandidate}
                      </h2>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-slate-500 font-bold">
                      <span className="text-4xl sm:text-5xl mb-2">🎰</span>
                      <span className="text-sm tracking-wider uppercase text-slate-400 font-black">
                        추첨 버튼을 눌러 슬롯을 돌리세요!
                      </span>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Machine Bottom Dashboard */}
        <div className="mt-6 flex items-center justify-between px-4 text-xs font-bold text-amber-200">
          <div className="flex items-center gap-2 bg-amber-900/60 px-4 py-2 rounded-xl border border-amber-500/40">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span>남은 인원: {students.length - drawn.length}명</span>
          </div>
          <div className="bg-amber-900/60 px-4 py-2 rounded-xl border border-amber-500/40 font-mono tracking-wider">
            777 GOLDEN SPIN
          </div>
        </div>

        {/* Casino Mechanical Pull Lever (Right Side Graphic) */}
        <div className="absolute -right-7 top-1/3 hidden sm:flex flex-col items-center">
          <motion.div
            animate={leverPulled ? { y: 50, rotate: 25 } : { y: 0, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="flex flex-col items-center"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-rose-400 shadow-xl border-2 border-white" />
            <div className="w-3 h-20 bg-gradient-to-r from-slate-400 to-slate-200 rounded-b shadow-md" />
          </motion.div>
          <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-600 -mt-2" />
        </div>

      </div>
    </div>
  );
}
