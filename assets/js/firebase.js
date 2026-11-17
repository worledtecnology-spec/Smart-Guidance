/* ================= الاتصال بـ Firebase (Auth + Firestore) ================= */
// يعتمد على FIREBASE_CONFIG في config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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
  // حسابات الطلاب: اسم المستخدم يتحول إلى بريد داخلي ثابت (لا يُرسل إليه شيء)
  const DOMAIN = STUDENT_EMAIL_DOMAIN, toEmail = u => `${u}@${DOMAIN}`, isStudentEmail = e => !!e && e.endsWith("@" + DOMAIN);
  let creator = null; // تطبيق ثانوي لإنشاء حسابات الطلاب دون إخراج الأدمن

  window.FB = {
    // الطالب الحالي (اسم المستخدم) إن كان المسجل طالباً
    studentUser: () => auth.currentUser && isStudentEmail(auth.currentUser.email) ? auth.currentUser.email.split("@")[0] : "",
    async studentLogin(u, pw) { await authReady; if (auth.currentUser) await signOut(auth); await signInWithEmailAndPassword(auth, toEmail(u), pw); return auth.currentUser.uid; },
    // الأدمن ينشئ حساب طالب (Authentication) ثم ملفه (Firestore)
    async createStudentAccount(name, u, pw) {
      if (!creator) creator = getAuth(initializeApp(FIREBASE_CONFIG, "student-creator"));
      const cred = await createUserWithEmailAndPassword(creator, toEmail(u), pw);
      const data = { name, code: u, uid: cred.user.uid, created: new Date().toISOString() };
      await signOut(creator);
      await setDoc(S(u), data);
      return data;
    },
    uid: () => auth.currentUser ? auth.currentUser.uid : "",
    isAdminUser: () => !!(auth.currentUser && auth.currentUser.email && !isStudentEmail(auth.currentUser.email)),
    adminEmail: () => auth.currentUser ? auth.currentUser.email : "",
    async ready() { await authReady; },
    async adminLogin(email, pw) { await authReady; await signInWithEmailAndPassword(auth, email, pw); },
    async logout() { await signOut(auth); },
    async getStudent(code) { const s = await getDoc(S(code)); return s.exists() ? s.data() : null; },
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
