import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth, signInAnonymously, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Automatically sign in anonymously if not already authenticated
export const initAuth = async (): Promise<User | null> => {
  try {
    if (!auth.currentUser) {
      const userCredential = await signInAnonymously(auth);
      return userCredential.user;
    }
    return auth.currentUser;
  } catch (error) {
    console.warn('[Firebase Auth] Anonymous sign-in warning:', error);
    return null;
  }
};

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

// Trigger immediately on load in browser
if (typeof window !== 'undefined') {
  initAuth();
  testConnection();
}

/**
 * Centralized Firestore Error Handler
 * Logs errors, generates human-readable Arabic messages, and presents a non-blocking toast.
 */
export function handleFirestoreError(error: unknown, contextDescription?: string): string {
  console.error(`[Firestore Error${contextDescription ? ` - ${contextDescription}` : ''}]:`, error);
  
  let userFriendlyMsg = 'تعذر إتمام العملية. يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً.';
  
  if (error && typeof error === 'object' && 'code' in error) {
    const errCode = String((error as any).code);
    if (errCode.includes('permission-denied')) {
      userFriendlyMsg = 'تم رفض الإذن (Permission Denied). يرجى مراجعة الصلاحيات أو إعادة تسجيل الدخول.';
    } else if (errCode.includes('unavailable')) {
      userFriendlyMsg = 'تعذر الوصول لقاعدة البيانات. قد يكون هناك انقطاع في الشبكة أو ضغط مؤقت.';
    } else if (errCode.includes('not-found')) {
      userFriendlyMsg = 'السجل المطلوب غير موجود في قاعدة البيانات.';
    } else if (errCode.includes('already-exists')) {
      userFriendlyMsg = 'هذا العنصر مسجل مسبقاً في النظام.';
    }
  } else if (error instanceof Error) {
    if (error.message.includes('permission-denied')) {
      userFriendlyMsg = 'تم رفض إذن العملية (Permission Denied).';
    }
  }

  const fullDisplayMsg = contextDescription ? `${contextDescription}: ${userFriendlyMsg}` : userFriendlyMsg;

  // Render a non-blocking lightweight DOM toast
  if (typeof window !== 'undefined') {
    const existingToast = document.getElementById('fsm-error-banner');
    if (!existingToast) {
      const banner = document.createElement('div');
      banner.id = 'fsm-error-banner';
      banner.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999] bg-red-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-bottom-4 duration-300';
      banner.setAttribute('dir', 'rtl');
      banner.innerHTML = `
        <span class="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
        <span id="fsm-error-text">${fullDisplayMsg}</span>
        <button onclick="this.parentElement.remove()" class="mr-2 text-white/80 hover:text-white font-black text-xs bg-red-700/50 hover:bg-red-700 px-2 py-1 rounded-lg">إغلاق ✕</button>
      `;
      document.body.appendChild(banner);
      setTimeout(() => {
        banner.remove();
      }, 5000);
    } else {
      const textSpan = document.getElementById('fsm-error-text');
      if (textSpan) textSpan.textContent = fullDisplayMsg;
    }
  }

  return fullDisplayMsg;
}
