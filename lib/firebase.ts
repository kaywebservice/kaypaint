"use client";

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAytTHFqbpOSWuA6EiSEJAqGaKbf9qskws",
  authDomain: "kaypaint-d4252.firebaseapp.com",
  projectId: "kaypaint-d4252",
  storageBucket: "kaypaint-d4252.firebasestorage.app",
  messagingSenderId: "287431685710",
  appId: "1:287431685710:web:ec201ca051eb8715f5b51f",
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}

export function getFirebaseAuth(): Auth | null {
  if (typeof window === "undefined") return null;
  const a = getFirebaseApp();
  if (!a) return null;
  if (!auth) auth = getAuth(a);
  return auth;
}

export function getFirestoreDb(): Firestore | null {
  if (typeof window === "undefined") return null;
  const a = getFirebaseApp();
  if (!a) return null;
  if (!db) db = getFirestore(a);
  return db;
}