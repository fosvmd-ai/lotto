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
  
  const marblesRef = useRef<Marble[]>([]);
  const pegsRef = useRef<Peg[]>([]);
  const bumpersRef = useRef<Bumper[]>([]);
  const rampsRef = useRef<Ramp[]>([]);
  const spinnersRef = useRef<Spinner[]>([]);
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

    // --- Section 5: Funnel leading into Finish Line (y: 3180 to FINISH_Y) ---
    ramps.push({ x1: 0, y1: 3200, x2: 150, y2: 3320 });
    ramps.push({ x1: TRACK_WIDTH, y1: 3200, x2: TRACK_WIDTH - 150, y2: 3320 });

    pegsRef.current = pegs;
    bumpersRef.current = bumpers;
    rampsRef.current = ramps;
    spinnersRef.current = spinners;
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
          // Reset bomb schedule
          nextBombTimeRef.current = Date.now() + 2500;
          shockwavesRef.current = [];
          particlesRef.current = [];
          screenShakeRef.current = 0;
          setBombAlert(null);
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
    setBombAlert(null);
    setRaceState('ready');
    setWinners([]);
    winnersListRef.current = [];
  };

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
      // 1. Update Spinners
      spinnersRef.current.forEach(sp => {
        sp.angle += sp.speed;
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

        m.vy += gravity;
        m.vx *= friction;
        m.vy *= friction;

        m.x += m.vx;
        m.y += m.vy;

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

        // Collision with Spinners
        for (let s = 0; s < spinners.length; s++) {
          const sp = spinners[s];
          const cos = Math.cos(sp.angle);
          const sin = Math.sin(sp.angle);
          const x1 = sp.x - cos * (sp.length / 2);
          const y1 = sp.y - sin * (sp.length / 2);
          const x2 = sp.x + cos * (sp.length / 2);
          const y2 = sp.y + sin * (sp.length / 2);

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
            m.x = closestX + nx * (m.radius + 6);
            m.y = closestY + ny * (m.radius + 6);
            // Spinner tangential velocity push
            const tangentSpeed = sp.speed * sp.length;
            m.vx = nx * 5 - sin * tangentSpeed;
            m.vy = ny * 5 + cos * tangentSpeed;
            playBounceSound();
          }
        }

        // Check Finish Line
        if (m.y >= FINISH_Y && !m.finished) {
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
            setTimeout(() => {
              onRaceFinished(winnersListRef.current.slice(0, numWinners));
            }, 3000);
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

      // 6. Smooth Camera Tracking
      // Find the leading active marble (or average of leaders)
      const activeMarbles = marbles.filter(m => !m.finished);
      let targetCameraY = FINISH_Y - 300;
      if (activeMarbles.length > 0) {
        // Look at the first leader
        const lead = activeMarbles.reduce((prev, curr) => (curr.y > prev.y ? curr : prev), activeMarbles[0]);
        targetCameraY = lead.y - 250;
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
      ctx.translate(shakeX, -cameraY + shakeY);

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
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ramp.x1, ramp.y1);
        ctx.lineTo(ramp.x2, ramp.y2);
        ctx.stroke();

        // Neon glow
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
        ctx.lineWidth = 16;
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

      // Draw Spinners
      spinners.forEach(sp => {
        ctx.save();
        ctx.translate(sp.x, sp.y);
        ctx.rotate(sp.angle);
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(-sp.length / 2, -6, sp.length, 12);
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
      });

      // Draw Finish Line
      ctx.save();
      // Checkered Pattern
      const sqSize = 16;
      for (let x = 20; x < TRACK_WIDTH - 20; x += sqSize) {
        for (let y = FINISH_Y; y < FINISH_Y + 32; y += sqSize) {
          const isWhite = ((x / sqSize) + (y / sqSize)) % 2 === 0;
          ctx.fillStyle = isWhite ? '#ffffff' : '#000000';
          ctx.fillRect(x, y, sqSize, sqSize);
        }
      }
      // Finish Banner
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'black 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🏁 FINISH LINE 🏁', TRACK_WIDTH / 2, FINISH_Y - 12);
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

        // Bomb indicator emoji above name
        if (m.isBomb) {
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('💣', m.x, m.y - m.radius - 22);
        }

        // Student Name Tag above Marble
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = m.isBomb ? 'rgba(220, 38, 38, 0.95)' : 'rgba(15, 23, 42, 0.85)';
        const textWidth = ctx.measureText(m.name).width;
        ctx.fillRect(m.x - textWidth / 2 - 4, m.y - m.radius - 18, textWidth + 8, 14);

        ctx.fillStyle = '#ffffff';
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

        {/* Race Completed Banner */}
        {raceState === 'completed' && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 px-8 py-3 rounded-2xl shadow-2xl font-black text-lg flex items-center gap-3 z-40 animate-bounce border-2 border-white">
            <Trophy className="w-6 h-6" />
            모든 당첨 구슬 골인 완료! 잠시 후 결과를 확정합니다.
          </div>
        )}
      </div>
    </div>
  );
}
