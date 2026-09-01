import React, { useEffect, useRef, useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Play, RotateCcw, Sparkles, Volume2, Flag, Bomb, Flame } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import soundEngine from '../soundEngine';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Student {
  id: string;
  name: string;
}

interface Marble {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  finished: boolean;
  finishRank: number;
  trail: { x: number; y: number }[];
  isBomb?: boolean;
  bombTimer?: number;
  boostEffect?: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

interface ExplosionParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
}

interface Peg {
  x: number;
  y: number;
  radius: number;
}

interface Bumper {
  x: number;
  y: number;
  radius: number;
  pulse: number; // for visual bounce effect
}

interface Ramp {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Spinner {
  x: number;
  y: number;
  length: number;
  angle: number;
  speed: number;
  anchorType?: 'center' | 'edge';
  color?: string;
}

interface SpeedPad {
  x: number;
  y: number;
  width: number;
  height: number;
  boostY: number;
  boostX?: number;
}

interface Wormhole {
  id: string;
  inX: number;
  inY: number;
  outX: number;
  outY: number;
  radius: number;
  color: string;
  pulse: number;
}

interface Pendulum {
  anchorX: number;
  anchorY: number;
  length: number;
  bobRadius: number;
  angle: number;
  speed: number;
  maxAngle: number;
}

interface MarbleRaceProps {
  students: Student[];
  numWinners: number;
  primaryColor?: string;
  onWinnerDetermined: (winnerName: string, rank: number) => void;
  onRaceFinished: (winners: string[]) => void;
}

const TRACK_WIDTH = 700;
const TRACK_HEIGHT = 3600;
const FINISH_Y = TRACK_HEIGHT - 250;

// Color palette for marbles
const MARBLE_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', 
  '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899',
  '#14b8a6', '#84cc16', '#eab308', '#a855f7', '#38bdf8'
];

