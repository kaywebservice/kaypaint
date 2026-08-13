import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { getFirebaseAuth, getFirestoreDb } from "@/lib/firebase";
import { usePluginStore } from "@/store/pluginStore";

const USER_KEY = "kaypaint:user";

export function notifyUserChanged() {
  window.dispatchEvent(new Event("kaypaint:user-changed"));
}

export function subscribeAuth(fn: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) return () => {};
  return onAuthStateChanged(auth, (u) => {
    if (u) syncLicensesToLocal().catch(() => {});
    fn(u);
  });
}

export async function signInWithEmail(email: string, password: string, createAccount: boolean): Promise<User | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  const cred = createAccount
    ? await createUserWithEmailAndPassword(auth, email, password)
    : await signInWithEmailAndPassword(auth, email, password);
  try {
    localStorage.setItem(USER_KEY, cred.user.email ?? email);
  } catch {
    /* ignore */
  }
  notifyUserChanged();
  await syncLicensesToLocal();
  return cred.user;
}

export async function signOutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) await fbSignOut(auth);
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
  notifyUserChanged();
}

export async function pushLicense(pluginId: string, kind: string): Promise<void> {
  const auth = getFirebaseAuth();
  const db = getFirestoreDb();
  const user = auth?.currentUser;
  if (!auth || !db || !user) return;
  const ref = doc(db, "licenses", `${user.uid}_${pluginId}`);
  await setDoc(
    ref,
    { userId: user.uid, pluginId, kind, acquiredAt: Date.now() },
    { merge: true }
  );
}

export async function syncLicensesToLocal(): Promise<void> {
  const auth = getFirebaseAuth();
  const db = getFirestoreDb();
  const user = auth?.currentUser;
  if (!auth || !db || !user) return;
  const snap = await getDocs(query(collection(db, "licenses"), where("userId", "==", user.uid)));
  const ids = snap.docs.map((d) => String(d.data().pluginId ?? ""));
  usePluginStore.getState().importLicenses(ids);
}

export async function hasCloudLicenses(): Promise<boolean> {
  const auth = getFirebaseAuth();
  const db = getFirestoreDb();
  const user = auth?.currentUser;
  if (!auth || !db || !user) return false;
  const snap = await getDocs(query(collection(db, "licenses"), where("userId", "==", user.uid)));
  return !snap.empty;
}

export function isSignedIn(): boolean {
  return !!getFirebaseAuth()?.currentUser;
}

export function currentUserEmail(): string | null {
  return getFirebaseAuth()?.currentUser?.email ?? null;
}