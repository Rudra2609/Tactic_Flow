import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBIIvd9saVvYFY7083rOKTO0YFXZPZs6t4",
  authDomain: "chessx-2609.firebaseapp.com",
  projectId: "chessx-2609",
  storageBucket: "chessx-2609.firebasestorage.app",
  messagingSenderId: "772061404867",
  appId: "1:772061404867:web:f34cec49c84b1135d1cc76",
  measurementId: "G-CTH3G1BN1C"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
