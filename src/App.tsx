import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  deleteDoc,
  updateDoc,
  serverTimestamp,
  getDocFromServer,
  writeBatch,
  increment
} from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { db, auth, signIn, logOut } from './firebase';
import { 
  Trophy, 
  Users, 
  User,
  Settings, 
  Play, 
  RotateCcw, 
  Plus, 
  Minus,
  Trash2, 
  LogOut, 
  QrCode,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Download,
  Upload,
  FileSpreadsheet,
  Volume2,
  Gift,
  Package,
  LayoutDashboard,
  ShieldCheck,
  Ticket,
  CircleDot,
  Atom,
  Coins,
  Flame,
  Crown,
  Wind
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import Confetti from 'react-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as XLSX from 'xlsx';
import soundEngine from './soundEngine';
import MarbleRace from './components/MarbleRace';
import SlotMachineEffect from './components/effects/SlotMachineEffect';
import SupernovaExplosionEffect from './components/effects/SupernovaExplosionEffect';
import MythicCardEffect from './components/effects/MythicCardEffect';
import LegendaryBoxEffect from './components/effects/LegendaryBoxEffect';
import AeroMachineEffect from './components/effects/AeroMachineEffect';
import CyberBoardEffect from './components/effects/CyberBoardEffect';
import StandardOrbEffect from './components/effects/StandardOrbEffect';

// --- Types ---
interface Student {
  id: string;
  name: string;
  tickets?: number;
  adminEmail?: string;
  stats?: {
    wins: Record<number, number>; // rank -> count
    totalPrize: number;
  };
}

interface Entry {
  id: string;
  uid: string;
  studentName: string;
  picks: string[];
  timestamp: any;
  adminEmail?: string;
}

interface PrizeCriteria {
  rank: number;
  matches: number;
  amount?: number;
}

interface GameState {
  status: 'waiting' | 'drawing' | 'finished';
  winningNumbers: string[];
  round: number;
  numWinners: number;
  prizeCriteria: PrizeCriteria[];
  drawEffect?: 'standard' | 'slot' | 'explosion' | 'card' | 'box' | 'machine' | 'board' | 'marble';
  currentDrawn?: string[];
  theme?: {
    primaryColor: string;
    backgroundColor: string;
    schoolLogoUrl: string;
    currencyUnit?: string;
  };
}

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

export default function App() {
  const [studentName, setStudentName] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [viewMode, setViewMode] = useState<'student' | 'teacher' | 'superadmin'>('student');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [admins, setAdmins] = useState<string[]>([]);

  const urlParams = new URLSearchParams(window.location.search);
  const urlAdmin = urlParams.get('admin');

  const isSuperAdmin = user?.email === "fosvm2@gmail.com" || user?.email === "fosvmd@gmail.com";
  const isTeacher = admins.includes(user?.email || "") || isSuperAdmin;

  // Update viewMode when user logs in
  useEffect(() => {
    if (user?.email) {
      if (isSuperAdmin) setViewMode('superadmin');
      else if (isTeacher) setViewMode('teacher');
    } else {
      setViewMode('student');
    }
  }, [user, isSuperAdmin, isTeacher]);

  const studentAdmin = useMemo(() => {
    if (!studentName) return null;
    // URL에 관리자 정보가 있으면 해당 관리자의 학생만 찾음
    const searchList = urlAdmin ? students.filter(s => s.adminEmail === urlAdmin) : students;
    const s = searchList.find(x => x.name === studentName);
    return s?.adminEmail || urlAdmin || "fosvmd@gmail.com";
  }, [students, studentName, urlAdmin]);

  const activeAdmin = (viewMode === 'teacher' || viewMode === 'superadmin') 
    ? (user?.email || "fosvmd@gmail.com") 
    : (urlAdmin || studentAdmin || "fosvmd@gmail.com");

  const [loginInput, setLoginInput] = useState('');
  const [showLoginSuggestions, setShowLoginSuggestions] = useState(false);

  const loginSuggestions = useMemo(() => {
    if (!loginInput.trim()) return [];
    const searchList = urlAdmin ? students.filter(s => s.adminEmail === urlAdmin) : students;
    return searchList
      .filter(s => s.name.includes(loginInput.trim()))
      .slice(0, 5);
  }, [students, loginInput, urlAdmin]);

  // Auth listener
  useEffect(() => {
    const handleClickOutside = () => setShowLoginSuggestions(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return unsub;
  }, []);

  // Admins listener
  useEffect(() => {
    const unsubAdmins = onSnapshot(collection(db, 'admins'), (snapshot) => {
      setAdmins(snapshot.docs.map(d => d.id));
    }, (err) => {
      console.error("Admins listener error:", err);
      // Fallback to empty if permission denied
      if (err.code === 'permission-denied') setAdmins([]);
    });
    return unsubAdmins;
  }, []);

  // Firestore listeners
  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const studentData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      setStudents(studentData);
    }, (err) => console.error("Students error:", err));

    const unsubEntries = onSnapshot(collection(db, 'entries'), (snapshot) => {
      setEntries(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Entry)));
    });

    const unsubGameState = onSnapshot(doc(db, 'gameState', activeAdmin), (snapshot) => {
      if (snapshot.exists()) {
        setGameState(snapshot.data() as GameState);
      } else {
        // Initialize if not exists
        setGameState({
          status: 'waiting',
          winningNumbers: [],
          round: 1,
          numWinners: 5,
          drawEffect: 'board',
          prizeCriteria: [
            { rank: 1, matches: 5, amount: 1000 },
            { rank: 2, matches: 4, amount: 500 },
            { rank: 3, matches: 3, amount: 100 }
          ],
          theme: {
            primaryColor: '#f59e0b',
            backgroundColor: '#0f172a',
            schoolLogoUrl: '',
            currencyUnit: '코인'
          }
        });
      }
    });

    setIsInitialized(true);
    return () => {
      unsubStudents();
      unsubEntries();
      unsubGameState();
    };
  }, [activeAdmin]);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginModalContent, setLoginModalContent] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleAdminSignIn = async () => {
    try {
      setIsLoggingIn(true);
      await signIn();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogin = () => {
    const name = loginInput.trim();
    if (!name) {
      setLoginModalContent("이름을 입력해주세요.");
      setIsLoginModalOpen(true);
      return;
    }
    const exists = students.some(s => s.name === name);
    if (!exists) {
      setLoginModalContent("등록되지 않은 이름입니다. 관리자에게 문의하세요.");
      setIsLoginModalOpen(true);
      return;
    }
    setStudentName(name);
  };

  if (!isInitialized) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><Loader2 className="w-8 h-8 animate-spin text-yellow-400" /></div>;

  // 로그인 화면 (이름 입력)
  if (!studentName && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4 text-white">
        <Modal 
          isOpen={isLoginModalOpen} 
          onClose={() => setIsLoginModalOpen(false)} 
          title="알림"
          footer={
            <button 
              onClick={() => setIsLoginModalOpen(false)} 
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold"
            >
              확인
            </button>
          }
        >
          <p className="text-slate-600">{loginModalContent}</p>
        </Modal>
        <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl border border-slate-800 max-w-md w-full text-center">
          <div className="flex justify-end mb-6">
            <button 
              onClick={handleAdminSignIn}
              disabled={isLoggingIn}
              className="text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl transition-all border border-slate-700 flex items-center gap-1.5 shadow-sm"
            >
              {isLoggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />}
              <span>{isLoggingIn ? "구글 로그인 중..." : "선생님/관리자 로그인"}</span>
            </button>
          </div>
          <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
          <h1 className="text-3xl font-black mb-2">우리반 로또</h1>
          <p className="text-slate-400 mb-8">이름을 입력하고 입장하세요!</p>
          <div className="relative mb-4" onClick={(e) => e.stopPropagation()}>
            <input 
              type="text"
              value={loginInput}
              onChange={(e) => {
                setLoginInput(e.target.value);
                setShowLoginSuggestions(true);
              }}
              onFocus={() => setShowLoginSuggestions(true)}
              placeholder="이름을 입력하세요"
              className="w-full bg-slate-800 border-slate-700 text-white p-4 rounded-xl"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <AnimatePresence>
              {showLoginSuggestions && loginSuggestions.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute left-0 right-0 top-full mt-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden z-50 shadow-2xl"
                >
                  {loginSuggestions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setLoginInput(s.name);
                        setShowLoginSuggestions(false);
                      }}
                      className="w-full p-3 text-left hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0"
                    >
                      {s.name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold p-4 rounded-xl transition-all"
          >
            입장하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen text-slate-100 pb-20 font-sans transition-colors duration-500"
      style={{ backgroundColor: gameState?.theme?.backgroundColor || '#020617' }}
    >
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {gameState?.theme?.schoolLogoUrl ? (
              <img src={gameState.theme.schoolLogoUrl} alt="Logo" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
            ) : (
              <Trophy className="w-6 h-6 text-yellow-500" />
            )}
            <span className="font-bold text-lg">우리반 로또</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              {viewMode === 'superadmin' ? "최고 관리자" : (viewMode === 'teacher' ? "선생님" : studentName)}님
            </span>
            {isTeacher && (
              <div className="flex bg-slate-800 rounded-full p-1">
                <button 
                  onClick={() => setViewMode('student')}
                  className={cn("text-[10px] px-3 py-1 rounded-full font-bold transition-all", viewMode === 'student' ? "bg-yellow-500 text-slate-900" : "text-slate-400")}
                >
                  학생
                </button>
                <button 
                  onClick={() => setViewMode('teacher')}
                  className={cn("text-[10px] px-3 py-1 rounded-full font-bold transition-all", viewMode === 'teacher' ? "bg-blue-500 text-white" : "text-slate-400")}
                >
                  교사
                </button>
                {isSuperAdmin && (
                  <button 
                    onClick={() => setViewMode('superadmin')}
                    className={cn("text-[10px] px-3 py-1 rounded-full font-bold transition-all", viewMode === 'superadmin' ? "bg-purple-500 text-white" : "text-slate-400")}
                  >
                    관리자
                  </button>
                )}
              </div>
            )}
            <button onClick={() => { 
              if (user) logOut();
              else setStudentName(null); 
            }} className="text-slate-500 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {viewMode === 'superadmin' && isSuperAdmin ? (
          <SuperAdminView students={students} entries={entries} admins={admins} />
        ) : viewMode === 'teacher' && isTeacher ? (
          <TeacherView 
            students={students} 
            entries={entries} 
            gameState={gameState} 
            admins={admins} 
            user={user}
          />
        ) : (
          <StudentView studentName={studentName!} students={students} entries={entries} gameState={gameState} />
        )}
      </main>
    </div>
  );
}

