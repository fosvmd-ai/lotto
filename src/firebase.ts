import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signIn = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    console.error("Firebase Login Error:", error);
    if (error.code === 'auth/unauthorized-domain') {
      alert(
        `[Firebase 승인 도메인 등록 필요]\n현재 도메인(${window.location.hostname})이 Firebase Authentication에 등록되지 않았습니다.\n\n해결 방법:\n1. Firebase 콘솔 접속\n2. Authentication > Settings > Authorized domains(승인된 도메인)\n3. '${window.location.hostname}' 추가`
      );
    } else if (error.code === 'auth/popup-blocked') {
      alert("브라우저 팝업이 차단되었습니다. 주소창의 팝업 차단을 해제하고 다시 시도해 주세요.");
    } else if (error.code !== 'auth/popup-closed-by-user') {
      alert(`로그인 오류: ${error.message} (코드: ${error.code})`);
    }
    throw error;
  }
};
export const logOut = () => signOut(auth);
