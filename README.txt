بيئة تعلم معززة قائمة على التوجيه الذكي
الطالب يجيب عن مقياس الأساليب المعرفية أولاً، ثم يُوجَّه تلقائياً إلى نمط التوجيه المناسب (تحليلي / كلي) ويدرس كل الأنشطة وفقه.
إعداد: أ.م.د/ منى عبدالوهاب أحمد - كلية التربية النوعية - جامعة الزقازيق

كل صفحة ملف مستقل. الصفحات بترتيب سير الطالب:
  index.html               الرئيسية
  instructions.html        التعليمات
  login.html               تسجيل الدخول
  scale.html               مقياس الأساليب المعرفية
  scale-result.html        نتيجة المقياس
  modules.html             الموديولات
  module1.html             مقدمة الموديول الأول
  module1-goals.html       أهداف الموديول
  pretest.html             الاختبار القبلي
  pretest-result.html      نتيجة الاختبار القبلي
  module1-lessons.html     موضوعات الموديول
  (لكل موضوع ثلاث صفحات: المحتوى / النشاط / التقويم الذاتي)
  lesson1.html / lesson1-activity.html / lesson1-self.html   تعريف صيانة الحاسب الآلي
  lesson2.html / lesson2-activity.html / lesson2-self.html   أهمية صيانة الحاسب الآلي
  lesson3.html / lesson3-activity.html / lesson3-self.html   أنواع صيانة الحاسب الآلي
  lesson4.html / lesson4-activity.html / lesson4-self.html   مكونات الحاسب المرتبطة بالصيانة
  lesson5.html / lesson5-activity.html / lesson5-self.html   أسباب أعطال الحاسب الآلي
  lesson6.html / lesson6-activity.html / lesson6-self.html   أنواع أعطال الحاسب الآلي وتصنيفها
  lesson7.html / lesson7-activity.html / lesson7-self.html   الإجراءات الوقائية والتصحيحية
  lesson8.html / lesson8-activity.html / lesson8-self.html   إجراءات السلامة والأمان أثناء الصيانة
  lesson9.html / lesson9-activity.html / lesson9-self.html   إجراءات الفحص الأولي للحاسب الآلي
  posttest.html            الاختبار البعدي
  posttest-result.html     نتيجة الاختبار البعدي
  summary.html             ملخص الأداء
  admin.html               دخول الأدمن / لوحة الباحث (الرقم السري الافتراضي 2026)

المجلدات
  assets/css/style.css     التصميم (ألوان النسخة في أول الملف)
  assets/js/config.js      الإعدادات: حد تصنيف المقياس، الرقم السري، الشعارات، مفتاح المقياس
  assets/js/module1.js     محتوى الموديول الأول ومفردات الاختبار ومفتاحه
  assets/js/app.js         منطق البيئة
  assets/js/firebase.js    الاتصال بقاعدة البيانات (Firebase Auth + Firestore)
  firestore.rules          قواعد أمان قاعدة البيانات (تُلصق في Firebase Console)
  assets/img/              الشعارات
  assets/scale/            أشكال مفردات المقياس

التشغيل: ارفع المجلد كما هو على استضافة (GitHub Pages مثلاً) وافتح index.html.
البيانات تُحفظ في Firestore (مشروع drmona-77077). لو تعذر الاتصال تعمل البيئة محلياً على الجهاز.
تفعيل قاعدة البيانات (مرة واحدة):
  1) Authentication ← Sign-in method: فعّل Email/Password، وأنشئ حساب الأدمن من Users.
  2) Firestore Database ← Rules: الصق محتوى firestore.rules كما هو، ثم Publish.
  3) Authentication ← Settings ← Authorized domains: أضف دومين الاستضافة.
إضافة الطلاب: من لوحة الأدمن ← إضافة الطلاب (طالب واحد أو قائمة: الاسم، اسم المستخدم، كلمة المرور).
  احفظ كلمات المرور عند الإضافة؛ لا تُحفظ في قاعدة البيانات.
  لتغيير كلمة مرور طالب: احذف حسابه من Authentication ← Users ومن لوحة الأدمن، ثم أضفه من جديد.