export default function MarbleRace({
  students,
  numWinners,
  primaryColor = '#fbbf24',
  onWinnerDetermined,
  onRaceFinished,
}: MarbleRaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [raceState, setRaceState] = useState<'ready' | 'countdown' | 'racing' | 'completed'>('ready');
  const [countdown, setCountdown] = useState<number>(3);
  const [winners, setWinners] = useState<{ rank: number; name: string; color: string }[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ name: string; y: number; rank: number }[]>([]);
  const [bombMode, setBombMode] = useState<boolean>(true);
  const [bombAlert, setBombAlert] = useState<string | null>(null);
  const [overtakeAlert, setOvertakeAlert] = useState<{ name: string; color: string } | null>(null);
  const [finishCountdown, setFinishCountdown] = useState<number>(30);
  
  const marblesRef = useRef<Marble[]>([]);
  const pegsRef = useRef<Peg[]>([]);
  const bumpersRef = useRef<Bumper[]>([]);
  const rampsRef = useRef<Ramp[]>([]);
  const spinnersRef = useRef<Spinner[]>([]);
  const speedPadsRef = useRef<SpeedPad[]>([]);
  const wormholesRef = useRef<Wormhole[]>([]);
  const pendulumsRef = useRef<Pendulum[]>([]);

  // Overtake Slow-mo & Dynamic Camera Zoom
  const leaderIdRef = useRef<string | null>(null);
  const slowMoTimerRef = useRef<number>(0);
  const slowMoCooldownRef = useRef<number>(0);
  const zoomRef = useRef<number>(1.0);

  const shockwavesRef = useRef<Shockwave[]>([]);
  const particlesRef = useRef<ExplosionParticle[]>([]);
  const nextBombTimeRef = useRef<number>(0);
  const screenShakeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const lastSoundTimeRef = useRef<number>(0);
  const winnersListRef = useRef<string[]>([]);

  // Sound cooldown
  const playBounceSound = () => {
    const now = Date.now();
    if (now - lastSoundTimeRef.current > 60) {
      lastSoundTimeRef.current = now;
      soundEngine.playMarbleBounce(0.18);
    }
  };

  // Build Obstacle Track
  const initTrack = () => {
    const pegs: Peg[] = [];
    const bumpers: Bumper[] = [];
    const ramps: Ramp[] = [];
    const spinners: Spinner[] = [];

    // --- Section 1: Top Peg Field (y: 350 to 950) ---
    const pegRows = 8;
    for (let r = 0; r < pegRows; r++) {
      const y = 380 + r * 70;
      const isOdd = r % 2 === 1;
      const cols = isOdd ? 9 : 10;
      const spacing = TRACK_WIDTH / cols;
      for (let c = 1; c < cols; c++) {
        const x = c * spacing + (isOdd ? spacing / 2 : 0) - (isOdd ? spacing / 4 : 0);
        if (x > 50 && x < TRACK_WIDTH - 50) {
          pegs.push({ x, y, radius: 7 });
        }
      }
    }

    // --- Section 2: Zig-zag Ramps & Central Bumpers (y: 1050 to 1800) ---
    ramps.push({ x1: 0, y1: 1100, x2: 480, y2: 1250 });
    ramps.push({ x1: TRACK_WIDTH, y1: 1350, x2: 220, y2: 1500 });
    ramps.push({ x1: 0, y1: 1600, x2: 480, y2: 1750 });

    // Bumpers on ramps
    bumpers.push({ x: 550, y: 1200, radius: 32, pulse: 0 });
    bumpers.push({ x: 150, y: 1450, radius: 32, pulse: 0 });
    bumpers.push({ x: 550, y: 1700, radius: 32, pulse: 0 });

    // --- Section 3: Rotating Obstacles (Spinners) (y: 1900 to 2400) ---
    spinners.push({ x: 220, y: 1980, length: 110, angle: 0, speed: 0.04 });
    spinners.push({ x: 480, y: 1980, length: 110, angle: Math.PI / 2, speed: -0.04 });
    spinners.push({ x: 350, y: 2220, length: 140, angle: 0, speed: 0.035 });

    // Side deflector ramps
    ramps.push({ x1: 0, y1: 2100, x2: 120, y2: 2160 });
    ramps.push({ x1: TRACK_WIDTH, y1: 2100, x2: TRACK_WIDTH - 120, y2: 2160 });

    // --- Section 4: Dense Pinball Chaos Zone (y: 2450 to 3100) ---
    for (let r = 0; r < 9; r++) {
      const y = 2500 + r * 65;
      const isOdd = r % 2 === 1;
      const cols = isOdd ? 8 : 9;
      const spacing = TRACK_WIDTH / cols;
      for (let c = 1; c < cols; c++) {
        const x = c * spacing + (isOdd ? spacing / 2 : 0) - (isOdd ? spacing / 4 : 0);
        if (x > 60 && x < TRACK_WIDTH - 60) {
          pegs.push({ x, y, radius: 8 });
        }
      }
    }
    // High-bounce center bumper
    bumpers.push({ x: 350, y: 2800, radius: 45, pulse: 0 });
    bumpers.push({ x: 160, y: 2650, radius: 25, pulse: 0 });
    bumpers.push({ x: 540, y: 2650, radius: 25, pulse: 0 });

    // --- Section 5: Funnel Bottleneck & Rotating Barrier leading into Finish Line (y: 3080 to FINISH_Y) ---
    const ALLEY_L = 305;
    const ALLEY_R = 395;
    const ALLEY_TOP = 3200;

    // 1. Funnel Diagonal Convergence Walls (수렴하는 깔때기 사선 벽)
    ramps.push({ x1: 20, y1: 3080, x2: ALLEY_L, y2: ALLEY_TOP });
    ramps.push({ x1: TRACK_WIDTH - 20, y1: 3080, x2: ALLEY_R, y2: ALLEY_TOP });

    // 2. Narrow Alley Straight Walls (좁은 골목 양쪽 벽)
    ramps.push({ x1: ALLEY_L, y1: ALLEY_TOP, x2: ALLEY_L, y2: FINISH_Y + 50 });
    ramps.push({ x1: ALLEY_R, y1: ALLEY_TOP, x2: ALLEY_R, y2: FINISH_Y + 50 });

    // 3. Rotating Gate Barrier Bar on Alley Entrance (골목 입구에서 시계 반대방향 360도 회전)
    // Left anchor at (305, 3195), length 78px (골목 폭 90px 중 78px 차단, 오른쪽 벽을 파고들지 않음!)
    spinners.push({
      x: ALLEY_L,
      y: ALLEY_TOP - 5,
      length: 78,
      angle: 0,
      speed: -0.046, // 시계 반대방향 회전!
      anchorType: 'edge',
      color: '#f59e0b'
    });

    // --- Dynamic Reversal Gimmick 1: Speed Boost Pads ---
    const speedPads: SpeedPad[] = [
      { x: 250, y: 850, width: 200, height: 32, boostY: 16 },
      { x: 100, y: 1580, width: 160, height: 30, boostY: 15, boostX: 4 },
      { x: 440, y: 1580, width: 160, height: 30, boostY: 15, boostX: -4 },
      { x: 270, y: 2880, width: 160, height: 32, boostY: 17 }
    ];

    // --- Dynamic Reversal Gimmick 2: Cosmic Warp Wormholes ---
    const wormholes: Wormhole[] = [
      { id: 'wh1', inX: 90, inY: 1320, outX: 520, outY: 1720, radius: 24, color: '#a855f7', pulse: 0 },
      { id: 'wh2', inX: 610, inY: 2060, outX: 150, outY: 2420, radius: 24, color: '#06b6d4', pulse: 0 }
    ];

    // --- Dynamic Reversal Gimmick 3: Giant Swinging Pendulums ---
    const pendulums: Pendulum[] = [
      { anchorX: 350, anchorY: 1820, length: 150, bobRadius: 26, angle: -0.9, speed: 0.045, maxAngle: 1.1 },
      { anchorX: 350, anchorY: 3020, length: 130, bobRadius: 24, angle: 0.8, speed: -0.05, maxAngle: 1.0 }
    ];

    pegsRef.current = pegs;
    bumpersRef.current = bumpers;
    rampsRef.current = ramps;
    spinnersRef.current = spinners;
    speedPadsRef.current = speedPads;
    wormholesRef.current = wormholes;
    pendulumsRef.current = pendulums;
  };

  // Initialize Marbles
  const initMarbles = () => {
    const list: Marble[] = [];
    const count = students.length;
    const startY = 120;
    const cols = Math.min(10, Math.ceil(Math.sqrt(count * 2)));
    const spacingX = (TRACK_WIDTH - 160) / (cols - 1 || 1);
    
    students.forEach((s, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const x = 80 + col * spacingX + (Math.random() * 10 - 5);
      const y = startY + row * 36 + (Math.random() * 8 - 4);
      const color = MARBLE_COLORS[idx % MARBLE_COLORS.length];

      list.push({
        id: s.id,
        name: s.name,
        x,
        y,
        vx: (Math.random() - 0.5) * 1.5,
        vy: Math.random() * 0.5,
        radius: 14,
        color,
        finished: false,
        finishRank: 0,
        trail: []
      });
    });

    marblesRef.current = list;
    winnersListRef.current = [];
    setWinners([]);
  };

  // Initialize on mount or when students change
  useEffect(() => {
    initTrack();
    initMarbles();
  }, [students]);

  // Start Race countdown
  const startCountdown = async () => {
    await soundEngine.unlockAudio();
    setRaceState('countdown');
    setCountdown(3);
    soundEngine.playTick('marble');

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setRaceState('racing');
          // Reset bomb & overtake schedule
          nextBombTimeRef.current = Date.now() + 2500;
          shockwavesRef.current = [];
          particlesRef.current = [];
          screenShakeRef.current = 0;
          leaderIdRef.current = null;
          slowMoTimerRef.current = 0;
          slowMoCooldownRef.current = 0;
          zoomRef.current = 1.0;
          setBombAlert(null);
          setOvertakeAlert(null);
          // Gate open sound
          soundEngine.playWin('marble');
          return 0;
        }
        soundEngine.playTick('marble');
        return prev - 1;
      });
    }, 1000);
  };

  // Reset Race
  const resetRace = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    initTrack();
    initMarbles();
    shockwavesRef.current = [];
    particlesRef.current = [];
    screenShakeRef.current = 0;
    leaderIdRef.current = null;
    slowMoTimerRef.current = 0;
    slowMoCooldownRef.current = 0;
    zoomRef.current = 1.0;
    setBombAlert(null);
    setOvertakeAlert(null);
    setRaceState('ready');
    setWinners([]);
    winnersListRef.current = [];
    setFinishCountdown(30);
  };

  // Manual / Auto Finish Handler
  const handleConfirmFinish = () => {
    onRaceFinished(winnersListRef.current.slice(0, numWinners));
  };

  // Countdown when race completes (allows generous 30s viewing time or immediate button click)
  useEffect(() => {
    if (raceState !== 'completed') return;
    const timer = setInterval(() => {
      setFinishCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleConfirmFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [raceState, numWinners]);

  // Physics Simulation Loop
  useEffect(() => {
    if (raceState !== 'racing' && raceState !== 'completed') return;

    let cameraY = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gravity = 0.23;
    const friction = 0.985;
    const wallElasticity = 0.7;

    const loop = () => {
      // 0. Slow-mo timer & timeScale
      if (slowMoTimerRef.current > 0) {
        slowMoTimerRef.current--;
      }
      if (slowMoCooldownRef.current > 0) {
        slowMoCooldownRef.current--;
      }
      const timeScale = slowMoTimerRef.current > 0 ? 0.3 : 1.0;

      // 1. Update Spinners
      spinnersRef.current.forEach(sp => {
        sp.angle += sp.speed * timeScale;
      });

      // 1-1. Update Pendulums
      pendulumsRef.current.forEach(pd => {
        pd.angle += pd.speed * timeScale;
        if (pd.angle > pd.maxAngle || pd.angle < -pd.maxAngle) {
          pd.speed = -pd.speed;
        }
      });

      // 1-2. Update Wormholes pulse
      wormholesRef.current.forEach(wh => {
        if (wh.pulse > 0) wh.pulse = Math.max(0, wh.pulse - 0.05);
      });

      // 2. Update Bumpers pulse
      bumpersRef.current.forEach(b => {
        if (b.pulse > 0) b.pulse = Math.max(0, b.pulse - 0.08);
      });

      const marbles = marblesRef.current;
      const pegs = pegsRef.current;
      const bumpers = bumpersRef.current;
      const ramps = rampsRef.current;
      const spinners = spinnersRef.current;
      const speedPads = speedPadsRef.current;
      const wormholes = wormholesRef.current;
      const pendulums = pendulumsRef.current;

      // 2-1. Random Marble Explosion Trigger
      if (bombMode && raceState === 'racing') {
        const now = Date.now();
        if (now > nextBombTimeRef.current) {
          const activeMarbles = marbles.filter(m => !m.finished && !m.isBomb);
          if (activeMarbles.length > 0) {
            const target = activeMarbles[Math.floor(Math.random() * activeMarbles.length)];
            target.isBomb = true;
            target.bombTimer = 45; // ~0.75 seconds warning countdown
            soundEngine.playBombWarning();
          }
          // Next bomb scheduled in 2.5 ~ 4.5 seconds
          nextBombTimeRef.current = now + (2500 + Math.random() * 2000);
        }
      }

      // 2-2. Update Shockwaves
      for (let s = shockwavesRef.current.length - 1; s >= 0; s--) {
        const sw = shockwavesRef.current[s];
        sw.radius += 7;
        sw.alpha *= 0.92;
        if (sw.radius >= sw.maxRadius || sw.alpha < 0.02) {
          shockwavesRef.current.splice(s, 1);
        }
      }

      // 2-3. Update Explosion Particles
      for (let p = particlesRef.current.length - 1; p >= 0; p--) {
        const pt = particlesRef.current[p];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vx *= 0.95;
        pt.vy *= 0.95;
        pt.life--;
        pt.alpha = pt.life / 40;
        if (pt.life <= 0) {
          particlesRef.current.splice(p, 1);
        }
      }

      // 3. Update Marbles Physics
      for (let i = 0; i < marbles.length; i++) {
        const m = marbles[i];
        if (m.finished) {
          // Slow down gracefully once finished
          m.vy *= 0.92;
          m.vx *= 0.92;
          m.y += m.vy;
          m.x += m.vx;
          continue;
        }

        // Bomb countdown & detonation
        if (m.isBomb && m.bombTimer !== undefined) {
          m.bombTimer--;
          if (m.bombTimer > 0 && m.bombTimer % 12 === 0) {
            soundEngine.playBombWarning();
          } else if (m.bombTimer <= 0) {
            // DETONATE!
            m.isBomb = false;
            soundEngine.playExplosionBlast();
            screenShakeRef.current = 14;

            // Spawn Shockwave ring
            shockwavesRef.current.push({
              x: m.x,
              y: m.y,
              radius: m.radius,
              maxRadius: 220,
              color: '#f97316',
              alpha: 1
            });

            // Spawn Fire/Spark particles
            for (let k = 0; k < 28; k++) {
              const angle = Math.random() * Math.PI * 2;
              const spd = 2 + Math.random() * 8;
              particlesRef.current.push({
                x: m.x,
                y: m.y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                size: 3 + Math.random() * 5,
                color: Math.random() > 0.4 ? '#f97316' : (Math.random() > 0.5 ? '#eab308' : '#ffffff'),
                alpha: 1,
                life: 30 + Math.floor(Math.random() * 20)
              });
            }

            // Blast nearby marbles outward with high impulse!
            const blastRadius = 220;
            for (let j = 0; j < marbles.length; j++) {
              const other = marbles[j];
              if (other.finished || other === m) continue;
              const dx = other.x - m.x;
              const dy = other.y - m.y;
              const dist = Math.hypot(dx, dy);
              if (dist < blastRadius && dist > 0.001) {
                const force = (1 - dist / blastRadius) * 24;
                const nx = dx / dist;
                const ny = dy / dist;
                other.vx += nx * force + (Math.random() - 0.5) * 6;
                other.vy += ny * force - 6; // blast upward and outward
                playBounceSound();
              }
            }

            // Exploded marble gains massive forward turbo rocket boost!
            m.vy += 10;
            m.vx += (Math.random() - 0.5) * 8;
            m.boostEffect = 60;

            setBombAlert(`💥 ${m.name} 구슬 대폭발!!`);
            setTimeout(() => setBombAlert(null), 1800);
          }
        }

        // Decay boost effect
        if (m.boostEffect && m.boostEffect > 0) {
          m.boostEffect--;
        }

        m.vy += gravity * timeScale;
        m.vx *= Math.pow(friction, timeScale);
        m.vy *= Math.pow(friction, timeScale);

        m.x += m.vx * timeScale;
        m.y += m.vy * timeScale;

        // Trail
        m.trail.push({ x: m.x, y: m.y });
        if (m.trail.length > 5) m.trail.shift();

        // Left / Right Wall Collisions
        if (m.x - m.radius < 20) {
          m.x = 20 + m.radius;
          m.vx = -m.vx * wallElasticity;
          playBounceSound();
        } else if (m.x + m.radius > TRACK_WIDTH - 20) {
          m.x = TRACK_WIDTH - 20 - m.radius;
          m.vx = -m.vx * wallElasticity;
          playBounceSound();
        }

        // Top Gate Wall (before race started or bouncing back)
        if (m.y - m.radius < 50) {
          m.y = 50 + m.radius;
          m.vy = Math.abs(m.vy) * 0.5;
        }

        // Collision with Pegs
        for (let p = 0; p < pegs.length; p++) {
          const peg = pegs[p];
          const dx = m.x - peg.x;
          const dy = m.y - peg.y;
          const dist = Math.hypot(dx, dy);
          const minDist = m.radius + peg.radius;

          if (dist < minDist) {
            const nx = dx / (dist || 1);
            const ny = dy / (dist || 1);
            // Push out
            m.x = peg.x + nx * minDist;
            m.y = peg.y + ny * minDist;
            // Bounce
            const dot = m.vx * nx + m.vy * ny;
            m.vx = (m.vx - 1.6 * dot * nx) + (Math.random() - 0.5) * 0.8;
            m.vy = (m.vy - 1.6 * dot * ny) + (Math.random() - 0.5) * 0.8;
            playBounceSound();
          }
        }

        // Collision with Bumpers (Extra Bouncy!)
        for (let b = 0; b < bumpers.length; b++) {
          const bmp = bumpers[b];
          const dx = m.x - bmp.x;
          const dy = m.y - bmp.y;
          const dist = Math.hypot(dx, dy);
          const minDist = m.radius + bmp.radius;

          if (dist < minDist) {
            const nx = dx / (dist || 1);
            const ny = dy / (dist || 1);
            m.x = bmp.x + nx * minDist;
            m.y = bmp.y + ny * minDist;
            // Strong blast
            const impulse = 8.5;
            m.vx = nx * impulse + (Math.random() - 0.5) * 2;
            m.vy = ny * impulse;
            bmp.pulse = 1;
            playBounceSound();
          }
        }

        // Collision with Line Ramps
        for (let r = 0; r < ramps.length; r++) {
          const ramp = ramps[r];
          const rdx = ramp.x2 - ramp.x1;
          const rdy = ramp.y2 - ramp.y1;
          const len = Math.hypot(rdx, rdy);
          const u = Math.max(0, Math.min(1, ((m.x - ramp.x1) * rdx + (m.y - ramp.y1) * rdy) / (len * len)));
          const closestX = ramp.x1 + u * rdx;
          const closestY = ramp.y1 + u * rdy;
          const cdx = m.x - closestX;
          const cdy = m.y - closestY;
          const dist = Math.hypot(cdx, cdy);

          if (dist < m.radius + 4) {
            const nx = cdx / (dist || 1);
            const ny = cdy / (dist || 1);
            m.x = closestX + nx * (m.radius + 4);
            m.y = closestY + ny * (m.radius + 4);
            const dot = m.vx * nx + m.vy * ny;
            m.vx = m.vx - 1.5 * dot * nx;
            m.vy = m.vy - 1.5 * dot * ny;
            // Add slight downhill slide force
            m.vx += (rdx / len) * 0.4;
            m.vy += (rdy / len) * 0.4;
          }
        }

        // Collision with Spinners & Rotating Barriers
        for (let s = 0; s < spinners.length; s++) {
          const sp = spinners[s];
          const isEdge = sp.anchorType === 'edge';
          const cos = Math.cos(sp.angle);
          const sin = Math.sin(sp.angle);
          const x1 = isEdge ? sp.x : sp.x - cos * (sp.length / 2);
          const y1 = isEdge ? sp.y : sp.y - sin * (sp.length / 2);
          const x2 = isEdge ? sp.x + cos * sp.length : sp.x + cos * (sp.length / 2);
          const y2 = isEdge ? sp.y + sin * sp.length : sp.y + sin * (sp.length / 2);

          const rdx = x2 - x1;
          const rdy = y2 - y1;
          const len = Math.hypot(rdx, rdy);
          const u = Math.max(0, Math.min(1, ((m.x - x1) * rdx + (m.y - y1) * rdy) / (len * len)));
          const closestX = x1 + u * rdx;
          const closestY = y1 + u * rdy;
          const dist = Math.hypot(m.x - closestX, m.y - closestY);

          if (dist < m.radius + 6) {
            const nx = (m.x - closestX) / (dist || 1);
            const ny = (m.y - closestY) / (dist || 1);

            if (isEdge) {
              // Edge-anchored Gate Barrier:
              // 1. Strictly keep inside alley horizontal bounds
              m.x = Math.max(305 + m.radius + 2, Math.min(395 - m.radius - 2, m.x));
              // 2. Launch ball strongly UPWARD out of the gate!
              m.y = Math.min(m.y, 3200 - m.radius - 6);
              m.vy = -Math.abs(m.vy) * 0.8 - 9;
              m.vx = (Math.random() - 0.5) * 6;
            } else {
              m.x = closestX + nx * (m.radius + 6);
              m.y = closestY + ny * (m.radius + 6);
              // Spinner tangential velocity push
              const rotRadius = sp.length * 0.5;
              const tangentSpeed = sp.speed * rotRadius;
              m.vx = nx * 6 - sin * tangentSpeed * 1.2;
              m.vy = ny * 6 + cos * tangentSpeed * 1.2;
            }
            playBounceSound();
          }
        }

        // --- Gimmick Collision 1: Speed Boost Pads ---
        for (let sp = 0; sp < speedPads.length; sp++) {
          const pad = speedPads[sp];
          if (
            m.x >= pad.x && m.x <= pad.x + pad.width &&
            m.y >= pad.y && m.y <= pad.y + pad.height
          ) {
            m.vy = Math.max(m.vy + pad.boostY, pad.boostY * 1.15);
            if (pad.boostX) m.vx += pad.boostX;
            m.boostEffect = 45;
            soundEngine.playBoostPad();
          }
        }

        // --- Gimmick Collision 2: Cosmic Warp Wormholes ---
        for (let w = 0; w < wormholes.length; w++) {
          const wh = wormholes[w];
          const dx = m.x - wh.inX;
          const dy = m.y - wh.inY;
          if (Math.hypot(dx, dy) < wh.radius + m.radius) {
            m.x = wh.outX + (Math.random() - 0.5) * 16;
            m.y = wh.outY + 25;
            m.vy = Math.max(m.vy, 9);
            wh.pulse = 1;
            soundEngine.playWarpSound();
            // Spawn portal warp spark particles
            for (let k = 0; k < 14; k++) {
              particlesRef.current.push({
                x: wh.outX,
                y: wh.outY,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                size: 3.5,
                color: wh.color,
                alpha: 1,
                life: 25
              });
            }
          }
        }

        // --- Gimmick Collision 3: Giant Swinging Pendulums ---
        for (let p = 0; p < pendulums.length; p++) {
          const pd = pendulums[p];
          const bobX = pd.anchorX + Math.sin(pd.angle) * pd.length;
          const bobY = pd.anchorY + Math.cos(pd.angle) * pd.length;
          const dx = m.x - bobX;
          const dy = m.y - bobY;
          const dist = Math.hypot(dx, dy);
          const minDist = m.radius + pd.bobRadius;

          if (dist < minDist && dist > 0.001) {
            const nx = dx / dist;
            const ny = dy / dist;
            m.x = bobX + nx * minDist;
            m.y = bobY + ny * minDist;
            const hammerSpeed = pd.speed * pd.length;
            m.vx += nx * 14 + Math.cos(pd.angle) * hammerSpeed * 0.9;
            m.vy += ny * 14;
            playBounceSound();
          }
        }

        // --- 100% Solid Wall Enclosure for Finish Funnel & Alley (Prevents wall clipping & tunneling) ---
        const ALLEY_L = 305;
        const ALLEY_R = 395;
        const ALLEY_TOP = 3200;

        // A. Funnel zone (y: 3080 to ALLEY_TOP)
        if (m.y >= 3080 && m.y < ALLEY_TOP) {
          const progress = (m.y - 3080) / (ALLEY_TOP - 3080);
          const leftWallX = 20 + progress * (ALLEY_L - 20);
          if (m.x < leftWallX + m.radius) {
            m.x = leftWallX + m.radius;
            m.vx = Math.abs(m.vx) * 0.6 + 1.5;
          }
          const rightWallX = (TRACK_WIDTH - 20) - progress * ((TRACK_WIDTH - 20) - ALLEY_R);
          if (m.x > rightWallX - m.radius) {
            m.x = rightWallX - m.radius;
            m.vx = -Math.abs(m.vx) * 0.6 - 1.5;
          }
        }

        // B. Vertical Alley zone (y >= ALLEY_TOP)
        if (m.y >= ALLEY_TOP) {
          // Strictly confine marble within alley horizontal bounds [ALLEY_L + m.radius, ALLEY_R - m.radius]!
          if (m.x < ALLEY_L + m.radius) {
            m.x = ALLEY_L + m.radius;
            m.vx = Math.abs(m.vx) * 0.6;
          } else if (m.x > ALLEY_R - m.radius) {
            m.x = ALLEY_R - m.radius;
            m.vx = -Math.abs(m.vx) * 0.6;
          }
        }

        // Check Finish Line (STRICTLY VALID ONLY INSIDE THE NARROW ALLEY!)
        const isInsideFinishAlley = m.x >= ALLEY_L - 2 && m.x <= ALLEY_R + 2;
        if (m.y >= FINISH_Y && isInsideFinishAlley && !m.finished) {
          m.finished = true;
          const rank = winnersListRef.current.length + 1;
          m.finishRank = rank;
          winnersListRef.current.push(m.name);

          // Trigger Winner celebration
          soundEngine.playWin('marble');
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.7 },
            colors: [m.color, '#fbbf24', '#ffffff']
          });

          setWinners(prev => [...prev, { rank, name: m.name, color: m.color }]);
          onWinnerDetermined(m.name, rank);

          // If reached required winner count
          if (winnersListRef.current.length >= numWinners) {
            setRaceState('completed');
            setFinishCountdown(30);
            soundEngine.playWin('marble');
            confetti({
              particleCount: 180,
              spread: 95,
              origin: { y: 0.5 },
              colors: ['#fbbf24', '#f59e0b', '#10b981', '#6366f1', '#ec4899']
            });
          }
        }
      }

      // 4. Marble-to-Marble Collisions
      for (let i = 0; i < marbles.length; i++) {
        for (let j = i + 1; j < marbles.length; j++) {
          const m1 = marbles[i];
          const m2 = marbles[j];
          const dx = m2.x - m1.x;
          const dy = m2.y - m1.y;
          const dist = Math.hypot(dx, dy);
          const minDist = m1.radius + m2.radius;

          if (dist < minDist && dist > 0.001) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = (minDist - dist) / 2;

            m1.x -= nx * overlap;
            m1.y -= ny * overlap;
            m2.x += nx * overlap;
            m2.y += ny * overlap;

            // Elastic velocity exchange
            const kx = m1.vx - m2.vx;
            const ky = m1.vy - m2.vy;
            const p = 2 * (nx * kx + ny * ky) / 2;
            m1.vx -= p * nx * 0.8;
            m1.vy -= p * ny * 0.8;
            m2.vx += p * nx * 0.8;
            m2.vy += p * ny * 0.8;
          }
        }
      }

      // 5. Update Leaderboard (top 5 by Y position)
      const sorted = [...marbles]
        .sort((a, b) => {
          if (a.finished && !b.finished) return -1;
          if (!a.finished && b.finished) return 1;
          if (a.finished && b.finished) return a.finishRank - b.finishRank;
          return b.y - a.y;
        })
        .slice(0, 5)
        .map((m, idx) => ({ name: m.name, y: m.y, rank: idx + 1 }));
      setLeaderboard(sorted);

      // 5-1. Overtake Detection & Slow-mo Trigger
      const activeMarbles = marbles.filter(m => !m.finished);
      let currentLead: Marble | null = null;
      if (activeMarbles.length > 0) {
        currentLead = activeMarbles.reduce((prev, curr) => (curr.y > prev.y ? curr : prev), activeMarbles[0]);
        
        // Check for 1st place overtake if past the starting zone
        if (raceState === 'racing' && currentLead.y > 350 && currentLead.y < FINISH_Y) {
          if (leaderIdRef.current && leaderIdRef.current !== currentLead.id) {
            // A new marble has overtaken 1st place!
            if (slowMoCooldownRef.current <= 0) {
              slowMoTimerRef.current = 65; // ~1.1s slow motion
              slowMoCooldownRef.current = 190; // ~3.2s cooldown
              soundEngine.playSlowMoWhoosh();
              setOvertakeAlert({ name: currentLead.name, color: currentLead.color });
              setTimeout(() => setOvertakeAlert(null), 1800);
            }
          }
          leaderIdRef.current = currentLead.id;
        }
      }

      // 6. Smooth Camera Tracking with Dynamic Zoom
      const targetZoom = slowMoTimerRef.current > 0 ? 1.6 : 1.0;
      zoomRef.current += (targetZoom - zoomRef.current) * 0.08;
      const currentZoom = zoomRef.current;

      let targetCameraY = FINISH_Y - 300;
      let leadX = TRACK_WIDTH / 2;
      if (currentLead) {
        targetCameraY = currentLead.y - 250;
        leadX = currentLead.x;
      }
      targetCameraY = Math.max(0, Math.min(TRACK_HEIGHT - 650, targetCameraY));
      cameraY += (targetCameraY - cameraY) * 0.08;

      // 7. RENDER TRACK ON CANVAS
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      // Screen Shake translation
      let shakeX = 0;
      let shakeY = 0;
      if (screenShakeRef.current > 0) {
        shakeX = (Math.random() - 0.5) * screenShakeRef.current;
        shakeY = (Math.random() - 0.5) * screenShakeRef.current;
        screenShakeRef.current *= 0.86;
        if (screenShakeRef.current < 0.2) screenShakeRef.current = 0;
      }

      // Dynamic Zoom & Close-up centering on 1st place marble!
      const viewCenterX = canvas.width / 2;
      const viewCenterY = 260;
      ctx.translate(viewCenterX + shakeX, viewCenterY + shakeY);
      ctx.scale(currentZoom, currentZoom);
      ctx.translate(-leadX, -cameraY - viewCenterY);

      // Track Background & Side Rails
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, TRACK_WIDTH, TRACK_HEIGHT);

      // Grid background lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let y = 0; y < TRACK_HEIGHT; y += 80) {
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(TRACK_WIDTH - 20, y);
        ctx.stroke();
      }

      // Neon Side Rails
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(20, TRACK_HEIGHT);
      ctx.moveTo(TRACK_WIDTH - 20, 0);
      ctx.lineTo(TRACK_WIDTH - 20, TRACK_HEIGHT);
      ctx.stroke();

      // Top Start Chamber Gate
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(20, 50, TRACK_WIDTH - 40, 20);
      ctx.fillStyle = primaryColor;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('START CHAMBER', TRACK_WIDTH / 2, 40);

      // Draw Ramps
      ramps.forEach(ramp => {
        const isBottleneckWall = ramp.y1 >= 3100 || ramp.y2 >= 3100;
        ctx.strokeStyle = isBottleneckWall ? '#f59e0b' : '#6366f1';
        ctx.lineWidth = isBottleneckWall ? 10 : 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ramp.x1, ramp.y1);
        ctx.lineTo(ramp.x2, ramp.y2);
        ctx.stroke();

        // Neon glow
        ctx.strokeStyle = isBottleneckWall ? 'rgba(245, 158, 11, 0.4)' : 'rgba(99, 102, 241, 0.3)';
        ctx.lineWidth = isBottleneckWall ? 20 : 16;
        ctx.stroke();
      });

      // Draw Pegs
      pegs.forEach(peg => {
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#94a3b8';
        ctx.fill();
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // Draw Bumpers
      bumpers.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius + (b.pulse * 8), 0, Math.PI * 2);
        ctx.fillStyle = b.pulse > 0 ? '#ef4444' : '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Inner core
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      });

      // Draw Spinners & Rotating Barriers
      spinners.forEach(sp => {
        ctx.save();
        ctx.translate(sp.x, sp.y);
        ctx.rotate(sp.angle);

        if (sp.anchorType === 'edge') {
          // --- Rotating Gate Barrier Bar on Alley Entrance ---
          // Main hazard arm
          ctx.fillStyle = sp.color || '#f59e0b';
          ctx.fillRect(0, -6, sp.length, 12);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.strokeRect(0, -6, sp.length, 12);

          // Black hazard stripes
          ctx.fillStyle = '#0f172a';
          for (let s = 10; s < sp.length - 10; s += 16) {
            ctx.beginPath();
            ctx.moveTo(s, -6);
            ctx.lineTo(s + 8, -6);
            ctx.lineTo(s + 4, 6);
            ctx.lineTo(s - 4, 6);
            ctx.fill();
          }

          // Flashing red/amber beacon on the tip
          const tipPulse = Math.sin(Date.now() * 0.015) > 0;
          ctx.beginPath();
          ctx.arc(sp.length - 4, 0, 6, 0, Math.PI * 2);
          ctx.fillStyle = tipPulse ? '#ef4444' : '#fbbf24';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Anchor Bearing Joint on the Wall
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.fillStyle = '#475569';
          ctx.fill();
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 3;
          ctx.stroke();

          // Center Bolt
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        } else {
          // Center-anchored rotating blade
          ctx.fillStyle = sp.color || '#06b6d4';
          ctx.fillRect(-sp.length / 2, -6, sp.length, 12);
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
        ctx.restore();
      });

      // Draw Speed Boost Pads
      speedPads.forEach(pad => {
        ctx.save();
        ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(pad.x, pad.y, pad.width, pad.height, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ SPEED BOOST ⚡', pad.x + pad.width / 2, pad.y + pad.height / 2 + 5);
        ctx.restore();
      });

      // Draw Wormholes
      wormholes.forEach(wh => {
        ctx.save();
        const rot = (Date.now() * 0.003) % (Math.PI * 2);
        // Entrance
        ctx.beginPath();
        ctx.arc(wh.inX, wh.inY, wh.radius + (wh.pulse * 6), 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.strokeStyle = wh.color;
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(wh.inX, wh.inY, wh.radius * 0.65, rot, rot + Math.PI * 1.5);
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = wh.color;
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WARP IN', wh.inX, wh.inY - wh.radius - 4);

        // Exit
        ctx.beginPath();
        ctx.arc(wh.outX, wh.outY, wh.radius * 0.8, 0, Math.PI * 2);
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#eab308';
        ctx.fillText('WARP OUT', wh.outX, wh.outY - wh.radius - 4);
        ctx.restore();
      });

      // Draw Giant Pendulums
      pendulums.forEach(pd => {
        ctx.save();
        const bobX = pd.anchorX + Math.sin(pd.angle) * pd.length;
        const bobY = pd.anchorY + Math.cos(pd.angle) * pd.length;

        // Anchor
        ctx.beginPath();
        ctx.arc(pd.anchorX, pd.anchorY, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#64748b';
        ctx.fill();

        // Rod
        ctx.beginPath();
        ctx.moveTo(pd.anchorX, pd.anchorY);
        ctx.lineTo(bobX, bobY);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Heavy Hammer Head
        ctx.beginPath();
        ctx.arc(bobX, bobY, pd.bobRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#e11d48';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Center bolt
        ctx.beginPath();
        ctx.arc(bobX, bobY, pd.bobRadius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
      });

      // Draw Finish Line (Narrow Alley Goal & Checkered Pattern)
      ctx.save();
      // Checkered Pattern inside the narrow alley (305 to 395)
      const sqSize = 15;
      for (let x = 305; x < 395; x += sqSize) {
        for (let y = FINISH_Y; y < FINISH_Y + 30; y += sqSize) {
          const isWhite = ((Math.floor(x / sqSize)) + (Math.floor(y / sqSize))) % 2 === 0;
          ctx.fillStyle = isWhite ? '#ffffff' : '#0f172a';
          ctx.fillRect(x, y, sqSize, sqSize);
        }
      }
      // Golden border around the goal alley
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.strokeRect(305, FINISH_Y, 90, 30);

      // Finish Banner
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'black 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🏁 GOAL 🏁', TRACK_WIDTH / 2, FINISH_Y - 8);

      // Warning text above bottleneck entrance
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('⚠️ DANGER: FINAL ROTATING GATE BARRIER ⚠️', TRACK_WIDTH / 2, 3105);
      ctx.restore();

      // Draw Shockwaves
      shockwavesRef.current.forEach(sw => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(249, 115, 22, ${Math.max(0, sw.alpha)})`;
        ctx.lineWidth = 8;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sw.x, sw.y, Math.max(1, sw.radius * 0.85), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(254, 240, 138, ${Math.max(0, sw.alpha * 0.8)})`;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
      });

      // Draw Explosion Fire Particles
      particlesRef.current.forEach(pt => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, pt.alpha));
        ctx.fill();
        ctx.restore();
      });

      // Draw Marbles
      marbles.forEach(m => {
        // Rocket Turbo Boost Flame Effect
        if (m.boostEffect && m.boostEffect > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(m.x, m.y + m.radius + 6, (m.boostEffect / 60) * 16, 0, Math.PI * 2);
          ctx.fillStyle = Math.random() > 0.5 ? '#f97316' : '#facc15';
          ctx.filter = 'blur(4px)';
          ctx.fill();
          ctx.restore();
        }

        // Motion Trail
        if (m.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(m.trail[0].x, m.trail[0].y);
          for (let t = 1; t < m.trail.length; t++) {
            ctx.lineTo(m.trail[t].x, m.trail[t].y);
          }
          ctx.strokeStyle = `${m.color}55`;
          ctx.lineWidth = m.radius * 1.2;
          ctx.stroke();
        }

        // Bomb Charging Aura (flashing red/yellow warning aura)
        if (m.isBomb) {
          ctx.save();
          const flash = Math.sin(Date.now() * 0.03) > 0;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius + 8, 0, Math.PI * 2);
          ctx.strokeStyle = flash ? '#ef4444' : '#fbbf24';
          ctx.lineWidth = 4;
          ctx.stroke();

          // Shockwave pulsing background
          ctx.fillStyle = flash ? 'rgba(239, 68, 68, 0.35)' : 'rgba(251, 191, 36, 0.2)';
          ctx.fill();
          ctx.restore();
        }

        // Marble Sphere (Radial gradient 3D glass look)
        const grad = ctx.createRadialGradient(
          m.x - m.radius * 0.3,
          m.y - m.radius * 0.3,
          m.radius * 0.1,
          m.x,
          m.y,
          m.radius
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, m.color);
        grad.addColorStop(1, '#000000');

        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = m.isBomb ? '#ef4444' : '#ffffff';
        ctx.lineWidth = m.isBomb ? 2.5 : 1.5;
        ctx.stroke();

        // 1st Place Golden Crown on Current Leader
        const isCurrent1st = currentLead && currentLead.id === m.id && !m.finished && raceState === 'racing';
        if (isCurrent1st) {
          ctx.save();
          // Leader pulsing ring
          const ringPulse = Math.sin(Date.now() * 0.01) * 3;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius + 6 + ringPulse, 0, Math.PI * 2);
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 3;
          ctx.stroke();

          // Crown icon above tag
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('👑', m.x, m.y - m.radius - (m.isBomb ? 38 : 22));
          ctx.restore();
        }

        // Bomb indicator emoji above name
        if (m.isBomb) {
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('💣', m.x, m.y - m.radius - 22);
        }

        // Student Name Tag above Marble
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = isCurrent1st ? '#fbbf24' : (m.isBomb ? 'rgba(220, 38, 38, 0.95)' : 'rgba(15, 23, 42, 0.85)');
        const textWidth = ctx.measureText(m.name).width;
        ctx.fillRect(m.x - textWidth / 2 - 4, m.y - m.radius - 18, textWidth + 8, 14);

        ctx.fillStyle = isCurrent1st ? '#0f172a' : '#ffffff';
        ctx.fillText(m.name, m.x, m.y - m.radius - 7);

        // Rank Badge if finished
        if (m.finished) {
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius * 0.9, 0, Math.PI * 2);
          ctx.fillStyle = '#fbbf24';
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.font = 'black 12px sans-serif';
          ctx.fillText(`${m.finishRank}`, m.x, m.y + 4);
        }
      });

      ctx.restore();

      // --- Cinematic Slow-Mo Letterbox & Speed Lines Overlay ---
      if (slowMoTimerRef.current > 0) {
        ctx.save();
        // Top & Bottom Cinematic Letterbox Bars
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, 32);
        ctx.fillRect(0, canvas.height - 32, canvas.width, 32);

        // Letterbox Neon accent lines
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 32);
        ctx.lineTo(canvas.width, 32);
        ctx.moveTo(0, canvas.height - 32);
        ctx.lineTo(canvas.width, canvas.height - 32);
        ctx.stroke();

        // Speed Lines around screen borders
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
        ctx.lineWidth = 2;
        for (let l = 0; l < 12; l++) {
          const sx = (l / 12) * canvas.width;
          ctx.beginPath();
          ctx.moveTo(sx, 32);
          ctx.lineTo(sx + (Math.random() - 0.5) * 30, 60);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(sx, canvas.height - 32);
          ctx.lineTo(sx + (Math.random() - 0.5) * 30, canvas.height - 60);
          ctx.stroke();
        }

        // Center Letterbox Slow-Mo Indicator
        ctx.fillStyle = '#fde047';
        ctx.font = 'black 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ SLOW MOTION OVERTAKE ⚡', canvas.width / 2, 21);
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [raceState, numWinners, primaryColor, bombMode]);

  return (
    <div className="w-full max-w-4xl flex flex-col items-center select-none relative">
      {/* Race Top HUD */}
      <div className="w-full bg-slate-900/90 backdrop-blur-md p-4 rounded-3xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 mb-4 shadow-2xl z-20">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              구슬 레이스 추첨
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold">
                목표 {numWinners}명
              </span>
            </h3>
            <p className="text-xs text-slate-400">결승선에 가장 먼저 도착한 구슬이 당첨됩니다!</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Bomb Mode Toggle Button */}
          <button
            onClick={() => setBombMode(prev => !prev)}
            className={cn(
              "px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all border shadow-sm",
              bombMode 
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30" 
                : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200"
            )}
            title="레이스 도중 구슬들이 무작위로 폭발하며 충격파를 뿜어내는 모드입니다."
          >
            <Bomb className={cn("w-3.5 h-3.5", bombMode ? "text-rose-400 animate-pulse" : "text-slate-400")} />
            <span>폭발 모드 {bombMode ? "ON" : "OFF"}</span>
          </button>

          {raceState === 'ready' && (
            <button
              onClick={startCountdown}
              style={{ backgroundColor: primaryColor }}
              className="px-6 py-2.5 rounded-xl font-black text-slate-950 text-sm shadow-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              레이스 출발!
            </button>
          )}

          {(raceState === 'racing' || raceState === 'completed') && (
            <button
              onClick={resetRace}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              다시 하기
            </button>
          )}

          {raceState === 'completed' && (
            <button
              onClick={handleConfirmFinish}
              className="px-4 py-2 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all shadow-md animate-pulse"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>결과 확정 ({finishCountdown}s)</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Track View Container */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] max-h-[560px] bg-slate-950 rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl flex justify-center">
        {/* Bomb Alert Floating Notification */}
        {bombAlert && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-rose-600/90 backdrop-blur-md text-white px-5 py-2 rounded-2xl shadow-2xl font-black text-sm flex items-center gap-2 z-50 animate-bounce border border-rose-400">
            <Flame className="w-4 h-4 text-amber-300 fill-current" />
            <span>{bombAlert}</span>
          </div>
        )}

        {/* Overtake Slow-Mo Alert Banner */}
        {overtakeAlert && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 text-slate-950 px-6 py-2.5 rounded-2xl shadow-[0_0_35px_rgba(251,191,36,0.9)] font-black text-sm sm:text-base flex items-center gap-2.5 z-50 animate-in zoom-in-95 border-2 border-white">
            <Sparkles className="w-5 h-5 text-slate-950 fill-current animate-spin" />
            <span>🔥 1위 역전! [{overtakeAlert.name}] 선두 탈환!</span>
          </div>
        )}

        {/* HTML5 Canvas */}
        <canvas
          ref={canvasRef}
          width={TRACK_WIDTH}
          height={650}
          className="h-full w-auto object-contain pointer-events-none"
        />

        {/* Countdown Overlay */}
        {raceState === 'countdown' && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-40 animate-in fade-in">
            <span className="text-7xl sm:text-9xl font-black text-amber-400 animate-bounce drop-shadow-[0_0_40px_rgba(251,191,36,0.8)]">
              {countdown}
            </span>
            <p className="text-slate-300 font-bold mt-4 tracking-widest uppercase">준비... 출발선 개방!</p>
          </div>
        )}

        {/* Live Race Leaderboard Overlay (Left Floating) */}
        <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md p-3 rounded-2xl border border-slate-800 shadow-xl hidden sm:block z-30 max-w-[170px]">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1">
            <Flag className="w-3 h-3 text-indigo-400" /> 실시간 선두
          </p>
          <div className="space-y-1.5">
            {leaderboard.map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between text-xs font-bold gap-2">
                <span className="w-5 h-5 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-black">
                  {idx + 1}
                </span>
                <span className="text-slate-200 truncate flex-1 text-left">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Winners Trophy Board Overlay (Right Floating) */}
        <div className="absolute top-4 right-4 bg-slate-900/85 backdrop-blur-md p-4 rounded-2xl border border-amber-500/30 shadow-2xl z-30 min-w-[200px]">
          <p className="text-xs font-black uppercase text-amber-400 tracking-wider mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> 골인 당첨자 ({winners.length}/{numWinners})
          </p>
          <div className="space-y-2">
            {winners.length === 0 ? (
              <p className="text-xs text-slate-500 italic">아직 골인한 구슬이 없습니다.</p>
            ) : (
              winners.map(w => (
                <div 
                  key={w.name} 
                  className="flex items-center gap-2.5 p-2 bg-white/5 rounded-xl border border-white/10 animate-in slide-in-from-right duration-300"
                >
                  <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shadow-md">
                    {w.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">{w.name}</p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md">
                    골인!
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Race Completed Big Winner Modal with Manual Finish Button */}
        {raceState === 'completed' && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 z-50 animate-in fade-in zoom-in-95">
            <div className="w-full max-w-md bg-slate-900 border-2 border-amber-400/80 rounded-3xl p-6 shadow-[0_0_60px_rgba(251,191,36,0.35)] flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center mb-3 text-amber-400 shadow-inner">
                <Trophy className="w-8 h-8" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mb-1">
                🎉 최종 당첨 구슬 골인 완료!
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mb-4">
                선발된 <span className="text-amber-400 font-black">{winners.length}명</span>의 당첨 학생 명단입니다.
              </p>

              {/* Winner List scrollable container */}
              <div className="w-full max-h-[200px] overflow-y-auto space-y-2 mb-5 pr-1 text-left">
                {winners.slice(0, numWinners).map((w, idx) => (
                  <div 
                    key={w.name} 
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "w-7 h-7 rounded-full font-black text-xs flex items-center justify-center shadow",
                        idx === 0 ? "bg-amber-400 text-slate-950 ring-2 ring-amber-300" :
                        idx === 1 ? "bg-slate-300 text-slate-950" :
                        idx === 2 ? "bg-amber-700 text-white" : "bg-indigo-600 text-white"
                      )}>
                        {w.rank}등
                      </span>
                      <span className="text-base font-black text-white">{w.name}</span>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      🏆 당첨 확정
                    </span>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="w-full flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  onClick={handleConfirmFinish}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-sm shadow-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Sparkles className="w-4 h-4 fill-current" />
                  <span>결과 확정 및 화면 닫기</span>
                  <span className="text-[10px] font-bold text-slate-800 bg-black/10 px-1.5 py-0.5 rounded-md ml-1">
                    {finishCountdown}s
                  </span>
                </button>
                <button
                  onClick={resetRace}
                  className="w-full sm:w-auto py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>다시 하기</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
