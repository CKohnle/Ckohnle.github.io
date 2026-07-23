import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js";

import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import { firebaseConfig } from "./tracker-config.js";

const fbApp = initializeApp(firebaseConfig);

getAnalytics(fbApp);

export const auth = getAuth(fbApp);
export const db = getFirestore(fbApp);

export {
  GoogleAuthProvider,
  doc,
  getDoc,
  onAuthStateChanged,
  setDoc,
  signInWithPopup,
  signInWithRedirect
};
