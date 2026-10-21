import React, { useEffect, useRef, useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Play, RotateCcw, Sparkles, Volume2, Flag, Bomb, Flame, Hourglass, ShieldAlert, Orbit, Zap, Snowflake, Cog } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import soundEngine from '../soundEngine';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type MapTheme = 'cosmic' | 'pinball' | 'glacier' | 'factory';

export interface MapThemeInfo {
  id: MapTheme;
  name: string;
  icon: string;
  desc: string;
  activeClasses: string;
  badgeColor: string;
}

export const MAP_THEMES: MapThemeInfo[] = [
  {
    id: 'cosmic',
    name: '우주 블랙홀',
    icon: '🌌',
    desc: '하단 블랙홀로 빨려 들어가면 상단으로 역류 워프!',
    activeClasses: 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-900/40',
    badgeColor: '#8b5cf6'
  },
  {
    id: 'pinball',
    name: '네온 핀볼',
    icon: '⚡',
    desc: '사방에서 튀어오르는 초탄성 메가 범퍼 카오스!',
    activeClasses: 'bg-pink-600 text-white border-pink-400 shadow-lg shadow-pink-900/40',
    badgeColor: '#ec4899'
  },
  {
    id: 'glacier',
    name: '빙하 협곡',
    icon: '❄️',
    desc: '강력한 눈보라 감속과 닿으면 얼어붙는 얼음 오브젝트!',
    activeClasses: 'bg-cyan-600 text-white border-cyan-400 shadow-lg shadow-cyan-900/40',
    badgeColor: '#06b6d4'
  },
  {
    id: 'factory',
    name: '메카닉 팩토리',
    icon: '⚙️',
    desc: '맞물려 회전하는 연쇄 기어와 8단 수평 컨베이어 벨트!',
    activeClasses: 'bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-900/40',
    badgeColor: '#f59e0b'
  }
];

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
  frozenTimer?: number;
  freezeCooldown?: number;
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

interface ConveyorBelt {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  label?: string;
  color?: string;
}

interface IceTrap {
  id: string;
  x: number;
  y: number;
  radius: number;
  pulse: number;
  frozenDuration: number;
}

interface Snowflake {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

interface MarbleRaceProps {
  students: Student[];
  numWinners: number;
  primaryColor?: string;
  initialMapTheme?: MapTheme;
  initialSpeed?: number;
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
  initialMapTheme = 'cosmic',
  initialSpeed = 1,
  onWinnerDetermined,
  onRaceFinished,
}: MarbleRaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [raceState, setRaceState] = useState<'ready' | 'countdown' | 'racing' | 'completed'>('ready');
  const [countdown, setCountdown] = useState<number>(3);
  const [winners, setWinners] = useState<{ rank: number; name: string; color: string }[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ name: string; y: number; rank: number }[]>([]);
  const [bombMode, setBombMode] = useState<boolean>(true);
  const [winRule, setWinRule] = useState<'first' | 'last'>('first');
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [bombAlert, setBombAlert] = useState<string | null>(null);
  const [blizzardAlert, setBlizzardAlert] = useState<string | null>(null);
  const [freezeAlert, setFreezeAlert] = useState<string | null>(null);
  const [overtakeAlert, setOvertakeAlert] = useState<{ name: string; color: string } | null>(null);
  const [finishCountdown, setFinishCountdown] = useState<number>(30);
  const [mapTheme, setMapTheme] = useState<MapTheme>(initialMapTheme);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(initialSpeed);
  const speedMultiplierRef = useRef<number>(initialSpeed);

  useEffect(() => {
    setSpeedMultiplier(initialSpeed);
    speedMultiplierRef.current = initialSpeed;
  }, [initialSpeed]);
  
  const marblesRef = useRef<Marble[]>([]);
  const pegsRef = useRef<Peg[]>([]);
  const bumpersRef = useRef<Bumper[]>([]);
  const rampsRef = useRef<Ramp[]>([]);
  const spinnersRef = useRef<Spinner[]>([]);
  const speedPadsRef = useRef<SpeedPad[]>([]);
  const wormholesRef = useRef<Wormhole[]>([]);
  const pendulumsRef = useRef<Pendulum[]>([]);
  const conveyorsRef = useRef<ConveyorBelt[]>([]);
  const iceTrapsRef = useRef<IceTrap[]>([]);
  const blizzardActiveRef = useRef<boolean>(false);
  const blizzardDurationRef = useRef<number>(0);
  const nextBlizzardTimeRef = useRef<number>(0);
  const snowflakesRef = useRef<Snowflake[]>([]);

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
  const cameraYRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastLeaderboardKeyRef = useRef<string>('');
  const bombAlertTimerRef = useRef<number | null>(null);
  const freezeAlertTimerRef = useRef<number | null>(null);
  const overtakeAlertTimerRef = useRef<number | null>(null);

  const triggerBombAlert = (msg: string, duration = 1800) => {
    setBombAlert(msg);
    if (bombAlertTimerRef.current) window.clearTimeout(bombAlertTimerRef.current);
    bombAlertTimerRef.current = window.setTimeout(() => setBombAlert(null), duration);
  };

  const triggerFreezeAlert = (msg: string, duration = 1800) => {
    setFreezeAlert(msg);
    if (freezeAlertTimerRef.current) window.clearTimeout(freezeAlertTimerRef.current);
    freezeAlertTimerRef.current = window.setTimeout(() => setFreezeAlert(null), duration);
  };

  const triggerOvertakeAlert = (alert: { name: string; color: string }, duration = 1800) => {
    setOvertakeAlert(alert);
    if (overtakeAlertTimerRef.current) window.clearTimeout(overtakeAlertTimerRef.current);
    overtakeAlertTimerRef.current = window.setTimeout(() => setOvertakeAlert(null), duration);
  };

  // Sound cooldown
  const playBounceSound = () => {
    const now = Date.now();
    if (now - lastSoundTimeRef.current > 60) {
      lastSoundTimeRef.current = now;
      soundEngine.playMarbleBounce(0.18);
    }
  };

