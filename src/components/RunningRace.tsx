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
type RacePhase = 'ready' | 'countdown' | 'racing' | 'finished';

const TRACK_LENGTH_PRESETS = [
  { label: '짧게', value: 1600 },
  { label: '보통', value: 2600 },
  { label: '길게', value: 4200 },
  { label: '마라톤', value: 6000 },
];

type ObstacleType = 'hurdle' | 'tire' | 'puddle' | 'cone';

interface TrackObstacle {
  id: string;
  lane: number;
  x: number;
  type: ObstacleType;
  knocked: boolean;
  resolved: boolean;
}

interface Runner {
  id: string;
  name: string;
  lane: number;
  x: number;
  vx: number;
  baseSpeed: number;
  phase: number;
  jumpY: number;
  jumpVy: number;
  tripTimer: number;
  color: string;
  hairColor: string;
  gimmick: 'none' | 'spurt' | 'superSpurt' | 'stumble' | 'longStop';
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
const SUPER_SPURT_TEXTS = ['대역전!!', '후방 터보!', '비켜라!!', '초각성!'];
const STUMBLE_TEXTS = ['어? 이쪽?', '잠깐만!', '신발끈!', '꿀맛!', '꽈당!'];
const LONG_STOP_TEXTS = ['헉헉... 휴식!', '신발끈 풀림!', '잠깐 멈춤!', '쥐났다!!'];

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
  const [trackLength, setTrackLength] = useState<number>(2600);
  const [phase, setPhase] = useState<RacePhase>('ready');
  const [countdownText, setCountdownText] = useState<string>('');
  const [isMuted, setIsMuted] = useState(false);
  const [slowMoReason, setSlowMoReason] = useState<'none' | 'lead' | 'finish'>('none');
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

  const trackLengthRef = useRef<number>(trackLength);
  trackLengthRef.current = trackLength;

  const phaseRef = useRef<RacePhase>(phase);
  phaseRef.current = phase;

  const runnersRef = useRef<Runner[]>([]);
  const obstaclesRef = useRef<TrackObstacle[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const cameraRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const tapeBrokenRef = useRef<boolean>(false);
  const finishedCountRef = useRef<number>(0);
  const determinedWinnersRef = useRef<string[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastCommentaryTimeRef = useRef<number>(0);
  const finishTriggeredRef = useRef<boolean>(false);
  const lastLeaderIdRef = useRef<string | null>(null);
  const leadChangeSlowMoRef = useRef<number>(0);
  const lastLeadChangeAtRef = useRef<number>(0);
  const halfwayAnnouncedRef = useRef<boolean>(false);
  const finalStretchAnnouncedRef = useRef<boolean>(false);

  const START_X = 110;
  const getFinishX = useCallback(() => trackLengthRef.current, []);
  const HEADER_HEIGHT = 98; // Sky + bleachers + bunting

  const generateObstacles = useCallback((laneCount: number, finishX: number) => {
    const types: ObstacleType[] = ['hurdle', 'tire', 'puddle', 'cone'];
    const obs: TrackObstacle[] = [];
    const usableSpan = Math.max(400, finishX - START_X - 460);
    const countPerLane = Math.max(3, Math.round(usableSpan / 430));

    for (let lane = 0; lane < laneCount; lane++) {
      for (let k = 0; k < countPerLane; k++) {
        const segment = usableSpan / countPerLane;
        const ox = START_X + 250 + k * segment + (Math.random() * 0.6 + 0.2) * segment;
        const type = types[Math.floor(Math.random() * types.length)];
        obs.push({
          id: `obs-${lane}-${k}`,
          lane,
          x: ox,
          type,
          knocked: false,
          resolved: false,
        });
      }
    }
    obstaclesRef.current = obs;
  }, []);

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
      jumpY: 0,
      jumpVy: 0,
      tripTimer: 0,
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
    generateObstacles(shuffled.length, getFinishX());
    particlesRef.current = [];
    cameraRef.current = { x: 0, y: 0 };
    tapeBrokenRef.current = false;
    finishedCountRef.current = 0;
    determinedWinnersRef.current = [];
    finishTriggeredRef.current = false;
    lastLeaderIdRef.current = null;
    leadChangeSlowMoRef.current = 0;
    lastLeadChangeAtRef.current = 0;
    halfwayAnnouncedRef.current = false;
    finalStretchAnnouncedRef.current = false;
    setWinnersList([]);
    setProgressPct(0);
    setSlowMoReason('none');
    setLeaderName(shuffled[0]?.name || '');
    setCommentary('출발선에서 심판의 신호를 기다리고 있습니다!');
  }, [students]);

