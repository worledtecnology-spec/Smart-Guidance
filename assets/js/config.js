/* ================= إعدادات النسخة (يعدلها الباحث) ================= */
// نمط التوجيه (تحليلي / كلي) يتحدد لكل طالب في كل موضوع من أدائه، بقواعد النظام الخبير (app.js: RULES)
const CONFIG = {
  pin: "2026"         // الرقم السري للأدمن في الوضع المحلي فقط (لو تعذر الاتصال بقاعدة البيانات)
};
// إعدادات مشروع Firebase (Firestore + Authentication)
// نطاق داخلي لحسابات الطلاب: اسم المستخدم "s101" يصبح s101@students.smart-guidance.app (لا يُرسل إليه بريد)
const STUDENT_EMAIL_DOMAIN = "students.smart-guidance.app";
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA5GQmimLhIgh0Vwts58KUIM0TmjCKQsxk",
  authDomain: "drmona-77077.firebaseapp.com",
  projectId: "drmona-77077",
  storageBucket: "drmona-77077.firebasestorage.app",
  messagingSenderId: "23509301323",
  appId: "1:23509301323:web:98f0f8a36a3b60b72df5ce"
};
const LOGOS = { uni:"assets/img/logo-university.jpg", fac:"assets/img/logo-faculty.jpg" };

// تلميحات التوجيه التحليلي عند الخطأ في أنشطة التصنيف (رقم الموضوع يبدأ من 0)
const HINT_A = {2:"حدد توقيت الإجراء في هذه الحالة: هل نُفذ قبل العطل، أم بعد ظهوره، أم بناءً على مؤشرات تتوقعه؟",
  5:"حدد أولًا ما الذي تعطل في هذه البطاقة: قطعة مادية، أم برنامج أو نظام؟",
  6:"حدد توقيت هذا الإجراء: هل يُنفذ قبل ظهور المشكلة أم بعد اكتشافها؟",
  7:"قارن هذه الممارسة بقاعدة السلامة التي تخصها: ما الخطر المحتمل منها؟"};