  // Build Obstacle Track based on selected theme
  const initTrack = (theme: MapTheme = mapTheme) => {
    const pegs: Peg[] = [];
    const bumpers: Bumper[] = [];
    const ramps: Ramp[] = [];
    const spinners: Spinner[] = [];
    const speedPads: SpeedPad[] = [];
    const wormholes: Wormhole[] = [];
    const pendulums: Pendulum[] = [];
    const conveyors: ConveyorBelt[] = [];
    const iceTraps: IceTrap[] = [];

    // --- Common Finale: Funnel Bottleneck & Rotating Gate Barrier (y: 3080 to FINISH_Y) ---
    const ALLEY_L = 305;
    const ALLEY_R = 395;
    const ALLEY_TOP = 3200;

    // 1. Funnel Convergence Walls
    ramps.push({ x1: 20, y1: 3080, x2: ALLEY_L, y2: ALLEY_TOP });
    ramps.push({ x1: TRACK_WIDTH - 20, y1: 3080, x2: ALLEY_R, y2: ALLEY_TOP });

    // 2. Narrow Alley Walls
    ramps.push({ x1: ALLEY_L, y1: ALLEY_TOP, x2: ALLEY_L, y2: FINISH_Y + 50 });
    ramps.push({ x1: ALLEY_R, y1: ALLEY_TOP, x2: ALLEY_R, y2: FINISH_Y + 50 });

    // 3. Rotating Gate Barrier Bar on Alley Entrance (시계 반대방향 360도 회전)
    spinners.push({
      x: ALLEY_L,
      y: ALLEY_TOP - 5,
      length: 78,
      angle: 0,
      speed: -0.046,
      anchorType: 'edge',
      color: theme === 'cosmic' ? '#a855f7' : theme === 'pinball' ? '#ec4899' : theme === 'glacier' ? '#06b6d4' : '#f59e0b'
    });

    if (theme === 'cosmic') {
      // ==========================================
      // 🌌 MAP 1: 우주 블랙홀 & 웜홀 맵 (COSMIC)
      // ==========================================
      // Stellar constellation peg field
      for (let r = 0; r < 7; r++) {
        const y = 380 + r * 75;
        const isOdd = r % 2 === 1;
        const cols = isOdd ? 8 : 9;
        const spacing = TRACK_WIDTH / cols;
        for (let c = 1; c < cols; c++) {
          const x = c * spacing + (isOdd ? spacing / 2 : 0);
          if (x > 60 && x < TRACK_WIDTH - 60) {
            pegs.push({ x, y, radius: 7 });
          }
        }
      }

      // Gravitational curved ramps
      ramps.push({ x1: 20, y1: 1050, x2: 450, y2: 1200 });
      ramps.push({ x1: TRACK_WIDTH - 20, y1: 1350, x2: 250, y2: 1500 });
      ramps.push({ x1: 20, y1: 1650, x2: 450, y2: 1800 });

      // Gravity Node Bumpers
      bumpers.push({ x: 550, y: 1150, radius: 36, pulse: 0 });
      bumpers.push({ x: 150, y: 1450, radius: 36, pulse: 0 });
      bumpers.push({ x: 550, y: 1750, radius: 36, pulse: 0 });
      bumpers.push({ x: 350, y: 2650, radius: 42, pulse: 0 });

      // Galaxy Spinners
      spinners.push({ x: 350, y: 1350, length: 135, angle: 0, speed: 0.04, color: '#a855f7' });
      spinners.push({ x: 200, y: 2050, length: 115, angle: Math.PI / 4, speed: -0.045, color: '#06b6d4' });
      spinners.push({ x: 500, y: 2050, length: 115, angle: -Math.PI / 4, speed: 0.045, color: '#06b6d4' });
      spinners.push({ x: 350, y: 2450, length: 140, angle: 0, speed: 0.035, color: '#a855f7' });

      // 🌀 3 Active Cosmic Wormholes (Black Hole In -> White Hole Out Upward / Cross Warps)
      // WH1: In at y:1550 -> Out at y:650 (상단 대역류 워프!)
      wormholes.push({ id: 'wh1', inX: 95, inY: 1550, outX: 580, outY: 650, radius: 26, color: '#a855f7', pulse: 0 });
      // WH2: In at y:2300 -> Out at y:1150 (중상단 역류 워프!)
      wormholes.push({ id: 'wh2', inX: 605, inY: 2300, outX: 140, outY: 1150, radius: 26, color: '#06b6d4', pulse: 0 });
      // WH3: In at y:2920 -> Out at y:1850 (결승선 직전 상단 역류 워프!)
      wormholes.push({ id: 'wh3', inX: 120, inY: 2920, outX: 580, outY: 1850, radius: 26, color: '#ec4899', pulse: 0 });

      // Anti-Gravity Booster Pads
      speedPads.push({ x: 250, y: 900, width: 200, height: 32, boostY: 16 });
      speedPads.push({ x: 100, y: 1780, width: 160, height: 30, boostY: 15, boostX: 4 });
      speedPads.push({ x: 440, y: 1780, width: 160, height: 30, boostY: 15, boostX: -4 });
      speedPads.push({ x: 270, y: 2780, width: 160, height: 32, boostY: 18 });

      // Cosmic Satellite Pendulum
      pendulums.push({ anchorX: 350, anchorY: 1950, length: 140, bobRadius: 26, angle: -0.9, speed: 0.045, maxAngle: 1.1 });

    } else if (theme === 'pinball') {
      // ==========================================
      // ⚡ MAP 2: 네온 핀볼 & 메가 범퍼 맵 (PINBALL)
      // ==========================================
      // Dense Top Plinko Field
      for (let r = 0; r < 8; r++) {
        const y = 370 + r * 65;
        const isOdd = r % 2 === 1;
        const cols = isOdd ? 9 : 10;
        const spacing = TRACK_WIDTH / cols;
        for (let c = 1; c < cols; c++) {
          const x = c * spacing + (isOdd ? spacing / 2 : 0);
          if (x > 50 && x < TRACK_WIDTH - 50) {
            pegs.push({ x, y, radius: 7 });
          }
        }
      }

      // 9 Mega Bouncy Bumpers
      bumpers.push({ x: 350, y: 950, radius: 48, pulse: 0 });
      bumpers.push({ x: 170, y: 1250, radius: 40, pulse: 0 });
      bumpers.push({ x: 530, y: 1250, radius: 40, pulse: 0 });
      bumpers.push({ x: 350, y: 1550, radius: 52, pulse: 0 });
      bumpers.push({ x: 180, y: 1900, radius: 42, pulse: 0 });
      bumpers.push({ x: 520, y: 1900, radius: 42, pulse: 0 });
      bumpers.push({ x: 350, y: 2250, radius: 48, pulse: 0 });
      bumpers.push({ x: 160, y: 2700, radius: 36, pulse: 0 });
      bumpers.push({ x: 540, y: 2700, radius: 36, pulse: 0 });

      // Fast Cyber Flipper Spinners
      spinners.push({ x: 180, y: 1400, length: 115, angle: 0, speed: 0.065, color: '#ec4899' });
      spinners.push({ x: 520, y: 1400, length: 115, angle: Math.PI, speed: -0.065, color: '#ec4899' });
      spinners.push({ x: 220, y: 2050, length: 120, angle: Math.PI / 4, speed: -0.06, color: '#facc15' });
      spinners.push({ x: 480, y: 2050, length: 120, angle: -Math.PI / 4, speed: 0.06, color: '#facc15' });

      // High-angle pinball deflector ramps
      ramps.push({ x1: 20, y1: 1100, x2: 150, y2: 1180 });
      ramps.push({ x1: TRACK_WIDTH - 20, y1: 1100, x2: TRACK_WIDTH - 150, y2: 1180 });
      ramps.push({ x1: 20, y1: 1750, x2: 150, y2: 1830 });
      ramps.push({ x1: TRACK_WIDTH - 20, y1: 1750, x2: TRACK_WIDTH - 150, y2: 1830 });
      ramps.push({ x1: 0, y1: 2400, x2: 460, y2: 2550 });
      ramps.push({ x1: TRACK_WIDTH, y1: 2600, x2: 240, y2: 2750 });

      // Dense Bottom Peg Cluster
      for (let r = 0; r < 5; r++) {
        const y = 2850 + r * 45;
        const isOdd = r % 2 === 1;
        const cols = isOdd ? 8 : 9;
        const spacing = TRACK_WIDTH / cols;
        for (let c = 1; c < cols; c++) {
          const x = c * spacing + (isOdd ? spacing / 2 : 0);
          if (x > 80 && x < TRACK_WIDTH - 80) {
            pegs.push({ x, y, radius: 7 });
          }
        }
      }

      // Turbo Speed Boosters
      speedPads.push({ x: 260, y: 1050, width: 180, height: 30, boostY: 17 });
      speedPads.push({ x: 100, y: 1650, width: 160, height: 30, boostY: 16, boostX: 5 });
      speedPads.push({ x: 440, y: 1650, width: 160, height: 30, boostY: 16, boostX: -5 });
      speedPads.push({ x: 260, y: 2350, width: 180, height: 30, boostY: 18 });

      // Pinball Bonus Warp Loop
      wormholes.push({ id: 'wh_pb', inX: 80, inY: 2580, outX: 520, outY: 1700, radius: 25, color: '#ec4899', pulse: 0 });

    } else if (theme === 'glacier') {
      // ==========================================
      // ❄️ MAP 3: 빙하 협곡 & 스윙 해머추 맵 (GLACIER)
      // ==========================================
      // Icicle cluster pegs
      for (let r = 0; r < 5; r++) {
        const y = 380 + r * 70;
        const isOdd = r % 2 === 1;
        const cols = isOdd ? 7 : 8;
        const spacing = TRACK_WIDTH / cols;
        for (let c = 1; c < cols; c++) {
          const x = c * spacing + (isOdd ? spacing / 2 : 0);
          if (x > 80 && x < TRACK_WIDTH - 80) {
            pegs.push({ x, y, radius: 8 });
          }
        }
      }

      // 3 Giant Ice Swinging Hammers (Pendulums)
      pendulums.push({ anchorX: 350, anchorY: 1050, length: 160, bobRadius: 32, angle: -1.1, speed: 0.048, maxAngle: 1.25 });
      pendulums.push({ anchorX: 350, anchorY: 1750, length: 175, bobRadius: 34, angle: 1.0, speed: -0.052, maxAngle: 1.3 });
      pendulums.push({ anchorX: 350, anchorY: 2550, length: 165, bobRadius: 32, angle: -0.9, speed: 0.05, maxAngle: 1.2 });

      // Steep Ice Slides (Ramps)
      ramps.push({ x1: 20, y1: 850, x2: 480, y2: 1000 });
      ramps.push({ x1: TRACK_WIDTH - 20, y1: 1250, x2: 220, y2: 1400 });
      ramps.push({ x1: 20, y1: 1550, x2: 480, y2: 1700 });
      ramps.push({ x1: TRACK_WIDTH - 20, y1: 1950, x2: 220, y2: 2100 });
      ramps.push({ x1: 20, y1: 2350, x2: 480, y2: 2500 });
      ramps.push({ x1: TRACK_WIDTH - 20, y1: 2750, x2: 220, y2: 2900 });

      // Frozen Ice Bumpers at turnarounds
      bumpers.push({ x: 560, y: 950, radius: 32, pulse: 0 });
      bumpers.push({ x: 140, y: 1350, radius: 32, pulse: 0 });
      bumpers.push({ x: 560, y: 1650, radius: 32, pulse: 0 });
      bumpers.push({ x: 140, y: 2050, radius: 32, pulse: 0 });
      bumpers.push({ x: 560, y: 2450, radius: 32, pulse: 0 });

      // Ice Propeller Spinners
      spinners.push({ x: 230, y: 1480, length: 110, angle: 0, speed: 0.04, color: '#38bdf8' });
      spinners.push({ x: 470, y: 2180, length: 110, angle: Math.PI / 2, speed: -0.04, color: '#38bdf8' });

      // Frost Slide Boosters
      speedPads.push({ x: 250, y: 780, width: 200, height: 30, boostY: 17 });
      speedPads.push({ x: 120, y: 2150, width: 160, height: 30, boostY: 16, boostX: 5 });
      speedPads.push({ x: 260, y: 2950, width: 180, height: 32, boostY: 18 });

      // Glacier Crevasse Warp
      wormholes.push({ id: 'wh_gl', inX: 90, inY: 2400, outX: 560, outY: 1550, radius: 25, color: '#38bdf8', pulse: 0 });

      // 🧊 Strategic Ice Crystal Traps (닿으면 꽁꽁 얼어붙어 1.5초간 멈추는 얼음 오브젝트)
      iceTraps.push({ id: 'ice_1', x: 260, y: 720, radius: 28, pulse: 0, frozenDuration: 90 });
      iceTraps.push({ id: 'ice_2', x: 420, y: 1120, radius: 28, pulse: 0, frozenDuration: 90 });
      iceTraps.push({ id: 'ice_3', x: 180, y: 1470, radius: 26, pulse: 0, frozenDuration: 85 });
      iceTraps.push({ id: 'ice_4', x: 350, y: 1850, radius: 30, pulse: 0, frozenDuration: 95 });
      iceTraps.push({ id: 'ice_5', x: 160, y: 2240, radius: 28, pulse: 0, frozenDuration: 90 });
      iceTraps.push({ id: 'ice_6', x: 450, y: 2600, radius: 28, pulse: 0, frozenDuration: 90 });
      iceTraps.push({ id: 'ice_7', x: 280, y: 2980, radius: 28, pulse: 0, frozenDuration: 95 });

      // Generate Ambient Snowflakes for Glacier theme
      const flakes: Snowflake[] = [];
      for (let i = 0; i < 90; i++) {
        flakes.push({
          x: Math.random() * TRACK_WIDTH,
          y: Math.random() * TRACK_HEIGHT,
          vx: (Math.random() - 0.5) * 2 - 1.2,
          vy: Math.random() * 2.5 + 1.5,
          size: Math.random() * 3 + 1.5,
          alpha: Math.random() * 0.7 + 0.3
        });
      }
      snowflakesRef.current = flakes;

    } else if (theme === 'factory') {
      // ==========================================
      // ⚙️ MAP 4: 메카닉 팩토리 & 수평 컨베이어 벨트 맵 (FACTORY)
      // ==========================================
      // Top Plinko Pins (y: 360 ~ 580)
      for (let r = 0; r < 4; r++) {
        const y = 370 + r * 60;
        const isOdd = r % 2 === 1;
        const cols = isOdd ? 8 : 9;
        const spacing = TRACK_WIDTH / cols;
        for (let c = 1; c < cols; c++) {
          const x = c * spacing + (isOdd ? spacing / 2 : 0);
          if (x > 50 && x < TRACK_WIDTH - 50) {
            pegs.push({ x, y, radius: 6 });
          }
        }
      }

      // ── CONVEYOR 1: Assembly Line 01 (우측 진행 수평 컨베이어) at y: 680 ──
      // Spans x: 30 ~ 540 (우측 x: 540 ~ 680 사이로 구슬이 낙하)
      conveyors.push({ x: 30, y: 680, width: 510, height: 32, speed: 7.5, label: "🏭 LINE 01 >>>" });
      // 우측 벽면 유도 경사로
      ramps.push({ x1: TRACK_WIDTH - 20, y1: 760, x2: 520, y2: 880 });

      // ── CONVEYOR 2: Cargo Belt 02 (좌측 진행 수평 컨베이어) at y: 1040 ──
      // Spans x: 160 ~ 670 (좌측 x: 20 ~ 160 사이로 구슬이 낙하)
      conveyors.push({ x: 160, y: 1040, width: 510, height: 32, speed: -7.5, label: "<<< CARGO 02 🏭" });
      // 좌측 벽면 유도 경사로
      ramps.push({ x1: 20, y1: 1120, x2: 180, y2: 1240 });

      // Industrial Gear Spinners (Pair 1 - Dual interlocking gear at y: 1350)
      spinners.push({ x: 250, y: 1350, length: 125, angle: 0, speed: 0.045, color: '#f59e0b' });
      spinners.push({ x: 450, y: 1350, length: 125, angle: Math.PI / 2, speed: -0.045, color: '#f59e0b' });

      // ── CONVEYORS 3 & 4: Dual Center-Converging Conveyors (중앙 합류 컨베이어) at y: 1560 ──
      // 좌측 벨트는 우측으로, 우측 벨트는 좌측으로 중앙(x: 300~400)으로 구슬을 모음
      conveyors.push({ x: 20, y: 1560, width: 280, height: 32, speed: 7.0, label: "FEEDER A >>>" });
      conveyors.push({ x: 400, y: 1560, width: 280, height: 32, speed: -7.0, label: "<<< FEEDER B" });

      // Industrial Wrecking Ball Pendulum (중앙 낙하 지점 거대 햄머추) at y: 1720
      pendulums.push({ anchorX: 350, anchorY: 1640, length: 140, bobRadius: 32, angle: -0.9, speed: 0.05, maxAngle: 1.15 });

      // Triple gear row at y: 1880
      spinners.push({ x: 170, y: 1880, length: 105, angle: 0, speed: 0.042, color: '#eab308' });
      spinners.push({ x: 350, y: 1880, length: 125, angle: Math.PI / 3, speed: -0.048, color: '#f97316' });
      spinners.push({ x: 530, y: 1880, length: 105, angle: 0, speed: 0.042, color: '#eab308' });

      // ── CONVEYOR 5: High-Speed Turbo Conveyor (초고속 우측 컨베이어) at y: 2080 ──
      conveyors.push({ x: 30, y: 2080, width: 520, height: 32, speed: 8.5, label: "⚡ TURBO EXPRESS 05 >>>" });

      // ── CONVEYOR 6: Return Loop Conveyor (좌측 회송 컨베이어) at y: 2360 ──
      conveyors.push({ x: 150, y: 2360, width: 520, height: 32, speed: -8.5, label: "<<< RETURN LOOP 06 ⚡" });

      // Factory Ventilation Shaft Warp (환기구 역류 워프: y: 2480 -> y: 1200)
      wormholes.push({ id: 'wh_fc', inX: 95, inY: 2480, outX: 580, outY: 1200, radius: 26, color: '#f59e0b', pulse: 0 });

      // Heavy Industrial Rotor at y: 2620
      spinners.push({ x: 350, y: 2620, length: 160, angle: 0, speed: 0.038, color: '#ef4444' });

      // ── CONVEYORS 7 & 8: Pre-Finale Sorter Conveyors (결승선 진입 전 지그재그 분류 컨베이어) ──
      conveyors.push({ x: 30, y: 2780, width: 440, height: 32, speed: 8.0, label: "SORTING A >>>" });
      conveyors.push({ x: 230, y: 2940, width: 440, height: 32, speed: -8.0, label: "<<< SORTING B" });

      // Hydraulic Piston Bumpers for extra dynamic rebound
      bumpers.push({ x: 600, y: 730, radius: 34, pulse: 0 });
      bumpers.push({ x: 100, y: 1090, radius: 34, pulse: 0 });
      bumpers.push({ x: 600, y: 2130, radius: 34, pulse: 0 });
      bumpers.push({ x: 100, y: 2410, radius: 34, pulse: 0 });
    }

    pegsRef.current = pegs;
    bumpersRef.current = bumpers;
    rampsRef.current = ramps;
    spinnersRef.current = spinners;
    speedPadsRef.current = speedPads;
    wormholesRef.current = wormholes;
    pendulumsRef.current = pendulums;
    conveyorsRef.current = conveyors;
    iceTrapsRef.current = iceTraps;
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
        trail: [],
        frozenTimer: 0,
        freezeCooldown: 0
      });
    });

    marblesRef.current = list;
    winnersListRef.current = [];
    cameraYRef.current = 0;
    frameCountRef.current = 0;
    lastLeaderboardKeyRef.current = '';
    setWinners([]);
  };

  // Initialize on mount or when students / initialMapTheme change
  useEffect(() => {
    const targetTheme = initialMapTheme || mapTheme;
    setMapTheme(targetTheme);
    initTrack(targetTheme);
    initMarbles();
  }, [students, initialMapTheme]);

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
          cameraYRef.current = 0;
          frameCountRef.current = 0;
          lastLeaderboardKeyRef.current = '';
          setBombAlert(null);
          setOvertakeAlert(null);
          setEliminated([]);
          // Reset Glacier blizzard schedule
          blizzardActiveRef.current = false;
          blizzardDurationRef.current = 0;
          nextBlizzardTimeRef.current = Date.now() + 6500;
          setBlizzardAlert(null);
          setFreezeAlert(null);
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
    initTrack(mapTheme);
    initMarbles();
    shockwavesRef.current = [];
    particlesRef.current = [];
    screenShakeRef.current = 0;
    leaderIdRef.current = null;
    slowMoTimerRef.current = 0;
    slowMoCooldownRef.current = 0;
    zoomRef.current = 1.0;
    cameraYRef.current = 0;
    frameCountRef.current = 0;
    lastLeaderboardKeyRef.current = '';
    setBombAlert(null);
    setOvertakeAlert(null);
    setEliminated([]);
    blizzardActiveRef.current = false;
    blizzardDurationRef.current = 0;
    nextBlizzardTimeRef.current = Date.now() + 6500;
    setBlizzardAlert(null);
    setFreezeAlert(null);
    setRaceState('ready');
    setWinners([]);
    winnersListRef.current = [];
    setFinishCountdown(30);
  };

  // Manual / Auto Finish Handler
  const handleConfirmFinish = () => {
    // Strictly sort winners by rank (1등 -> 2등 -> 3등...)
    const sorted = [...winners].sort((a, b) => a.rank - b.rank).map(w => w.name);
    onRaceFinished(sorted.slice(0, numWinners));
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

  // Physics Simulation & Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gravity = mapTheme === 'cosmic' ? 0.21 : (mapTheme === 'glacier' ? 0.24 : 0.23);
    const friction = mapTheme === 'glacier' ? 0.992 : (mapTheme === 'cosmic' ? 0.987 : 0.985);
    const wallElasticity = mapTheme === 'pinball' ? 0.85 : 0.7;
    const isSimulating = raceState === 'racing' || raceState === 'completed';

    const pushParticle = (pt: ExplosionParticle) => {
      if (particlesRef.current.length < 100) {
        particlesRef.current.push(pt);
      }
    };

    const loop = () => {
      frameCountRef.current++;
      const now = Date.now();

      // 0. Slow-mo timer & timeScale (scaled by user speedMultiplier)
      if (slowMoTimerRef.current > 0) {
        slowMoTimerRef.current--;
      }
      if (slowMoCooldownRef.current > 0) {
        slowMoCooldownRef.current--;
      }
      const baseTimeScale = slowMoTimerRef.current > 0 ? 0.3 : 1.0;
      const timeScale = baseTimeScale * speedMultiplierRef.current;

      const marbles = marblesRef.current;
      const pegs = pegsRef.current;
      const bumpers = bumpersRef.current;
      const ramps = rampsRef.current;
      const spinners = spinnersRef.current;
      const speedPads = speedPadsRef.current;
      const wormholes = wormholesRef.current;
      const pendulums = pendulumsRef.current;
      const conveyors = conveyorsRef.current;
      const iceTraps = iceTrapsRef.current;

      if (isSimulating) {
        // 1. Update Spinners
        for (let s = 0; s < spinners.length; s++) {
          spinners[s].angle += spinners[s].speed * timeScale;
        }

        // 1-1. Update Pendulums
        for (let p = 0; p < pendulums.length; p++) {
          const pd = pendulums[p];
          pd.angle += pd.speed * timeScale;
          if (pd.angle > pd.maxAngle || pd.angle < -pd.maxAngle) {
            pd.speed = -pd.speed;
          }
        }

        // 1-2. Update Wormholes pulse
        for (let w = 0; w < wormholes.length; w++) {
          if (wormholes[w].pulse > 0) wormholes[w].pulse = Math.max(0, wormholes[w].pulse - 0.05);
        }

        // 2. Update Bumpers pulse
        for (let b = 0; b < bumpers.length; b++) {
          if (bumpers[b].pulse > 0) bumpers[b].pulse = Math.max(0, bumpers[b].pulse - 0.08);
        }

        // 1-3. Update Ice Traps pulse decay
        for (let it = 0; it < iceTraps.length; it++) {
          if (iceTraps[it].pulse > 0) iceTraps[it].pulse = Math.max(0, iceTraps[it].pulse - 0.04);
        }

        // 1-4. Update Snowflakes & Glacier Blizzard Cycle
        if (mapTheme === 'glacier') {
          if (raceState === 'racing') {
            if (!blizzardActiveRef.current && now > nextBlizzardTimeRef.current) {
              blizzardActiveRef.current = true;
              blizzardDurationRef.current = 240; // ~4 seconds of intense blizzard
              soundEngine.playBlizzardHowl();
              setBlizzardAlert('❄️ 거센 눈보라 강타! 볼 낙하 속도 급감소! 🌨️');
            } else if (blizzardActiveRef.current) {
              blizzardDurationRef.current--;
              if (blizzardDurationRef.current <= 0) {
                blizzardActiveRef.current = false;
                setBlizzardAlert(null);
                nextBlizzardTimeRef.current = now + (9000 + Math.random() * 5000);
              }
            }
          }

          const isBlizzard = blizzardActiveRef.current;
          const sfs = snowflakesRef.current;
          for (let i = 0; i < sfs.length; i++) {
            const sf = sfs[i];
            if (isBlizzard) {
              sf.x += sf.vx * 3.5 - 7;
              sf.y += sf.vy * 1.4;
            } else {
              sf.x += sf.vx;
              sf.y += sf.vy;
            }
            if (sf.x < 0) sf.x = TRACK_WIDTH;
            else if (sf.x > TRACK_WIDTH) sf.x = 0;
            if (sf.y > TRACK_HEIGHT) sf.y = 0;
          }
        }

        // 2-1. Random Marble Explosion Trigger
        if (bombMode && raceState === 'racing') {
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

        // 2-3. Update Explosion Particles (in-place compaction)
        let writeIdx = 0;
        const pts = particlesRef.current;
        for (let p = 0; p < pts.length; p++) {
          const pt = pts[p];
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.vx *= 0.95;
          pt.vy *= 0.95;
          pt.life--;
          pt.alpha = pt.life / 40;
          if (pt.life > 0) {
            pts[writeIdx++] = pt;
          }
        }
        pts.length = writeIdx;

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

          // Decay freeze cooldown
          if (m.freezeCooldown && m.freezeCooldown > 0) {
            m.freezeCooldown--;
          }

          // Frozen Marble Handling (얼음 오브젝트에 얼어붙은 상태: 완전 정지 및 카운트다운)
          if (m.frozenTimer && m.frozenTimer > 0) {
            m.frozenTimer--;
            m.vx = 0;
            m.vy = 0;

            // Sparkling frost crystals while frozen
            if (Math.random() < 0.14) {
              pushParticle({
                x: m.x + (Math.random() - 0.5) * m.radius * 2,
                y: m.y + (Math.random() - 0.5) * m.radius * 2,
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5,
                size: Math.random() * 2.5 + 1,
                color: '#38bdf8',
                alpha: 0.9,
                life: 16
              });
            }

            if (m.frozenTimer === 0) {
              // Shatter ice when thaw timer hits 0!
              soundEngine.playIceShatter();
              m.freezeCooldown = 80; // brief immunity so ball rolls off trap
              m.vy = 2.5; // slight downward drop nudge
              for (let k = 0; k < 10; k++) {
                pushParticle({
                  x: m.x,
                  y: m.y,
                  vx: (Math.random() - 0.5) * 8,
                  vy: (Math.random() - 0.5) * 8,
                  size: Math.random() * 4 + 2,
                  color: k % 2 === 0 ? '#38bdf8' : '#e0f2fe',
                  alpha: 1,
                  life: 22
                });
              }
            }
            continue; // Marble remains completely stopped while frozen!
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
              if (shockwavesRef.current.length < 8) {
                shockwavesRef.current.push({
                  x: m.x,
                  y: m.y,
                  radius: m.radius,
                  maxRadius: 220,
                  color: '#f97316',
                  alpha: 1
                });
              }

              // Spawn Fire/Spark particles
              for (let k = 0; k < 18; k++) {
                const angle = Math.random() * Math.PI * 2;
                const spd = 2 + Math.random() * 8;
                pushParticle({
                  x: m.x,
                  y: m.y,
                  vx: Math.cos(angle) * spd,
                  vy: Math.sin(angle) * spd,
                  size: 3 + Math.random() * 5,
                  color: Math.random() > 0.4 ? '#f97316' : (Math.random() > 0.5 ? '#eab308' : '#ffffff'),
                  alpha: 1,
                  life: 26 + Math.floor(Math.random() * 14)
                });
              }

              // Blast nearby marbles outward with high impulse!
              const blastRadius = 220;
              for (let j = 0; j < marbles.length; j++) {
                const other = marbles[j];
                if (other.finished || other === m) continue;
                const dx = other.x - m.x;
                const dy = other.y - m.y;
                if (Math.abs(dx) > blastRadius || Math.abs(dy) > blastRadius) continue;
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

              triggerBombAlert(`💥 ${m.name} 구슬 대폭발!!`, 1800);
            }
          }

          // Decay boost effect
          if (m.boostEffect && m.boostEffect > 0) {
            m.boostEffect--;
          }

          m.vy += gravity * timeScale;

          // Blizzard Storm Drag Effect (눈보라 몰아칠 때 볼 낙하 속도 급감소 및 저항)
          if (mapTheme === 'glacier' && blizzardActiveRef.current) {
            m.vy = Math.min(m.vy, 2.6);
            m.vy *= 0.85;
            m.vx += (Math.random() - 0.5) * 1.5 - 0.8;
          }

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

          // Collision with Pegs (with fast broad-phase check)
          for (let p = 0; p < pegs.length; p++) {
            const peg = pegs[p];
            const dy = m.y - peg.y;
            if (dy > 24 || dy < -24) continue;
            const dx = m.x - peg.x;
            if (dx > 24 || dx < -24) continue;
            const dist = Math.hypot(dx, dy);
            const minDist = m.radius + peg.radius;

            if (dist < minDist) {
              const nx = dx / (dist || 1);
              const ny = dy / (dist || 1);
              m.x = peg.x + nx * minDist;
              m.y = peg.y + ny * minDist;
              const dot = m.vx * nx + m.vy * ny;
              m.vx = (m.vx - 1.6 * dot * nx) + (Math.random() - 0.5) * 0.8;
              m.vy = (m.vy - 1.6 * dot * ny) + (Math.random() - 0.5) * 0.8;
              playBounceSound();
            }
          }

          // Collision with Bumpers (Extra Bouncy!)
          for (let b = 0; b < bumpers.length; b++) {
            const bmp = bumpers[b];
            const dy = m.y - bmp.y;
            const minDist = m.radius + bmp.radius;
            if (dy > minDist || dy < -minDist) continue;
            const dx = m.x - bmp.x;
            if (dx > minDist || dx < -minDist) continue;
            const dist = Math.hypot(dx, dy);

            if (dist < minDist) {
              const nx = dx / (dist || 1);
              const ny = dy / (dist || 1);
              m.x = bmp.x + nx * minDist;
              m.y = bmp.y + ny * minDist;
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
            const minY = Math.min(ramp.y1, ramp.y2) - 25;
            const maxY = Math.max(ramp.y1, ramp.y2) + 25;
            if (m.y < minY || m.y > maxY) continue;
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
              m.vx += (rdx / len) * 0.4;
              m.vy += (rdy / len) * 0.4;
            }
          }

          // Collision with Spinners & Rotating Barriers
          for (let s = 0; s < spinners.length; s++) {
            const sp = spinners[s];
            if (Math.abs(m.y - sp.y) > sp.length + 25) continue;
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
                m.x = Math.max(305 + m.radius + 2, Math.min(395 - m.radius - 2, m.x));
                m.y = Math.min(m.y, 3200 - m.radius - 6);
                m.vy = -Math.abs(m.vy) * 0.8 - 9;
                m.vx = (Math.random() - 0.5) * 6;
              } else {
                m.x = closestX + nx * (m.radius + 6);
                m.y = closestY + ny * (m.radius + 6);
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
              m.y >= pad.y && m.y <= pad.y + pad.height &&
              m.x >= pad.x && m.x <= pad.x + pad.width
            ) {
              m.vy = Math.max(m.vy + pad.boostY, pad.boostY * 1.15);
              if (pad.boostX) m.vx += pad.boostX;
              if (!m.boostEffect || m.boostEffect < 30) {
                soundEngine.playBoostPad();
              }
              m.boostEffect = 45;
            }
          }

          // --- Gimmick Collision 2: Cosmic Warp Wormholes ---
          for (let w = 0; w < wormholes.length; w++) {
            const wh = wormholes[w];
            if (Math.abs(m.y - wh.inY) > wh.radius + m.radius) continue;
            const dx = m.x - wh.inX;
            const dy = m.y - wh.inY;
            if (Math.hypot(dx, dy) < wh.radius + m.radius) {
              const isUpwardWarp = wh.outY < wh.inY;
              m.x = wh.outX + (Math.random() - 0.5) * 16;
              m.y = isUpwardWarp ? wh.outY - 10 : wh.outY + 25;
              m.vy = isUpwardWarp ? 3.5 : Math.max(m.vy, 9);
              m.vx = (Math.random() - 0.5) * 6;
              wh.pulse = 1;
              soundEngine.playWarpSound();
              
              for (let k = 0; k < 12; k++) {
                pushParticle({
                  x: wh.outX,
                  y: wh.outY,
                  vx: (Math.random() - 0.5) * 9,
                  vy: (Math.random() - 0.5) * 9,
                  size: 4,
                  color: wh.color,
                  alpha: 1,
                  life: 24
                });
              }

              if (isUpwardWarp && raceState === 'racing') {
                triggerBombAlert(`🌀 [${m.name}] 블랙홀에 빠져 상단으로 역류 워프!`, 1800);
              }
            }
          }

          // --- Gimmick Collision 3: Giant Swinging Pendulums ---
          for (let p = 0; p < pendulums.length; p++) {
            const pd = pendulums[p];
            if (Math.abs(m.y - pd.anchorY) > pd.length + pd.bobRadius + m.radius + 20) continue;
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

          // --- Gimmick Collision 4: Solid Horizontal Conveyor Belts ---
          for (let c = 0; c < conveyors.length; c++) {
            const cb = conveyors[c];
            if (m.y < cb.y - m.radius - 10 || m.y > cb.y + cb.height + m.radius + 10) continue;
            const halfH = cb.height / 2;

            // 1. Top Surface: Marble lands on and rides the conveyor belt!
            if (
              m.x >= cb.x - m.radius * 0.4 &&
              m.x <= cb.x + cb.width + m.radius * 0.4 &&
              m.y + m.radius >= cb.y &&
              m.y - m.radius < cb.y + halfH
            ) {
              m.y = cb.y - m.radius;
              if (m.vy > 0) {
                m.vy = -m.vy * 0.15;
              }
              m.vx = m.vx * 0.7 + cb.speed * 1.35;

              // Spawn conveyor track friction sparks (throttled)
              if (Math.random() < 0.14) {
                pushParticle({
                  x: m.x,
                  y: m.y + m.radius,
                  vx: -cb.speed * 0.35 + (Math.random() - 0.5) * 2,
                  vy: -Math.random() * 2.5 - 0.5,
                  size: Math.random() * 2.5 + 1.5,
                  color: '#f59e0b',
                  alpha: 0.85,
                  life: 12
                });
              }
            }
            // 2. Bottom Surface: Marble bounces off underneath the conveyor
            else if (
              m.x >= cb.x - m.radius * 0.4 &&
              m.x <= cb.x + cb.width + m.radius * 0.4 &&
              m.y - m.radius <= cb.y + cb.height &&
              m.y + m.radius > cb.y + halfH
            ) {
              m.y = cb.y + cb.height + m.radius;
              m.vy = Math.abs(m.vy) * 0.6 + 2;
              playBounceSound();
            }
            // 3. Left Pulley End Cap Collision (Rounded bumper)
            else if (
              Math.hypot(m.x - cb.x, m.y - (cb.y + halfH)) < m.radius + halfH
            ) {
              const dx = m.x - cb.x;
              const dy = m.y - (cb.y + halfH);
              const dist = Math.hypot(dx, dy) || 1;
              const minDist = m.radius + halfH;
              m.x = cb.x + (dx / dist) * minDist;
              m.y = (cb.y + halfH) + (dy / dist) * minDist;
              m.vx = (dx / dist) * 6;
              m.vy = (dy / dist) * 6;
              playBounceSound();
            }
            // 4. Right Pulley End Cap Collision (Rounded bumper)
            else if (
              Math.hypot(m.x - (cb.x + cb.width), m.y - (cb.y + halfH)) < m.radius + halfH
            ) {
              const dx = m.x - (cb.x + cb.width);
              const dy = m.y - (cb.y + halfH);
              const dist = Math.hypot(dx, dy) || 1;
              const minDist = m.radius + halfH;
              m.x = (cb.x + cb.width) + (dx / dist) * minDist;
              m.y = (cb.y + halfH) + (dy / dist) * minDist;
              m.vx = (dx / dist) * 6;
              m.vy = (dy / dist) * 6;
              playBounceSound();
            }
          }

          // --- Gimmick Collision 5: Ice Crystal Traps (빙하 협곡 얼음 오브젝트 - 닿으면 결빙 정지) ---
          for (let it = 0; it < iceTraps.length; it++) {
            const trap = iceTraps[it];
            const dy = m.y - trap.y;
            const minDist = m.radius + trap.radius;
            if (dy > minDist || dy < -minDist) continue;
            const dx = m.x - trap.x;
            if (dx > minDist || dx < -minDist) continue;
            const dist = Math.hypot(dx, dy);

            if (dist < minDist) {
              if ((!m.frozenTimer || m.frozenTimer <= 0) && (!m.freezeCooldown || m.freezeCooldown <= 0)) {
                m.frozenTimer = trap.frozenDuration;
                m.vx = 0;
                m.vy = 0;
                trap.pulse = 1;
                soundEngine.playFreeze();
                triggerFreezeAlert(`🧊 [${m.name}] 얼음 오브젝트에 닿아 꽁꽁 얼어붙었습니다! (1.5초 정지)`, 1800);

                for (let k = 0; k < 8; k++) {
                  pushParticle({
                    x: m.x,
                    y: m.y,
                    vx: (Math.random() - 0.5) * 6,
                    vy: (Math.random() - 0.5) * 6,
                    size: Math.random() * 3 + 2,
                    color: '#38bdf8',
                    alpha: 1,
                    life: 20
                  });
                }
                break;
              } else if (!m.frozenTimer || m.frozenTimer <= 0) {
                const nx = dx / (dist || 1);
                const ny = dy / (dist || 1);
                m.x = trap.x + nx * minDist;
                m.y = trap.y + ny * minDist;
                m.vx = nx * 5;
                m.vy = ny * 5;
                playBounceSound();
              }
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

            if (winRule === 'first') {
              if (winnersListRef.current.length < numWinners) {
                const rank = winnersListRef.current.length + 1;
                m.finishRank = rank;
                winnersListRef.current.push(m.name);

                soundEngine.playWin('marble');
                confetti({
                  particleCount: 70,
                  spread: 65,
                  origin: { y: 0.7 },
                  colors: [m.color, '#fbbf24', '#ffffff']
                });

                setWinners(prev => [...prev, { rank, name: m.name, color: m.color }]);
                onWinnerDetermined(m.name, rank);

                if (winnersListRef.current.length >= numWinners) {
                  setRaceState('completed');
                  setFinishCountdown(30);
                }
              } else {
                m.finishRank = 0;
              }
            } else {
              const totalCount = marbles.length;
              const eliminationTarget = Math.max(0, totalCount - numWinners);
              const currentFinishedCount = marbles.filter(marble => marble.finished).length;

              if (currentFinishedCount <= eliminationTarget) {
                m.finishRank = 0;
                setEliminated(prev => [...prev, m.name]);
                soundEngine.playMarbleBounce(0.35);
                triggerBombAlert(`❌ [${m.name}] 골인... 탈락! (남은 생존: ${totalCount - currentFinishedCount}명)`, 1400);
              } else {
                const winnerSlot = currentFinishedCount - eliminationTarget;
                const rank = (numWinners - winnerSlot + 1);
                m.finishRank = rank;
                winnersListRef.current.push(m.name);

                soundEngine.playWin('marble');
                confetti({
                  particleCount: 80,
                  spread: 70,
                  origin: { y: 0.65 },
                  colors: [m.color, '#10b981', '#fbbf24', '#ffffff']
                });

                setWinners(prev => [...prev, { rank, name: m.name, color: m.color }]);
                onWinnerDetermined(m.name, rank);

                if (winnersListRef.current.length >= numWinners) {
                  setRaceState('completed');
                  setFinishCountdown(30);
                }
              }
            }
          }
        }

        // --- Early Survival Auto-Win for Last Remaining Marble in Survival Mode ---
        if (winRule === 'last' && raceState === 'racing') {
          const remainingMarbles = marbles.filter(m => !m.finished);
          if (remainingMarbles.length === 1) {
            const lastMarble = remainingMarbles[0];
            lastMarble.finished = true;
            lastMarble.finishRank = 1;
            winnersListRef.current.push(lastMarble.name);

            soundEngine.playWin('marble');
            confetti({
              particleCount: 120,
              spread: 85,
              origin: { y: 0.6 },
              colors: [lastMarble.color, '#10b981', '#fbbf24', '#ffffff', '#ec4899']
            });

            setWinners(prev => {
              const next = [...prev.filter(w => w.name !== lastMarble.name), { rank: 1, name: lastMarble.name, color: lastMarble.color }];
              return next.sort((a, b) => a.rank - b.rank);
            });
            onWinnerDetermined(lastMarble.name, 1);

            triggerBombAlert(`👑 최후의 1인 생존 확정! [${lastMarble.name}] 대망의 1등 당첨! 🎉`, 3000);

            setRaceState('completed');
            setFinishCountdown(30);
          }
        }

        // 4. Marble-to-Marble Collisions (with fast bounding-box pre-check)
        for (let i = 0; i < marbles.length; i++) {
          const m1 = marbles[i];
          for (let j = i + 1; j < marbles.length; j++) {
            const m2 = marbles[j];
            const dy = m2.y - m1.y;
            const minDist = m1.radius + m2.radius;
            if (dy > minDist || dy < -minDist) continue;
            const dx = m2.x - m1.x;
            if (dx > minDist || dx < -minDist) continue;
            const dist = Math.hypot(dx, dy);

            if (dist < minDist && dist > 0.001) {
              const nx = dx / dist;
              const ny = dy / dist;
              const overlap = (minDist - dist) / 2;

              m1.x -= nx * overlap;
              m1.y -= ny * overlap;
              m2.x += nx * overlap;
              m2.y += ny * overlap;

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

        // 5. Throttled Leaderboard Update (every 15 frames and only if ranking order changed)
        if (frameCountRef.current % 15 === 0) {
          const sorted = [...marbles]
            .sort((a, b) => {
              if (winRule === 'first') {
                if (a.finished && !b.finished) return -1;
                if (!a.finished && b.finished) return 1;
                if (a.finished && b.finished) return a.finishRank - b.finishRank;
                return b.y - a.y;
              } else {
                if (!a.finished && b.finished) return -1;
                if (a.finished && !b.finished) return 1;
                if (!a.finished && !b.finished) return a.y - b.y;
                return a.finishRank - b.finishRank;
              }
            })
            .slice(0, 5)
            .map((m, idx) => ({ name: m.name, y: Math.round(m.y), rank: idx + 1 }));

          const nextKey = sorted.map(s => s.name).join('|');
          if (nextKey !== lastLeaderboardKeyRef.current) {
            lastLeaderboardKeyRef.current = nextKey;
            setLeaderboard(sorted);
          }
        }
      }

      // 5-1. Overtake Detection & Slow-mo Trigger
      let currentLead: Marble | null = null;
      for (let i = 0; i < marbles.length; i++) {
        const m = marbles[i];
        if (m.finished) continue;
        if (!currentLead) {
          currentLead = m;
        } else if (winRule === 'first' ? m.y > currentLead.y : m.y < currentLead.y) {
          currentLead = m;
        }
      }

      if (isSimulating && currentLead) {
        if (raceState === 'racing' && currentLead.y > 250 && currentLead.y < FINISH_Y) {
          if (leaderIdRef.current && leaderIdRef.current !== currentLead.id) {
            if (slowMoCooldownRef.current <= 0) {
              slowMoTimerRef.current = 65; // ~1.1s slow motion
              slowMoCooldownRef.current = 190; // ~3.2s cooldown
              soundEngine.playSlowMoWhoosh();
              triggerOvertakeAlert({ name: currentLead.name, color: currentLead.color }, 1800);
            }
          }
          leaderIdRef.current = currentLead.id;
        }
      }

      // 6. Smooth Camera Tracking with Dynamic Zoom
      const targetZoom = slowMoTimerRef.current > 0 ? 1.6 : 1.0;
      zoomRef.current += (targetZoom - zoomRef.current) * 0.08;
      const currentZoom = zoomRef.current;

      let targetCameraY = isSimulating ? FINISH_Y - 300 : 0;
      let leadX = TRACK_WIDTH / 2;
      if (isSimulating && currentLead) {
        targetCameraY = currentLead.y - 250;
        leadX = currentLead.x;
      }
      targetCameraY = Math.max(0, Math.min(TRACK_HEIGHT - 650, targetCameraY));
      cameraYRef.current += (targetCameraY - cameraYRef.current) * (isSimulating ? 0.08 : 0.25);
      const cameraY = cameraYRef.current;

      // 7. RENDER TRACK ON CANVAS (with Viewport Frustum Culling)
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

      // Visible Vertical Frustum Bounds in World Space
      const viewTop = Math.max(0, cameraY - 200);
      const viewBottom = Math.min(TRACK_HEIGHT, cameraY + 850);

      // Track Background & Side Rails adapted to theme
      const bgColors = {
        cosmic: '#030712',
        pinball: '#09090b',
        glacier: '#082f49',
        factory: '#18181b'
      };
      ctx.fillStyle = bgColors[mapTheme] || '#0f172a';
      ctx.fillRect(0, viewTop, TRACK_WIDTH, viewBottom - viewTop);

      // Theme-specific Background Visuals (Culled to Viewport)
      if (mapTheme === 'cosmic') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.beginPath();
        for (let i = 0; i < 70; i++) {
          const sy = (i * 55 + ((now * 0.03) % 55)) % TRACK_HEIGHT;
          if (sy < viewTop || sy > viewBottom) continue;
          const sx = (Math.sin(i * 123.45) * 0.5 + 0.5) * (TRACK_WIDTH - 60) + 30;
          const sr = (i % 4 === 0) ? 2.2 : (i % 2 === 0 ? 1.5 : 1);
          ctx.moveTo(sx + sr, sy);
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        }
        ctx.fill();
      } else if (mapTheme === 'pinball') {
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.14)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const startY = Math.floor(viewTop / 60) * 60;
        for (let y = startY; y <= viewBottom; y += 60) {
          ctx.moveTo(20, y);
          ctx.lineTo(TRACK_WIDTH - 20, y);
        }
        for (let x = 60; x < TRACK_WIDTH - 20; x += 80) {
          ctx.moveTo(x, viewTop);
          ctx.lineTo(x, viewBottom);
        }
        ctx.stroke();
      } else if (mapTheme === 'glacier') {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
        const startY = Math.floor(viewTop / 120) * 120;
        for (let y = startY; y <= viewBottom; y += 120) {
          ctx.fillRect(20, y, TRACK_WIDTH - 40, 45);
        }
      } else if (mapTheme === 'factory') {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const startY = Math.floor(viewTop / 80) * 80;
        for (let y = startY; y <= viewBottom; y += 80) {
          ctx.moveTo(20, y);
          ctx.lineTo(TRACK_WIDTH - 20, y);
        }
        ctx.stroke();
      }

      // Neon Side Rails with Theme Glow
      const railColors = {
        cosmic: '#8b5cf6',
        pinball: '#ec4899',
        glacier: '#38bdf8',
        factory: '#f97316'
      };
      const railGlowColors = {
        cosmic: 'rgba(139, 92, 246, 0.35)',
        pinball: 'rgba(236, 72, 153, 0.35)',
        glacier: 'rgba(56, 189, 248, 0.35)',
        factory: 'rgba(249, 115, 22, 0.35)'
      };

      ctx.strokeStyle = railColors[mapTheme] || '#334155';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(20, viewTop);
      ctx.lineTo(20, viewBottom);
      ctx.moveTo(TRACK_WIDTH - 20, viewTop);
      ctx.lineTo(TRACK_WIDTH - 20, viewBottom);
      ctx.stroke();

      ctx.strokeStyle = railGlowColors[mapTheme] || 'rgba(51, 65, 85, 0.3)';
      ctx.lineWidth = 16;
      ctx.stroke();

      // Top Start Chamber Gate
      if (viewTop < 100) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(20, 50, TRACK_WIDTH - 40, 20);
        ctx.fillStyle = primaryColor;
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`START CHAMBER [${MAP_THEMES.find(t => t.id === mapTheme)?.name || 'TRACK'}]`, TRACK_WIDTH / 2, 40);
      }

      // Draw Ramps (Culled)
      for (let i = 0; i < ramps.length; i++) {
        const ramp = ramps[i];
        if (Math.max(ramp.y1, ramp.y2) < viewTop || Math.min(ramp.y1, ramp.y2) > viewBottom) continue;
        const isBottleneckWall = ramp.y1 >= 3100 || ramp.y2 >= 3100;
        ctx.strokeStyle = isBottleneckWall ? '#f59e0b' : '#6366f1';
        ctx.lineWidth = isBottleneckWall ? 10 : 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ramp.x1, ramp.y1);
        ctx.lineTo(ramp.x2, ramp.y2);
        ctx.stroke();

        ctx.strokeStyle = isBottleneckWall ? 'rgba(245, 158, 11, 0.4)' : 'rgba(99, 102, 241, 0.3)';
        ctx.lineWidth = isBottleneckWall ? 20 : 16;
        ctx.stroke();
      }

      // Draw Pegs (Batched & Culled)
      ctx.beginPath();
      for (let i = 0; i < pegs.length; i++) {
        const peg = pegs[i];
        if (peg.y < viewTop || peg.y > viewBottom) continue;
        ctx.moveTo(peg.x + peg.radius, peg.y);
        ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
      }
      ctx.fillStyle = '#94a3b8';
      ctx.fill();
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw Bumpers (Culled)
      for (let i = 0; i < bumpers.length; i++) {
        const b = bumpers[i];
        if (b.y + b.radius < viewTop || b.y - b.radius > viewBottom) continue;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius + (b.pulse * 8), 0, Math.PI * 2);
        ctx.fillStyle = b.pulse > 0 ? '#ef4444' : '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      // Draw Spinners & Rotating Barriers (Culled)
      for (let i = 0; i < spinners.length; i++) {
        const sp = spinners[i];
        if (sp.y + sp.length < viewTop || sp.y - sp.length > viewBottom) continue;
        ctx.save();
        ctx.translate(sp.x, sp.y);
        ctx.rotate(sp.angle);

        if (sp.anchorType === 'edge') {
          ctx.fillStyle = sp.color || '#f59e0b';
          ctx.fillRect(0, -6, sp.length, 12);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.strokeRect(0, -6, sp.length, 12);

          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          for (let s = 10; s < sp.length - 10; s += 16) {
            ctx.moveTo(s, -6);
            ctx.lineTo(s + 8, -6);
            ctx.lineTo(s + 4, 6);
            ctx.lineTo(s - 4, 6);
          }
          ctx.fill();

          const tipPulse = Math.sin(now * 0.015) > 0;
          ctx.beginPath();
          ctx.arc(sp.length - 4, 0, 6, 0, Math.PI * 2);
          ctx.fillStyle = tipPulse ? '#ef4444' : '#fbbf24';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.fillStyle = '#475569';
          ctx.fill();
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        } else {
          ctx.fillStyle = sp.color || '#06b6d4';
          ctx.fillRect(-sp.length / 2, -6, sp.length, 12);
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
        ctx.restore();
      }

      // Draw Speed Boost Pads (Culled)
      for (let i = 0; i < speedPads.length; i++) {
        const pad = speedPads[i];
        if (pad.y + pad.height < viewTop || pad.y > viewBottom) continue;
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
      }

      // Draw Wormholes (Culled)
      const rot = (now * 0.003) % (Math.PI * 2);
      for (let i = 0; i < wormholes.length; i++) {
        const wh = wormholes[i];
        const inVisible = wh.inY + wh.radius >= viewTop && wh.inY - wh.radius <= viewBottom;
        const outVisible = wh.outY + wh.radius >= viewTop && wh.outY - wh.radius <= viewBottom;
        if (!inVisible && !outVisible) continue;

        ctx.save();
        if (inVisible) {
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
        }

        if (outVisible) {
          ctx.beginPath();
          ctx.arc(wh.outX, wh.outY, wh.radius * 0.8, 0, Math.PI * 2);
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = '#eab308';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('WARP OUT', wh.outX, wh.outY - wh.radius - 4);
        }
        ctx.restore();
      }

      // Draw Giant Pendulums (Culled)
      for (let i = 0; i < pendulums.length; i++) {
        const pd = pendulums[i];
        if (pd.anchorY + pd.length + pd.bobRadius < viewTop || pd.anchorY - 20 > viewBottom) continue;
        ctx.save();
        const bobX = pd.anchorX + Math.sin(pd.angle) * pd.length;
        const bobY = pd.anchorY + Math.cos(pd.angle) * pd.length;

        ctx.beginPath();
        ctx.arc(pd.anchorX, pd.anchorY, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#64748b';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(pd.anchorX, pd.anchorY);
        ctx.lineTo(bobX, bobY);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(bobX, bobY, pd.bobRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#e11d48';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(bobX, bobY, pd.bobRadius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
      }

      // Draw Horizontal Conveyor Belts (Culled & Clip-free for high FPS)
      for (let i = 0; i < conveyors.length; i++) {
        const cb = conveyors[i];
        if (cb.y + cb.height + 10 < viewTop || cb.y - 10 > viewBottom) continue;
        ctx.save();
        const radius = cb.height / 2;
        const isRight = cb.speed > 0;

        // 1. Industrial Drop Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.roundRect(cb.x - 2, cb.y + 4, cb.width + 4, cb.height, radius);
        ctx.fill();

        // 2. Heavy Steel Outer Housing Chassis
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(cb.x, cb.y, cb.width, cb.height, radius);
        ctx.fill();
        ctx.stroke();

        // 3. Moving Industrial Tread Surface
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.roundRect(cb.x + 3, cb.y + 3, cb.width - 6, cb.height - 10, 6);
        ctx.fill();

        // 4. Yellow/Black Hazard Caution Stripes on Lower Frame (bounded without clip())
        const stripeWidth = 14;
        const innerLeft = cb.x + radius;
        const innerRight = cb.x + cb.width - radius;
        for (let sx = innerLeft; sx < innerRight; sx += stripeWidth * 2) {
          const w1 = Math.min(stripeWidth, innerRight - sx);
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(sx, cb.y + cb.height - 8, w1, 6);
          const sx2 = sx + stripeWidth;
          if (sx2 < innerRight) {
            const w2 = Math.min(stripeWidth, innerRight - sx2);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(sx2, cb.y + cb.height - 8, w2, 6);
          }
        }

        // 5. Animated Conveyor Chevron Arrows / Treads (bounded without clip())
        const arrowSpacing = 28;
        const animOffset = ((now * 0.06 * speedMultiplierRef.current * (isRight ? 1 : -1)) % arrowSpacing + arrowSpacing) % arrowSpacing;

        ctx.strokeStyle = isRight ? '#f59e0b' : '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        for (let ax = innerLeft + animOffset; ax < innerRight - 4; ax += arrowSpacing) {
          if (isRight) {
            ctx.moveTo(ax - 5, cb.y + 6);
            ctx.lineTo(ax + 3, cb.y + (cb.height - 10) / 2);
            ctx.lineTo(ax - 5, cb.y + cb.height - 11);
          } else {
            ctx.moveTo(ax + 5, cb.y + 6);
            ctx.lineTo(ax - 3, cb.y + (cb.height - 10) / 2);
            ctx.lineTo(ax + 5, cb.y + cb.height - 11);
          }
        }
        ctx.stroke();

        // 6. Rotating End Pulley Gears (Left & Right)
        const rotAngle = now * 0.008 * speedMultiplierRef.current * (isRight ? 1 : -1);
        const pulleyPositions = [cb.x + radius, cb.x + cb.width - radius];
        for (let p = 0; p < 2; p++) {
          const px = pulleyPositions[p];
          ctx.save();
          ctx.translate(px, cb.y + radius);
          ctx.rotate(rotAngle);
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.arc(0, 0, radius - 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-radius + 5, 0);
          ctx.lineTo(radius - 5, 0);
          ctx.moveTo(0, -radius + 5);
          ctx.lineTo(0, radius - 5);
          ctx.stroke();

          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(0, 0, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 7. Conveyor Title Tag in Center (Fast pill background instead of shadowBlur)
        if (cb.label) {
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const cx = cb.x + cb.width / 2;
          const cy = cb.y + (cb.height - 8) / 2;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
          ctx.fillRect(cx - 56, cy - 6, 112, 12);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(cb.label, cx, cy);
        }

        ctx.restore();
      }

      // Draw Ice Crystal Traps (Culled)
      for (let idx = 0; idx < iceTraps.length; idx++) {
        const trap = iceTraps[idx];
        if (trap.y + trap.radius * 2 < viewTop || trap.y - trap.radius * 2 > viewBottom) continue;
        ctx.save();
        const r = trap.radius + (trap.pulse * 6);

        // Ambient Ice Frost Glow
        ctx.fillStyle = trap.pulse > 0 ? 'rgba(56, 189, 248, 0.35)' : 'rgba(56, 189, 248, 0.18)';
        ctx.beginPath();
        ctx.arc(trap.x, trap.y, r * 1.45, 0, Math.PI * 2);
        ctx.fill();

        // Faceted Hexagonal Ice Crystal
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const px = trap.x + r * Math.cos(angle);
          const py = trap.y + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();

        ctx.fillStyle = trap.pulse > 0 ? '#7dd3fc' : '#0ea5e9';
        ctx.fill();

        ctx.strokeStyle = trap.pulse > 0 ? '#ffffff' : '#bae6fd';
        ctx.lineWidth = trap.pulse > 0 ? 4 : 2.5;
        ctx.stroke();

        // Internal crystal facet lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i += 2) {
          const angle = (i * Math.PI) / 3;
          ctx.moveTo(trap.x, trap.y);
          ctx.lineTo(trap.x + r * Math.cos(angle), trap.y + r * Math.sin(angle));
        }
        ctx.stroke();

        ctx.font = '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🧊', trap.x, trap.y);

        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = '#7dd3fc';
        ctx.fillText('ICE TRAP', trap.x, trap.y + r + 11);

        ctx.restore();
      }

      // Draw Finish Line (Narrow Alley Goal & Checkered Pattern - Culled)
      if (viewBottom >= 3090) {
        ctx.save();
        const sqSize = 15;
        for (let x = 305; x < 395; x += sqSize) {
          for (let y = FINISH_Y; y < FINISH_Y + 30; y += sqSize) {
            const isWhite = ((Math.floor(x / sqSize)) + (Math.floor(y / sqSize))) % 2 === 0;
            ctx.fillStyle = isWhite ? '#ffffff' : '#0f172a';
            ctx.fillRect(x, y, sqSize, sqSize);
          }
        }
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.strokeRect(305, FINISH_Y, 90, 30);

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'black 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🏁 GOAL 🏁', TRACK_WIDTH / 2, FINISH_Y - 8);

        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('⚠️ DANGER: FINAL ROTATING GATE BARRIER ⚠️', TRACK_WIDTH / 2, 3105);
        ctx.restore();
      }

      // Draw Snowflakes & Blizzard Storm Visuals (Glacier theme - Batched & Culled)
      if (mapTheme === 'glacier') {
        const isBlizzard = blizzardActiveRef.current;
        const sfs = snowflakesRef.current;
        ctx.save();
        ctx.fillStyle = isBlizzard ? '#ffffff' : 'rgba(224, 242, 254, 0.8)';
        ctx.beginPath();
        for (let i = 0; i < sfs.length; i++) {
          const sf = sfs[i];
          if (sf.y < viewTop || sf.y > viewBottom) continue;
          const r = isBlizzard ? sf.size * 1.3 : sf.size;
          ctx.moveTo(sf.x + r, sf.y);
          ctx.arc(sf.x, sf.y, r, 0, Math.PI * 2);
        }
        ctx.fill();

        // Blizzard Wind Streaks across current camera view
        if (isBlizzard) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          for (let w = 0; w < 18; w++) {
            const wx = ((now * 1.8 + w * 130) % (TRACK_WIDTH + 300)) - 100;
            const wy = (cameraY + (w * 40) % 650);
            ctx.moveTo(wx, wy);
            ctx.lineTo(wx - 75, wy + 20);
          }
          ctx.stroke();

          ctx.fillStyle = 'rgba(186, 230, 253, 0.14)';
          ctx.fillRect(0, cameraY, TRACK_WIDTH, 650);
        }
        ctx.restore();
      }

      // Draw Shockwaves
      const sws = shockwavesRef.current;
      for (let i = 0; i < sws.length; i++) {
        const sw = sws[i];
        if (sw.y + sw.radius < viewTop || sw.y - sw.radius > viewBottom) continue;
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
      }

      // Draw Explosion Fire Particles (Culled)
      const pts = particlesRef.current;
      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        if (pt.y < viewTop || pt.y > viewBottom) continue;
        ctx.save();
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, pt.alpha));
        ctx.fill();
        ctx.restore();
      }

      // Draw Marbles (Culled to Viewport)
      for (let i = 0; i < marbles.length; i++) {
        const m = marbles[i];
        if (m.y + 45 < viewTop || m.y - 60 > viewBottom) continue;

        // Rocket Turbo Boost Flame Effect (Zero-overhead layered circles instead of ctx.filter blur)
        if (m.boostEffect && m.boostEffect > 0) {
          const flameR = (m.boostEffect / 60) * 16;
          ctx.beginPath();
          ctx.arc(m.x, m.y + m.radius + 6, flameR * 1.35, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(249, 115, 22, 0.35)';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(m.x, m.y + m.radius + 5, flameR * 0.8, 0, Math.PI * 2);
          ctx.fillStyle = '#facc15';
          ctx.fill();
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
          const flash = Math.sin(now * 0.03) > 0;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius + 8, 0, Math.PI * 2);
          ctx.strokeStyle = flash ? '#ef4444' : '#fbbf24';
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.fillStyle = flash ? 'rgba(239, 68, 68, 0.35)' : 'rgba(251, 191, 36, 0.2)';
          ctx.fill();
        }

        // Marble Sphere (3D glass look)
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fillStyle = m.color;
        ctx.fill();
        ctx.strokeStyle = m.isBomb ? '#ef4444' : '#ffffff';
        ctx.lineWidth = m.isBomb ? 2.5 : 1.5;
        ctx.stroke();

        // Specular highlight dot (replaces per-marble createRadialGradient allocation)
        ctx.beginPath();
        ctx.arc(m.x - m.radius * 0.32, m.y - m.radius * 0.32, m.radius * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.fill();

        // Frozen Ice Crystal Encasement (얼어붙은 구슬 얼음 결정체 연출)
        if (m.frozenTimer && m.frozenTimer > 0) {
          ctx.save();
          const iceBoxSize = m.radius * 2.5;

          ctx.beginPath();
          ctx.roundRect(m.x - iceBoxSize / 2, m.y - iceBoxSize / 2, iceBoxSize, iceBoxSize, 6);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
          ctx.strokeStyle = '#e0f2fe';
          ctx.lineWidth = 3;
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(m.x - iceBoxSize / 2 + 3, m.y - iceBoxSize / 2 + 3);
          ctx.lineTo(m.x - iceBoxSize / 2 + 10, m.y - iceBoxSize / 2 + 3);
          ctx.lineTo(m.x - iceBoxSize / 2 + 3, m.y - iceBoxSize / 2 + 10);
          ctx.fill();

          const crackStage = Math.floor((1 - m.frozenTimer / 90) * 3);
          if (crackStage >= 1) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(m.x - 6, m.y - 8);
            ctx.lineTo(m.x + 2, m.y);
            ctx.lineTo(m.x - 2, m.y + 7);
            ctx.stroke();
          }
          if (crackStage >= 2) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(m.x + 7, m.y - 5);
            ctx.lineTo(m.x, m.y + 3);
            ctx.lineTo(m.x + 5, m.y + 9);
            ctx.stroke();
          }

          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('❄️', m.x, m.y - iceBoxSize / 2 - 8);

          ctx.font = 'bold 9px sans-serif';
          ctx.fillStyle = '#7dd3fc';
          ctx.fillText(`${(m.frozenTimer / 60).toFixed(1)}s`, m.x, m.y + iceBoxSize / 2 + 11);

          ctx.restore();
        }

        // 1st Place Golden Crown on Current Leader
        const isCurrent1st = currentLead && currentLead.id === m.id && !m.finished && raceState === 'racing';
        if (isCurrent1st) {
          const ringPulse = Math.sin(now * 0.01) * 3;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius + 6 + ringPulse, 0, Math.PI * 2);
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('👑', m.x, m.y - m.radius - (m.isBomb ? 38 : 22));
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
          if (m.finishRank > 0) {
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.radius * 0.9, 0, Math.PI * 2);
            ctx.fillStyle = '#fbbf24';
            ctx.fill();
            ctx.fillStyle = '#0f172a';
            ctx.font = 'black 12px sans-serif';
            ctx.fillText(`${m.finishRank}`, m.x, m.y + 4);
          } else {
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.radius * 0.9, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
            ctx.fill();
            ctx.fillStyle = '#ef4444';
            ctx.font = 'black 9px sans-serif';
            ctx.fillText('OUT', m.x, m.y + 3);
          }
        }
      }

      ctx.restore();

      // --- Cinematic Slow-Mo Letterbox & Speed Lines Overlay ---
      if (slowMoTimerRef.current > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, 32);
        ctx.fillRect(0, canvas.height - 32, canvas.width, 32);

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 32);
        ctx.lineTo(canvas.width, 32);
        ctx.moveTo(0, canvas.height - 32);
        ctx.lineTo(canvas.width, canvas.height - 32);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let l = 0; l < 12; l++) {
          const sx = (l / 12) * canvas.width;
          ctx.moveTo(sx, 32);
          ctx.lineTo(sx + (Math.random() - 0.5) * 30, 60);
          ctx.moveTo(sx, canvas.height - 32);
          ctx.lineTo(sx + (Math.random() - 0.5) * 30, canvas.height - 60);
        }
        ctx.stroke();

        ctx.fillStyle = '#fde047';
        ctx.font = 'black 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ SLOW MOTION OVERTAKE ⚡', canvas.width / 2, 21);
        ctx.restore();
      }

      if (isSimulating) {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [raceState, numWinners, primaryColor, bombMode, mapTheme, winRule, students]);

  return (
    <div className="w-full max-w-4xl flex flex-col items-center select-none relative">
      {/* Map Theme & Speed Selector Bar */}
      <div className="w-full bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-800/90 flex flex-wrap items-center justify-between gap-2.5 mb-3 shadow-xl z-20">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-300 mr-1">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>맵:</span>
          </div>
          {MAP_THEMES.map(theme => (
            <button
              key={theme.id}
              onClick={() => {
                if (raceState === 'ready') {
                  setMapTheme(theme.id);
                  initTrack(theme.id);
                  initMarbles();
                }
              }}
              disabled={raceState !== 'ready'}
              className={cn(
                "px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all border shadow-sm",
                mapTheme === theme.id
                  ? theme.activeClasses
                  : "bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200",
                raceState !== 'ready' && "opacity-50 cursor-not-allowed"
              )}
              title={theme.desc}
            >
              <span>{theme.icon}</span>
              <span>{theme.name}</span>
            </button>
          ))}
        </div>

        {/* Real-time Speed Multiplier Control (배속 조절) */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-black text-slate-300 mr-0.5">배속</span>
          {[0.5, 1, 1.5, 2, 3].map(spd => (
            <button
              key={spd}
              type="button"
              onClick={() => {
                setSpeedMultiplier(spd);
                speedMultiplierRef.current = spd;
              }}
              className={cn(
                "px-2 py-1 rounded-lg text-[11px] font-black transition-all",
                speedMultiplier === spd
                  ? "bg-amber-400 text-slate-950 shadow-md scale-105"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
              title={`구슬 레이스 ${spd}배속 설정`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Race Top HUD */}
      <div className="w-full bg-slate-900/90 backdrop-blur-md p-4 rounded-3xl border border-slate-800 flex items-center justify-between gap-4 mb-4 shadow-2xl z-20">
        {/* Left Title & Description (Fixed layout, no jitter) */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={cn(
            "p-3 rounded-2xl border transition-colors flex-shrink-0",
            winRule === 'last' 
              ? "bg-purple-500/20 text-purple-400 border-purple-500/30" 
              : "bg-amber-500/20 text-amber-400 border-amber-500/30"
          )}>
            {winRule === 'last' ? <Hourglass className="w-6 h-6 animate-pulse" /> : <Trophy className="w-6 h-6" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-white flex items-center gap-2 truncate">
              구슬 레이스 추첨
              <span className={cn(
                "text-xs px-2.5 py-0.5 rounded-full border font-bold flex-shrink-0",
                winRule === 'last'
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                  : "bg-amber-500/20 text-amber-300 border-amber-500/30"
              )}>
                {winRule === 'last' ? "🐢 꼴찌 서바이벌" : "🏆 1등 선착순"}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold flex-shrink-0">
                목표 {numWinners}명
              </span>
            </h3>
            <p className="text-xs text-slate-400 truncate h-5 flex items-center">
              {winRule === 'last' 
                ? "먼저 들어오면 탈락! 끝까지 버텨 가장 늦게 들어온 최후의 구슬이 1등!" 
                : "결승선에 가장 먼저 도착한 구슬이 당첨됩니다!"}
            </p>
          </div>
        </div>

        {/* Action Buttons (Fixed sizes, no jittering) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Win Rule Toggle (선착순 vs 꼴찌 서바이벌) - Fixed width 148px */}
          <button
            onClick={() => {
              if (raceState === 'ready') {
                setWinRule(prev => prev === 'first' ? 'last' : 'first');
              }
            }}
            disabled={raceState !== 'ready'}
            className={cn(
              "w-[148px] h-[40px] px-2 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all border shadow-sm flex-shrink-0",
              winRule === 'last'
                ? "bg-purple-500/25 text-purple-300 border-purple-500/40 hover:bg-purple-500/35"
                : "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30",
              raceState !== 'ready' && "opacity-60 cursor-not-allowed"
            )}
            title="클릭하여 당첨 방식을 선착순(1등) 또는 서바이벌(꼴찌 당첨)으로 변경합니다."
          >
            {winRule === 'last' ? (
              <>
                <Hourglass className="w-3.5 h-3.5 text-purple-400 animate-spin flex-shrink-0" />
                <span>🐢 꼴찌 서바이벌</span>
              </>
            ) : (
              <>
                <Trophy className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>🏆 1등 선착순</span>
              </>
            )}
          </button>

          {/* Bomb Mode Toggle Button - Fixed width 108px */}
          <button
            onClick={() => setBombMode(prev => !prev)}
            className={cn(
              "w-[108px] h-[40px] px-2 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all border shadow-sm flex-shrink-0",
              bombMode 
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30" 
                : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200"
            )}
            title="레이스 도중 구슬들이 무작위로 폭발하며 충격파를 뿜어내는 모드입니다."
          >
            <Bomb className={cn("w-3.5 h-3.5 flex-shrink-0", bombMode ? "text-rose-400 animate-pulse" : "text-slate-400")} />
            <span>폭발 {bombMode ? "ON" : "OFF"}</span>
          </button>

          {raceState === 'ready' && (
            <button
              onClick={startCountdown}
              style={{ backgroundColor: primaryColor }}
              className="h-[40px] px-5 py-2 rounded-xl font-black text-slate-950 text-xs sm:text-sm shadow-xl flex items-center justify-center gap-1.5 hover:scale-105 active:scale-95 transition-all flex-shrink-0"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>출발!</span>
            </button>
          )}

          {(raceState === 'racing' || raceState === 'completed') && (
            <button
              onClick={resetRace}
              className="h-[40px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-slate-700 flex-shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>다시 하기</span>
            </button>
          )}

          {raceState === 'completed' && (
            <button
              onClick={handleConfirmFinish}
              className="h-[40px] px-4 py-2 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md animate-pulse flex-shrink-0"
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

        {/* Blizzard Alert Floating Notification (Glacier Theme) */}
        {blizzardAlert && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-cyan-600/90 backdrop-blur-md text-white px-5 py-2 rounded-2xl shadow-[0_0_35px_rgba(6,182,212,0.75)] font-black text-sm flex items-center gap-2 z-50 animate-pulse border border-cyan-300">
            <Snowflake className="w-4 h-4 text-cyan-200 animate-spin" />
            <span>{blizzardAlert}</span>
          </div>
        )}

        {/* Ice Freeze Alert Floating Notification */}
        {freezeAlert && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-blue-900/95 backdrop-blur-md text-cyan-100 px-5 py-2 rounded-2xl shadow-xl font-black text-xs sm:text-sm flex items-center gap-2 z-50 animate-in zoom-in-95 border border-cyan-400">
            <span className="text-base animate-bounce">🧊</span>
            <span>{freezeAlert}</span>
          </div>
        )}

        {/* Overtake Slow-Mo Alert Banner */}
        {overtakeAlert && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 text-slate-950 px-6 py-2.5 rounded-2xl shadow-[0_0_35px_rgba(251,191,36,0.9)] font-black text-sm sm:text-base flex items-center gap-2.5 z-50 animate-in zoom-in-95 border-2 border-white">
            <Sparkles className="w-5 h-5 text-slate-950 fill-current animate-spin" />
            <span>
              {winRule === 'last' 
                ? `🔥 최후의 생존 1위 역전! [${overtakeAlert.name}] 최후미 수성!` 
                : `🔥 1위 역전! [${overtakeAlert.name}] 선두 탈환!`}
            </span>
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
        <div className="absolute top-4 right-4 bg-slate-900/85 backdrop-blur-md p-4 rounded-2xl border border-amber-500/30 shadow-2xl z-30 min-w-[200px] max-w-[230px]">
          <p className="text-xs font-black uppercase text-amber-400 tracking-wider mb-2 flex items-center gap-1.5">
            {winRule === 'last' ? <Hourglass className="w-3.5 h-3.5 text-purple-400" /> : <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
            <span>{winRule === 'last' ? `생존 당첨 (${winners.length}/${numWinners})` : `골인 당첨 (${winners.length}/${numWinners})`}</span>
          </p>
          {winRule === 'last' && (
            <p className="text-[10px] text-slate-400 font-bold mb-2 flex items-center justify-between">
              <span>❌ 탈락: <strong className="text-rose-400">{eliminated.length}명</strong></span>
              <span>🛡️ 생존: <strong className="text-emerald-400">{students.length - eliminated.length}명</strong></span>
            </p>
          )}
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {winners.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                {winRule === 'last' ? "탈락 구슬 제외 후 최종 생존 구슬이 표시됩니다." : "아직 골인한 구슬이 없습니다."}
              </p>
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
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-md",
                    winRule === 'last' ? "text-purple-300 bg-purple-500/20" : "text-emerald-400 bg-emerald-500/20"
                  )}>
                    {winRule === 'last' ? "생존!" : "골인!"}
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
                {winRule === 'last' ? <Hourglass className="w-8 h-8 text-purple-400 animate-spin" /> : <Trophy className="w-8 h-8" />}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mb-1">
                {winRule === 'last' ? "🐢 최후의 생존자 당첨 완료!" : "🎉 최종 당첨 구슬 골인 완료!"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mb-4">
                {winRule === 'last' 
                  ? "먼저 들어온 공들은 모두 탈락하고, 끝까지 버텨 살아남은 최후의 당첨 명단입니다!" 
                  : `선발된 ${winners.length}명의 당첨 학생 명단입니다.`}
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
