import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Configuration Firebase Web Standard
// NE PAS UTILISER "SERVICE ACCOUNT" ICI.
// Allez dans : Project Settings (Engrenage) -> General -> Your Apps -> Web App (</>)
// Si vous n'avez pas d'app Web, cliquez sur "Add app" (l'icône </>) pour obtenir ces clés.
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialisation de Firebase Client (Compatible GitHub Pages)
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
