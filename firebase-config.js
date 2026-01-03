// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCBup5n5fYqvdmSQ_48cYwKifdWuZhOff4",
  authDomain: "mobile-writer.firebaseapp.com",
  projectId: "mobile-writer",
  storageBucket: "mobile-writer.firebasestorage.app",
  messagingSenderId: "279505458644",
  appId: "1:279505458644:web:c2088f04fb214a180d3241",
  measurementId: "G-7NYL4VKDBZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db };
