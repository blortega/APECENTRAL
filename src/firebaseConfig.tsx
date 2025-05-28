// firebase.ts
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDHg-hlfPO83e7B0PeoCTBPYkWtW8Xl85o",
  authDomain: "apecentral-d8d32.firebaseapp.com",
  projectId: "apecentral-d8d32",
  storageBucket: "apecentral-d8d32.firebasestorage.app",
  messagingSenderId: "619287319618",
  appId: "1:619287319618:web:42959546be08a486e409db",
  measurementId: "G-SZF7L8GW3Q",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firestore and Auth
const db = getFirestore(app);
const auth = getAuth(app);

// Export instances for use in your components
export { app, analytics, db, auth };
