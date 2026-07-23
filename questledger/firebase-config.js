// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBzCogyORUtEw8efrl8KoeAPPuK0mFQzy8",
  authDomain: "task-tracker-83250.firebaseapp.com",
  projectId: "task-tracker-83250",
  storageBucket: "task-tracker-83250.firebasestorage.app",
  messagingSenderId: "657729804454",
  appId: "1:657729804454:web:a980f2b9e7ca6108e8fc67",
  measurementId: "G-XLS1KS71VZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
