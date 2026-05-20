import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, enableMultiTabIndexedDbPersistence, getDocFromServer, doc } from 'firebase/firestore';

// Firebase config is read from Vite environment variables (.env file).
// Copy .env.example → .env and fill in your Firebase project values.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_FIRESTORE_ID || '(default)';

const app = initializeApp(firebaseConfig);
console.log("Firebase Initialized with Project:", firebaseConfig.projectId);
export const db = getFirestore(app, firestoreDatabaseId);

// Enable robust offline persistence
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Persistence failed: Browser does not support it');
    }
  });
}

// Validate Connection to Firestore with retry
async function testConnection(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      // Attempt to fetch a doc from server to verify connectivity
      await getDocFromServer(doc(db, '_system_', 'connectivity_probe'));
      console.log("Firestore Connection: Verified");
      return;
    } catch (error) {
      const isOffline = error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('unavailable'));
      
      if (isOffline && i < retries - 1) {
        console.warn(`Firestore Connection: Attempt ${i + 1} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      if (isOffline) {
        console.error("CRITICAL: Firestore is unreachable. The application will operate in offline mode.");
      } else {
        // If it's just 'not-found', the connection is actually working
        console.log("Firestore Connection: Verified (Path ready)");
      }
      break;
    }
  }
}
testConnection();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const login = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  let friendlyMessage = "An unexpected error occurred while accessing data.";
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (errorMessage.includes('permission-denied')) {
    friendlyMessage = "Access Denied: You don't have permission to perform this action.";
  } else if (errorMessage.includes('not-found')) {
    friendlyMessage = "Not Found: The requested data could not be found.";
  } else if (errorMessage.includes('unauthenticated')) {
    friendlyMessage = "Authentication Error: Please log in to continue.";
  } else if (errorMessage.includes('offline')) {
    friendlyMessage = "Network Error: You are currently offline.";
  } else if (errorMessage.includes('already-exists')) {
    friendlyMessage = "Conflict: This record already exists.";
  }

  // Display friendly toast
  const toast = document.createElement('div');
  toast.textContent = friendlyMessage;
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:rgba(239,68,68,0.9);backdrop-filter:blur(8px);color:white;padding:12px 24px;border-radius:12px;z-index:99999;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;box-shadow:0 8px 32px rgba(239,68,68,0.2);border:1px solid rgba(255,255,255,0.1);animation:slideIn 0.3s ease-out forwards;';
  
  // Add keyframes if not exists
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = '@keyframes slideIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } } @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }';
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-out forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);

  const errInfo = {
    error: errorMessage,
    friendlyMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error(`Firestore Error [${operationType} at ${path}]:`, friendlyMessage);
  
  if (errorMessage.includes('permission-denied')) {
    console.error('Firestore Permission Error: ', JSON.stringify(errInfo));
    // We no longer throw the error here to prevent the ErrorBoundary from crashing the entire app.
    // The toast notification will still inform the user.
  }
}
