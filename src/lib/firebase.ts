import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
const firebaseConfig = {
  apiKey: "AIzaSyA4jefMyJblCxlrI6A1GUeAXvsHlBcI93Q",
  authDomain: "seatidle.firebaseapp.com",
  projectId: "seatidle",
  storageBucket: "seatidle.firebasestorage.app",
  messagingSenderId: "237670859440",
  appId: "1:237670859440:web:2cc7b783913fb2a3e4f175",
  measurementId: "G-0NH5LP7TQ6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