  useEffect(() => {
    initRunners();
  }, [initRunners]);

  useEffect(() => {
    if (phaseRef.current === 'ready') {
      generateObstacles(runnersRef.current.length, trackLength);
    }
  }, [trackLength, generateObstacles]);

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

    const drawObstacle = (obs: TrackObstacle, screenX: number, screenY: number, laneHeight: number) => {
      const scale = Math.max(0.62, Math.min(1, laneHeight / 38));
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.scale(scale, scale);

      if (obs.type === 'puddle') {
        ctx.fillStyle = obs.knocked ? 'rgba(56, 189, 248, 0.55)' : 'rgba(14, 165, 233, 0.72)';
        ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 13, 18, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (obs.type === 'tire') {
        if (obs.knocked) ctx.rotate(0.65);
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.ellipse(0, 10, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c9583c';
        ctx.beginPath();
        ctx.ellipse(0, 10, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 10, 12, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (obs.type === 'cone') {
        if (obs.knocked) {
          ctx.translate(6, 12);
          ctx.rotate(1.3);
          ctx.translate(-6, -12);
        }
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(-7, 15);
        ctx.lineTo(7, 15);
        ctx.lineTo(2, -4);
        ctx.lineTo(-2, -4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-4, 4, 8, 4);
      } else {
        // hurdle
        if (obs.knocked) {
          ctx.translate(6, 14);
          ctx.rotate(1.15);
          ctx.translate(-6, -14);
        }
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-5, 15);
        ctx.lineTo(-2, -4);
        ctx.moveTo(5, 15);
        ctx.lineTo(2, -4);
        ctx.stroke();
        // Top red-white striped bar
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-7, -7, 14, 5);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-3, -7, 6, 5);
      }

      ctx.restore();
    };

    const drawRunner = (r: Runner, screenX: number, screenY: number, isLeader: boolean, laneHeight: number) => {
      const scale = Math.max(0.58, Math.min(1, laneHeight / 38));
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.scale(scale, scale);

      // Shadow stays on ground and shrinks slightly when jumping
      const shadowScale = Math.max(0.45, 1 + r.jumpY / 35);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 11 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Apply vertical jump offset
      ctx.translate(0, r.jumpY);

      // Spurt / SuperSpurt afterimage
      if ((r.gimmick === 'spurt' || r.gimmick === 'superSpurt') && !r.finished) {
        const isSuper = r.gimmick === 'superSpurt';
        for (let i = 1; i <= (isSuper ? 5 : 3); i++) {
          ctx.fillStyle = isSuper
            ? `rgba(250, 204, 21, ${0.38 - i * 0.06})`
            : `rgba(56, 189, 248, ${0.28 - i * 0.07})`;
          ctx.beginPath();
          ctx.arc(-i * 12, 0, isSuper ? 13 : 11, 0, Math.PI * 2);
          ctx.fill();
        }
        // Speed lines
        ctx.strokeStyle = isSuper ? '#facc15' : '#38bdf8';
        ctx.lineWidth = isSuper ? 2.5 : 2;
        for (let i = 0; i < (isSuper ? 4 : 3); i++) {
          ctx.beginPath();
          ctx.moveTo(-18 - i * 6, -10 + i * 6);
          ctx.lineTo(-38 - i * 6, -10 + i * 6);
          ctx.stroke();
        }
      }

      const swing = r.vx > 0.1 ? Math.sin(r.phase) : 0;
      const stumbleTilt =
        r.tripTimer > 0
          ? 0.55 + Math.sin(r.tripTimer * 0.5) * 0.25
          : r.gimmick === 'stumble'
            ? Math.sin(r.phase * 2) * 0.35
            : 0;

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

      // Sweat drops if stumbling or long-stopped
      if (r.gimmick === 'stumble' || r.gimmick === 'longStop') {
        ctx.fillStyle = r.gimmick === 'longStop' ? '#a855f7' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(-10, -16, 2.5, 0, Math.PI * 2);
        ctx.arc(10, -13, 2.5, 0, Math.PI * 2);
        ctx.fill();
        if (r.gimmick === 'longStop') {
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('💫', 0, -24);
        }
      }

      ctx.restore();

      // Leader Crown (scaled)
      if (isLeader && !r.finished) {
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑', 0, -28);
      }

      // Restore scale before drawing name badge so names stay large & crisp!
      ctx.restore();
      ctx.save();
      ctx.translate(screenX, screenY);

      // Large Unscaled Name Pill Badge
      ctx.font = '900 13px "Pretendard", "Noto Sans KR", sans-serif';
      const label = r.winRank > 0 ? `${r.winRank}등 ${r.name}` : r.name;
      const textWidth = ctx.measureText(label).width;
      const pillW = Math.max(46, textWidth + 16);
      const pillH = 22;

      // If lanes are spacious, place above; if many students, place cleanly beside runner
      const placeBeside = laneHeight < 38;
      const pillX = placeBeside ? -14 - pillW : -pillW / 2;
      const pillY = placeBeside ? -pillH / 2 - 2 : -44;

      ctx.fillStyle = r.winRank > 0 ? '#facc15' : isLeader ? '#fef08a' : '#ffffff';
      ctx.strokeStyle = r.winRank > 0 ? '#b45309' : isLeader ? '#d97706' : '#1e293b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 7);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, pillX + pillW / 2, pillY + pillH / 2 + 0.5);

      // Speech Bubble (Gimmick)
      if (r.bubbleTimer > 0 && r.bubbleText) {
        ctx.font = '900 12px "Pretendard", "Noto Sans KR", sans-serif';
        const bw = ctx.measureText(r.bubbleText).width + 16;
        const bh = 22;
        const bx = 14;
        const by = placeBeside ? -bh / 2 - 2 : -44;
        ctx.fillStyle =
          r.gimmick === 'superSpurt'
            ? '#d97706'
            : r.gimmick === 'spurt'
              ? '#0284c7'
              : r.gimmick === 'longStop'
                ? '#7c3aed'
                : '#e11d48';
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 8);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(r.bubbleText, bx + 8, by + bh / 2);
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

      const W = canvas.width || 1100;
      const H = canvas.height || 620;
      const FINISH_X = getFinishX();
      const runners = runnersRef.current;
      const totalLanes = Math.max(1, runners.length);
      const availableTrackHeight = Math.max(160, H - HEADER_HEIGHT - 12);
      // Fit ALL students vertically on one screen without clipping
      const laneHeight = Math.max(18, Math.min(48, availableTrackHeight / totalLanes));
      const trackTotalHeight = totalLanes * laneHeight;

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

        // Lead-change slow-mo countdown
        if (leadChangeSlowMoRef.current > 0) {
          leadChangeSlowMoRef.current = Math.max(0, leadChangeSlowMoRef.current - dt * 60);
        }
        const leadSlowMoActive = leadChangeSlowMoRef.current > 0;
        setSlowMoReason(slowMoActive ? 'finish' : leadSlowMoActive ? 'lead' : 'none');

        const slowFactor = slowMoActive ? 0.24 : leadSlowMoActive ? 0.3 : 1.0;
        const timeScale = slowFactor * speedRef.current;
        const step = dt * 60 * timeScale;

        const sortedUnfinishedList = [...unfinished].sort((a, b) => b.x - a.x);
        const leaderX = sortedUnfinishedList[0]?.x || START_X;

        for (const r of runners) {
          if (r.finished) continue;

          const rankIdx = sortedUnfinishedList.findIndex(u => u.id === r.id);
          const gapFromLeader = leaderX - r.x;
          const isTrailingPack = unfinished.length > 2 && rankIdx >= Math.floor(unfinished.length * 0.45);
          const isTopPack = unfinished.length > 2 && rankIdx <= Math.max(1, Math.floor(unfinished.length * 0.25));

          // Trigger dynamic comeback / collapse / random gimmicks
          if (r.gimmickTimer > 0) {
            r.gimmickTimer -= step;
            if (r.gimmickTimer <= 0) {
              r.gimmick = 'none';
            }
          } else if (r.x > START_X + 110 && r.x < FINISH_X - 130) {
            if (isTrailingPack && gapFromLeader > 85 && Math.random() < 0.0115 * step) {
              // Underdog mega-spurt comeback!
              r.gimmick = 'superSpurt';
              r.gimmickTimer = 88 + Math.random() * 35;
              r.bubbleText = SUPER_SPURT_TEXTS[Math.floor(Math.random() * SUPER_SPURT_TEXTS.length)];
              r.bubbleTimer = 85;
              if (!mutedRef.current) soundEngine.playSpurt();
              if (now - lastCommentaryTimeRef.current > 900) {
                lastCommentaryTimeRef.current = now;
                setCommentary(`🚀 대역전극! 하위권 ${r.name} 선수가 폭풍 터보로 치고 올라옵니다!`);
              }
            } else if (isTopPack && r.x > START_X + 170 && Math.random() < (gapFromLeader === 0 ? 0.0075 : 0.0055) * step) {
              // Leader long stop / exhaustion / shoe untied!
              r.gimmick = 'longStop';
              r.gimmickTimer = 95 + Math.random() * 50;
              r.bubbleText = LONG_STOP_TEXTS[Math.floor(Math.random() * LONG_STOP_TEXTS.length)];
              r.bubbleTimer = 95;
              if (!mutedRef.current) soundEngine.playStumble();
              if (now - lastCommentaryTimeRef.current > 900) {
                lastCommentaryTimeRef.current = now;
                setCommentary(`😱 대위기! 선두권 ${r.name} 선수가 갑자기 멈춰 섰습니다! 하위권 추격 기회!`);
              }
            } else if (Math.random() < 0.005 * step) {
              if (Math.random() < 0.56) {
                r.gimmick = 'spurt';
                r.gimmickTimer = 55 + Math.random() * 35;
                r.bubbleText = SPURT_TEXTS[Math.floor(Math.random() * SPURT_TEXTS.length)];
                r.bubbleTimer = 65;
                if (!mutedRef.current) soundEngine.playSpurt();
                if (now - lastCommentaryTimeRef.current > 950) {
                  lastCommentaryTimeRef.current = now;
                  setCommentary(`💨 ${r.name} 폭풍 스퍼트 발동! ("${r.bubbleText}")`);
                }
              } else {
                r.gimmick = 'stumble';
                r.gimmickTimer = 42 + Math.random() * 28;
                r.bubbleText = STUMBLE_TEXTS[Math.floor(Math.random() * STUMBLE_TEXTS.length)];
                r.bubbleTimer = 65;
                if (!mutedRef.current) soundEngine.playStumble();
                if (now - lastCommentaryTimeRef.current > 950) {
                  lastCommentaryTimeRef.current = now;
                  setCommentary(`💦 아이고! ${r.name} 잠시 주춤합니다! ("${r.bubbleText}")`);
                }
              }
            }
          }

          if (r.bubbleTimer > 0) r.bubbleTimer -= step;
          if (r.tripTimer > 0) r.tripTimer = Math.max(0, r.tripTimer - step);

          // Vertical jump physics
          if (r.jumpY < 0 || r.jumpVy < 0) {
            r.jumpY += r.jumpVy * step;
            r.jumpVy += 0.38 * step;
            if (r.jumpY >= 0) {
              r.jumpY = 0;
              r.jumpVy = 0;
            }
          }

          // Check Obstacles on this runner's lane
          for (const obs of obstaclesRef.current) {
            if (obs.lane !== r.lane || obs.resolved) continue;
            const dist = obs.x - r.x;
            if (dist <= 20 && dist >= -10) {
              obs.resolved = true;
              const jumpChance = r.gimmick === 'spurt' ? 0.85 : 0.64;
              if (Math.random() < jumpChance) {
                // Clean jump over obstacle!
                r.jumpVy = -5.2;
                r.jumpY = -1;
                r.vx = Math.max(r.vx, r.baseSpeed * 1.18);
                const jumpWords = ['점프!', '폴짝!', '나이스!', '가뿐해!'];
                r.bubbleText = jumpWords[Math.floor(Math.random() * jumpWords.length)];
                r.bubbleTimer = 42;
                spawnDust(r.x, HEADER_HEIGHT + r.lane * laneHeight + laneHeight * 0.58, '#fde047', 4);
                if (!mutedRef.current) soundEngine.playMarbleBounce(0.25);
                if (now - lastCommentaryTimeRef.current > 1100) {
                  lastCommentaryTimeRef.current = now;
                  const obsName =
                    obs.type === 'hurdle' ? '허들' : obs.type === 'tire' ? '타이어' : obs.type === 'puddle' ? '물웅덩이' : '라바콘';
                  setCommentary(`🦘 ${r.name} 선수, ${obsName}을(를) 가볍게 뛰어넘습니다!`);
                }
              } else {
                // Tripped / stumbled on obstacle!
                obs.knocked = true;
                r.gimmick = 'stumble';
                r.gimmickTimer = 46;
                r.tripTimer = 30;
                r.jumpVy = -2.4;
                r.jumpY = -1;
                r.vx *= 0.4;
                const tripWords =
                  obs.type === 'puddle' ? ['첨벙!', '미끄덩!'] : ['아야!', '걸렸다!', '꽈당!'];
                r.bubbleText = tripWords[Math.floor(Math.random() * tripWords.length)];
                r.bubbleTimer = 55;
                spawnDust(
                  obs.x,
                  HEADER_HEIGHT + r.lane * laneHeight + laneHeight * 0.58,
                  obs.type === 'puddle' ? '#38bdf8' : '#f87171',
                  6
                );
                if (!mutedRef.current) soundEngine.playStumble();
                if (now - lastCommentaryTimeRef.current > 1000) {
                  lastCommentaryTimeRef.current = now;
                  const obsName =
                    obs.type === 'hurdle' ? '허들' : obs.type === 'tire' ? '타이어' : obs.type === 'puddle' ? '물웅덩이' : '라바콘';
                  setCommentary(`💥 아이고! ${r.name} 선수, ${obsName}에 걸려 넘어지며 주춤합니다!`);
                }
              }
            }
          }

          // Target speed calculation with wide momentum swings
          const jitter = (Math.random() - 0.48) * 0.28;
          r.baseSpeed = Math.max(1.55, Math.min(3.65, r.baseSpeed + jitter * 0.22 * step));
          let targetVx = r.baseSpeed;
          if (r.gimmick === 'superSpurt') targetVx *= 2.1;
          else if (r.gimmick === 'spurt') targetVx *= 1.58;
          else if (r.gimmick === 'stumble') targetVx *= 0.36;
          else if (r.gimmick === 'longStop') targetVx = 0.05;

          r.vx += (targetVx - r.vx) * Math.min(1, 0.12 * step);
          r.x += r.vx * step;
          r.phase += r.vx * 0.22 * step;

          if (Math.random() < 0.3 * step) {
            spawnDust(r.x, HEADER_HEIGHT + r.lane * laneHeight + laneHeight * 0.55);
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
                setSlowMoReason('none');
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
                setSlowMoReason('none');
                if (!mutedRef.current) soundEngine.playWin('running');
                const finalOrdered = [...determinedWinnersRef.current].reverse();
                setTimeout(() => {
                  onRaceFinished(finalOrdered);
                }, 1500);
              }
            }
          }
        }

