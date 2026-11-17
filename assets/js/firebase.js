/* ================= الاتصال بـ Firebase (Auth + Firestore) ================= */
// يعتمد على FIREBASE_CONFIG في config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

try {
  const app = initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(app);
  let db;
  // تخزين مؤقت على الجهاز: لو انقطع الإنترنت تُحفظ الإجابات وتُرسل تلقائياً عند عودته
  try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
  catch (e) { db = initializeFirestore(app, {}); }
  const authReady = new Promise(res => { const off = onAuthStateChanged(auth, u => { off(); res(u); }); });
  const S = code => doc(db, "students", code);

  window.FB = {
    // حساب مجهول للطالب (لا يُخرج الأدمن إن كان مسجلاً)
    async ensureAnon() { await authReady; if (!auth.currentUser) await signInAnonymously(auth); return auth.currentUser.uid; },
    // قبل تسجيل دخول طالب: يُخرج حساب الأدمن إن وُجد
    async ensureStudentAuth() { await authReady; if (auth.currentUser && !auth.currentUser.isAnonymous) await signOut(auth); if (!auth.currentUser) await signInAnonymously(auth); return auth.currentUser.uid; },
    uid: () => auth.currentUser ? auth.currentUser.uid : "",
    isAdminUser: () => !!(auth.currentUser && !auth.currentUser.isAnonymous),
    adminEmail: () => auth.currentUser ? auth.currentUser.email : "",
    async ready() { await authReady; },
    async adminLogin(email, pw) { await authReady; await signInWithEmailAndPassword(auth, email, pw); },
    async logout() { await signOut(auth); },
    async getStudent(code) { const s = await getDoc(S(code)); return s.exists() ? s.data() : null; },
    async createStudent(code, data) { await setDoc(S(code), data); },
    async claimStudent(code, name) { await updateDoc(S(code), { uid: auth.currentUser.uid, name, code }); },
    async saveStudent(code, data) { await setDoc(S(code), data, { merge: true }); },
    async setOverride(code, v) { await updateDoc(S(code), { override: v ? v : deleteField() }); },
    async deleteStudent(code) { await deleteDoc(S(code)); },
    async listStudents() { const q = await getDocs(collection(db, "students")); const o = {}; q.forEach(d => { o[d.id] = d.data(); }); return o; },
    async getSettings() { const s = await getDoc(doc(db, "settings", "main")); return s.exists() ? s.data() : null; },
    async saveSettings(d) { await setDoc(doc(db, "settings", "main"), d, { merge: true }); }
  };
  window.dispatchEvent(new Event("fb-ready"));
} catch (e) {
  console.warn("Firebase init failed", e);
  window.dispatchEvent(new Event("fb-fail"));
}
