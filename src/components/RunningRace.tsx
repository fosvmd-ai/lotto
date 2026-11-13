import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Flag, Play, RotateCcw, Volume2, VolumeX, Trophy, Sparkles, Zap } from 'lucide-react';
import soundEngine from '../soundEngine';

interface Student {
  id: string;
  name: string;
}

interface RunningRaceProps {
  students: Student[];
  numWinners: number;
  primaryColor?: string;
  initialSpeed?: number;
  onWinnerDetermined: (winnerName: string, rank: number) => void;
  onRaceFinished: (finalWinners: string[]) => void;
}

type RaceMode = 'first' | 'last';
type RaceLength = 'normal' | 'long';
type RacePhase = 'ready' | 'countdown' | 'racing' | 'finished';

interface Runner {
  id: string;
  name: string;
  lane: number;
  x: number;
  vx: number;
  baseSpeed: number;
  phase: number;
  color: string;
  hairColor: string;
  gimmick: 'none' | 'spurt' | 'stumble';
  gimmickTimer: number;
  bubbleText: string;
  bubbleTimer: number;
  finished: boolean;
  finishOrder: number; // 1-based overall finish order
  winRank: number; // 0 if not a winner, 1..numWinners if winner
  trail: { x: number; alpha: number }[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

const JERSEY_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6',
  '#e11d48', '#84cc16'
];

const HAIR_COLORS = ['#1e293b', '#451a03', '#78350f', '#312e81', '#0f172a'];

const SPURT_TEXTS = ['스퍼트!', '가즈아!', '부스터!', '초고속!', '비켜비켜!'];
const STUMBLE_TEXTS = ['어? 이쪽?', '잠깐만!', '신발끈!', '꿀맛!', '꽈당!'];

const BUNTING_COLORS = ['#ef4444', '#facc15', '#3b82f6', '#22c55e', '#ec4899', '#f97316'];

export default function RunningRace({
  students,
  numWinners,
  initialSpeed = 1,
  onWinnerDetermined,
  onRaceFinished,
}: RunningRaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [raceMode, setRaceMode] = useState<RaceMode>('first');
  const [raceLength, setRaceLength] = useState<RaceLength>('normal');
  const [phase, setPhase] = useState<RacePhase>('ready');
  const [countdownText, setCountdownText] = useState<string>('');
  const [isMuted, setIsMuted] = useState(false);
  const [isSlowMo, setIsSlowMo] = useState(false);
  const [leaderName, setLeaderName] = useState<string>(students[0]?.name || '');
  const [commentary, setCommentary] = useState<string>('출발선에서 심판의 신호를 기다리고 있습니다!');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [winnersList, setWinnersList] = useState<string[]>([]);

  const speedRef = useRef<number>(initialSpeed);
  useEffect(() => {
    speedRef.current = initialSpeed;
  }, [initialSpeed]);

  const mutedRef = useRef<boolean>(false);
  useEffect(() => {
    mutedRef.current = isMuted;
  }, [isMuted]);

  const raceModeRef = useRef<RaceMode>(raceMode);
  raceModeRef.current = raceMode;

  const raceLengthRef = useRef<RaceLength>(raceLength);
  raceLengthRef.current = raceLength;

  const phaseRef = useRef<RacePhase>(phase);
  phaseRef.current = phase;

  const runnersRef = useRef<Runner[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const cameraRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const tapeBrokenRef = useRef<boolean>(false);
  const finishedCountRef = useRef<number>(0);
  const determinedWinnersRef = useRef<string[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastCommentaryTimeRef = useRef<number>(0);
  const finishTriggeredRef = useRef<boolean>(false);

  const START_X = 110;
  const getFinishX = useCallback(() => (raceLengthRef.current === 'long' ? 4200 : 2600), []);
  const LANE_HEIGHT = 46;
  const HEADER_HEIGHT = 110; // Sky + bleachers + bunting

  const initRunners = useCallback(() => {
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    runnersRef.current = shuffled.map((s, idx) => ({
      id: s.id,
      name: s.name,
      lane: idx,
      x: START_X,
      vx: 0,
      baseSpeed: 2.35 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
      color: JERSEY_COLORS[idx % JERSEY_COLORS.length],
      hairColor: HAIR_COLORS[idx % HAIR_COLORS.length],
      gimmick: 'none',
      gimmickTimer: 0,
      bubbleText: '',
      bubbleTimer: 0,
      finished: false,
      finishOrder: 0,
      winRank: 0,
      trail: [],
    }));
    particlesRef.current = [];
    cameraRef.current = { x: 0, y: 0 };
    tapeBrokenRef.current = false;
    finishedCountRef.current = 0;
    determinedWinnersRef.current = [];
    finishTriggeredRef.current = false;
    setWinnersList([]);
    setProgressPct(0);
    setIsSlowMo(false);
    setLeaderName(shuffled[0]?.name || '');
    setCommentary('출발선에서 심판의 신호를 기다리고 있습니다!');
  }, [students]);

  useEffect(() => {
    initRunners();
  }, [initRunners]);

  const spawnDust = (x: number, y: number, color = 'rgba(255,255,255,0.6)', count = 2) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x: x - 8 + (Math.random() - 0.5) * 8,
        y: y + 14 + (Math.random() - 0.5) * 6,
        vx: -Math.random() * 1.6 - 0.4,
        vy: -Math.random() * 0.8 - 0.2,
        size: 3 + Math.random() * 4,
        color,
        alpha: 0.85,
        life: 0,
        maxLife: 22 + Math.random() * 14,
      });
    }
  };

  const spawnGunSmoke = (x: number, y: number) => {
    for (let i = 0; i < 18; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const spd = 1.5 + Math.random() * 3.5;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 6 + Math.random() * 10,
        color: i % 3 === 0 ? '#fde047' : '#f1f5f9',
        alpha: 0.95,
        life: 0,
        maxLife: 35 + Math.random() * 20,
      });
    }
  };

  const startCountdown = async () => {
    if (phaseRef.current !== 'ready') return;
    await soundEngine.unlockAudio();
    initRunners();
    setPhase('countdown');
    phaseRef.current = 'countdown';

    const steps: { text: string; delay: number; sound?: 'whistle' | 'gun' }[] = [
      { text: '출발 준비', delay: 650 },
      { text: '제자리에', delay: 700, sound: 'whistle' },
      { text: '차려', delay: 650 },
      { text: '탕!', delay: 450, sound: 'gun' },
    ];

    for (const step of steps) {
      if (phaseRef.current !== 'countdown') return;
      setCountdownText(step.text);
      setCommentary(step.text === '탕!' ? '출발! 모두 힘차게 달려 나갑니다!' : `수달 심판: "${step.text}"`);
      if (!mutedRef.current) {
        if (step.sound === 'whistle') soundEngine.playWhistle();
        if (step.sound === 'gun') soundEngine.playStartingGun();
      }
      if (step.sound === 'gun') {
        spawnGunSmoke(START_X + 20, HEADER_HEIGHT + 24);
      }
      await new Promise(res => setTimeout(res, step.delay));
    }

    if (phaseRef.current !== 'countdown') return;
    setCountdownText('');
    setPhase('racing');
    phaseRef.current = 'racing';
  };

  const resetRace = () => {
    setPhase('ready');
    phaseRef.current = 'ready';
    setCountdownText('');
    initRunners();
  };

  // Main Canvas Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const drawPixelOtter = (x: number, y: number, isBang: boolean) => {
      ctx.save();
      ctx.translate(x, y);
      // Body
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.roundRect(-14, -6, 28, 30, 10);
      ctx.fill();
      // Belly
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.ellipse(0, 10, 9, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.arc(0, -14, 13, 0, Math.PI * 2);
      ctx.fill();
      // Red headband
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-13, -21, 26, 5);
      // Eyes & Nose
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-4, -14, 2, 0, Math.PI * 2);
      ctx.arc(4, -14, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.ellipse(0, -10, 3, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Starting pistol
      ctx.fillStyle = '#334155';
      ctx.fillRect(10, -18, 12, 5);
      ctx.fillRect(10, -14, 4, 8);
      if (isBang) {
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(25, -16, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawRunner = (r: Runner, screenX: number, screenY: number, isLeader: boolean) => {
      ctx.save();
      ctx.translate(screenX, screenY);

      // Spurt afterimage
      if (r.gimmick === 'spurt' && !r.finished) {
        for (let i = 1; i <= 3; i++) {
          ctx.fillStyle = `rgba(56, 189, 248, ${0.28 - i * 0.07})`;
          ctx.beginPath();
          ctx.arc(-i * 12, 0, 11, 0, Math.PI * 2);
          ctx.fill();
        }
        // Speed lines
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(-18 - i * 6, -8 + i * 7);
          ctx.lineTo(-34 - i * 6, -8 + i * 7);
          ctx.stroke();
        }
      }

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 11, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      const swing = r.vx > 0.1 ? Math.sin(r.phase) : 0;
      const stumbleTilt = r.gimmick === 'stumble' ? Math.sin(r.phase * 2) * 0.35 : 0;

      ctx.save();
      ctx.rotate(stumbleTilt);

      // Legs
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-2, 6);
      ctx.lineTo(-2 + swing * 9, 15);
      ctx.moveTo(2, 6);
      ctx.lineTo(2 - swing * 9, 15);
      ctx.stroke();

      // Torso (Jersey)
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.roundRect(-7, -7, 14, 15, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Arms
      ctx.strokeStyle = '#fed7aa';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-3, -3);
      ctx.lineTo(-3 - swing * 8, 5);
      ctx.moveTo(3, -3);
      ctx.lineTo(3 + swing * 8, 5);
      ctx.stroke();

      // Head
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(0, -13, 8, 0, Math.PI * 2);
      ctx.fill();

      // Hair
      ctx.fillStyle = r.hairColor;
      ctx.beginPath();
      ctx.arc(0, -15, 8, Math.PI, Math.PI * 2);
      ctx.fill();

      // Sweat drops if stumbling
      if (r.gimmick === 'stumble') {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(-10, -16, 2.5, 0, Math.PI * 2);
        ctx.arc(10, -13, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Leader Crown
      if (isLeader && !r.finished) {
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑', 0, -40);
      }

      // Name Pill Badge above runner
      ctx.font = 'bold 11px "Pretendard", "Noto Sans KR", sans-serif';
      const label = r.winRank > 0 ? `${r.winRank}등 ${r.name}` : r.name;
      const textWidth = ctx.measureText(label).width;
      const pillW = Math.max(38, textWidth + 14);
      const pillH = 19;
      const pillY = -36;

      ctx.fillStyle = r.winRank > 0 ? '#facc15' : isLeader ? '#fef08a' : '#ffffff';
      ctx.strokeStyle = r.winRank > 0 ? '#b45309' : '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-pillW / 2, pillY, pillW, pillH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, pillY + pillH / 2 + 0.5);

      // Speech Bubble (Gimmick)
      if (r.bubbleTimer > 0 && r.bubbleText) {
        ctx.font = 'bold 11px "Pretendard", "Noto Sans KR", sans-serif';
        const bw = ctx.measureText(r.bubbleText).width + 14;
        const bh = 20;
        const bx = 14;
        const by = -44;
        ctx.fillStyle = r.gimmick === 'spurt' ? '#0284c7' : '#e11d48';
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 8);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(r.bubbleText, bx + 7, by + bh / 2);
      }

      ctx.restore();
    };

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
          canvas.width = Math.floor(rect.width);
          canvas.height = Math.floor(rect.height);
        }
      }

      const W = canvas.width || 900;
      const H = canvas.height || 480;
      const FINISH_X = getFinishX();
      const runners = runnersRef.current;
      const totalLanes = Math.max(1, runners.length);
      const trackTotalHeight = totalLanes * LANE_HEIGHT;

      // Update Physics if racing
      let slowMoActive = false;
      if (phaseRef.current === 'racing') {
        const targetWinCount = Math.min(numWinners, runners.length);

        // Determine slow motion near the decisive finish
        const unfinished = runners.filter(r => !r.finished);
        if (raceModeRef.current === 'first') {
          const remainingNeeded = targetWinCount - finishedCountRef.current;
          if (remainingNeeded > 0 && unfinished.length > 0) {
            const sortedUnfinished = [...unfinished].sort((a, b) => b.x - a.x);
            const focusRunner = sortedUnfinished[0];
            if (focusRunner && focusRunner.x >= FINISH_X - (FINISH_X - START_X) * 0.1) {
              slowMoActive = true;
            }
          }
        } else {
          // Last-place mode: slow mo when the last runner is near the finish
          if (unfinished.length <= targetWinCount && unfinished.length > 0) {
            const slowest = [...unfinished].sort((a, b) => a.x - b.x)[0];
            if (slowest && slowest.x >= FINISH_X - (FINISH_X - START_X) * 0.12) {
              slowMoActive = true;
            }
          }
        }

        setIsSlowMo(slowMoActive);
        const timeScale = (slowMoActive ? 0.25 : 1.0) * speedRef.current;
        const step = dt * 60 * timeScale;

        for (const r of runners) {
          if (r.finished) continue;

          // Trigger random gimmicks
          if (r.gimmickTimer > 0) {
            r.gimmickTimer -= step;
            if (r.gimmickTimer <= 0) {
              r.gimmick = 'none';
            }
          } else if (r.x > START_X + 120 && r.x < FINISH_X - 180 && Math.random() < 0.0045 * step) {
            if (Math.random() < 0.58) {
              r.gimmick = 'spurt';
              r.gimmickTimer = 55 + Math.random() * 35;
              r.bubbleText = SPURT_TEXTS[Math.floor(Math.random() * SPURT_TEXTS.length)];
              r.bubbleTimer = 65;
              if (!mutedRef.current) soundEngine.playSpurt();
            } else {
              r.gimmick = 'stumble';
              r.gimmickTimer = 42 + Math.random() * 28;
              r.bubbleText = STUMBLE_TEXTS[Math.floor(Math.random() * STUMBLE_TEXTS.length)];
              r.bubbleTimer = 65;
              if (!mutedRef.current) soundEngine.playStumble();
            }
          }

          if (r.bubbleTimer > 0) r.bubbleTimer -= step;

          // Target speed calculation
          const jitter = (Math.random() - 0.48) * 0.22;
          r.baseSpeed = Math.max(1.75, Math.min(3.35, r.baseSpeed + jitter * 0.18 * step));
          let targetVx = r.baseSpeed;
          if (r.gimmick === 'spurt') targetVx *= 1.55;
          if (r.gimmick === 'stumble') targetVx *= 0.42;

          r.vx += (targetVx - r.vx) * Math.min(1, 0.12 * step);
          r.x += r.vx * step;
          r.phase += r.vx * 0.22 * step;

          if (Math.random() < 0.3 * step) {
            spawnDust(r.x, HEADER_HEIGHT + r.lane * LANE_HEIGHT + LANE_HEIGHT * 0.5);
          }

          // Check Finish Line
          if (r.x >= FINISH_X) {
            r.x = FINISH_X;
            r.finished = true;
            r.vx = 0;
            finishedCountRef.current += 1;
            r.finishOrder = finishedCountRef.current;

            if (!tapeBrokenRef.current) {
              tapeBrokenRef.current = true;
              confetti({ particleCount: 70, spread: 65, origin: { y: 0.6 } });
              if (!mutedRef.current) soundEngine.playWin('running');
            }

            if (raceModeRef.current === 'first') {
              if (r.finishOrder <= targetWinCount) {
                r.winRank = r.finishOrder;
                determinedWinnersRef.current = [...determinedWinnersRef.current, r.name];
                setWinnersList([...determinedWinnersRef.current]);
                setCommentary(`🎉 ${r.name} ${r.winRank}등 결승선 통과!`);
                onWinnerDetermined(r.name, r.winRank);
              }
              if (finishedCountRef.current >= targetWinCount && !finishTriggeredRef.current) {
                finishTriggeredRef.current = true;
                setPhase('finished');
                phaseRef.current = 'finished';
                setIsSlowMo(false);
                if (!mutedRef.current) soundEngine.playWin('running');
                setTimeout(() => {
                  onRaceFinished([...determinedWinnersRef.current]);
                }, 1500);
              }
            } else {
              // Last-place mode: last `targetWinCount` finishers win!
              const total = runners.length;
              if (r.finishOrder > total - targetWinCount) {
                const winIdx = total - r.finishOrder + 1; // very last is 1등(꼴등)
                r.winRank = winIdx;
                determinedWinnersRef.current = [...determinedWinnersRef.current, r.name];
                setWinnersList([...determinedWinnersRef.current]);
                setCommentary(`🐢 ${r.name} 꼴등 그룹 당첨!`);
                onWinnerDetermined(r.name, determinedWinnersRef.current.length);
              }
              if (finishedCountRef.current >= total && !finishTriggeredRef.current) {
                finishTriggeredRef.current = true;
                setPhase('finished');
                phaseRef.current = 'finished';
                setIsSlowMo(false);
                if (!mutedRef.current) soundEngine.playWin('running');
                const finalOrdered = [...determinedWinnersRef.current].reverse();
                setTimeout(() => {
                  onRaceFinished(finalOrdered);
                }, 1500);
              }
            }
          }
        }

        // Update leader & commentary periodically
        const sortedByX = [...runners].sort((a, b) => b.x - a.x);
        const currentFocus =
          raceModeRef.current === 'first'
            ? sortedByX[0]
            : [...runners].filter(r => !r.finished).sort((a, b) => a.x - b.x)[0] || sortedByX[sortedByX.length - 1];

        if (currentFocus) {
          setLeaderName(currentFocus.name);
          const pct = Math.min(100, Math.max(0, Math.round(((currentFocus.x - START_X) / (FINISH_X - START_X)) * 100)));
          setProgressPct(pct);

          if (now - lastCommentaryTimeRef.current > 1800) {
            lastCommentaryTimeRef.current = now;
            if (raceModeRef.current === 'first') {
              const second = sortedByX[1];
              if (second && Math.abs(sortedByX[0].x - second.x) < 45) {
                setCommentary(`${sortedByX[0].name}와(과) ${second.name}의 치열한 선두 다툼!`);
              } else {
                setCommentary(`${sortedByX[0].name} 선두 질주 중!`);
              }
            } else {
              setCommentary(`${currentFocus.name} 마지막 결승을 향해 달리는 중!`);
            }
          }
        }
      }

      // Camera Tracking
      const sortedRunners = [...runners].sort((a, b) => b.x - a.x);
      const focusRunner =
        raceModeRef.current === 'first'
          ? sortedRunners.find(r => !r.finished) || sortedRunners[0]
          : [...runners].filter(r => !r.finished).sort((a, b) => a.x - b.x)[0] || sortedRunners[sortedRunners.length - 1];

      const maxCamX = Math.max(0, FINISH_X + 180 - W);
      const targetCamX = focusRunner ? Math.max(0, Math.min(maxCamX, focusRunner.x - W * 0.55)) : 0;
      cameraRef.current.x += (targetCamX - cameraRef.current.x) * 0.1;

      const availableTrackH = Math.max(120, H - HEADER_HEIGHT - 54);
      const maxCamY = Math.max(0, trackTotalHeight - availableTrackH);
      const focusLaneY = focusRunner ? focusRunner.lane * LANE_HEIGHT : 0;
      const targetCamY = Math.max(0, Math.min(maxCamY, focusLaneY - availableTrackH * 0.45));
      cameraRef.current.y += (targetCamY - cameraRef.current.y) * 0.08;

      const camX = cameraRef.current.x;
      const camY = cameraRef.current.y;

      // --- DRAW BACKGROUND ---
      // Sky
      ctx.fillStyle = '#cbe9f8';
      ctx.fillRect(0, 0, W, HEADER_HEIGHT);

      // Clouds
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 6; i++) {
        const cx = ((i * 320 - camX * 0.2) % (W + 300) + W + 300) % (W + 300) - 100;
        const cy = 22 + (i % 2) * 14;
        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, Math.PI * 2);
        ctx.arc(cx + 16, cy - 4, 20, 0, Math.PI * 2);
        ctx.arc(cx + 34, cy, 15, 0, Math.PI * 2);
        ctx.fill();
      }

      // Spectator Bleachers
      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, 56, W, 34);
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, 72, W, 18);

      // Cheering Spectators
      const bounceOffset = Math.sin(now * 0.008) * 2.5;
      for (let sx = -((camX * 0.6) % 28); sx < W + 28; sx += 28) {
        const idx = Math.abs(Math.floor((sx + camX * 0.6) / 28));
        ctx.fillStyle = BUNTING_COLORS[idx % BUNTING_COLORS.length];
        const b = idx % 2 === 0 ? bounceOffset : -bounceOffset;
        ctx.beginPath();
        ctx.arc(sx + 10, 68 + b, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(sx + 10, 60 + b, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bunting Pennant Flags
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(0, 90, W, 3);
      for (let fx = -((camX * 0.8) % 26); fx < W + 26; fx += 26) {
        const idx = Math.abs(Math.floor((fx + camX * 0.8) / 26));
        ctx.fillStyle = BUNTING_COLORS[idx % BUNTING_COLORS.length];
        ctx.beginPath();
        ctx.moveTo(fx, 92);
        ctx.lineTo(fx + 20, 92);
        ctx.lineTo(fx + 10, 108);
        ctx.closePath();
        ctx.fill();
      }

      // --- DRAW RUNNING TRACK ---
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, HEADER_HEIGHT, W, H - HEADER_HEIGHT);
      ctx.clip();

      // Rubber track base
      ctx.fillStyle = '#c9583c';
      ctx.fillRect(0, HEADER_HEIGHT, W, H - HEADER_HEIGHT);

      // Lanes
      for (let i = 0; i < totalLanes; i++) {
        const laneY = HEADER_HEIGHT + i * LANE_HEIGHT - camY;
        if (laneY + LANE_HEIGHT < HEADER_HEIGHT || laneY > H) continue;

        ctx.fillStyle = i % 2 === 0 ? '#c9583c' : '#be4e33';
        ctx.fillRect(0, laneY, W, LANE_HEIGHT);

        // White lane divider
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, laneY + LANE_HEIGHT);
        ctx.lineTo(W, laneY + LANE_HEIGHT);
        ctx.stroke();

        // Stenciled Lane Number
        const numX = START_X - 42 - camX;
        if (numX > -40 && numX < W + 40) {
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.font = '900 18px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(i + 1), numX, laneY + LANE_HEIGHT / 2);
        }
      }

      // Green Grass Infield below last lane
      const grassY = HEADER_HEIGHT + trackTotalHeight - camY;
      if (grassY < H) {
        ctx.fillStyle = '#57a447';
        ctx.fillRect(0, grassY, W, H - grassY);
        ctx.fillStyle = '#4e963f';
        for (let gx = -((camX) % 80); gx < W; gx += 80) {
          ctx.fillRect(gx, grassY, 40, H - grassY);
        }
      }

      // Distance Markers (every 500px)
      for (let mx = START_X + 500; mx < FINISH_X; mx += 500) {
        const screenMx = mx - camX;
        if (screenMx > -20 && screenMx < W + 20) {
          ctx.strokeStyle = 'rgba(255,255,255,0.22)';
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(screenMx, HEADER_HEIGHT);
          ctx.lineTo(screenMx, HEADER_HEIGHT + trackTotalHeight - camY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Start Line
      const startScreenX = START_X - camX;
      if (startScreenX > -20 && startScreenX < W + 20) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(startScreenX - 3, HEADER_HEIGHT, 6, trackTotalHeight);
      }

      // Checkered Finish Line & Red Tape
      const finishScreenX = FINISH_X - camX;
      if (finishScreenX > -40 && finishScreenX < W + 40) {
        const squareSize = 10;
        const trackEnd = HEADER_HEIGHT + trackTotalHeight - camY;
        for (let fy = HEADER_HEIGHT; fy < trackEnd; fy += squareSize) {
          const row = Math.floor((fy - HEADER_HEIGHT) / squareSize);
          ctx.fillStyle = row % 2 === 0 ? '#ffffff' : '#0f172a';
          ctx.fillRect(finishScreenX - 5, fy, 5, squareSize);
          ctx.fillStyle = row % 2 === 0 ? '#0f172a' : '#ffffff';
          ctx.fillRect(finishScreenX, fy, 5, squareSize);
        }
        if (!tapeBrokenRef.current) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(finishScreenX + 8, HEADER_HEIGHT);
          ctx.lineTo(finishScreenX + 8, trackEnd);
          ctx.stroke();
        }
      }

      // Referee Otter near Start Line
      if (startScreenX > -60 && startScreenX < W + 60) {
        drawPixelOtter(startScreenX + 18, HEADER_HEIGHT + 24 - Math.min(camY, 20), countdownText === '탕!');
      }

      // Update & Draw Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life += 1;
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        if (p.life >= p.maxLife) {
          particlesRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x - camX, p.y - camY, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Runners
      const leaderId = focusRunner?.id;
      for (const r of runners) {
        const sx = r.x - camX;
        const sy = HEADER_HEIGHT + r.lane * LANE_HEIGHT + LANE_HEIGHT * 0.55 - camY;
        if (sy < HEADER_HEIGHT - 30 || sy > H + 30) continue;
        drawRunner(r, sx, sy, r.id === leaderId);
      }

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [getFinishX, numWinners, onRaceFinished, onWinnerDetermined, countdownText]);

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col rounded-3xl overflow-hidden shadow-2xl border-4 border-amber-400/80 bg-slate-900 select-none">
      {/* Top HUD Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 text-white">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-amber-400 text-slate-950 font-black px-3.5 py-1.5 rounded-xl shadow-sm flex items-center gap-1.5 text-sm">
            <Trophy className="w-4 h-4" />
            <span>{raceMode === 'first' ? '1등' : '꼴등'} {leaderName}</span>
          </div>

          {isSlowMo && (
            <div className="bg-rose-500 text-white font-black px-3 py-1.5 rounded-xl text-xs animate-pulse flex items-center gap-1 shadow">
              <Zap className="w-3.5 h-3.5" />
              <span>느린 화면</span>
            </div>
          )}

          {winnersList.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {winnersList.map((w, idx) => (
                <span
                  key={`${w}-${idx}`}
                  className="bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-bold px-2.5 py-1 rounded-lg"
                >
                  {idx + 1}등 {w}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Mode & Length Controls (when ready) */}
          {phase === 'ready' && (
            <>
              <div className="flex bg-black/20 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setRaceMode('first')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    raceMode === 'first' ? 'bg-amber-400 text-slate-950' : 'text-white/80 hover:text-white'
                  }`}
                >
                  1등 선발
                </button>
                <button
                  type="button"
                  onClick={() => setRaceMode('last')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    raceMode === 'last' ? 'bg-amber-400 text-slate-950' : 'text-white/80 hover:text-white'
                  }`}
                >
                  꼴등 선발
                </button>
              </div>

              <div className="flex bg-black/20 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setRaceLength('normal')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    raceLength === 'normal' ? 'bg-white text-slate-900' : 'text-white/80 hover:text-white'
                  }`}
                >
                  보통
                </button>
                <button
                  type="button"
                  onClick={() => setRaceLength('long')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    raceLength === 'long' ? 'bg-white text-slate-900' : 'text-white/80 hover:text-white'
                  }`}
                >
                  길게
                </button>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-all"
            title={isMuted ? '소리 켜기' : '음소거'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {phase !== 'ready' && (
            <button
              type="button"
              onClick={resetRace}
              className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-all"
              title="다시 준비"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Track Canvas */}
      <div
        ref={containerRef}
        className="relative w-full h-[430px] sm:h-[490px] bg-[#cbe9f8] overflow-hidden"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Ready Start Overlay */}
        {phase === 'ready' && (
          <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px] flex flex-col items-center justify-center gap-4 p-4">
            <div className="bg-white/95 text-slate-900 px-6 py-4 rounded-3xl shadow-2xl border-4 border-amber-400 text-center max-w-sm">
              <p className="text-xs font-black text-amber-600 uppercase tracking-wider mb-1">
                운동회 달리기 추첨 ({students.length}명 참가 · {numWinners}명 선발)
              </p>
              <h3 className="text-xl font-black text-slate-900 mb-3">
                {raceMode === 'first' ? '가장 먼저 결승선을 통과하라!' : '끝까지 느긋하게! 꼴등이 주인공!'}
              </h3>
              <button
                type="button"
                onClick={startCountdown}
                className="w-full py-3.5 px-6 bg-[#d8432b] hover:bg-[#b9331d] text-white font-black text-lg rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                출발하기!
              </button>
            </div>
          </div>
        )}

        {/* Countdown Overlay */}
        {phase === 'countdown' && countdownText && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-amber-400 text-slate-950 font-black text-4xl sm:text-5xl px-8 py-4 rounded-3xl shadow-2xl border-4 border-white animate-bounce">
              {countdownText}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Live Status & Progress Bar */}
      <div className="bg-slate-900 px-4 py-3 border-t border-slate-800 space-y-2">
        <div className="relative h-2.5 bg-slate-800 rounded-full overflow-visible">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-rose-500 rounded-full transition-all duration-150"
            style={{ width: `${progressPct}%` }}
          />
          <div
            className="absolute -top-2.5 -translate-x-1/2 text-sm transition-all duration-150"
            style={{ left: `${progressPct}%` }}
          >
            🏁
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="bg-white/10 text-white px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 truncate">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{commentary}</span>
          </div>
          <span className="bg-emerald-500 text-slate-950 font-black px-3 py-1 rounded-xl shrink-0 flex items-center gap-1">
            <Flag className="w-3 h-3" />
            결승! ({progressPct}%)
          </span>
        </div>
      </div>
    </div>
  );
}
