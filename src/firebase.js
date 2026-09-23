import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB0jqbKqcmnlfUVVSvfJR7CZG8qR6MiWfc",
  authDomain: "demoappcmru.firebaseapp.com",
  projectId: "demoappcmru",
  storageBucket: "demoappcmru.firebasestorage.app",
  messagingSenderId: "850197613162",
  appId: "1:850197613162:web:0dd3ae02f74ea71ba59813",
  measurementId: "G-D0H5HG2YZB"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);