// --- Super Admin View ---
// --- Components ---

function Modal({ isOpen, onClose, title, children, footer }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode, footer?: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <Trash2 className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
        {footer && (
          <div className="p-6 bg-slate-50 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function SuperAdminView({ students, entries, admins }: { 
  students: Student[], 
  entries: Entry[], 
  admins: string[] 
}) {
  const [newAdminEmail, setNewAdminEmail] = useState('');

  const addAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    await setDoc(doc(db, 'admins', newAdminEmail.trim()), { email: newAdminEmail.trim() });
    setNewAdminEmail('');
  };

  const deleteAdmin = async (email: string) => {
    if (!confirm(`${email} 관리자를 삭제하시겠습니까?`)) return;
    await deleteDoc(doc(db, 'admins', email));
  };

  const teacherStats = useMemo(() => {
    const stats: Record<string, { studentCount: number, entryCount: number }> = {};
    
    // Include super admin and all registered admins
    const allAdmins = Array.from(new Set(["fosvm2@gmail.com", "fosvmd@gmail.com", ...admins]));
    
    allAdmins.forEach(email => {
      stats[email] = { studentCount: 0, entryCount: 0 };
    });

    students.forEach(s => {
      const email = s.adminEmail || "fosvmd@gmail.com";
      if (!stats[email]) stats[email] = { studentCount: 0, entryCount: 0 };
      stats[email].studentCount++;
    });

    entries.forEach(e => {
      const email = e.adminEmail || "fosvmd@gmail.com";
      if (!stats[email]) stats[email] = { studentCount: 0, entryCount: 0 };
      stats[email].entryCount++;
    });

    return Object.entries(stats).map(([email, data]) => ({
      email,
      ...data
    })).sort((a, b) => b.studentCount - a.studentCount);
  }, [students, entries, admins]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-purple-100 rounded-2xl">
              <ShieldCheck className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-slate-500 font-bold uppercase text-xs tracking-wider">총 교사 수</h3>
          </div>
          <p className="text-3xl font-black text-slate-900">{teacherStats.length}명</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-blue-100 rounded-2xl">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-slate-500 font-bold uppercase text-xs tracking-wider">총 등록 학생</h3>
          </div>
          <p className="text-3xl font-black text-slate-900">{students.length}명</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-green-100 rounded-2xl">
              <Ticket className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-slate-500 font-bold uppercase text-xs tracking-wider">총 응모 내역</h3>
          </div>
          <p className="text-3xl font-black text-slate-900">{entries.length}건</p>
        </div>
      </div>

      <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-900">
          <LayoutDashboard className="w-5 h-5 text-slate-600" />
          교사별 학급 현황
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-4 font-bold text-slate-500 text-xs uppercase tracking-wider">교사 이메일</th>
                <th className="pb-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-center">학생 수</th>
                <th className="pb-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-center">응모 수</th>
                <th className="pb-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-right">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {teacherStats.map((teacher) => (
                <tr key={teacher.email} className="group hover:bg-slate-50 transition-colors">
                  <td className="py-4 font-medium text-slate-700">{teacher.email}</td>
                  <td className="py-4 text-center font-bold text-slate-900">{teacher.studentCount}</td>
                  <td className="py-4 text-center font-bold text-slate-900">{teacher.entryCount}</td>
                  <td className="py-4 text-right">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                      teacher.studentCount > 0 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
                    )}>
                      {teacher.studentCount > 0 ? "활성" : "대기"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Admin Management */}
      <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-900">
          <Settings className="w-5 h-5 text-slate-600" />
          관리자 권한 관리
        </h2>
        <div className="flex gap-2 mb-6">
          <input 
            type="email" 
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            placeholder="추가할 관리자 이메일 입력"
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            onKeyDown={(e) => e.key === 'Enter' && addAdmin()}
          />
          <button 
            onClick={addAdmin}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2 font-bold transition-all"
          >
            <Plus className="w-4 h-4" />
            관리자 추가
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {admins.map(email => (
            <div key={email} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-purple-200 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-xs">
                  {email[0].toUpperCase()}
                </div>
                <span className="font-medium text-slate-900 text-sm truncate max-w-[150px]">{email}</span>
              </div>
              {email !== "fosvmd@gmail.com" && email !== "fosvm2@gmail.com" && (
                <button 
                  onClick={() => deleteAdmin(email)}
                  className="text-slate-300 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// --- Teacher View ---
function TeacherView({ students, entries, gameState, admins, user }: { 
  students: Student[], 
  entries: Entry[], 
  gameState: GameState | null,
  admins: string[],
  user: FirebaseUser | null
}) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'settings'>('dashboard');
  const [newStudentName, setNewStudentName] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [numWinners, setNumWinners] = useState(gameState?.numWinners || 5);
  const [drawEffect, setDrawEffect] = useState<'standard' | 'slot' | 'explosion' | 'card' | 'box' | 'machine' | 'board' | 'marble'>(gameState?.drawEffect || 'board');
  const [primaryColor, setPrimaryColor] = useState(gameState?.theme?.primaryColor || '#f59e0b');
  const [backgroundColor, setBackgroundColor] = useState(gameState?.theme?.backgroundColor || '#0f172a');
  const [schoolLogoUrl, setSchoolLogoUrl] = useState(gameState?.theme?.schoolLogoUrl || '');
  const [currencyUnit, setCurrencyUnit] = useState(gameState?.theme?.currencyUnit || '코인');
  const [prizeCriteria, setPrizeCriteria] = useState<PrizeCriteria[]>(gameState?.prizeCriteria || [
    { rank: 1, matches: 5, amount: 1000 },
    { rank: 2, matches: 4, amount: 500 },
    { rank: 3, matches: 3, amount: 100 }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string, content: string, onConfirm: () => void } | null>(null);

  const showConfirm = (title: string, content: string, onConfirm: () => void) => {
    setModalConfig({ title, content, onConfirm });
    setIsModalOpen(true);
  };

  const isAdmin = useMemo(() => {
    if (!user) return false;
    return user.email === "fosvmd@gmail.com" || admins.includes(user.email || "");
  }, [user, admins]);

  // Sync with Firestore updates
  useEffect(() => {
    if (gameState) {
      setNumWinners(gameState.numWinners || 5);
      setDrawEffect(gameState.drawEffect || 'standard');
      if (gameState.prizeCriteria) {
        setPrizeCriteria(gameState.prizeCriteria);
      }
      if (gameState.theme) {
        setPrimaryColor(gameState.theme.primaryColor || '#3b82f6');
        setBackgroundColor(gameState.theme.backgroundColor || '#0f172a');
        setSchoolLogoUrl(gameState.theme.schoolLogoUrl || '');
        setCurrencyUnit(gameState.theme.currencyUnit || '코인');
      }
    }
  }, [gameState]);

  const updateGameSettings = async () => {
    if (!user?.email) return;
    await setDoc(doc(db, 'gameState', user.email), {
      ...gameState,
      numWinners,
      drawEffect,
      prizeCriteria,
      theme: {
        primaryColor,
        backgroundColor,
        schoolLogoUrl,
        currencyUnit
      }
    }, { merge: true });
    setModalConfig({
      title: "알림",
      content: "설정이 저장되었습니다.",
      onConfirm: () => setIsModalOpen(false)
    });
    setIsModalOpen(true);
  };

  const filteredStudents = useMemo(() => {
    if (!user?.email) return [];
    return students
      .filter(s => s.adminEmail === user.email || (!s.adminEmail && user.email === "fosvmd@gmail.com"))
      .sort((a, b) => b.name.localeCompare(a.name));
  }, [students, user?.email]);

  const filteredEntries = useMemo(() => {
    if (!user?.email) return [];
    return entries.filter(e => e.adminEmail === user.email || (!e.adminEmail && user.email === "fosvmd@gmail.com"));
  }, [entries, user?.email]);

  const pendingStudents = useMemo(() => {
    const enteredNames = new Set(filteredEntries.map(e => e.studentName));
    return filteredStudents.filter(s => !enteredNames.has(s.name));
  }, [filteredStudents, filteredEntries]);

  const uniqueEnteredCount = useMemo(() => {
    const enteredNames = new Set(filteredEntries.map(e => e.studentName));
    return enteredNames.size;
  }, [filteredEntries]);

  const entryProgress = useMemo(() => {
    if (filteredStudents.length === 0) return 0;
    return Math.round((uniqueEnteredCount / filteredStudents.length) * 100);
  }, [filteredStudents, uniqueEnteredCount]);

  useEffect(() => {
    console.log("AdminView students:", students);
  }, [students]);

  const totalPrizeAll = useMemo(() => {
    return filteredStudents.reduce((sum, s) => sum + (s.stats?.totalPrize || 0), 0);
  }, [filteredStudents]);

  const resetCumulativeStats = async () => {
    showConfirm(
      "누적 통계 초기화", 
      "모든 학생의 누적 당첨금 및 당첨 횟수 기록을 삭제하시겠습니까?", 
      async () => {
        const batch = writeBatch(db);
        filteredStudents.forEach(s => {
          batch.update(doc(db, 'students', s.id), {
            stats: { wins: {}, totalPrize: 0 }
          });
        });
        await batch.commit();
        setIsModalOpen(false);
      }
    );
  };

  const resetAllTickets = async () => {
    showConfirm(
      "응모권 초기화", 
      "모든 학생의 응모권 개수를 1개로 초기화하시겠습니까?", 
      async () => {
        const batch = writeBatch(db);
        filteredStudents.forEach(s => {
          batch.update(doc(db, 'students', s.id), { tickets: 1 });
        });
        await batch.commit();
        setIsModalOpen(false);
      }
    );
  };

  const addStudent = async () => {
    if (!newStudentName.trim() || !user?.email) return;
    await addDoc(collection(db, 'students'), { 
      name: newStudentName.trim(),
      tickets: 1,
      adminEmail: user.email
    });
    setNewStudentName('');
  };

  const updateTickets = async (id: string, tickets: number) => {
    if (tickets < 1) return;
    await updateDoc(doc(db, 'students', id), { tickets });
  };

  const deleteStudent = async (id: string) => {
    await deleteDoc(doc(db, 'students', id));
  };

  const deleteAllStudents = async () => {
    showConfirm(
      "학생 전체 삭제", 
      "모든 학생 명단을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.", 
      async () => {
        const batch = writeBatch(db);
        filteredStudents.forEach(s => {
          batch.delete(doc(db, 'students', s.id));
        });
        await batch.commit();
        setIsModalOpen(false);
      }
    );
  };

  const startDrawing = async () => {
    if (filteredStudents.length < 5) {
      setModalConfig({ 
        title: "알림", 
        content: "학생이 최소 5명 이상 등록되어야 합니다.", 
        onConfirm: () => setIsModalOpen(false) 
      });
      setIsModalOpen(true);
      return;
    }
    if (!user?.email) return;
    await setDoc(doc(db, 'gameState', user.email), {
      ...gameState,
      status: 'drawing',
      winningNumbers: []
    });
  };

  const resetGame = async () => {
    showConfirm(
      "게임 초기화", 
      "모든 응모 내역과 학생들의 누적 통계를 초기화할까요?", 
      async () => {
        const batch = writeBatch(db);
        
        // 1. Delete current teacher's entries
        filteredEntries.forEach(e => {
          batch.delete(doc(db, 'entries', e.id));
        });

        // 2. Reset this teacher's student stats
        filteredStudents.forEach(s => {
          batch.update(doc(db, 'students', s.id), {
            stats: { wins: {}, totalPrize: 0 }
          });
        });

        // 3. Reset Game State (preserving settings like currency, theme, criteria)
        batch.update(doc(db, 'gameState', user!.email!), {
          status: 'waiting',
          winningNumbers: [],
          currentDrawn: [],
          round: 1
        });

        await batch.commit();
        setIsModalOpen(false);
      }
    );
  };

  const nextRound = async () => {
    showConfirm(
      "다음 라운드 시작", 
      "응모 내역을 유지한 채로 새로운 추첨을 시작할까요?", 
      async () => {
        await setDoc(doc(db, 'gameState', user!.email!), {
          ...gameState,
          status: 'waiting',
          winningNumbers: [],
          currentDrawn: [],
          round: (gameState?.round || 0) + 1
        });
        setIsModalOpen(false);
      }
    );
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { "이름": "홍길동", "응모권": 1 }, 
      { "이름": "김철수", "응모권": 2 }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "학생명단");
    XLSX.writeFile(wb, "우리반_학생명단_양식.xlsx");
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const studentRows = data.map(row => ({
          name: (row["이름"] || row["name"])?.toString().trim(),
          tickets: parseInt(row["응모권"] || row["tickets"]) || 1
        })).filter(row => row.name);
        
        if (studentRows.length === 0) {
          setModalConfig({
            title: "알림",
            content: "엑셀 파일에서 이름을 찾을 수 없습니다. '이름' 열이 있는지 확인해주세요.",
            onConfirm: () => setIsModalOpen(false)
          });
          setIsModalOpen(true);
          return;
        }

        showConfirm(
          "학생 추가",
          `${studentRows.length}명의 학생을 추가하시겠습니까?`,
          async () => {
            const batch = writeBatch(db);
            studentRows.forEach(row => {
              const newDocRef = doc(collection(db, 'students'));
              batch.set(newDocRef, {
                name: row.name,
                tickets: row.tickets,
                adminEmail: user?.email
              });
            });
            await batch.commit();
            setModalConfig({
              title: "알림",
              content: "학생 추가가 완료되었습니다.",
              onConfirm: () => setIsModalOpen(false)
            });
            setIsModalOpen(true);
          }
        );
      } catch (err) {
        console.error("Excel upload error:", err);
        setModalConfig({
          title: "오류",
          content: "엑셀 파일을 읽는 중 오류가 발생했습니다.",
          onConfirm: () => setIsModalOpen(false)
        });
        setIsModalOpen(true);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const exportResults = () => {
    if (!gameState?.winningNumbers || gameState.winningNumbers.length === 0) {
      setModalConfig({
        title: "알림",
        content: "추첨 결과가 없습니다.",
        onConfirm: () => setIsModalOpen(false)
      });
      setIsModalOpen(true);
      return;
    }

    const results = filteredEntries.map(entry => {
      const matches = entry.picks.filter(p => gameState.winningNumbers.includes(p)).length;
      const criteria = prizeCriteria.find(c => c.matches === matches);
      return {
        "이름": entry.studentName,
        "선택한 번호": entry.picks.join(", "),
        "맞춘 개수": matches,
        "등수": criteria ? `${criteria.rank}등` : "꽝"
      };
    }).sort((a, b) => {
      if (a.등수 === "꽝") return 1;
      if (b.등수 === "꽝") return -1;
      return parseInt(a.등수) - parseInt(b.등수);
    });

    const ws = XLSX.utils.json_to_sheet(results);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "추첨결과");
    XLSX.writeFile(wb, `추첨결과_라운드${gameState.round}.xlsx`);
  };

  return (
    <div className="space-y-8">
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={modalConfig?.title || ""}
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold">취소</button>
            <button 
              onClick={modalConfig?.onConfirm} 
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200"
            >
              확인
            </button>
          </>
        }
      >
        <p className="text-slate-600">{modalConfig?.content}</p>
      </Modal>

      {/* Tabs Navigation */}
      <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-200 w-fit">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={cn(
            "px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2",
            activeTab === 'dashboard' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <LayoutDashboard className="w-4 h-4" />
          대시보드
        </button>
        <button 
          onClick={() => setActiveTab('students')}
          className={cn(
            "px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2",
            activeTab === 'students' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Users className="w-4 h-4" />
          학생 관리
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={cn(
            "px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2",
            activeTab === 'settings' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Settings className="w-4 h-4" />
          설정
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-2xl">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">참여 학생</h3>
                <p className="text-2xl font-black text-slate-900">{filteredStudents.length}명</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-2xl">
                <Ticket className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">응모 건수</h3>
                <p className="text-2xl font-black text-slate-900">{filteredEntries.length}건</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-2xl">
                <Trophy className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">총 누적 당첨금</h3>
                <p className="text-2xl font-black text-slate-900">{totalPrizeAll.toLocaleString()}{gameState?.theme?.currencyUnit || '코인'}</p>
              </div>
            </div>
          </div>

          {/* Game Control */}
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-900">추첨 컨트롤 타워</h2>
                <p className="text-slate-400">현재 {gameState?.round || 1}라운드가 진행 중입니다.</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowQr(!showQr)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 flex items-center gap-2 font-bold transition-all"
                >
                  <QrCode className="w-4 h-4" />
                  QR 코드
                </button>
                <button 
                  onClick={resetGame}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 rounded-xl text-red-600 flex items-center gap-2 font-bold transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  초기화
                </button>
              </div>
            </div>

            {showQr && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mb-8 flex flex-col items-center p-8 bg-indigo-50 rounded-3xl border border-indigo-100"
              >
                <QRCodeSVG value={`${window.location.origin}${window.location.pathname}?admin=${user?.email}`} size={240} />
                <p className="mt-6 text-indigo-900 font-bold">학생들이 이 QR을 찍고 접속하게 하세요.</p>
                <p className="text-indigo-400 text-sm mt-1">{user?.email} 학급 전용</p>
              </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">응모 현황</span>
                  <span className="text-2xl font-black text-indigo-600">{entryProgress}%</span>
                </div>
                <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden mb-4">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${entryProgress}%` }}
                    className="bg-indigo-600 h-full relative"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                  </motion.div>
                </div>
                <p className="text-sm text-slate-500 font-medium mb-4">
                  총 {filteredStudents.length}명 중 <span className="text-slate-900 font-bold">{uniqueEnteredCount}명</span> 응모 완료
                </p>

                {pendingStudents.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <AlertCircle className="w-3 h-3 text-amber-500" />
                      미응모 학생 명단
                    </p>
                    <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto pr-2 scrollbar-thin">
                      {pendingStudents.map(s => (
                        <span key={s.id} className="px-2 py-1 bg-amber-50 text-[10px] text-amber-700 font-bold rounded-lg border border-amber-100">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-center gap-4">
                {gameState?.status === 'waiting' ? (
                  <button 
                    onClick={startDrawing}
                    className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-3xl font-black text-xl shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-3"
                  >
                    <Play className="w-6 h-6 fill-current" />
                    추첨 시작하기
                  </button>
                ) : (
                  <div className="flex gap-4">
                    <button 
                      onClick={nextRound}
                      className="flex-1 py-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-2xl font-bold transition-all"
                    >
                      다음 라운드
                    </button>
                    <button 
                      onClick={() => setDoc(doc(db, 'gameState', user!.email!), { ...gameState, status: 'drawing' }, { merge: true })}
                      className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 transition-all"
                    >
                      추첨 화면으로
                    </button>
                  </div>
                )}
              </div>
            </div>

            {gameState?.status === 'finished' && (
              <button 
                onClick={exportResults}
                className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-100"
              >
                <FileSpreadsheet className="w-5 h-5" />
                결과 엑셀 다운로드
              </button>
            )}
          </section>

          {gameState?.status === 'drawing' && (
            <DrawingAnimation students={filteredStudents} entries={filteredEntries} gameState={gameState} isAdmin={isAdmin} adminEmail={user?.email || "fosvmd@gmail.com"} />
          )}

          {gameState?.status === 'finished' && (
            <div className="mt-6">
              <ResultsView students={filteredStudents} entries={filteredEntries} gameState={gameState} myEntries={[]} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'students' && (
        <div className="space-y-8">
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900">
                <Users className="w-5 h-5 text-indigo-600" />
                학생 명단 관리 ({filteredStudents.length}명)
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={downloadTemplate}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 flex items-center gap-2 font-bold transition-all text-sm"
                >
                  <Download className="w-4 h-4" />
                  양식 다운로드
                </button>
                <label className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl flex items-center gap-2 font-bold transition-all text-sm cursor-pointer">
                  <Plus className="w-4 h-4" />
                  Excel 업로드
                  <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="hidden" />
                </label>
                <button 
                  onClick={deleteAllStudents}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl flex items-center gap-2 font-bold transition-all text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  전체 삭제
                </button>
                <button 
                  onClick={resetAllTickets}
                  className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl flex items-center gap-2 font-bold transition-all text-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  응모권 초기화
                </button>
              </div>
            </div>

            <div className="flex gap-2 mb-8">
              <input 
                type="text" 
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                placeholder="학생 이름 입력"
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
                onKeyDown={(e) => e.key === 'Enter' && addStudent()}
              />
              <button 
                onClick={addStudent}
                className="bg-indigo-600 text-white px-8 py-3 rounded-2xl hover:bg-indigo-700 flex items-center gap-2 font-bold shadow-lg shadow-indigo-100 transition-all"
              >
                추가
              </button>
            </div>

            {pendingStudents.length > 0 && gameState?.status === 'waiting' && (
              <div className="mb-8 p-6 bg-amber-50 rounded-3xl border border-amber-100">
                <h3 className="text-sm font-bold text-amber-800 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  미응모 학생 ({pendingStudents.length}명)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {pendingStudents.map(s => (
                    <span key={s.id} className="px-3 py-1.5 bg-white border border-amber-200 rounded-xl text-xs text-amber-700 font-bold shadow-sm">
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredStudents.map(s => (
                <div key={s.id} className="p-4 bg-white rounded-2xl border border-slate-100 group hover:border-indigo-200 hover:shadow-md transition-all flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-slate-900 mb-2">{s.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">응모권</p>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => updateTickets(s.id, s.tickets - 1)} 
                          className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-xl font-black text-indigo-600 tabular-nums">{s.tickets}</span>
                        <button 
                          onClick={() => updateTickets(s.id, s.tickets + 1)} 
                          className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteStudent(s.id)}
                      className="text-slate-200 hover:text-red-500 transition-colors p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {s.stats && (s.stats.totalPrize > 0 || Object.keys(s.stats.wins).length > 0) && (
                    <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(s.stats.wins).map(([rank, count]) => (
                          <span key={rank} className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md">
                            {rank}등:{count}회
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] font-black text-slate-900">
                        {s.stats.totalPrize.toLocaleString()}{currencyUnit}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-8">
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-8 text-slate-900">
              <Settings className="w-5 h-5 text-indigo-600" />
              추첨 시스템 설정
            </h2>
            
            <div className="space-y-12">
              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">추첨 시스템 기본 설정</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-3">추첨 인원 ({numWinners}명)</label>
                      <div className="flex items-center gap-4 h-12">
                        <input 
                          type="range" 
                          min="1" 
                          max="20" 
                          value={numWinners} 
                          onChange={(e) => setNumWinners(parseInt(e.target.value))}
                          className="flex-1 accent-indigo-600"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase">추첨 효과 애니메이션 (클릭 시 효과음 미리듣기)</label>
                        <span className="text-[10px] text-indigo-500 font-bold flex items-center gap-1">
                          <Volume2 className="w-3 h-3" /> 모드별 전용 효과음 지원
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-2">
                        {[
                          { id: 'standard', name: '네온 코어', icon: <Atom className="w-5 h-5 text-indigo-400" /> },
                          { id: 'marble', name: '구슬 레이스', icon: <CircleDot className="w-5 h-5 text-amber-400" /> },
                          { id: 'slot', name: '베가스 슬롯', icon: <Coins className="w-5 h-5 text-yellow-400" /> },
                          { id: 'explosion', name: '초신성 폭발', icon: <Flame className="w-5 h-5 text-rose-500" /> },
                          { id: 'card', name: '타로 카드', icon: <Crown className="w-5 h-5 text-purple-400" /> },
                          { id: 'box', name: '황금 보물상자', icon: <Trophy className="w-5 h-5 text-amber-500" /> },
                          { id: 'machine', name: '에어로 볼', icon: <Wind className="w-5 h-5 text-cyan-400" /> },
                          { id: 'board', name: '사이버 전광판', icon: <LayoutDashboard className="w-5 h-5 text-emerald-400" /> }
                        ].map((eff) => (
                          <button
                            key={eff.id}
                            onClick={() => {
                              setDrawEffect(eff.id as any);
                              soundEngine.unlockAudio().then(() => {
                                soundEngine.playWin(eff.id);
                              });
                            }}
                            title={`${eff.name} 선택 및 효과음 미리듣기`}
                            className={cn(
                              "relative group p-2.5 rounded-2xl border-2 transition-all text-center flex flex-col items-center gap-2",
                              drawEffect === eff.id 
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                                : "bg-white border-slate-100 text-slate-600 hover:border-indigo-200"
                            )}
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                              drawEffect === eff.id ? "bg-white/20" : "bg-slate-50 group-hover:bg-indigo-50"
                            )}>
                              {eff.icon}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider whitespace-nowrap">{eff.name}</span>
                            {drawEffect === eff.id && (
                              <motion.div layoutId="active-effect" className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                                <CheckCircle2 className="w-2 h-2 text-white" />
                              </motion.div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">당첨 등수 및 상금 상세 설정</h3>
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                      {[1, 2, 3, 4, 5].map(num => (
                        <button
                          key={num}
                          onClick={() => {
                            let newCriteria = [...prizeCriteria];
                            if (num > prizeCriteria.length) {
                              for (let i = prizeCriteria.length; i < num; i++) {
                                const lastMatches = newCriteria[newCriteria.length - 1]?.matches || 1;
                                newCriteria.push({ rank: i + 1, matches: Math.max(1, lastMatches - 1) });
                              }
                            } else if (num < prizeCriteria.length) {
                              newCriteria = newCriteria.slice(0, num);
                            }
                            setPrizeCriteria(newCriteria);
                          }}
                          className={cn(
                            "w-8 h-8 rounded-lg font-bold text-xs transition-all",
                            prizeCriteria.length === num 
                              ? "bg-indigo-600 text-white shadow-sm" 
                              : "text-slate-500 hover:bg-slate-200"
                          )}
                        >
                          {num}
                        </button>
                      ))}
                      <span className="text-[10px] font-bold text-slate-400 px-2">등</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {prizeCriteria.map((pc, idx) => (
                      <div key={idx} className="bg-slate-50 p-5 rounded-3xl border border-slate-100 group hover:border-indigo-200 transition-all flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black text-white shadow-sm shadow-indigo-100 shrink-0">
                            {pc.rank}
                          </div>
                          <span className="font-bold text-slate-800 text-sm whitespace-nowrap">{pc.rank}등 당첨 조건</span>
                        </div>
                        
                        <div className="space-y-3 mt-auto">
                          <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap shrink-0">맞춘 개수</label>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => {
                                  const newCriteria = [...prizeCriteria];
                                  newCriteria[idx].matches = Math.max(1, newCriteria[idx].matches - 1);
                                  setPrizeCriteria(newCriteria);
                                }}
                                className="w-6 h-6 bg-slate-50 hover:bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-black text-indigo-600 text-sm w-8 text-center">{pc.matches}개</span>
                              <button 
                                onClick={() => {
                                  const newCriteria = [...prizeCriteria];
                                  newCriteria[idx].matches = Math.min(numWinners, newCriteria[idx].matches + 1);
                                  setPrizeCriteria(newCriteria);
                                }}
                                className="w-6 h-6 bg-slate-50 hover:bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap shrink-0">당첨 상금</label>
                            <div className="flex items-center gap-1 justify-end flex-1 min-w-0">
                              <input 
                                type="number"
                                value={pc.amount || 0}
                                onChange={(e) => {
                                  const newCriteria = [...prizeCriteria];
                                  newCriteria[idx].amount = parseInt(e.target.value) || 0;
                                  setPrizeCriteria(newCriteria);
                                }}
                                className="w-full bg-transparent border-none p-0 text-sm font-black text-indigo-600 focus:outline-none focus:ring-0 text-right min-w-[60px]"
                              />
                              <span className="text-[10px] font-bold text-slate-400 shrink-0">{currencyUnit}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <hr className="border-slate-100" />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                  <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-6">브랜딩 및 화폐 설정</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-3">테마 컬러</label>
                        <div className="flex gap-2 flex-wrap">
                          {['#3b82f6', '#4f46e5', '#ec4899', '#f59e0b', '#10b981', '#000000'].map(c => (
                            <button 
                              key={c}
                              onClick={() => setPrimaryColor(c)}
                              className={cn(
                                "w-8 h-8 rounded-full border-2 transition-all",
                                primaryColor === c ? "border-slate-900 scale-110 shadow-md" : "border-white"
                              )}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="md:col-span-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">학교 로고 URL</label>
                        <input 
                          type="text" 
                          value={schoolLogoUrl}
                          onChange={(e) => setSchoolLogoUrl(e.target.value)}
                          placeholder="https://example.com/logo.png"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium text-slate-900 shadow-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">화폐 단위 설정</label>
                        <input 
                          type="text" 
                          value={currencyUnit}
                          onChange={(e) => setCurrencyUnit(e.target.value)}
                          placeholder="원, 코인, 포인트"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-black text-indigo-600 text-center shadow-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 h-full justify-center">
                    <button 
                      onClick={updateGameSettings}
                      className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black text-xl shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                      <ShieldCheck className="w-6 h-6" />
                      추첨 설정 저장하기
                    </button>
                    <button 
                      onClick={resetCumulativeStats}
                      className="w-full py-4 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 rounded-[1.5rem] font-bold text-sm transition-all flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      누적 통계 초기화
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// --- Student View ---
function StudentView({ studentName, students, entries, gameState }: { 
  studentName: string,
  students: Student[], 
  entries: Entry[], 
  gameState: GameState | null 
}) {
  const myEntries = useMemo(() => {
    return entries.filter(e => e.studentName === studentName);
  }, [entries, studentName]);

  const myStudent = useMemo(() => {
    return students.find(s => s.name === studentName);
  }, [students, studentName]);

  const filteredStudents = useMemo(() => {
    if (!myStudent) return [];
    const adminEmail = myStudent.adminEmail || "fosvmd@gmail.com";
    return students.filter(s => s.adminEmail === adminEmail || (!s.adminEmail && adminEmail === "fosvmd@gmail.com"));
  }, [students, myStudent]);

  const filteredEntries = useMemo(() => {
    if (!myStudent) return [];
    const adminEmail = myStudent.adminEmail || "fosvmd@gmail.com";
    return entries.filter(e => e.adminEmail === adminEmail || (!e.adminEmail && adminEmail === "fosvmd@gmail.com"));
  }, [entries, myStudent]);

  const ticketsTotal = myStudent?.tickets || 1;
  const ticketsLeft = ticketsTotal - myEntries.length;

  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [showWinPopup, setShowWinPopup] = useState(false);
  const [winInfo, setWinInfo] = useState<{ rank: number, matches: number } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string, content: string } | null>(null);

  const submitEntry = async () => {
    if (selectedNames.length !== 5 || !myStudent) return;
    
    const adminEmail = myStudent.adminEmail || "fosvmd@gmail.com";
    try {
      await addDoc(collection(db, 'entries'), {
        uid: myStudent.id,
        studentName,
        picks: selectedNames,
        timestamp: Date.now(),
        adminEmail
      });
      setSelectedNames([]);
      setModalConfig({
        title: "응모 완료!",
        content: "성공적으로 응모되었습니다. 행운을 빌어요!"
      });
      setIsModalOpen(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'entries');
      setModalConfig({
        title: "응모 실패",
        content: "응모 처리 중 오류가 발생했습니다. 다시 시도해 주세요."
      });
      setIsModalOpen(true);
    }
  };

  useEffect(() => {
    if (gameState?.status === 'finished' && myEntries.length > 0) {
      const lastEntry = myEntries[myEntries.length - 1];
      const matches = lastEntry.picks.filter(p => gameState.winningNumbers.includes(p)).length;
      const criteria = (gameState.prizeCriteria || []).find(c => c.matches === matches);
      
      if (criteria) {
        setWinInfo({ rank: criteria.rank, matches });
        setShowWinPopup(true);
        soundEngine.unlockAudio().then(() => {
          soundEngine.playWin(gameState?.drawEffect || 'standard');
        });
      }
    }
  }, [gameState?.status, myEntries, gameState?.winningNumbers, gameState?.prizeCriteria, gameState?.drawEffect]);

  return (
    <div className="space-y-8">
      {gameState?.status === 'drawing' ? (
        <StudentRealTimeView 
          studentName={studentName}
          myEntries={myEntries}
          gameState={gameState}
        />
      ) : gameState?.status === 'finished' ? (
        <div className="space-y-8">
          <ResultsView 
            students={filteredStudents} 
            entries={filteredEntries} 
            gameState={gameState} 
            myEntries={myEntries} 
          />

          <Modal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            title={modalConfig?.title || ""}
            footer={
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold"
              >
                확인
              </button>
            }
          >
            <p className="text-slate-600 font-medium">{modalConfig?.content}</p>
          </Modal>
          
          {showWinPopup && winInfo && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
              <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
                <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trophy className="w-10 h-10 text-yellow-600" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 mb-2">축하합니다!</h2>
                <p className="text-slate-500 mb-6">
                  {studentName}님은 <span className="text-indigo-600 font-bold">{winInfo.matches}개</span>를 맞춰<br/>
                  <span className="text-2xl font-black text-indigo-600">{winInfo.rank}등</span>에 당첨되었습니다!<br/>
                  <span className="text-lg font-bold text-emerald-600 mt-2 block">
                    + {( ( (gameState?.prizeCriteria || []).find(c => c.rank === winInfo.rank)?.amount || 0 ) ).toLocaleString()}{gameState?.theme?.currencyUnit || '코인'} 획득!
                  </span>
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">나의 총 누적 상금</p>
                    <p className="text-xl font-black text-indigo-600">
                      {(myStudent?.stats?.totalPrize || 0).toLocaleString()}{gameState?.theme?.currencyUnit || '코인'}
                    </p>
                  </div>
                </p>
                <button 
                  onClick={() => setShowWinPopup(false)}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200"
                >
                  확인
                </button>
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Student Info Card */}
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                <User className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">{studentName}님</h2>
                <p className="text-slate-500 font-medium">반갑습니다! 행운을 빌어요.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">보유 응모권</p>
                <p className="text-2xl font-black text-slate-900">{ticketsTotal}장</p>
              </div>
              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">남은 응모 횟수</p>
                <p className="text-2xl font-black text-indigo-600">{ticketsLeft}회</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 col-span-2">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">나의 총 누적 상금</p>
                <div className="flex items-center justify-between">
                  <p className="text-3xl font-black text-emerald-700">{(myStudent?.stats?.totalPrize || 0).toLocaleString()}{gameState?.theme?.currencyUnit || '코인'}</p>
                  <Trophy className="w-6 h-6 text-emerald-500" />
                </div>
              </div>
            </div>

            {myStudent?.stats && (myStudent.stats.totalPrize > 0 || Object.keys(myStudent.stats.wins).length > 0) && (
              <div className="mt-6 pt-6 border-t border-slate-100 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  나의 누적 당첨 통계
                </p>
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex-1 min-w-[120px]">
                    <p className="text-[10px] font-bold text-emerald-600 mb-1">총 당첨 금액</p>
                    <p className="text-xl font-black text-emerald-700">{(myStudent.stats.totalPrize || 0).toLocaleString()}{gameState?.theme?.currencyUnit || '코인'}</p>
                  </div>
                  <div className="flex-1 min-w-[150px] flex flex-wrap gap-2">
                    {Object.entries(myStudent.stats.wins).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).map(([rank, count]) => (
                      <div key={rank} className="px-3 py-1 bg-white rounded-lg border border-emerald-200 text-xs shadow-sm">
                        <span className="font-bold text-emerald-700">{rank}등</span>
                        <span className="ml-2 font-black text-slate-900">{count}회</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Entry Form */}
          {ticketsLeft > 0 ? (
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-slate-900">번호 선택하기</h3>
                <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                  5개 선택 ({selectedNames.length}/5)
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                {filteredStudents.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (selectedNames.includes(s.name)) {
                        setSelectedNames(selectedNames.filter(n => n !== s.name));
                      } else if (selectedNames.length < 5) {
                        setSelectedNames([...selectedNames, s.name]);
                      }
                    }}
                    className={cn(
                      "p-4 rounded-2xl font-bold transition-all border-2 text-sm",
                      selectedNames.includes(s.name)
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]"
                        : "bg-white border-slate-100 text-slate-600 hover:border-indigo-200"
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </div>

              <button
                onClick={submitEntry}
                disabled={selectedNames.length !== 5}
                className={cn(
                  "w-full py-5 rounded-2xl font-black text-lg transition-all shadow-xl",
                  selectedNames.length === 5
                    ? "bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700"
                    : "bg-slate-100 text-slate-300 cursor-not-allowed shadow-none"
                )}
              >
                응모하기
              </button>
            </section>
          ) : (
            <section className="bg-indigo-600 p-8 rounded-3xl shadow-xl shadow-indigo-200 text-center text-white">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black mb-2">응모 완료!</h3>
              <p className="text-indigo-100 font-medium">추첨이 시작될 때까지 잠시만 기다려주세요.</p>
            </section>
          )}

          {/* My Entries */}
          {myEntries.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 px-2">나의 응모 내역</h3>
              <div className="space-y-3">
                {myEntries.map((entry, idx) => (
                  <div key={entry.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">응모 #{idx + 1}</span>
                      <span className="text-xs font-medium text-slate-400">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {entry.picks.map(pick => (
                        <span key={pick} className="px-3 py-1.5 bg-slate-50 rounded-xl text-sm font-bold text-slate-700 border border-slate-100">
                          {pick}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

import confetti from 'canvas-confetti';

// --- Student Real-time Drawing View ---
function StudentRealTimeView({ studentName, myEntries, gameState }: {
  studentName: string,
  myEntries: Entry[],
  gameState: GameState | null
}) {
  if (!gameState) return null;
  const currentDrawn = gameState.currentDrawn || [];
  
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-ping" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">Live Drawing</span>
            </div>
            <h2 className="text-3xl font-black mb-1 flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-yellow-300" />
              실시간 추첨 현황
            </h2>
            <p className="text-indigo-100 font-medium">현재 선생님이 번호를 추첨하고 있어요!</p>
          </div>

          <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/20 flex items-center gap-4">
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold text-indigo-200 mb-1">진행률</p>
              <p className="text-xl font-black">{currentDrawn.length} / {gameState.numWinners || 5}</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold text-indigo-200 mb-1">기다리는 번호</p>
              <p className="text-xl font-black">{(gameState.numWinners || 5) - currentDrawn.length}개</p>
            </div>
          </div>
        </div>

        {/* Drawn Numbers Bar */}
        <div className="mt-8 flex flex-wrap gap-3">
          {[...Array(gameState.numWinners || 5)].map((_, i) => (
            <motion.div
              key={i}
              initial={currentDrawn[i] ? { scale: 0.8, opacity: 0 } : false}
              animate={currentDrawn[i] ? { scale: 1, opacity: 1 } : {}}
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black transition-all duration-500 border-2",
                currentDrawn[i] 
                  ? "bg-white text-indigo-600 border-white shadow-lg" 
                  : "bg-indigo-700/50 text-indigo-400 border-indigo-500/30"
              )}
            >
              {currentDrawn[i] || i + 1}
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-indigo-600" />
            나의 응모 내역 실시간 확인
          </h3>
          
          <div className="space-y-4">
            {myEntries.map((entry, idx) => {
              const matchedPicks = entry.picks.filter(p => currentDrawn.includes(p));
              const matchCount = matchedPicks.length;
              
              return (
                <motion.div 
                  key={entry.timestamp}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                >
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center justify-center w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold">Slot</span>
                      <span className="text-lg font-black text-slate-700 leading-tight">{idx + 1}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {entry.picks.map((pick, pIdx) => {
                        const isMatch = currentDrawn.includes(pick);
                        return (
                          <span 
                            key={pIdx}
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-300",
                              isMatch 
                                ? "bg-amber-400 text-amber-950 shadow-lg shadow-amber-100 scale-110 border-2 border-amber-200" 
                                : "bg-white text-slate-600 border border-slate-200"
                            )}
                          >
                            {pick}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">현재 일치</p>
                      <p className="text-xl font-black text-slate-900">{matchCount}개</p>
                    </div>
                    {matchCount > 0 && (
                      <div className="px-4 py-2 bg-indigo-50 rounded-2xl flex items-center gap-2">
                        <Sparkles className={cn("w-4 h-4", matchCount >= 3 ? "text-amber-500" : "text-indigo-400")} />
                        <span className="text-xs font-black text-indigo-600">
                          {matchCount === 5 ? "대박! 당첨 예감" : matchCount >= 3 ? "분위기 좋아요!" : "일치 확인!"}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

// --- Drawing Animation ---
function DrawingAnimation({ students, entries, gameState, isAdmin, adminEmail }: { students: Student[], entries: Entry[], gameState: GameState, isAdmin: boolean, adminEmail: string }) {
  console.log("DrawingAnimation rendering. Status:", gameState.status);
  const [drawn, setDrawn] = useState<string[]>(gameState.currentDrawn || []);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentCandidate, setCurrentCandidate] = useState('');
  const [showFlash, setShowFlash] = useState(false);

  // Sync drawn state with Firestore updates
  useEffect(() => {
    if (gameState.currentDrawn && JSON.stringify(gameState.currentDrawn) !== JSON.stringify(drawn)) {
      setDrawn(gameState.currentDrawn);
    }
  }, [gameState.currentDrawn]);
  
  const winners = useMemo(() => {
    if (drawn.length === 0) return [];
    
    const criteria = (gameState.prizeCriteria && gameState.prizeCriteria.length > 0) 
      ? gameState.prizeCriteria 
      : [];

    return entries.map(e => {
      const matches = e.picks.filter(p => drawn.includes(p)).length;
      const criterion = criteria.find(c => c.matches === matches);
      const rank = criterion ? criterion.rank : 0;
      return { ...e, matches, rank };
    }).filter(e => e.rank > 0).sort((a, b) => a.rank - b.rank);
  }, [entries, drawn, gameState.prizeCriteria]);

  const effect = gameState.drawEffect || 'standard';
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Sounds (Web Audio API Sound Engine)
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  useEffect(() => {
    // Attempt auto-unlock on mount
    soundEngine.unlockAudio().then((ready) => {
      if (ready) setAudioUnlocked(true);
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      soundEngine.stopTick(effect);
    };
  }, [effect]);

  // Auto-unlock audio on any interaction within the drawing screen
  useEffect(() => {
    const handleGesture = () => {
      if (!audioUnlocked) {
        soundEngine.unlockAudio().then((ready) => {
          if (ready) setAudioUnlocked(true);
        });
      }
    };
    window.addEventListener('click', handleGesture);
    window.addEventListener('touchstart', handleGesture);
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
    };
  }, [audioUnlocked]);

  const handleCancel = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    soundEngine.stopTick(effect);
    
    await setDoc(doc(db, 'gameState', adminEmail), {
      ...gameState,
      status: 'waiting',
      winningNumbers: [],
      currentDrawn: []
    });
  };

  const unlockAudio = async () => {
    const ok = await soundEngine.unlockAudio();
    if (ok) setAudioUnlocked(true);
  };

  const playTick = () => {
    soundEngine.playTick(effect);
  };

  const stopTick = () => {
    soundEngine.stopTick(effect);
  };

  const playWin = () => {
    soundEngine.playWin(effect);
  };

  const pickNext = async () => {
    console.log("pickNext called. Current drawn count:", drawn.length);
    if (drawn.length >= (gameState.numWinners || 5) || isAnimating) {
      console.log("Cannot pick next: already animating or max winners reached.");
      return;
    }
    
    console.log("Unlocking audio and starting animation...");
    unlockAudio();
    setIsAnimating(true);
    
    // Rolling animation
    let counter = 0;
    const maxCounter = effect === 'slot' ? 40 : (effect === 'box' ? 35 : 25);
    intervalRef.current = setInterval(() => {
      const remaining = students.filter(s => !drawn.includes(s.name));
      const random = remaining[Math.floor(Math.random() * remaining.length)];
      setCurrentCandidate(random.name);
      
      // Play tick sound on each step
      if (counter % 5 === 0) console.log("Animation step:", counter);
      playTick();
      
      counter++;
      
      if (counter > maxCounter) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        stopTick(); // Ensure shaking stops
        const final = remaining[Math.floor(Math.random() * remaining.length)];
        setCurrentCandidate(final.name);
        
        // Win Sound & Confetti
        console.log("Winner determined! Playing win sound...");
        playWin();
        
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 200);

        confetti({
          particleCount: 200,
          spread: 90,
          origin: { y: 0.6 },
          colors: ['#fbbf24', '#f59e0b', '#ffffff', '#3b82f6']
        });

        // Show the name for 2 seconds before adding to drawn list
        setTimeout(() => {
          const newDrawn = [...drawn, final.name];
          setDrawn(newDrawn);
          
          // Update Firestore for real-time student feedback
          setDoc(doc(db, 'gameState', adminEmail), {
            ...gameState,
            currentDrawn: newDrawn
          }, { merge: true });

          setIsAnimating(false);
          setCurrentCandidate('');

          if (newDrawn.length === (gameState.numWinners || 5)) {
            // Record final results to student stats
            if (isAdmin && adminEmail) {
              const recordStats = async () => {
                const resultsByStudent: Record<string, { wins: Record<number, number>, totalPrize: number }> = {};
                
                entries.forEach(entry => {
                  const matches = entry.picks.filter(p => newDrawn.includes(p)).length;
                  const criteriaList = (gameState.prizeCriteria && gameState.prizeCriteria.length > 0) 
                    ? gameState.prizeCriteria 
                    : [];
                  
                  const criterion = criteriaList.find(c => c.matches === matches);
                  if (criterion) {
                    if (!resultsByStudent[entry.studentName]) {
                      resultsByStudent[entry.studentName] = { wins: {}, totalPrize: 0 };
                    }
                    resultsByStudent[entry.studentName].wins[criterion.rank] = (resultsByStudent[entry.studentName].wins[criterion.rank] || 0) + 1;
                    resultsByStudent[entry.studentName].totalPrize += (criterion.amount || 0);
                  }
                });

                const batch = writeBatch(db);
                let hasUpdates = false;
                Object.entries(resultsByStudent).forEach(([name, data]) => {
                  const student = students.find(s => s.name === name);
                  if (student) {
                    const updates: any = {
                      'stats.totalPrize': increment(data.totalPrize)
                    };
                    Object.entries(data.wins).forEach(([rank, count]) => {
                      updates[`stats.wins.${rank}`] = increment(count);
                    });
                    batch.update(doc(db, 'students', student.id), updates);
                    hasUpdates = true;
                  }
                });
                
                if (hasUpdates) {
                  try {
                    await batch.commit();
                    console.log("Recorded cumulative stats for winners");
                  } catch (err) {
                    console.error("Error recording cumulative stats:", err);
                  }
                }
              };
              recordStats();
            }

            setTimeout(() => {
              setDoc(doc(db, 'gameState', adminEmail), {
                ...gameState,
                status: 'finished',
                winningNumbers: newDrawn,
                currentDrawn: newDrawn
              });
            }, 2500);
          }
        }, 2000);
      }
    }, effect === 'slot' ? 50 : 100);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 overflow-hidden"
      style={{ backgroundColor: gameState?.theme?.backgroundColor || '#020617' }}
    >
      {/* Background Atmosphere */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 rounded-full blur-[120px] mix-blend-screen animate-pulse delay-700" />
      </div>

      <div className="relative flex-1 flex flex-col overflow-y-auto scrollbar-hide py-12 px-4">
        <AnimatePresence>
          {showFlash && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white z-[60]"
            />
          )}
        </AnimatePresence>

        {/* School Logo in Drawing */}
        {gameState?.theme?.schoolLogoUrl && (
          <motion.img 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            src={gameState.theme.schoolLogoUrl} 
            className="absolute top-8 left-8 w-16 h-16 object-contain opacity-50 hidden sm:block" 
            referrerPolicy="no-referrer"
          />
        )}

        {/* Cancel Button */}
        {isAdmin && (
          <button 
            onClick={handleCancel}
            className="absolute top-8 right-8 bg-slate-800/80 hover:bg-red-600/80 text-white px-4 py-2 rounded-xl border border-slate-700 transition-all flex items-center gap-2 z-[80] shadow-xl backdrop-blur-md"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm font-bold">중지</span>
          </button>
        )}

        <div className="max-w-4xl mx-auto w-full flex flex-col items-center">
          <motion.h2 
            animate={isAnimating ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="text-2xl sm:text-4xl font-black text-white mb-4 flex items-center justify-center gap-3 text-center"
          >
            <Sparkles style={{ color: gameState?.theme?.primaryColor || '#fbbf24' }} className="w-8 h-8" />
            <span className="drop-shadow-lg">
              {effect === 'standard' && '네온 코어 퀀텀 추첨 중!'}
              {effect === 'marble' && '박진감 넘치는 구슬 레이스!'}
              {effect === 'slot' && '라스베가스 777 잭팟 슬롯!'}
              {effect === 'explosion' && '코스믹 초신성 대폭발 추첨!'}
              {effect === 'card' && '운명의 3D 홀로그램 타로 플립!'}
              {effect === 'box' && '전설의 황금 보물상자 개봉!'}
              {effect === 'machine' && '에어로 볼 토네이도 머신!'}
              {effect === 'board' && '사이버네틱 스테이지 전광판!'}
            </span>
            <Sparkles style={{ color: gameState?.theme?.primaryColor || '#fbbf24' }} className="w-8 h-8" />
          </motion.h2>

          <div className="mb-8 flex flex-col items-center gap-2">
            {!audioUnlocked && (
              <button 
                onClick={unlockAudio}
                className="text-xs bg-slate-800/80 text-slate-400 px-4 py-1.5 rounded-full hover:bg-slate-700 transition-all flex items-center gap-2 border border-slate-700 backdrop-blur-sm"
              >
                <Volume2 className="w-3 h-3" />
                소리가 안 들린다면 클릭하세요
              </button>
            )}
            {audioUnlocked && <p className="text-[10px] text-green-500 uppercase tracking-widest font-bold flex items-center gap-1">Audio Ready <CheckCircle2 className="w-2 h-2" /></p>}
          </div>

          {effect === 'marble' ? (
            <div className="w-full flex justify-center mb-12">
              <MarbleRace 
                students={students}
                numWinners={gameState.numWinners || 5}
                primaryColor={gameState?.theme?.primaryColor || '#fbbf24'}
                onWinnerDetermined={(winnerName, rank) => {
                  const newDrawn = [...drawn, winnerName];
                  setDrawn(newDrawn);
                  setDoc(doc(db, 'gameState', adminEmail), {
                    ...gameState,
                    currentDrawn: newDrawn
                  }, { merge: true });
                }}
                onRaceFinished={async (finalWinners) => {
                  setDrawn(finalWinners);
                  
                  if (isAdmin && adminEmail) {
                    const recordStats = async () => {
                      const resultsByStudent: Record<string, { wins: Record<number, number>, totalPrize: number }> = {};
                      entries.forEach(entry => {
                        const matches = entry.picks.filter(p => finalWinners.includes(p)).length;
                        const criteriaList = (gameState.prizeCriteria && gameState.prizeCriteria.length > 0) 
                          ? gameState.prizeCriteria 
                          : [];
                        const criterion = criteriaList.find(c => c.matches === matches);
                        if (criterion) {
                          if (!resultsByStudent[entry.studentName]) {
                            resultsByStudent[entry.studentName] = { wins: {}, totalPrize: 0 };
                          }
                          resultsByStudent[entry.studentName].wins[criterion.rank] = (resultsByStudent[entry.studentName].wins[criterion.rank] || 0) + 1;
                          resultsByStudent[entry.studentName].totalPrize += (criterion.amount || 0);
                        }
                      });

                      const batch = writeBatch(db);
                      let hasUpdates = false;
                      Object.entries(resultsByStudent).forEach(([name, data]) => {
                        const student = students.find(s => s.name === name);
                        if (student) {
                          const updates: any = {
                            'stats.totalPrize': increment(data.totalPrize)
                          };
                          Object.entries(data.wins).forEach(([rank, count]) => {
                            updates[`stats.wins.${rank}`] = increment(count);
                          });
                          batch.update(doc(db, 'students', student.id), updates);
                          hasUpdates = true;
                        }
                      });
                      if (hasUpdates) {
                        try {
                          await batch.commit();
                          console.log("Recorded cumulative stats for marble winners");
                        } catch (err) {
                          console.error("Error recording cumulative stats:", err);
                        }
                      }
                    };
                    await recordStats();
                  }

                  setDoc(doc(db, 'gameState', adminEmail), {
                    ...gameState,
                    status: 'finished',
                    winningNumbers: finalWinners,
                    currentDrawn: finalWinners
                  });
                }}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center w-full">
            {/* Main Animation Area */}
            <div className={cn(
              "relative w-full flex items-center justify-center",
              effect === 'board' ? "max-w-5xl min-h-[380px] mb-8" : "aspect-video sm:aspect-square max-h-[400px] max-w-2xl mb-12"
            )}>
              {/* Interactive Trigger Overlay */}
              {!isAnimating && drawn.length < (gameState.numWinners || 5) && (
                <motion.button
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={pickNext}
                  style={{ backgroundColor: gameState?.theme?.primaryColor || '#fbbf24' }}
                  className="absolute z-[70] text-slate-900 font-black px-10 py-5 rounded-2xl shadow-2xl flex items-center gap-3 text-2xl border-b-4 border-slate-900/20"
                >
                  <Play className="w-7 h-7 fill-current" />
                  추첨 시작!
                </motion.button>
              )}

        {effect === 'standard' && (
          <StandardOrbEffect 
            students={students}
            currentCandidate={currentCandidate}
            isAnimating={isAnimating}
            drawn={drawn}
            primaryColor={gameState?.theme?.primaryColor || '#fbbf24'}
          />
        )}

        {effect === 'slot' && (
          <SlotMachineEffect 
            students={students}
            currentCandidate={currentCandidate}
            isAnimating={isAnimating}
            drawn={drawn}
            primaryColor={gameState?.theme?.primaryColor || '#fbbf24'}
          />
        )}

        {effect === 'explosion' && (
          <SupernovaExplosionEffect 
            students={students}
            currentCandidate={currentCandidate}
            isAnimating={isAnimating}
            drawn={drawn}
            primaryColor={gameState?.theme?.primaryColor || '#fbbf24'}
          />
        )}

        {effect === 'card' && (
          <MythicCardEffect 
            students={students}
            currentCandidate={currentCandidate}
            isAnimating={isAnimating}
            drawn={drawn}
            primaryColor={gameState?.theme?.primaryColor || '#fbbf24'}
          />
        )}

        {effect === 'box' && (
          <LegendaryBoxEffect 
            students={students}
            currentCandidate={currentCandidate}
            isAnimating={isAnimating}
            drawn={drawn}
            primaryColor={gameState?.theme?.primaryColor || '#fbbf24'}
          />
        )}

        {effect === 'machine' && (
          <AeroMachineEffect 
            students={students}
            currentCandidate={currentCandidate}
            isAnimating={isAnimating}
            drawn={drawn}
            primaryColor={gameState?.theme?.primaryColor || '#fbbf24'}
          />
        )}

        {effect === 'board' && (
          <CyberBoardEffect 
            students={students}
            currentCandidate={currentCandidate}
            isAnimating={isAnimating}
            drawn={drawn}
            primaryColor={gameState?.theme?.primaryColor || '#fbbf24'}
          />
        )}
      </div>

      {/* Drawn Numbers List */}
      <div className="flex justify-center gap-2 sm:gap-4 mb-12 flex-wrap w-full max-w-2xl px-4">
        {[...Array(gameState.numWinners || 5)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              "w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-xs sm:text-lg font-bold border-2 transition-all duration-500",
              drawn[i] 
                ? "bg-yellow-400 border-yellow-200 text-yellow-900 shadow-[0_0_20px_rgba(250,204,21,0.4)] scale-110" 
                : "bg-slate-900/50 border-slate-800 text-slate-600"
            )}
          >
            {drawn[i] || (i === drawn.length && isAnimating ? '...' : i + 1)}
          </motion.div>
        ))}
      </div>

      {/* Real-time Winners List in Drawing Screen */}
      <AnimatePresence>
        {winners.length > 0 && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-2xl bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 mb-12 shadow-2xl"
          >
            <h3 className="text-white font-black text-sm mb-6 flex items-center gap-2 uppercase tracking-widest border-b border-white/10 pb-4">
              <Trophy className="w-4 h-4 text-yellow-400" />
              실시간 당첨 현황
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {winners.map((w, idx) => (
                <motion.div 
                  key={`${w.studentName}-${idx}`}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-col items-center hover:bg-white/10 transition-colors"
                >
                  <div className={cn(
                    "text-[8px] font-black px-2 py-0.5 rounded-full mb-2 uppercase tracking-tighter",
                    w.rank === 1 ? "bg-yellow-400 text-yellow-950" : "bg-indigo-500 text-white"
                  )}>
                    {w.rank}등 당첨!
                  </div>
                  <span className="text-white font-bold text-sm mb-1">{w.studentName}</span>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5 text-yellow-400" />
                    <span className="text-[10px] text-slate-400 font-bold">{w.matches}개 일치</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isAnimating && drawn.length < (gameState.numWinners || 5) && (
        <motion.button
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={pickNext}
          className="bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-950 font-black text-lg sm:text-xl py-5 px-10 rounded-3xl shadow-[0_10px_30px_rgba(251,191,36,0.3)] transition-all flex items-center gap-4 border-b-8 border-orange-700 mb-8"
        >
          <Play className="w-6 h-6 fill-current" />
          {drawn.length + 1}번째 주인공 계속 추첨!
        </motion.button>
      )}
      </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Results View ---
function ResultsView({ students, entries, gameState, myEntries }: { 
  students: Student[], 
  entries: Entry[], 
  gameState: GameState | null,
  myEntries: Entry[]
}) {
  const winners = useMemo(() => {
    if (!gameState?.winningNumbers) return [];
    
    // Fallback criteria if missing in gameState
    const criteria = (gameState.prizeCriteria && gameState.prizeCriteria.length > 0) 
      ? gameState.prizeCriteria 
      : [];

    return entries.map(e => {
      const matches = e.picks.filter(p => gameState.winningNumbers.includes(p)).length;
      const criterion = criteria.find(c => c.matches === matches);
      const rank = criterion ? criterion.rank : 0;
      return { ...e, matches, rank };
    }).filter(e => e.rank > 0).sort((a, b) => a.rank - b.rank);
  }, [entries, gameState]);

  const myResults = useMemo(() => {
    if (!myEntries.length || !gameState?.winningNumbers) return [];
    
    const criteria = (gameState.prizeCriteria && gameState.prizeCriteria.length > 0) 
      ? gameState.prizeCriteria 
      : [];

    return myEntries.map(entry => {
      const matches = entry.picks.filter(p => gameState.winningNumbers.includes(p)).length;
      const criterion = criteria.find(c => c.matches === matches);
      const rank = criterion ? criterion.rank : 0;
      return { entry, matches, rank };
    });
  }, [myEntries, gameState]);

  const hasAnyWin = myResults.some(r => r.rank > 0);

  return (
    <div className="space-y-8">
      {hasAnyWin && <Confetti recycle={false} numberOfPieces={500} />}
      
      {/* Winning Numbers */}
      <section className="bg-slate-900 p-8 rounded-3xl shadow-md border border-slate-800 text-center">
        <h2 className="text-2xl font-bold mb-6 text-white">당첨 친구들</h2>
        <div className="flex justify-center gap-3 flex-wrap">
          {gameState?.winningNumbers.map((n, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: i * 0.1 }}
              style={{ backgroundColor: gameState?.theme?.primaryColor || '#eab308' }}
              className="w-16 h-16 rounded-full flex items-center justify-center text-slate-900 font-bold shadow-lg"
            >
              {n}
            </motion.div>
          ))}
        </div>
      </section>

      {/* My Results */}
      {myResults.length > 0 && (
        <section className="bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-800">
          <h3 className="text-lg font-bold mb-4 text-white">내 결과 ({myResults.length})</h3>
          <div className="space-y-3">
            {myResults.map((res, idx) => (
              <div key={res.entry.id} className="flex items-center justify-between p-4 bg-slate-800 rounded-xl border border-slate-700">
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">#{idx + 1} 응모</span>
                  <div className="flex gap-2">
                    {res.entry.picks.map((p, i) => (
                      <span key={i} className={cn(
                        "px-2 py-1 rounded-lg text-xs font-bold",
                        gameState?.winningNumbers.includes(p) ? "text-slate-900" : "bg-slate-700 text-slate-400"
                      )} style={gameState?.winningNumbers.includes(p) ? { backgroundColor: gameState?.theme?.primaryColor || '#eab308' } : {}}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{res.matches}개 일치</p>
                  <p className={cn(
                    "text-lg font-bold",
                    res.rank > 0 ? "text-yellow-400" : "text-slate-500"
                  )}>
                    {res.rank ? `${res.rank}등 당첨!` : '낙첨'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Leaderboard */}
      <section className="bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-800">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-white">
          <Trophy className="w-5 h-5 text-yellow-500" />
          당첨자 명단
        </h2>
        
        <div className="space-y-3">
          {winners.length > 0 ? winners.map((w, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-slate-800 rounded-xl border border-slate-700">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                  w.rank === 1 ? "text-slate-900" :
                  w.rank === 2 ? "bg-slate-400 text-slate-900" :
                  "bg-orange-600 text-white"
                )} style={w.rank === 1 ? { backgroundColor: gameState?.theme?.primaryColor || '#eab308' } : {}}>
                  {w.rank}
                </div>
                <div>
                  <p className="font-bold text-white">{w.studentName}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {w.picks.map((p, idx) => (
                      <span key={idx} className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded font-medium",
                        gameState?.winningNumbers.includes(p) ? "text-slate-900" : "bg-slate-700 text-slate-400"
                      )} style={gameState?.winningNumbers.includes(p) ? { backgroundColor: gameState?.theme?.primaryColor || '#eab308' } : {}}>
                        {p}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{w.matches}개 일치</p>
                </div>
              </div>
            </div>
          )) : (
            <p className="text-center text-slate-500 py-8">당첨자가 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}