        // Update leader, lead-change slow-mo & live commentary
        const sortedByX = [...runners].sort((a, b) => b.x - a.x);
        const currentFocus =
          raceModeRef.current === 'first'
            ? sortedByX.find(r => !r.finished) || sortedByX[0]
            : [...runners].filter(r => !r.finished).sort((a, b) => a.x - b.x)[0] || sortedByX[sortedByX.length - 1];

        if (currentFocus) {
          const prevLeaderId = lastLeaderIdRef.current;
          const prevLeader = prevLeaderId ? runners.find(r => r.id === prevLeaderId) : null;
          if (
            prevLeaderId &&
            currentFocus.id !== prevLeaderId &&
            !slowMoActive &&
            currentFocus.x > START_X + 110 &&
            now - lastLeadChangeAtRef.current > 1800
          ) {
            leadChangeSlowMoRef.current = 45;
            lastLeadChangeAtRef.current = now;
            lastCommentaryTimeRef.current = now;
            if (!mutedRef.current) soundEngine.playSlowMoWhoosh();
            const roleLabel = raceModeRef.current === 'first' ? '선두' : '꼴등 자리';
            setCommentary(
              prevLeader
                ? `🔥 역전! ${currentFocus.name} 선수가 ${prevLeader.name}을(를) 제치고 ${roleLabel}에 올라섭니다!`
                : `🔥 ${currentFocus.name} 선수가 새로운 ${roleLabel}로 올라섭니다!`
            );
          }
          lastLeaderIdRef.current = currentFocus.id;
          setLeaderName(currentFocus.name);

          const pct = Math.min(100, Math.max(0, Math.round(((currentFocus.x - START_X) / (FINISH_X - START_X)) * 100)));
          setProgressPct(pct);

          if (!halfwayAnnouncedRef.current && pct >= 50) {
            halfwayAnnouncedRef.current = true;
            lastCommentaryTimeRef.current = now;
            setCommentary(`📢 반환점 통과! 현재 선두는 ${sortedByX[0]?.name} 선수입니다!`);
          } else if (!finalStretchAnnouncedRef.current && pct >= 80) {
            finalStretchAnnouncedRef.current = true;
            lastCommentaryTimeRef.current = now;
            setCommentary(`🚨 막판 스퍼트 구간! 결승선이 코앞으로 다가왔습니다!`);
          } else if (now - lastCommentaryTimeRef.current > 1500) {
            lastCommentaryTimeRef.current = now;
            if (slowMoActive) {
              setCommentary(`📸 초접전 결승 슬로우 모션! 과연 결승 테이프를 끊을 주인공은?!`);
            } else if (raceModeRef.current === 'first') {
              const second = sortedByX[1];
              const third = sortedByX[2];
              if (second && Math.abs(sortedByX[0].x - second.x) < 42) {
                setCommentary(`⚔️ ${sortedByX[0].name} vs ${second.name}! 숨 막히는 초접전 선두 경쟁!`);
              } else if (second && third) {
                setCommentary(`🏃 1위 ${sortedByX[0].name} 독주! ${second.name}, ${third.name} 선수가 바짝 뒤쫓습니다!`);
              } else {
                setCommentary(`🏃 ${sortedByX[0].name} 선수, 힘차게 선두를 달리고 있습니다!`);
              }
            } else {
              setCommentary(`🐢 ${currentFocus.name} 선수, 마지막까지 포기하지 않고 달리고 있습니다!`);
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
      cameraRef.current.y = 0;

      const camX = cameraRef.current.x;
      const camY = 0;

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
        const laneY = HEADER_HEIGHT + i * laneHeight - camY;
        if (laneY + laneHeight < HEADER_HEIGHT || laneY > H) continue;

        ctx.fillStyle = i % 2 === 0 ? '#c9583c' : '#be4e33';
        ctx.fillRect(0, laneY, W, laneHeight);

        // White lane divider
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
        ctx.lineWidth = laneHeight < 26 ? 1 : 2;
        ctx.beginPath();
        ctx.moveTo(0, laneY + laneHeight);
        ctx.lineTo(W, laneY + laneHeight);
        ctx.stroke();

        // Stenciled Lane Number
        const numX = START_X - 42 - camX;
        if (numX > -40 && numX < W + 40) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.font = `900 ${Math.max(10, Math.min(18, Math.floor(laneHeight * 0.45)))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(i + 1), numX, laneY + laneHeight / 2);
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

      // Draw Obstacles on Track
      for (const obs of obstaclesRef.current) {
        const ox = obs.x - camX;
        if (ox < -30 || ox > W + 30) continue;
        const oy = HEADER_HEIGHT + obs.lane * laneHeight + laneHeight * 0.58 - camY;
        drawObstacle(obs, ox, oy, laneHeight);
      }

      // Draw Runners
      const leaderId = focusRunner?.id;
      for (const r of runners) {
        const sx = r.x - camX;
        const sy = HEADER_HEIGHT + r.lane * laneHeight + laneHeight * 0.58 - camY;
        drawRunner(r, sx, sy, r.id === leaderId, laneHeight);
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
    <div className="w-full max-w-[1440px] mx-auto flex flex-col rounded-3xl overflow-hidden shadow-2xl border-4 border-amber-400/80 bg-slate-900 select-none">
      {/* Top HUD Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 text-white">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-amber-400 text-slate-950 font-black px-3.5 py-1.5 rounded-xl shadow-sm flex items-center gap-1.5 text-sm">
            <Trophy className="w-4 h-4" />
            <span>{raceMode === 'first' ? '1등' : '꼴등'} {leaderName}</span>
          </div>

          {slowMoReason !== 'none' && (
            <div className="bg-rose-500 text-white font-black px-3 py-1.5 rounded-xl text-xs animate-pulse flex items-center gap-1 shadow">
              <Zap className="w-3.5 h-3.5" />
              <span>{slowMoReason === 'lead' ? '선두 역전! 슬로우 모션' : '결승! 느린 화면'}</span>
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
                {TRACK_LENGTH_PRESETS.map(preset => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setTrackLength(preset.value)}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      trackLength === preset.value ? 'bg-white text-slate-900' : 'text-white/80 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
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
        className="relative w-full min-h-[600px] h-[72vh] bg-[#cbe9f8] overflow-hidden"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Ready Start Overlay */}
        {phase === 'ready' && (
          <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px] flex flex-col items-center justify-center gap-4 p-4">
            <div className="bg-white/95 text-slate-900 px-6 py-5 rounded-3xl shadow-2xl border-4 border-amber-400 text-center w-full max-w-md">
              <p className="text-xs font-black text-amber-600 uppercase tracking-wider mb-1">
                운동회 달리기 추첨 ({students.length}명 전원 한눈에 · {numWinners}명 선발)
              </p>
              <h3 className="text-xl font-black text-slate-900 mb-3">
                {raceMode === 'first' ? '가장 먼저 결승선을 통과하라!' : '끝까지 느긋하게! 꼴등이 주인공!'}
              </h3>

              {/* Track Length Slider & Presets */}
              <div className="bg-slate-100 rounded-2xl p-3 mb-4 text-left border border-slate-200">
                <div className="flex items-center justify-between text-xs font-black text-slate-700 mb-2">
                  <span>트랙 길이 조절</span>
                  <span className="text-indigo-600">{Math.round(trackLength / 26)}m ({trackLength}px)</span>
                </div>
                <input
                  type="range"
                  min={1200}
                  max={6500}
                  step={100}
                  value={trackLength}
                  onChange={(e) => setTrackLength(parseInt(e.target.value, 10))}
                  className="w-full accent-[#d8432b] mb-2"
                />
                <div className="grid grid-cols-4 gap-1.5">
                  {TRACK_LENGTH_PRESETS.map(preset => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setTrackLength(preset.value)}
                      className={`py-1 rounded-lg text-[11px] font-bold border transition-all ${
                        trackLength === preset.value
                          ? 'bg-amber-400 text-slate-950 border-amber-500'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

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

        <div className="flex items-center justify-between gap-3">
          <div className="bg-white/10 border border-white/10 text-white px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 min-w-0 flex-1">
            <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 animate-pulse">
              LIVE 중계
            </span>
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate text-sm sm:text-base font-black text-amber-100">{commentary}</span>
          </div>
          <span className="bg-emerald-500 text-slate-950 font-black px-3.5 py-2 rounded-xl shrink-0 flex items-center gap-1 text-xs sm:text-sm">
            <Flag className="w-3.5 h-3.5" />
            결승! ({progressPct}%)
          </span>
        </div>
      </div>
    </div>
  );
}
