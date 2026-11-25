"use strict";
/* ================= أساسيات ================= */
const PAGE = document.body.dataset.page || "home";
const PI = document.body.dataset.i != null ? +document.body.dataset.i : null;
// نمط التوجيه يتحدد لكل طالب في كل موضوع من أدائه (نظام خبير قائم على القواعد)
let A = false, PNAME = "";
const NL = MOD.lessons.length;
const LETTERS = ["أ","ب","ج","د"];
const SNAME = {analytic:"تحليلي", holistic:"كلي"};
const TITLE = "تصميم بيئة تعلم معززة قائمة على التوجيه الذكي وأثرها في تنمية مهارات صيانة الحاسب الآلي والتفكير المنظومي لدى طلاب تكنولوجيا التعليم";

/* ================= التخزين ================= */
const LS = "smart-guidance-adaptive-v1";
let DB = {students:{}, cfg:{}};
try{ const s = localStorage.getItem(LS); if(s) DB = Object.assign(DB, JSON.parse(s)); }catch(e){}
function save(){ try{ localStorage.setItem(LS, JSON.stringify(DB)); }catch(e){} schedulePush(); }
/* ---- المزامنة مع Firebase: ONLINE = متصل بقاعدة البيانات ---- */
let ONLINE = false, pushT = null, pushFails = 0;
function schedulePush(){ if(!ONLINE || !me || !DB.students[me]) return; clearTimeout(pushT); pushT = setTimeout(push, 700); }
function payload(st){ const d = JSON.parse(JSON.stringify(st)); delete d.override; d.uid = FB.uid(); d.updated = Date.now(); return d; }
function push(){
  clearTimeout(pushT);
  if(!ONLINE || !me || !DB.students[me]) return Promise.resolve();
  return FB.saveStudent(me, payload(DB.students[me])).then(()=>{ pushFails = 0; syncNote(""); })
    .catch(e=>{ pushFails++; console.warn("save failed", e); syncNote(e && e.code==="permission-denied" ? "تعذر حفظ بياناتك. سجل الدخول مرة أخرى." : "تعذر الحفظ على الخادم الآن. ستُرسل إجاباتك تلقائياً عند عودة الاتصال."); });
}
function flush(){ if(!ONLINE || !me) return Promise.resolve(); return Promise.race([push(), new Promise(r=>setTimeout(r, 2500))]); }
function syncNote(msg){ let n = document.getElementById("sync"); if(!n){ n = document.createElement("div"); n.id = "sync"; n.setAttribute("role","status"); document.body.appendChild(n); } n.textContent = msg; n.classList.toggle("on", !!msg); }
let saveT = null; function saveSoon(){ clearTimeout(saveT); saveT = setTimeout(save, 400); }
let me = null;
try{ me = sessionStorage.getItem(LS+"-me"); }catch(e){ me = DB.cur || null; }
if(me && !DB.students[me]) me = null;
function setMe(c){ me = c; try{ if(c) sessionStorage.setItem(LS+"-me", c); else sessionStorage.removeItem(LS+"-me"); }catch(e){ DB.cur = c; save(); } }
const S = () => me ? DB.students[me] : null;
function M(){ const st = S(); if(!st.m) st.m = {start:Date.now(), r:{}, c:{}, f:{}, p:{}, err:0}; return st.m; }

const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ic = (n, cls="") => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const median = a => { const v = a.slice().sort((x,y)=>x-y), n = v.length; return n ? (n%2 ? v[(n-1)/2] : (v[n/2-1]+v[n/2])/2) : 0; };
// وسيط زمن الاستجابة (بالمللي ثانية) للمفردات الصحيحة، أو لكل المفردات إذا كانت الصحيحة أقل من 4
const fmt = sec => { sec = Math.round(sec); return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0"); };

/* ================= التوجيه الذكي: نظام خبير قائم على القواعد =================
   نموذج المتعلم ← قاعدة المعرفة (قواعد إذا/فإن) ← محرك الاستدلال ← قرار التوجيه + تفسير للطالب.
   القرار يُتخذ لكل موضوع على حدة من أداء الطالب، ويمكن أن يتغير داخل النشاط نفسه. */
const RULES = [
  {id:"R0", at:"أي وقت", when:"حدد القائم على التجربة نمطاً يدوياً للطالب", then:"يُطبَّق النمط المحدد يدوياً"},
  {id:"R1", at:"مؤشر الأداء", when:"أخطأ في سؤال الجزء وسؤال الكل معاً", then:"تحليلي، مع تلميح موجه من البداية"},
  {id:"R2", at:"مؤشر الأداء", when:"أخطأ في سؤال الجزء للمرة الثانية على التوالي", then:"تحليلي، مع تلميح موجه من البداية"},
  {id:"R3", at:"مؤشر الأداء", when:"أخطأ في سؤال الكل للمرة الثانية على التوالي", then:"كلي، مع تلميح موجه من البداية"},
  {id:"R4", at:"مؤشر الأداء", when:"أخطأ في سؤال الجزء وأصاب في سؤال الكل", then:"تحليلي (من الجزء إلى الكل)"},
  {id:"R5", at:"مؤشر الأداء", when:"أصاب في سؤال الجزء وأخطأ في سؤال الكل", then:"كلي (من الكل إلى الجزء)"},
  {id:"R6", at:"مؤشر الأداء", when:"أصاب في السؤالين واحتاج مثالاً محلولاً أو أكثر في النشاط السابق", then:"يستمر نمط النشاط السابق لتثبيت التعلم"},
  {id:"R7", at:"مؤشر الأداء", when:"أصاب في السؤالين في الموضوع الأول", then:"النمط الأضعف في الاختبار القبلي (الجزء ← تحليلي، الكل ← كلي)"},
  {id:"R8", at:"مؤشر الأداء", when:"أصاب في السؤالين في باقي الموضوعات", then:"كلي بإرشاد أقل"},
  {id:"R9", at:"أثناء النشاط", when:"في التوجيه الكلي أخفق في التحقق من التصنيف مرتين", then:"تحويل فوري إلى التوجيه التحليلي لباقي النشاط"},
  {id:"R10", at:"أثناء النشاط", when:"أخطأ مرة واحدة في البند نفسه", then:"تلميح موجه"},
  {id:"R11", at:"أثناء النشاط", when:"أخطأ مرتين في البند نفسه", then:"مثال محلول"},
  {id:"R12", at:"أثناء النشاط", when:"أخطأ ثلاث مرات في البند نفسه", then:"مراجعة المحتوى وإظهار الإجابة الصحيحة"},
  {id:"R13", at:"مهارة الواقع المعزز", when:"بدأ مهارة عملية", then:"آخر قرار توجيه للطالب، أو نتيجة الاختبار القبلي إن لم يوجد قرار"}
];
const RID = Object.fromEntries(RULES.map(r=>[r.id, r]));
const WHY = {
  R0:"حدد القائم على التجربة نمط التوجيه لك.",
  R1:"أجبت عن سؤالي المؤشر بشكل غير صحيح، فستنفذ النشاط خطوة بخطوة مع تلميح يساعدك من البداية.",
  R2:"احتجت للمرة الثانية إلى دعم في التفاصيل والخطوات، فستنفذ النشاط خطوة بخطوة مع تلميح من البداية.",
  R3:"احتجت للمرة الثانية إلى دعم في إدراك العلاقات، فستبدأ بالصورة الكاملة مع تلميح من البداية.",
  R4:"أدركت الصورة العامة، لكنك تحتاج دعماً في التفاصيل، فستنفذ النشاط خطوة بخطوة.",
  R5:"تعرف العناصر منفردة، لكنك تحتاج دعماً في إدراك العلاقات بينها، فستبدأ بالصورة الكاملة.",
  R6:"أداؤك جيد، لكنك احتجت إرشاداً كبيراً في النشاط السابق، فتستمر بنفس التوجيه لتثبيت تعلمك.",
  R7:"أجبت عن سؤالي المؤشر بشكل صحيح، فاعتمدت البيئة على إجاباتك في الاختبار القبلي.",
  R8:"أجبت عن سؤالي المؤشر بشكل صحيح، فستأخذ التوجيه الكلي بإرشاد أقل.",
  R9:"أخفقت في التصنيف مرتين بالتوجيه الكلي، فتحولت البيئة إلى تقسيم المهمة لخطوات متتابعة.",
  R13:"نمط التوجيه في المهارة هو آخر نمط حددته البيئة لك من أدائك."
};
const GE = m => m.ge || (m.ge = {d:{}, log:[]});

/* ================= «مُرشِد»: الروبوت الذي ينطق بالتوجيه ================= */
// mode: analytic | holistic | "" ، mood: happy | think | alert
function bot(mode, mood, mini){
  mood = mood || "happy";
  const badge = mode==="analytic"
    ? `<g class="bd-ic"><rect x="49" y="104" width="7" height="5" rx="1.5"/><rect x="56" y="99" width="7" height="10" rx="1.5"/><rect x="63" y="94" width="7" height="15" rx="1.5"/></g>`
    : mode==="holistic"
    ? `<g class="bd-ic"><circle cx="60" cy="101" r="3.4"/><circle cx="51" cy="95" r="2.6"/><circle cx="69" cy="95" r="2.6"/><circle cx="51" cy="107" r="2.6"/><circle cx="69" cy="107" r="2.6"/><path d="M60 101 51 95M60 101 69 95M60 101 51 107M60 101 69 107" stroke-width="1.6"/></g>`
    : `<g class="bd-ic"><path d="M60 94l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></g>`;
  const mouth = mood==="think" ? `<path class="mouth" d="M53 58q7-3 14 0"/>` : mood==="alert" ? `<ellipse class="mouth o" cx="60" cy="58" rx="4" ry="3.2"/>` : `<path class="mouth" d="M51 55q9 8 18 0"/>`;
  const brows = mood==="think" ? `<path class="brow" d="M42 35l9-3M69 32l9 3"/>` : mood==="alert" ? `<path class="brow" d="M42 31l9 1M69 32l9-1"/>` : "";
  const vb = mini ? "18 4 84 74" : "0 0 120 140";
  return `<svg class="bot ${mood}" viewBox="${vb}" aria-hidden="true">
    <g class="bot-fig">
      <line class="ant" x1="60" y1="16" x2="60" y2="7"/><circle class="ant-b" cx="60" cy="6" r="4.5"/>
      <rect class="ear" x="20" y="34" width="8" height="18" rx="4"/><rect class="ear" x="92" y="34" width="8" height="18" rx="4"/>
      <rect class="head" x="26" y="16" width="68" height="56" rx="20"/>
      <rect class="face" x="34" y="25" width="52" height="40" rx="14"/>
      ${brows}<g class="eyes"><ellipse cx="50" cy="43" rx="4.6" ry="5.6"/><ellipse cx="70" cy="43" rx="4.6" ry="5.6"/><circle class="gl" cx="51.6" cy="41" r="1.5"/><circle class="gl" cx="71.6" cy="41" r="1.5"/></g>
      <circle class="cheek" cx="42" cy="54" r="3"/><circle class="cheek" cx="78" cy="54" r="3"/>${mouth}
      ${mini ? "" : `<rect class="neck" x="52" y="71" width="16" height="7" rx="3"/>
      <path class="arm l" d="M34 92q-12 6-14 20"/><path class="arm r" d="M86 92q13-8 16-22"/><circle class="hand l" cx="20" cy="113" r="5"/><circle class="hand r" cx="102" cy="69" r="5"/>
      <rect class="body" x="32" y="77" width="56" height="46" rx="16"/><rect class="chest" x="44" y="88" width="32" height="25" rx="8"/>${badge}
      <rect class="leg" x="44" y="121" width="10" height="11" rx="4"/><rect class="leg" x="66" y="121" width="10" height="11" rx="4"/>`}
    </g></svg>`;
}
// فقاعة كلام الروبوت. size: big (قرار التوجيه) | mini (تلميح أثناء النشاط)
function botSay(html, o){
  o = o || {}; const mode = o.mode==null ? (PNAME ? (A?"analytic":"holistic") : "") : o.mode, mini = o.size==="mini";
  return `<div class="bot-say ${mini?"mini":"lg"} ${mode==="analytic"?"an":mode==="holistic"?"ho":"nu"} ${o.cls||""}"><div class="bot-av">${bot(mode, o.mood, mini)}</div>
    <div class="bubble">${o.name===false?"":`<span class="bot-name">${o.name||"مُرشِد"}${o.tag?` · ${o.tag}`:""}</span>`}${html}</div></div>`;
}
function preProfile(m){ const t = MOD.testTags, a = (m.pre&&m.pre.a)||[]; const sc = tag => { const ix = t.map((x,k)=>x===tag?k:-1).filter(k=>k>=0); return ix.length ? ix.filter(k=>a[k]===MOD.test[k].k).length/ix.length : null; };
  return {p:sc("p"), w:sc("w")}; }
// محرك الاستدلال: يمر على القواعد بالترتيب ويطبّق أول قاعدة يتحقق شرطها
function infer(m, i, dp, dw){
  const g = GE(m), prev = g.d[i-1], prevHelp = i>0 ? Math.max((m.need||{})["L"+(i-1)+".a"]||0, prev&&prev.lv||0) : 0;
  if(!dp && !dw) return {rule:"R1", mode:"analytic", lv:1};
  if(!dp && prev && prev.dp===false) return {rule:"R2", mode:"analytic", lv:1};
  if(!dw && prev && prev.dw===false) return {rule:"R3", mode:"holistic", lv:1};
  if(!dp) return {rule:"R4", mode:"analytic", lv:0};
  if(!dw) return {rule:"R5", mode:"holistic", lv:0};
  if(prev && prevHelp>=2) return {rule:"R6", mode:prev.act||prev.mode, lv:0};
  if(i===0){ const pp = preProfile(m); return {rule:"R7", mode:(pp.p!=null && pp.w!=null && pp.p < pp.w) ? "analytic" : "holistic", lv:0, pre:pp}; }
  return {rule:"R8", mode:"holistic", lv:0};
}
function decide(i, dp, dw){
  const m = M(), g = GE(m), r = infer(m, i, dp, dw), now = Date.now();
  g.d[i] = {mode:r.mode, lv:r.lv, rule:r.rule, dp, dw, at:now};
  g.last = r.mode; g.log.push({i, pt:"diag", mode:r.mode, lv:r.lv, rule:r.rule, dp, dw, at:now}); save();
}
function switchAct(i, rule){
  const m = M(), g = GE(m), d = g.d[i]; if(!d || d.act==="analytic") return;
  d.act = "analytic"; d.sw = rule; g.last = "analytic"; g.log.push({i, pt:"act", mode:"analytic", from:d.mode, rule, at:Date.now()}); save();
}
const decOf = (st, i) => st && st.m && st.m.ge && st.m.ge.d[i];
function guideNow(st, i){
  if(!st) return null; if(st.override) return st.override;
  if(i!=null){ const d = decOf(st, i); return d ? (d.act||d.mode) : null; }
  const g = st.m && st.m.ge; if(g && g.last) return g.last;
  if(st.m && st.m.pre){ const pp = preProfile(st.m); return (pp.p!=null && pp.w!=null && pp.p < pp.w) ? "analytic" : "holistic"; }
  return null;
}
const ruleOf = (st, i) => { if(st && st.override) return "R0"; if(i==null) return "R13"; const d = decOf(st, i); return d ? (d.sw||d.rule) : null; };
const baseLv = i => { const st = S(), d = decOf(st, i); return st && !st.override && d ? (d.lv||0) : 0; };
function applyStyle(){
  const st = S(), perLesson = ["lesson","activity","self"].includes(PAGE), sty = guideNow(st, perLesson ? PI : null);
  A = sty==="analytic"; PNAME = sty ? (A?"التحليلي":"الكلي") : "";
  if(sty) document.documentElement.dataset.style = sty; else delete document.documentElement.dataset.style;
}
const styleOf = st => guideNow(st);
const lessonDone = (m,i) => !!(m.f["L"+i+".c"] && m.f["L"+i+".a"] && m.f["L"+i+".s"]);
const lessonsDone = m => MOD.lessons.filter((_,i)=>lessonDone(m,i)).length;
function progress(m){ let d = (m.pre?1:0)+(m.post?1:0); MOD.lessons.forEach((_,i)=>["c","a","s"].forEach(k=>{ if(m.f["L"+i+"."+k]) d++; })); return Math.round(d/(2+NL*3)*100); }
/* ---- الإرشاد المتدرج (تحديد الاحتياج): يرتفع المستوى مع تكرار خطأ الطالب ---- */
const HELP = ["أساسي","تلميح موجه","مثال محلول","مراجعة المحتوى"];
const needs = m => m.need || (m.need = {});
function raiseNeed(m, key, lv){ const n = needs(m); n[key] = Math.max(n[key]||0, Math.min(3, lv)); }
const level = m => HELP[Math.max(0, ...Object.values(m.need||{}))];
const helpCounts = m => { const v = Object.values(m.need||{}); return [1,2,3].map(l=>v.filter(x=>x>=l).length); };

/* ================= الملفات والتنقل ================= */
const U = {home:"index.html", instructions:"instructions.html", login:"login.html",
  modules:"modules.html", module:"module1.html", goals:"module1-goals.html", lessons:"module1-lessons.html",
  pretest:"pretest.html", preResult:"pretest-result.html", posttest:"posttest.html", postResult:"posttest-result.html",
  summary:"summary.html", admin:"admin.html", skills:"skills.html", ar:"ar-ram.html", card:"ar-card.html"};
const LU = (i,p="c") => "lesson"+(i+1)+(p==="a"?"-activity":(p==="s"?"-self":""))+".html";
const VT = "onpageswap" in window;
async function goto(url){
  save(); await flush();
  if(VT || matchMedia("(prefers-reduced-motion: reduce)").matches){ location.href = url; return; }
  document.body.classList.add("leaving"); setTimeout(()=>{ location.href = url; }, 170);
}
const quietVT = e => { const t = e.viewTransition; if(t) ["ready","finished","updateCallbackDone"].forEach(k=>{ if(t[k]) t[k].catch(()=>{}); }); };
window.addEventListener("pagereveal", quietVT); window.addEventListener("pageswap", quietVT);
window.addEventListener("pageshow", e=>{ document.body.classList.remove("leaving"); if(e.persisted) location.reload(); });

function gate(){
  const st = S();
  const login = ["card","skills","ar","modules","module","goals","lessons","pretest","preResult","posttest","postResult","lesson","activity","self","summary"];
  if(login.includes(PAGE) && !st){ try{ sessionStorage.setItem("sg-next", location.href.split("/").pop()); }catch(e){} return U.login; }
  if(!st) return null;
  const mod = ["card","skills","ar","modules","module","goals","lessons","pretest","preResult","posttest","postResult","lesson","activity","self"];
  if(!mod.includes(PAGE)) return null;
  const m = M();
  if((PAGE==="skills" || PAGE==="ar") && !m.pre) return U.pretest;
  if(PAGE==="card") return null;
  if(PAGE==="pretest" && m.pre) return U.preResult;
  if(PAGE==="preResult" && !m.pre) return U.pretest;
  if(["lessons","lesson","activity","self","posttest","postResult"].includes(PAGE) && !m.pre) return U.pretest;
  if(PAGE==="lesson" && PI>0 && !lessonDone(m,PI-1)) return U.lessons;
  if(PAGE==="activity" && !(m.f["L"+PI+".c"] && (decOf(st,PI) || st.override))) return LU(PI,"c");
  if(PAGE==="self" && !m.f["L"+PI+".a"]) return LU(PI,"a");
  if(PAGE==="posttest" && m.post) return U.postResult;
  if(PAGE==="posttest" && lessonsDone(m)<NL) return U.lessons;
  if(PAGE==="postResult" && !m.post) return U.posttest;
  return null;
}

/* ================= الهيدر والأيقونات ================= */
const SECTION = {home:"home", instructions:"instructions", login:"account", summary:"summary", admin:"admin"};
function topBar(){
  const st = S(), sec = SECTION[PAGE] != null ? SECTION[PAGE] : "modules";
  const items = [["home",U.home,"home","الرئيسية","#2f7cf6"],["instructions",U.instructions,"info","التعليمات","#f59e0b"],
                 ["modules",U.modules,"layers","الموديولات","#10b981"],["summary",U.summary,"chart","ملخص الأداء","#ec4899"]];
  const locked = !st;
  const nv = items.map(([k,h,i,t,c])=>{ if(k==="modules" && locked) i = "lock"; return [k,h,i,t,c]; }).map(([k,h,i,t,c])=>`<a class="nv ${sec===k?"on":""}" href="${h}" style="--c:${c}" ${sec===k?'aria-current="page"':""}><span class="nb">${ic(i)}</span><span class="nl">${t}</span></a>`).join("");
  const acc = st ? `<button class="nv" data-act="logout" style="--c:#64748b"><span class="nb">${ic("out")}</span><span class="nl">خروج<small>${esc(st.name.split(/\s+/)[0])}</small></span></button>`
                 : `<a class="nv ${sec==="account"?"on":""}" href="${U.login}" style="--c:#0ea5e9" ${sec==="account"?'aria-current="page"':""}><span class="nb">${ic("user")}</span><span class="nl">دخول الطالب</span></a>`;
  const adm = `<a class="nv ${sec==="admin"?"on":""}" href="${U.admin}" style="--c:#334155" ${sec==="admin"?'aria-current="page"':""}><span class="nb">${ic("lock")}</span><span class="nl">دخول الأدمن</span></a>`;
  return `<header class="hdr"><div class="in">
      <img class="lg-uni" src="${LOGOS.uni}" alt="شعار جامعة الزقازيق">
      <div class="ttl"><b>بيئة تعلم معززة قائمة على التوجيه الذكي</b><span>لتنمية مهارات صيانة الحاسب الآلي والتفكير المنظومي لدى طلاب تكنولوجيا التعليم</span></div>
      <img class="lg-fac" src="${LOGOS.fac}" alt="شعار كلية التربية النوعية - جامعة الزقازيق">
    </div></header><div class="hline"></div>
    <nav class="icons" aria-label="صفحات البيئة">${nv}${acc}${adm}</nav>`;
}
const head = (icon,title,sub="") => `<section class="phead"><div class="pi">${ic(icon)}</div><div><h1>${title}</h1>${sub?`<p>${sub}</p>`:""}</div></section>`;
function pager(prev, next){
  const p = prev ? `<a class="btn ghost" href="${prev.href}">${ic("prev")}${prev.t}</a>` : "<span></span>";
  const n = !next ? "<span></span>" : (next.href ? `<a class="btn" href="${next.href}">${next.t}${ic("next")}</a>` : `<button class="btn" data-act="${next.act}">${next.t}${ic("next")}</button>`);
  return `<div class="pager">${p}${n}</div>`;
}
let vp = {};

/* ================= الرئيسية ================= */
function pHome(){
  return `<section class="home">
    <span class="kick">${ic("book")}بحث بعنوان</span>
    <div class="frame"><h1>${TITLE}</h1></div>
    <span class="kick">${ic("pen")}إعداد</span>
    <div class="author"><b>أ.م.د/ منى عبدالوهاب أحمد</b><span>أستاذ مساعد تكنولوجيا التعليم</span><span>كلية التربية النوعية - جامعة الزقازيق</span></div>
  </section>`;
}

/* ================= التعليمات ================= */
function pInstructions(){
  const steps = [["user","سجّل دخولك","باسم المستخدم وكلمة المرور اللي استلمتهم من القائم على التجربة."],
    ["test","أدِّ الاختبار القبلي","قبل دراسة الموديول."],["book","ادرس الموضوعات بالترتيب","لكل موضوع صفحة محتوى ينتهي بمؤشر أداء، ثم صفحة نشاط، ثم صفحة تقويم ذاتي."],
    ["test","أدِّ الاختبار البعدي","بعد إتمام كل موضوعات الموديول."],["chart","راجع ملخص أدائك","درجاتك وتقدمك."]];
  const rules = [["lock","الموضوعات تُفتح بالترتيب، ولا يُفتح موضوع قبل إتمام السابق."],["clock","الاختباران ومؤشر الأداء في كل موضوع تُؤدَّى مرة واحدة فقط."],
    ["save","إجاباتك تُحفظ تلقائياً على هذا الجهاز، فاستخدم نفس الجهاز والمتصفح دائماً."],["shield","الأنشطة العملية تُنفذ في المعمل بعد فصل الكهرباء واتباع قواعد السلامة."],
    ["pen","اكتب إجاباتك بأسلوبك، فالمطلوب تفكيرك أنت."],["help","إذا واجهتك مشكلة فنية فارجع إلى القائم على التجربة."]];
  return head("info","تعليمات استخدام البيئة","اقرأ هذه التعليمات قبل أن تبدأ.")+`
    <h2 class="sec"><span class="si">${ic("steps")}</span>خطوات السير داخل البيئة</h2>
    <div class="g3">${steps.map((s,k)=>`<div class="tile"><span class="stepno">${k+1}</span><div class="ti">${ic(s[0])}</div><h3>${s[1]}</h3><p class="muted small">${s[2]}</p></div>`).join("")}</div>
    <h2 class="sec"><span class="si">${ic("brain")}</span>التوجيه الذكي</h2>
    ${botSay(`<p>أنا <b>مُرشِد</b>، المرشد الذكي في هذه البيئة. أتابع أداءك وأختار لك التوجيه المناسب في كل نشاط، وأشرح لك سبب اختياري.</p>`, {mode:"", mood:"happy", tag:"مرحباً بك"})}
    <div class="def">${ic("brain")}<div>تعمل البيئة كنظام خبير: في نهاية محتوى كل موضوع تجيب عن سؤالين قصيرين (مؤشر الأداء)، أحدهما عن الجزء والآخر عن الكل. تحلل البيئة إجابتك وأداءك في النشاط السابق، وتطبق قواعد التوجيه لتحدد نوع التوجيه المناسب لك في النشاط، وتوضح لك سبب اختيارها. وقد يتغير التوجيه أثناء النشاط إذا احتجت إلى دعم أكبر.</div></div>
    <div class="g2"><div class="def">${ic("steps")}<div><b>التوجيه التحليلي (من الجزء إلى الكل)</b><br>المهمة مقسمة إلى خطوات فرعية متتابعة، تنجز خطوة ثم تُفتح التالية، مع تغذية راجعة عند كل إجراء.</div></div>
      <div class="def">${ic("map")}<div><b>التوجيه الكلي (من الكل إلى الجزء)</b><br>المهمة كاملة مع خريطة تربط جوانبها وعلاقاتها، ترى الصورة الكلية أولاً ثم تكوّن تصوراً متكاملاً.</div></div></div>
    <h2 class="sec"><span class="si">${ic("flag")}</span>قواعد مهمة</h2>
    <div class="ilist">${rules.map(r=>`<div class="il"><div class="ii">${ic(r[0])}</div><span>${r[1]}</span></div>`).join("")}</div>`
    + pager(null, S() ? {href:U.modules, t:"الموديولات"} : {href:U.login, t:"تسجيل الدخول"});
}

/* ================= الدخول ================= */
function pLogin(){
  const st = S();
  if(st) return head("user","تسجيل الدخول")+`<div class="card stack" style="max-width:560px;width:100%;margin:0 auto">
      <div class="fb ok">${ic("check")}<span>أنت مسجل الآن باسم <b>${esc(st.name)}</b>.</span></div>
      <div class="row"><a class="btn" href="${U.modules}">متابعة${ic("next")}</a><button class="btn ghost" data-act="logoutHere">لست أنا، تسجيل خروج</button></div></div>`;
  return head("user","دخول الطالب","ادخل باسم المستخدم وكلمة المرور اللي استلمتهم من القائم على التجربة.")+`<div class="card" style="max-width:560px;width:100%;margin:0 auto">
    <form id="loginForm" class="stack" novalidate>
      <div><label for="fUser">اسم المستخدم</label><input type="text" id="fUser" dir="ltr" autocomplete="username" autocapitalize="off" spellcheck="false"></div>
      <div><label for="fPass">كلمة المرور</label><input type="password" id="fPass" dir="ltr" autocomplete="current-password"></div>
      <div class="err" id="loginErr"></div>
      <button class="btn" type="submit">دخول${ic("next")}</button>
    </form></div>`;
}

/* ================= الموديولات ================= */
function pModules(){
  return head("layers","الموديولات التعليمية","اختر الموديول الذي تريد دراسته.")+`
    <a class="modcard" href="${U.module}"><div class="side">${ic("wrench")}<b>1</b></div>
      <div class="main"><span class="chip v">${MOD.no}</span><h2>${MOD.title}</h2><p class="muted">${NL} موضوعات تعليمية</p><span class="btn">ادخل الموديول${ic("next")}</span></div></a>
    <a class="modcard ar-card" href="${U.skills}"><div class="side">${ic("scan")}<b>AR</b></div>
      <div class="main"><span class="chip amber">${ic("phone")}واقع معزز</span><h2>المهارات العملية بالواقع المعزز</h2><p class="muted">نفّذ مهارات الصيانة على جهاز حقيقي بتوجيه ثلاثي الأبعاد من كاميرا الهاتف.</p><span class="btn">ادخل المهارات${ic("next")}</span></div></a>`;
}
function pModule(){
  return head("wrench",MOD.no,MOD.title)+`<div class="card stack s"><h2 class="sec"><span class="si">${ic("book")}</span>عزيزي الطالب.. عزيزتي الطالبة</h2><p class="intro">${MOD.intro}</p></div>`
    + pager({href:U.modules, t:"الموديولات"}, {href:U.goals, t:"أهداف الموديول"});
}
function pGoals(){
  const m = M();
  return head("flag","أهداف الموديول",`${MOD.no}: ${MOD.title}`)+`<p class="muted" style="font-size:1.05rem">بعد دراستك لهذا الموديول ينبغي أن تكون قادراً على أن:</p>
    <div class="goals">${MOD.goals.map((g,k)=>`<div class="goal"><b>${k+1}</b><span>${g}</span></div>`).join("")}</div>`
    + pager({href:U.module, t:"مقدمة الموديول"}, m.pre ? {href:U.lessons, t:"موضوعات الموديول"} : {href:U.pretest, t:"الاختبار القبلي"});
}
function pLessons(){
  const m = M(), all = lessonsDone(m)===NL;
  const tile = (open,done,cls,icon,no,title,href) => {
    const inner = `<div class="top"><div class="li">${ic(done?"check":(open?icon:"lock"))}</div><div><div class="no">${no}</div><h3>${title}</h3></div></div><span class="state ${done?"d":(open?"o":"")}">${done?"مكتمل":(open?"متاح":"مغلق")}</span>`;
    return open ? `<a class="lt ${cls} ${done?"done":""}" href="${href}">${inner}</a>` : `<div class="lt ${cls} locked" aria-disabled="true">${inner}</div>`; };
  return head("list","موضوعات الموديول",`${MOD.no}: ${MOD.title}`)+`<div class="path">
    ${MOD.lessons.map((l,i)=>tile(i===0||lessonDone(m,i-1), lessonDone(m,i), "", l.icon, "الموضوع "+(i+1), l.t, LU(i))).join("")}
    ${tile(all, !!m.post, "test", "test", "ختام الموديول", "الاختبار البعدي", m.post?U.postResult:U.posttest)}
  </div>` + pager({href:U.goals, t:"أهداف الموديول"}, null);
}

/* ================= الاختبار القبلي / البعدي ================= */
const TT = {pre:[], post:[]};
function pTest(kind){
  const pk = TT[kind], name = kind==="pre" ? "الاختبار القبلي" : "الاختبار البعدي";
  return head("test",name,`${MOD.no}: ${MOD.title}`)+`<div class="fb info">${ic("info")}<span>اختر الإجابة الصحيحة من بين البدائل. يُؤدَّى الاختبار مرة واحدة، فراجع إجاباتك قبل الإرسال.</span></div>
    ${MOD.test.map((q,i)=>`<div class="qcard"><h3><b>${i+1}</b><span>${q.q}</span></h3><div class="opts">${q.o.map((o,k)=>`<button class="opt ${pk[i]===k?"sel":""}" data-act="tq" data-kind="${kind}" data-q="${i}" data-o="${k}"><i>${LETTERS[k]}</i>${o}</button>`).join("")}</div></div>`).join("")}
    <div class="err">${vp.err||""}</div>` + pager(null, {act:"submitTest", t:"إرسال الإجابات"});
}
function submitTest(kind){
  const pk = TT[kind], left = MOD.test.filter((_,i)=>pk[i]==null).length;
  if(left){ fail("أجب عن كل الأسئلة أولاً. المتبقي: "+left); return; }
  M()[kind] = {a:pk.slice(), score:MOD.test.filter((q,i)=>pk[i]===q.k).length, at:new Date().toISOString()}; save();
  goto(kind==="pre" ? U.preResult : U.postResult);
}
function pTestResult(kind){
  const m = M(), r = m[kind], name = kind==="pre" ? "نتيجة الاختبار القبلي" : "نتيجة الاختبار البعدي";
  return head("check",name,`${MOD.no}: ${MOD.title}`)+`<div class="card stack" style="max-width:560px;width:100%;margin:0 auto;text-align:center">
    <div class="score" style="--p:${r.score*10}"><div class="num">${r.score}/10</div></div><h2>تم تسجيل إجاباتك</h2>
    <p class="muted">${kind==="pre"?"هذه درجتك قبل دراسة الموديول. ابدأ الآن دراسة الموضوعات.":"أتممت الموديول الأول."}</p>
    ${kind==="pre"?(()=>{ const pp = preProfile(m), pc = v => v==null?"-":Math.round(v*100)+"%"; return `<div class="stats"><div class="stat"><b class="num">${pc(pp.p)}</b><span>${ic("steps")} أسئلة الجزء</span></div><div class="stat"><b class="num">${pc(pp.w)}</b><span>${ic("map")} أسئلة الكل</span></div></div><p class="muted small">تستخدم البيئة هذه النتيجة مع مؤشر الأداء في كل موضوع لتحديد نوع التوجيه المناسب لك.</p>`; })():""}</div>`
    + pager(null, kind==="pre" ? {href:U.lessons, t:"موضوعات الموديول"} : {href:U.summary, t:"ملخص الأداء"});
}

/* ================= العناصر المعززة: علامة QR لكل فقرة في المحتوى والأنشطة ================= */
// مفتاح العنصر: c{موضوع}-{كتلة}[-{بند}] للمحتوى ، a{موضوع}-goal|task|g{خطوة} للنشاط
function elements(i){
  const l = MOD.lessons[i], out = [], add = (k,title,lines,icon,sec) => out.push({k, i, title, lines:[].concat(lines).filter(Boolean), icon:icon||"book", sec});
  l.blocks.forEach((b,bi)=>{ const K = `c${i}-${bi}`;
    if(b.def) add(K, "تعريف", b.def, "book", "c");
    else if(b.p) add(K, "فقرة", b.p, "book", "c");
    else if(b.note) add(K, "ملاحظة مهمة", b.note, "bulb", "c");
    else if(b.list) b.list.forEach((x,ii)=>add(`${K}-${ii}`, b.h, x[1], x[0], "c"));
    else if(b.cards) b.cards.forEach((x,ii)=>add(`${K}-${ii}`, x[1], x[2], x[0], "c"));
    else if(b.types) b.types.forEach((t,ii)=>add(`${K}-${ii}`, t.name, [t.def].concat(t.ex), t.icon, "c"));
    else if(b.comp) b.comp.forEach((c,ii)=>add(`${K}-${ii}`, `${c[1]} (${c[2]})`, ["الوظيفة: "+c[3], "ما يُفحص أثناء الصيانة: "+c[4]], c[0], "c"));
    else if(b.rules) b.rules.forEach((r,ii)=>add(`${K}-${ii}`, `قاعدة السلامة ${ii+1}`, r[1], r[0], "c"));
    else if(b.steps) b.steps.forEach((x,ii)=>add(`${K}-${ii}`, `الخطوة ${ii+1}: ${x.t}`, x.items, x.icon, "c"));
  });
  const a = l.act;
  add(`a${i}-goal`, "الهدف من النشاط", a.goal, "target", "a");
  add(`a${i}-task`, "المهمة المطلوب تنفيذها", a.task, "alert", "a");
  (A ? a.A : a.H).forEach((x,n)=>add(`a${i}-g${n}`, A ? `خطوة التوجيه ${n+1}` : "جانب من الصورة الكلية", x, A ? "steps" : "link", "a"));
  return out;
}
function elementByKey(k){ const m = /^([ca])(\d+)-/.exec(k||""); if(!m || !MOD.lessons[+m[2]]) return null; return elements(+m[2]).find(e=>e.k===k) || null; }
// العنصر المادي المرتبط بالفقرة (لإظهاره على النموذج ثلاثي الأبعاد)
function partOf(el){ const t = el.title + " " + el.lines.join(" ");
  const R = [["ram",/ذاكرة|RAM/],["cpu",/معالج|CPU/],["fan",/مروح|مراوح|تبريد|حرار/],["sto",/تخزين|القرص|SMART|نسخ احتياطي|البيانات والبرامج/],["psu",/مزود الطاقة|الطاقة الكهربائية|مصدر الكهرباء|الجهد|PSU/],["plug",/كابل|توصيل|منافذ/],["mb",/اللوحة الأم|Motherboard|الدوائر/]];
  for(const [p,re] of R) if(re.test(el.title)) return p; for(const [p,re] of R) if(re.test(t)) return p; return null; }
const QRC = new Map();
function qrc(text, cell){ const key = text+"|"+(cell||3); if(QRC.has(key)) return QRC.get(key); let u; try{ const q = qrcode(0, "M"); q.addData(text); q.make(); u = q.createDataURL(cell||3, 2); }catch(e){ u = ""; } QRC.set(key,u); return u; }
const cardURL = k => /^https?:/.test(location.protocol) ? `${baseDir()}${U.card}?k=${k}` : k;
const seenEl = k => { const st = S(); return !!(st && st.m && st.m.arc && st.m.arc[k]); };
const mk = k => typeof qrcode==="function" ? `<button class="mk ${seenEl(k)?"seen":""}" data-act="mk" data-k="${k}" title="امسح بهاتفك لترى هذا العنصر بالواقع المعزز" aria-label="علامة الواقع المعزز لهذا العنصر"><img src="${qrc(cardURL(k))}" alt=""></button>` : "";
function showMk(k){
  const el = elementByKey(k); if(!el) return;
  let d = document.getElementById("mkModal"); if(d) d.remove();
  d = document.createElement("div"); d.id = "mkModal"; d.setAttribute("role","dialog"); d.setAttribute("aria-modal","true");
  d.innerHTML = `<div class="mkbox"><button class="mkx" data-act="mkClose" aria-label="إغلاق">${ic("x")}</button>
    <span class="chip amber">${ic("scan")}عنصر معزز</span><h3>${esc(el.title)}</h3>
    <img src="${qrc(cardURL(k), 7)}" alt="رمز QR للعنصر">
    <p class="muted small">وجّه كاميرا هاتفك إلى الرمز لترى هذا العنصر بالواقع المعزز على الهاتف.</p>
    <div class="row" style="justify-content:center"><a class="btn" href="${U.card}?k=${k}">${ic("eye")}اعرضه هنا</a><button class="btn ghost" data-act="mkClose">إغلاق</button></div></div>`;
  document.body.appendChild(d); d.querySelector(".mkx").focus();
}
const arcRec = (k, via) => { const m = M(); m.arc = m.arc || {}; const r = m.arc[k] || (m.arc[k] = {n:0, first:Date.now()}); r.n++; r.last = Date.now(); if(via) r[via] = (r[via]||0) + 1; save(); };

const arHint = () => typeof qrcode==="function" ? `<div class="arhint">${ic("scan")}<span>بجوار كل فقرة علامة QR: امسحها بكاميرا هاتفك لترى العنصر بالواقع المعزز، أو اضغط عليها هنا.</span></div>` : "";
/* ================= صفحة المحتوى ================= */
function blocks(l){
  const tone = {ok:"var(--ok)", bad:"var(--bad)", info:"var(--info)"}, i = MOD.lessons.indexOf(l);
  return l.blocks.map((b,bi)=>{ const K = `c${i}-${bi}`;
    if(b.def) return `<div class="def hasmk">${ic("book")}<div>${b.def}</div>${mk(K)}</div>`;
    if(b.p) return `<div class="para hasmk"><p>${b.p}</p>${mk(K)}</div>`;
    if(b.note) return `<div class="note hasmk">${ic("bulb")}<span>${b.note}</span>${mk(K)}</div>`;
    if(b.list) return `<h3 class="sec"><span class="si">${ic("list")}</span>${b.h}</h3><div class="ilist">${b.list.map((x,ii)=>`<div class="il hasmk"><div class="ii">${ic(x[0])}</div><span>${x[1]}</span>${mk(`${K}-${ii}`)}</div>`).join("")}</div>`;
    if(b.cards) return `<h3 class="sec"><span class="si">${ic("list")}</span>${b.h}</h3><div class="g3">${b.cards.map((x,ii)=>`<div class="tile hasmk"><span class="stepno">${ii+1}</span><div class="ti">${ic(x[0])}</div><h3>${x[1]}</h3><p class="muted">${x[2]}</p>${mk(`${K}-${ii}`)}</div>`).join("")}</div>`;
    if(b.types) return `<div class="types">${b.types.map((t,ii)=>`<div class="ty" style="--tc:${tone[t.tone]}"><div class="hd">${ic(t.icon)}<div><b>${t.name}</b><span dir="auto">${t.en}</span></div></div><div class="bd hasmk">${t.def?`<p>${t.def}</p>`:""}${t.ex.length?`<ul>${t.ex.map(e=>`<li>${ic("check")}<span>${e}</span></li>`).join("")}</ul>`:""}${mk(`${K}-${ii}`)}</div></div>`).join("")}</div>`;
    if(b.comp) return `<div class="comp">${b.comp.map((c,ii)=>`<div class="cp hasmk"><div class="ci">${ic(c[0])}</div><h4>${c[1]}<span dir="ltr">${c[2]}</span></h4><dl><div><dt>الوظيفة</dt><dd>${c[3]}</dd></div><div><dt>ما يُفحص أثناء الصيانة</dt><dd>${c[4]}</dd></div></dl>${mk(`${K}-${ii}`)}</div>`).join("")}</div>`;
    if(b.rules) return `<div class="rules">${b.rules.map((r,ii)=>`<div class="rule hasmk"><div class="rn">${ic(r[0])}<i>${ii+1}</i></div><span>${r[1]}</span>${mk(`${K}-${ii}`)}</div>`).join("")}</div>`;
    if(b.steps) return `<h3 class="sec"><span class="si">${ic("steps")}</span>${b.h}</h3><div class="tl">${b.steps.map((x,ii)=>`<div class="st"><div class="ln"><b>${ic(x.icon)}</b></div><div class="bx hasmk"><h4><small>الخطوة ${ii+1}:</small> ${x.t}</h4><ul>${x.items.map(y=>`<li>${y}</li>`).join("")}</ul>${mk(`${K}-${ii}`)}</div></div>`).join("")}</div>`;
    return "";
  }).join("");
}
const LETTERS_ = ["أ","ب","ج","د"];
const dperm = (i,t) => { const r = (i*3 + (t==="w"?2:1)) % 4; return [0,1,2,3].map(j=>(j+r)%4); };
function diagQ(i,t){
  const q = MOD.diag[i][t], d = decOf(S(), i), pk = d ? (d["a"+t]) : (vp.dg||{})[t], order = dperm(i,t);
  return `<div class="qcard"><h3><b>${ic(t==="p"?"steps":"map")}</b><span>${q.q}</span></h3><div class="opts">${order.map(o=>{
    const cls = d ? (o===0?"ok":(o===pk?"no":"")) : (pk===o?"sel":"");
    return `<button class="opt ${cls}" ${d?"disabled":""} data-act="dq" data-t="${t}" data-o="${o}"><i>${LETTERS_[order.indexOf(o)]}</i>${q.o[o]}</button>`; }).join("")}</div></div>`;
}
function diagBox(i){
  const st = S(), d = decOf(st, i);
  return `<div class="card stack s diag"><div class="row"><h2 class="sec grow"><span class="si">${ic("brain")}</span>مؤشر الأداء</h2>${d?`<span class="chip ok">${ic("check")}تم</span>`:""}</div>
    <p class="muted small">${d?"تم تحليل إجابتك وتحديد نوع التوجيه في النشاط.":"أجب عن السؤالين. على أساس إجابتك تحدد البيئة نوع التوجيه المناسب لك في النشاط. يُجاب مرة واحدة."}</p>
    ${diagQ(i,"p")}${diagQ(i,"w")}${d?guideBanner(i):""}<div class="err">${vp.err||""}</div></div>`;
}
function guideBanner(i){
  const st = S(), d = decOf(st, i), mode = guideNow(st, i), rid = ruleOf(st, i); if(!mode) return "";
  const an = mode==="analytic", ind = d ? [["steps","سؤال الجزء", d.dp?"صحيح":"غير صحيح", d.dp],["map","سؤال الكل", d.dw?"صحيح":"غير صحيح", d.dw]] : [];
  if(d && i>0){ const pv = Math.max((S().m.need||{})["L"+(i-1)+".a"]||0, 0); ind.push(["bulb","الإرشاد في النشاط السابق", HELP[pv], pv<2]); }
  const mood = d && d.sw ? "alert" : (d && d.dp && d.dw ? "happy" : "think");
  return botSay(`<h3>سأوجهك ${an?"توجيهاً تحليلياً: من الجزء إلى الكل":"توجيهاً كلياً: من الكل إلى الجزء"}${d&&d.sw?` <span class="chip amber">${ic("refresh")}غيّرت التوجيه أثناء النشاط</span>`:""}</h3>
    <p>${WHY[rid]||""}</p>
    <details><summary>${ic("info")}لماذا هذا القرار؟</summary><div class="xind">${ind.map(x=>`<span class="${x[3]?"ok":"no"}">${ic(x[0])}${x[1]}: <b>${x[2]}</b></span>`).join("")}<span>${ic("brain")}القاعدة المطبقة: <b dir="ltr">${rid}</b> · ${RID[rid]?RID[rid].when:""}</span></div></details>`, {mode, mood, tag:"قرار التوجيه الذكي", cls:"gdec"});
}
function pLesson(){
  const l = MOD.lessons[PI];
  return head(l.icon,l.t,`الموضوع ${PI+1} من ${NL}`)+arHint()+blocks(l)+diagBox(PI)
    + pager({href:U.lessons, t:"موضوعات الموديول"}, {act:"doneContent", t:"النشاط التعليمي"});
}

/* ================= صفحة النشاط ================= */
const ta = (key, ph="اكتب إجابتك هنا") => `<textarea data-r="${key}" placeholder="${ph}" aria-label="${ph}">${esc(M().r[key])}</textarea>`;
function field(key,c){
  if(c.opts) return `<select data-r="${key}" aria-label="${c.label}"><option value="">اختر</option>${c.opts.map(o=>`<option ${M().r[key]===o?"selected":""}>${o}</option>`).join("")}</select>`;
  return `<textarea data-r="${key}" style="min-height:64px" placeholder="${c.label}" aria-label="${c.label}">${esc(M().r[key])}</textarea>`;
}
function pActivity(){
  const m = M(), i = PI, l = MOD.lessons[i], a = l.act, pr = a.prod, K = "L"+i, done = !!m.f[K+".a"];
  const brief = arHint()+`<div class="brief"><div class="b goal-b hasmk">${ic("target")}<div><b>الهدف من النشاط</b>${a.goal}</div>${mk(K.replace("L","a")+"-goal")}</div>
     <div class="b lvl-b">${ic(a.lab?"wrench":"pen")}<div><b>${a.lab?"نشاط عملي يُنفذ في المعمل":"نشاط تحليل وتطبيق"}</b>مستوى الإرشاد الحالي: ${HELP[Math.max(baseLv(i),(m.need||{})[K+".a"]||0)]}</div></div>
     <div class="b task-b hasmk">${ic("alert")}<div><b>المهمة المطلوب تنفيذها</b>${a.task}</div>${mk(K.replace("L","a")+"-task")}</div></div>`;
  const strip = `<div class="strip">${a.A.map((s,k)=>`<div class="hasmk"><b>${k+1}</b><span>${s}</span>${mk(`a${i}-g${k}`)}</div>`).join("")}</div>`;
  let guide, product = "";
  if(A){
    if(pr.type==="text"){
      const k = Math.min(m.p[K]||0, a.A.length-1);
      guide = a.A.map((s,j)=>`<div class="astep ${j<k||done?"dn":(j===k?"cur":"lk")}"><b>${j<k||done?ic("check"):j+1}</b><div class="tx"><div class="hasmk ptitle"><p>${s}</p>${j<=k||done?mk(`a${i}-g${j}`):""}</div>${j<=k||done?ta(`${K}.A.s${j}`):`<span class="muted small">${ic("lock")} تُفتح بعد إتمام الخطوة السابقة</span>`}
        ${j===k&&!done&&j<a.A.length-1?`<div><button class="btn sm" data-act="aNext" data-j="${j}">الخطوة التالية${ic("next")}</button></div>`:""}</div></div>`).join("");
    } else if(pr.type==="table"){
      const k = Math.min(m.p[K]||0, pr.rows.length-1);
      guide = `<p class="muted">طبّق الخطوات التالية على كل ${pr.rowLabel} على حدة، بالترتيب:</p>${strip}`;
      product = `<h3 class="sec"><span class="si">${ic("test")}</span>${pr.name}</h3>`+pr.rows.map((r,j)=>`<div class="astep ${j<k||done?"dn":(j===k?"cur":"lk")}"><b>${j<k||done?ic("check"):j+1}</b><div class="tx"><p>${r}</p>${j<=k||done?`<div class="g2" style="gap:10px">${pr.cols.map((c,ci)=>`<div><label>${c.label}</label>${field(`${K}.T.r${j}.c${ci}`,c)}</div>`).join("")}</div>`:`<span class="muted small">${ic("lock")} يُفتح بعد إتمام السابق</span>`}
        ${j===k&&!done&&j<pr.rows.length-1?`<div><button class="btn sm" data-act="rNext" data-j="${j}">${pr.rowLabel} التالي${ic("next")}</button></div>`:""}</div></div>`).join("");
    } else {
      guide = `<p class="muted">طبّق الخطوات التالية على كل بطاقة على حدة:</p>${strip}`;
      product = classifyA(m,i,pr);
    }
  } else {
    guide = `<div class="hub"><div class="core">${ic("eye")}انظر للمهمة كصورة واحدة</div><div class="stem"></div><div class="ring">${a.H.map((s,n)=>`<div class="hasmk">${ic("link")}<span>${s}</span>${mk(`a${i}-g${n}`)}</div>`).join("")}</div></div>`;
    if(pr.type==="table") product = `<h3 class="sec"><span class="si">${ic("test")}</span>${pr.name}</h3><div class="scroll"><table class="ftable"><thead><tr><th>${pr.rowLabel}</th>${pr.cols.map(c=>`<th>${c.label}</th>`).join("")}</tr></thead><tbody>${pr.rows.map((r,j)=>`<tr><td>${r}</td>${pr.cols.map((c,ci)=>`<td>${field(`${K}.T.r${j}.c${ci}`,c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    if(pr.type==="classify") product = classifyH(m,K+".a",pr.cats,pr.items.map(x=>[x.t,x.c,x.why]),pr.hintH,"صنّف البطاقات كلها ثم تحقق",pr.ex,i);
    product += `<div class="stack s"><h3 class="sec"><span class="si">${ic("map")}</span>تصورك المتكامل</h3><p class="muted">اكتب تصوراً واحداً يجمع جوانب التوجيه السابقة ويربط بينها.</p>${ta(`${K}.H.all`,"اكتب تصورك المتكامل هنا")}</div>`;
  }
  const startHint = baseLv(i)>=1 && !done ? botSay(`<b>تلميح موجه:</b> ${A ? `ابدأ بـ «${a.A[0]}»، ولا تنتقل للخطوة التالية قبل إتمامها.` : `قبل أن تبدأ، اربط بين «${a.H[0]}» و«${a.H[1]||a.H[0]}»، ثم انظر لباقي الجوانب في ضوئهما.`}${pr.type==="classify"&&HINT_A[i]?" "+HINT_A[i]:""}`, {size:"mini", mood:"think", name:false}) : "";
  return head("pen",`النشاط التعليمي (${i+1})`,l.t)+guideBanner(i)+startHint+brief
    + (!A && MAP_LESSONS.includes(i) ? systemMap(m,K) : "")
    + `<div class="gpanel"><div class="gh">${ic(A?"steps":"map")}${A?"التوجيه التحليلي: نفّذ المهمة خطوة بخطوة":"التوجيه الكلي: كوّن الصورة الكاملة أولاً"}</div><div class="gb">${guide}</div></div>`
    + product + (done?`<div class="fb ok">${ic("check")}<span>أتممت هذا النشاط.</span></div>`:"") + `<div class="err">${vp.err||""}</div>`
    + pager({href:LU(i,"c"), t:"المحتوى"}, {act:"doneAct", t:"التقويم الذاتي"});
}
const helpChip = lv => lv ? `<span class="chip amber">${ic("bulb")}مستوى الإرشاد: ${HELP[lv]}</span>` : "";
const workedEx = (ex,cats) => ex ? botSay("لاحظت أنك تحتاج دعماً أكبر، فإليك مثالاً محلولاً يوضح طريقة التفكير:", {size:"mini", mood:"think", name:false})+`<div class="worked"><b>${ic("book")}مثال محلول</b><div class="wk-q">${ex.t}</div><div class="wk-a"><span class="chip ok">${ic("check")}${cats[ex.c]}</span><span>${ex.why}</span></div></div>` : "";
const reviewBox = i => botSay(`أقترح أن تراجع صفحة المحتوى، فيها تعريف كل فئة وأمثلتها. <a class="btn ghost sm" href="${LU(i,"c")}">${ic("book")}صفحة المحتوى</a>`, {size:"mini", mood:"think", name:false});
// تحليلي: بطاقة واحدة في كل مرة، وتغذية راجعة محددة تتدرج مع الخطأ: تلميح ← مثال محلول ← مراجعة المحتوى وإظهار الإجابة
function classifyA(m,i,pr){
  const key = "L"+i+".a", c = m.c[key] || (m.c[key] = {k:0, e:{}, ok:false}), n = pr.items.length;
  const past = pr.items.slice(0,c.k).map(x=>`<div class="citem r"><div class="row"><span class="chip ok">${ic("check")}${pr.cats[x.c]}</span><b class="grow">${x.t}</b></div><span class="small">${x.why}</span></div>`).join("");
  if(c.k>=n) return `<h3 class="sec"><span class="si">${ic("shapes")}</span>نتيجة التصنيف</h3>${past}`;
  const x = pr.items[c.k], fb = vp.cfb, wrong = c.e[c.k]||0, solved = fb && fb.ok, lv = wrong ? Math.min(3, wrong + baseLv(i)) : 0;
  return `<div class="row"><h3 class="sec grow"><span class="si">${ic("shapes")}</span>صنّف البطاقات واحدة بعد أخرى <span class="chip amber num">${c.k+1} من ${n}</span></h3>${helpChip(lv)}</div>${past}
    <div class="bigcard">${x.t}</div>
    <div class="cats" style="justify-content:center">${pr.cats.map((t,k)=>`<button class="cat ${fb&&fb.k===k?"sel":""}" ${solved?"disabled":""} data-act="cA" data-k="${k}">${t}</button>`).join("")}</div>
    ${solved?`<div class="fb ok">${ic("check")}<span><b>صحيح.</b> ${x.why}</span></div><div style="text-align:center"><button class="btn sm" data-act="cANext">${c.k<n-1?"البطاقة التالية":"إنهاء التصنيف"}${ic("next")}</button></div>`:""}
    ${fb&&!fb.ok?`<div class="fb bad">${ic("x")}<span><b>ليست «${pr.cats[fb.k]}».</b></span></div>`+(HINT_A[i]?botSay(`<b>تلميح:</b> ${HINT_A[i]}`, {size:"mini", mood:"think", name:false}):""):""}
    ${!solved&&lv>=2?workedEx(pr.ex,pr.cats):""}
    ${!solved&&lv>=3?reviewBox(i)+`<div class="fb info">${ic("info")}<span>الإجابة الصحيحة: <b>${pr.cats[x.c]}</b>. ${x.why} اختر الفئة الصحيحة لتكمل.</span></div>`:""}`;
}
// كلي: كل العناصر معاً ثم تحقق واحد؛ الإرشاد يتدرج مع المحاولات: تلميح عام ← مثال محلول ← مراجعة المحتوى وإظهار الصحيح
function classifyH(m,key,cats,items,hint,title,ex,li){
  const c = m.c[key] || (m.c[key] = {pick:{}, chk:false, ok:false, tries:0});
  const right = items.filter((x,j)=>c.pick[j]===x[1]).length, fails = c.fails||0, lv = c.ok || !fails ? 0 : Math.min(3, fails + (/\.a$/.test(key) ? baseLv(li) : 0));
  return `<div class="row"><h3 class="sec grow"><span class="si">${ic("shapes")}</span>${title}</h3>${helpChip(lv)}</div>
    ${items.map((x,j)=>{ const st = c.chk ? (c.pick[j]===x[1]?"r":"w") : ""; return `<div class="citem ${st}"><b>${x[0]}</b><div class="cats">${cats.map((t,k)=>`<button class="cat ${c.pick[j]===k?"sel":""}" ${c.ok?"disabled":""} data-act="cH" data-key="${key}" data-j="${j}" data-k="${k}">${t}</button>`).join("")}</div>${c.ok&&x[2]?`<span class="small">${x[2]}</span>`:""}${!c.ok&&lv>=3&&st==="w"?`<span class="small">الصحيح: <b>${cats[x[1]]}</b>${x[2]?" · "+x[2]:""}</span>`:""}</div>`; }).join("")}
    ${c.chk&&!c.ok?`<div class="fb bad">${ic("x")}<span><b>${right} من ${items.length} في موضعها الصحيح.</b> العناصر المظللة بالأحمر تحتاج إعادة نظر.</span></div>`:""}
    ${!c.ok&&lv>=1&&hint?botSay(`<b>تلميح:</b> ${hint}`, {size:"mini", mood:"think", name:false}):""}
    ${!c.ok&&lv>=2?workedEx(ex,cats):""}
    ${!c.ok&&lv>=3?reviewBox(li):""}
    ${c.ok?`<div class="fb ok">${ic("check")}<span><b>تصنيف صحيح كله.</b> لاحظ كيف تتوزع العناصر على الفئات كمجموعة واحدة.</span></div>`:`<div class="row"><button class="btn sm" data-act="cHCheck" data-key="${key}" data-n="${items.length}">${ic("check")}تحقق من التصنيف</button><span class="err" id="e-${key.replace(/\./g,"-")}"></span></div>`}`;
}

/* ================= خريطة منظومة الحاسب (التوجيه الكلي) ================= */
const MAP_LESSONS = [0,1,3,4,5,8];
const SYS = {
  psu:{ar:"مزود الطاقة", en:"PSU", icon:"power", x:100, y:205, fn:"توفير الطاقة الكهربائية المناسبة لكل المكونات.",
       rel:"يمد اللوحة الأم ووحدة التخزين بالكهرباء مباشرة، ومن خلال اللوحة الأم تصل الطاقة للمعالج والذاكرة والمروحة.",
       fail:"لا تدور المراوح ولا تضيء اللمبات ولا يستجيب الجهاز إطلاقاً.", hits:["mb","cpu","ram","sto","fan"]},
  mb:{ar:"اللوحة الأم", en:"Motherboard", icon:"board", x:340, y:205, fn:"ربط المكونات وتسهيل الاتصال بينها.",
       rel:"تستقبل الكهرباء من مزود الطاقة، ويتصل بها المعالج والذاكرة ووحدة التخزين والمروحة.",
       fail:"قد تصل الكهرباء وتدور المراوح، لكن لا يبدأ الإقلاع لانقطاع الاتصال بين المكونات.", hits:["cpu","ram","sto","fan"]},
  cpu:{ar:"المعالج", en:"CPU", icon:"cpu", x:340, y:60, fn:"تنفيذ التعليمات ومعالجة البيانات.",
       rel:"يتصل باللوحة الأم، ويقرأ البيانات من الذاكرة، وتبرده المروحة.",
       fail:"تدور المراوح لكن لا تظهر صورة ولا تبدأ أي معالجة.", hits:["ram","sto"]},
  ram:{ar:"ذاكرة RAM", en:"RAM", icon:"ram", x:580, y:110, fn:"تخزين البيانات مؤقتاً أثناء التشغيل.",
       rel:"يقرأ منها المعالج عبر اللوحة الأم، ويُحمَّل إليها نظام التشغيل من وحدة التخزين.",
       fail:"يصدر الجهاز صافرات تنبيه ولا تظهر صورة، أو يتوقف بشكل مفاجئ.", hits:["cpu","sto"]},
  sto:{ar:"وحدة التخزين", en:"HDD / SSD", icon:"disk", x:580, y:290, fn:"حفظ البيانات والبرامج بصورة دائمة.",
       rel:"تأخذ الكهرباء من مزود الطاقة وتنقل البيانات عبر اللوحة الأم، ومنها يُحمَّل نظام التشغيل إلى الذاكرة.",
       fail:"تظهر شاشة البداية ثم رسالة بعدم وجود جهاز إقلاع، أو لا يتعرف الجهاز على وحدة التخزين.", hits:["ram"]},
  fan:{ar:"المراوح", en:"Fan", icon:"fan", x:100, y:60, fn:"تبريد المكونات وتنظيم تدفق الهواء.",
       rel:"تبرد المعالج والمكونات الداخلية، وتراكم الأتربة عليها يضعف التبريد.",
       fail:"ترتفع حرارة المعالج فيبطؤ الجهاز أو يعيد التشغيل أو يتوقف فجأة.", hits:["cpu"]}
};
const SYS_EDGES = [["psu","mb","pw"],["psu","sto","pw","M100,241 V342 H580 V326"],["mb","cpu","dt"],["mb","ram","dt"],["mb","sto","dt"],["cpu","ram","dt"],["fan","cpu","cl"]];
function systemMap(m,K){
  const seen = (m.map||{})[K] || [], sel = vp.ms, failOn = !!(sel && vp.mf), hits = failOn ? SYS[sel].hits : [];
  const edges = SYS_EDGES.map(([a,b,t,path])=>{ const A_ = SYS[a], B_ = SYS[b], cut = failOn && (a===sel||b===sel);
    return `<path class="se ${t} ${cut?"cut":""}" d="${path || `M${A_.x},${A_.y} L${B_.x},${B_.y}`}"/>`; }).join("");
  const nodes = Object.entries(SYS).map(([id,c])=>{ const cls = ["sn", id===sel?(failOn?"fail":"sel"):"", hits.includes(id)?"hit":"", seen.includes(id)&&id!==sel&&!hits.includes(id)?"seen":""].join(" ");
    return `<g class="${cls}" data-act="mapNode" data-id="${id}" tabindex="0" role="button" aria-label="${c.ar}">
      <rect x="${c.x-78}" y="${c.y-34}" width="156" height="68" rx="14"/>
      <svg x="${c.x+40}" y="${c.y-13}" width="26" height="26" viewBox="0 0 24 24" class="sg"><use href="#i-${c.icon}"/></svg>
      <text x="${c.x-14}" y="${c.y-1}">${c.ar}</text><text class="en" x="${c.x-14}" y="${c.y+18}">${c.en}</text></g>`; }).join("");
  const c = sel && SYS[sel];
  return `<div class="smap"><div class="row"><h3 class="sec grow"><span class="si">${ic("map")}</span>خريطة منظومة الحاسب</h3><span class="chip v num">استكشفت ${seen.length} من 6</span></div>
    <p class="muted small">الحاسب منظومة واحدة مترابطة. اضغط على أي مكون لتعرف وظيفته وعلاقاته، ثم جرّب تعطيله لترى أثر ذلك على باقي المنظومة.</p>
    <div class="smap-in"><div class="smap-svg"><svg viewBox="0 0 680 360" role="img" aria-label="خريطة مكونات الحاسب والعلاقات بينها">${edges}${nodes}</svg>
      <div class="slegend"><span><i class="pw"></i>الكهرباء</span><span><i class="dt"></i>البيانات</span><span><i class="cl"></i>التبريد</span>${failOn?`<span><i class="hb"></i>مكون متأثر بالعطل</span>`:""}</div></div>
    <div class="smap-info">${c?`<h4>${ic(c.icon)}${c.ar} <small dir="ltr">${c.en}</small></h4>
        <div class="kv"><div>${ic("bulb")}<span><b>وظيفته</b>${c.fn}</span></div><div>${ic("link")}<span><b>علاقاته</b>${c.rel}</span></div>
        ${failOn?`<div class="bad">${ic("alert")}<span><b>لو تعطل</b>${c.fail}<br><b>يتأثر:</b> ${c.hits.map(h=>SYS[h].ar).join("، ")}</span></div>`:""}</div>
        <button class="btn sm ${failOn?"ghost":"amber"}" data-act="mapFail">${ic("alert")}${failOn?"أعد المنظومة سليمة":"ماذا لو تعطل؟"}</button>`
      :`<h4>${ic("eye")}اختر مكوناً</h4><p class="muted small">اضغط على أي مكون في الخريطة لتظهر وظيفته وعلاقاته هنا.</p>`}</div></div></div>`;
}
function finishActivity(){
  const m = M(), i = PI, K = "L"+i, a = MOD.lessons[i].act, pr = a.prod, miss = [];
  if(m.f[K+".a"]){ goto(LU(i,"s")); return; }
  const filled = k => (m.r[k]||"").trim().length >= 2;
  const tableOk = () => pr.rows.every((_,j)=>pr.cols.every((_,ci)=>filled(`${K}.T.r${j}.c${ci}`)));
  if(A){
    if(pr.type==="text" && !a.A.every((_,j)=>filled(`${K}.A.s${j}`))) miss.push("أكمل كتابة إجابتك في كل الخطوات");
    if(pr.type==="table" && !tableOk()) miss.push(`أكمل كل خانات «${pr.name}»`);
    if(pr.type==="classify" && !(m.c[K+".a"]&&m.c[K+".a"].ok)) miss.push("أكمل تصنيف كل البطاقات");
  } else {
    if(pr.type==="table" && !tableOk()) miss.push(`أكمل كل خانات «${pr.name}»`);
    if(pr.type==="classify" && !(m.c[K+".a"]&&m.c[K+".a"].ok)) miss.push("صنّف البطاقات وتحقق حتى يصح التصنيف كله");
    if(!filled(`${K}.H.all`)) miss.push("اكتب تصورك المتكامل");
  }
  if(miss.length){ fail(miss.join("، ")+"."); return; }
  m.f[K+".a"] = Date.now(); goto(LU(i,"s"));
}

/* ================= صفحة التقويم الذاتي ================= */
function pSelf(){
  const m = M(), i = PI, l = MOD.lessons[i], K = "L"+i, done = !!m.f[K+".s"], last = i===NL-1;
  return head("help","التقويم الذاتي",l.t)+`<div class="fb info">${ic("help")}<span>أجب عن الأسئلة التالية لتتأكد من فهمك للموضوع.</span></div>
    ${l.sa.map((q,j)=> typeof q==="string"
       ? `<div class="qcard"><h3><b>${j+1}</b><span>${q}</span></h3>${ta(`${K}.S.q${j}`)}</div>`
       : `<div class="qcard"><h3><b>${j+1}</b><span>${q.q}</span></h3>${classifyH(m,`${K}.s${j}`,q.cats,q.items,"راجع تعريف كل فئة في صفحة المحتوى.","اختر الفئة المناسبة لكل عنصر",l.act.prod.ex,i)}</div>`).join("")}
    ${done?`<div class="fb ok">${ic("check")}<span>أتممت هذا الموضوع.</span></div>`:""}<div class="err">${vp.err||""}</div>`
    + pager({href:LU(i,"a"), t:"النشاط التعليمي"}, {act:"doneSelf", t:last?"الاختبار البعدي":"الموضوع التالي"});
}
function finishSelf(){
  const m = M(), i = PI, K = "L"+i, l = MOD.lessons[i];
  const ok = l.sa.every((q,j)=> typeof q==="string" ? (m.r[`${K}.S.q${j}`]||"").trim().length>=2 : (m.c[`${K}.s${j}`]&&m.c[`${K}.s${j}`].ok));
  if(!ok){ fail("أجب عن كل الأسئلة أولاً، وأكمل التصنيف حتى يصح."); return; }
  m.f[K+".s"] = m.f[K+".s"] || Date.now(); goto(i<NL-1 ? LU(i+1) : U.posttest);
}

/* ================= المهارات العملية بالواقع المعزز ================= */
const SK = SKILLS.ram, NS = SK.steps.length;
// رابط المهارة: علامة QR تحمل هذا الرابط، فمسحها بكاميرا الهاتف العادية يفتح المهارة مباشرة، وتتعرف عليها البيئة أثناء المسح
const baseDir = () => location.href.split(/[?#]/)[0].replace(/[^/]*$/, "");
const markerURL = () => /^https?:/.test(location.protocol) ? `${baseDir()}${SK.page}?m=${SK.marker}` : SK.marker;
function qrImg(text, cell){ try{ const q = qrcode(0, "H"); q.addData(text); q.make(); return q.createDataURL(cell||8, 4); }catch(e){ return "assets/img/qr-ram.png"; } }
function arRec(){ const m = M(); m.ar = m.ar || {}; return m.ar.ram || (m.ar.ram = {attempts:0, overview:0, plays:0, steps:{}}); }
function pSkills(){
  const r = (S() && S().m && S().m.ar && S().m.ar.ram) || null, done = !!(r && r.doneAt);
  return head("scan","المهارات العملية بالواقع المعزز","اختر المهارة التي تريد تنفيذها.")+`
    <a class="modcard ar-card" href="${U.ar}"><div class="side">${ic("ram")}<b>1</b></div>
      <div class="main"><div class="row"><span class="chip amber">${ic("phone")}واقع معزز</span>${done?`<span class="chip ok">${ic("check")}أتممتها</span>`:""}</div><h2>${SK.title}</h2><p class="muted">${SK.desc}</p>
      <div class="ar-need"><span>${ic("phone")}هاتف بكاميرا</span><span>${ic("scan")}علامة QR على اللوحة الأم</span><span>${ic("cpu")}جهاز حاسب للتطبيق</span></div>
      <span class="btn">${done?"أعد التدريب":"ابدأ المهارة"}${ic("next")}</span></div></a>`;
}
const AS = {phase:"scan", i:0, view:-1, play:-1, cam:false, status:"", ready:false, gl:true};
function pAr(){
  return head("scan",SK.title,`مهارة عملية بالواقع المعزز · التوجيه ${A?"التحليلي":"الكلي"} (${ruleOf(S())})`)+`<div class="ar">
    <div class="arview" id="arView"><video id="arVideo" muted playsinline></video>
      <div class="ar-scan" id="arScan" hidden><i></i><i></i><i></i><i></i><span>وجّه الكاميرا إلى علامة QR على اللوحة الأم</span></div>
      <div class="ar-chip" id="arChip" hidden></div><div class="ar-hint" id="arHint" hidden>${ic("hand")}اسحب لتدوير النموذج</div></div>
    <div class="arpanel" id="arPanel"></div></div>`
    + pager({href:U.skills, t:"المهارات العملية"}, null);
}
function initAR(){
  if(AS.ready) return; AS.ready = true;
  const view = document.getElementById("arView");
  AS.gl = !!(window.AR && window.THREE && AR.webgl());
  if(AS.gl){ try{ AR.init(view); AR.setStep(0); }catch(e){ console.warn(e); AS.gl = false; } }
  if(!AS.gl) view.classList.add("nogl");
  const r = arRec(); if(r.doneAt){ AS.phase = "done"; }
  arUpdate();
}
function arChip(){
  const c = document.getElementById("arChip"); if(!c) return;
  let txt = "";
  if(AS.phase==="overview") txt = AS.play>=0 ? `${AS.play+1}. ${SK.steps[AS.play].t}` : (AS.view>=0 ? `${AS.view+1}. ${SK.steps[AS.view].t}` : "العرض الكلي للمهارة");
  else if(AS.phase==="run") txt = `${A?"الخطوة "+(AS.i+1)+": "+SK.steps[AS.i].a:(AS.view>=0&&AS.view!==AS.i?"معاينة: "+SK.steps[AS.view].t:(AS.i+1)+". "+SK.steps[AS.i].t)}`;
  else if(AS.phase==="done") txt = "تمت المهارة بنجاح";
  c.innerHTML = txt ? `<i class="chip-bot">${bot(A?"analytic":"holistic", AS.phase==="done"?"happy":"happy", true)}</i><span>${esc(txt)}</span>` : ""; c.hidden = !txt;
}
function setModel(k){ if(AS.gl) AR.setStep(k); }
const stepCard = (k, big) => { const st = SK.steps[k]; return `<div class="ar-step ${big?"focus":""}"><div class="ar-sh"><b>${ic(st.icon)}</b><div><small>الخطوة ${k+1} من ${NS}</small><h3>${A?st.a:st.t}</h3></div></div>
  <ul>${st.d.map(x=>`<li>${ic("check")}<span>${x}</span></li>`).join("")}</ul>${st.safe?`<div class="note">${ic("shield")}<span>${st.safe}</span></div>`:""}</div>`; };
function arPanelHTML(){
  const r = arRec();
  if(AS.phase==="scan") return `<div class="stack s"><h3 class="sec"><span class="si">${ic("scan")}</span>ابدأ بمسح العلامة</h3>
    <ol class="ar-howto"><li>جهّز جهاز الحاسب الذي ستطبق عليه المهارة.</li><li>اضغط «تشغيل الكاميرا» واسمح للمتصفح باستخدامها.</li><li>وجّه الكاميرا إلى علامة QR الموجودة على اللوحة الأم.</li></ol>
    ${AR.camSupported && AR.camSupported() ? `<button class="btn amber" data-act="arCam" ${AS.cam?"disabled":""}>${ic("phone")}${AS.cam?"جارٍ البحث عن العلامة…":"تشغيل الكاميرا"}</button>` : `<div class="fb hint">${ic("alert")}<span>الكاميرا غير متاحة هنا. افتح البيئة من الهاتف عبر رابط الاستضافة (https).</span></div>`}
    ${AS.status?`<div class="fb ${AS.statusBad?"bad":"info"}">${ic(AS.statusBad?"alert":"info")}<span>${AS.status}</span></div>`:""}
    <button class="btn ghost" data-act="arFree">${ic("eye")}عرض النموذج بدون كاميرا</button>
    ${/^https?:/.test(location.protocol)?`<div class="ar-phone"><img src="${qrImg(markerURL(), 5)}" alt="رمز QR لفتح المهارة على الهاتف"><div><b>${ic("phone")}فاتح من اللاب توب؟</b><span>امسح الرمز بكاميرا هاتفك لتفتح المهارة على الهاتف، ثم وجّه الهاتف إلى العلامة الملصقة على اللوحة الأم.</span></div></div>`:""}</div>`;
  if(AS.phase==="done") return `<div class="stack s"><div class="fb ok">${ic("check")}<span><b>أتممت مهارة ${SK.title}.</b></span></div>
    <div class="stats"><div class="stat"><b class="num">${fmt(r.time||0)}</b><span>زمن التنفيذ</span></div><div class="stat"><b class="num">${r.attempts||1}</b><span>مرات التدريب</span></div>${!A?`<div class="stat"><b class="num">${r.overview||0}</b><span>مرات الرجوع للعرض الكلي</span></div>`:""}</div>
    <div class="row"><button class="btn ghost" data-act="arRestart">${ic("refresh")}أعد التدريب</button><a class="btn" href="${U.skills}">المهارات العملية${ic("next")}</a></div></div>`;
  if(A){ // تحليلي: خطوة واحدة فقط في كل مرة
    const past = SK.steps.slice(0,AS.i).map((st,k)=>`<div class="ar-past">${ic("check")}<span>${k+1}. ${st.a}</span></div>`).join("");
    return `<div class="stack s"><div class="row"><span class="chip v">${ic("steps")}التوجيه التحليلي</span><span class="grow"></span><span class="chip amber num">${AS.i+1} / ${NS}</span></div>
      <div class="bar"><i style="width:${AS.i/NS*100}%"></i></div>${past?`<div class="stack" style="gap:4px">${past}</div>`:""}
      ${stepCard(AS.i, true)}
      <button class="btn" data-act="arDone">${ic("check")}تم${AS.i<NS-1?"، الخطوة التالية":"، إنهاء المهارة"}</button></div>`;
  }
  // كلي: خريطة المهارة كاملة
  const chain = SK.steps.map((st,k)=>{ const dn = !!r.steps[k] && AS.phase==="run" && k<AS.i, cur = AS.phase==="run" && k===AS.i, on = AS.play===k || AS.view===k;
    return `<button class="ar-node ${dn?"dn":""} ${cur?"cur":""} ${on?"on":""}" data-act="arPreview" data-k="${k}"><b>${dn?ic("check"):k+1}</b><span>${ic(st.icon)}${st.t}</span></button>`; }).join("");
  if(AS.phase==="overview") return `<div class="stack s"><div class="row"><span class="chip v">${ic("map")}التوجيه الكلي</span><h3 class="grow" style="font-size:1rem">خريطة المهارة كاملة</h3></div>
    <p class="muted small">شاهد كل خطوات المهارة في صورة متكاملة. اضغط أي خطوة لترى ما يحدث فيها على النموذج.</p>
    <div class="ar-map">${chain}</div>
    ${AS.view>=0?stepCard(AS.view,false):""}
    <div class="row"><button class="btn ghost" data-act="arPlay" ${AS.play>=0?"disabled":""}>${ic("play")}${AS.play>=0?"جارٍ العرض…":"شاهد الخطوات متتابعة"}</button><button class="btn" data-act="arStart">${ic("next")}${r.started?"متابعة التنفيذ":"ابدأ التنفيذ"}</button></div></div>`;
  return `<div class="stack s"><div class="row"><span class="chip v">${ic("map")}التوجيه الكلي</span><span class="grow"></span><button class="btn ghost sm" data-act="arOverview">${ic("map")}العرض الكلي</button></div>
    <div class="ar-map compact">${chain}</div>
    ${stepCard(AS.view>=0?AS.view:AS.i, false)}
    ${AS.view>=0&&AS.view!==AS.i?`<button class="btn ghost" data-act="arBack">${ic("prev")}رجوع للخطوة الحالية</button>`:`<button class="btn" data-act="arDone">${ic("check")}تم${AS.i<NS-1?"، الخطوة التالية":"، إنهاء المهارة"}</button>`}</div>`;
}
function arUpdate(){
  const p = document.getElementById("arPanel"); if(!p) return;
  p.innerHTML = arPanelHTML(); arChip();
  const hint = document.getElementById("arHint"); if(hint) hint.hidden = !(AS.gl && !AS.cam && AS.phase!=="scan");
}
function arFound(scanned){
  const r = arRec(); r.attempts = (r.attempts||0) + 1; r.style = guideNow(S()); r.rule = ruleOf(S()); r.scanned = !!(r.scanned || scanned); r.start = Date.now(); r.steps = {}; delete r.doneAt; delete r.time; r.started = false;
  AS.i = 0; AS.view = -1; AS.play = -1;
  if(A){ AS.phase = "run"; r.started = true; setModel(1); } else { AS.phase = "overview"; setModel(0); }
  save(); arUpdate();
}
let playT = null;
function arPlay(){
  const r = arRec(); r.plays = (r.plays||0) + 1; save();
  let k = 0; AS.view = -1;
  const next = () => { if(k >= NS){ AS.play = -1; setModel(0); arUpdate(); return; } AS.play = k; setModel(k+1); arUpdate(); k++; playT = setTimeout(next, 1900); };
  next();
}
function arDoneStep(){
  const r = arRec(); r.steps[AS.i] = Date.now(); AS.view = -1;
  if(AS.i < NS-1){ AS.i++; setModel(AS.i+1); }
  else { r.doneAt = Date.now(); r.time = Math.round((r.doneAt - r.start)/1000); AS.phase = "done"; setModel(7); }
  save(); arUpdate();
}
function startCam(){
  AS.cam = true; AS.status = ""; arUpdate();
  const v = document.getElementById("arVideo"), view = document.getElementById("arView");
  AR.startCamera(v).then(()=>{
    view.classList.add("cam"); document.getElementById("arScan").hidden = false;
    if(AS.gl) AR.setMode("ar");
    let found = false;
    AR.scan(a=>{ if(!found){ found = true; document.getElementById("arScan").hidden = true; view.classList.add("found"); arFound(true); } else view.classList.remove("lost"); },
      ()=>{ if(!found){ AS.status = "هذه ليست علامة مهارة RAM. وجّه الكاميرا إلى العلامة الملصقة على اللوحة الأم."; AS.statusBad = true; arUpdate(); } },
      ()=>{ view.classList.add("lost"); });
  }).catch(e=>{ console.warn(e); AS.cam = false; AS.statusBad = true; AS.status = e && e.name==="NotAllowedError" ? "لم يُسمح باستخدام الكاميرا. اسمح بها من إعدادات المتصفح ثم أعد المحاولة." : "تعذر تشغيل الكاميرا على هذا الجهاز."; arUpdate(); });
}

/* ================= بطاقة العنصر المعززة (ar-card.html?k=) ================= */
const CS = {k:"", el:null, cam:false, ready:false, gl:true};
function cardKey(){ const m = /[?&]k=([A-Za-z0-9_-]+)/.exec(location.search); return m ? m[1] : ""; }
function pCard(){
  CS.k = CS.k || cardKey(); CS.el = elementByKey(CS.k);
  if(!CS.el) return head("scan","عنصر معزز")+`<div class="fb hint">${ic("alert")}<span>هذه العلامة غير معروفة. ارجع إلى صفحة المحتوى وامسح علامة أخرى.</span></div>`+pager({href:U.modules, t:"الموديولات"}, null);
  return head("scan","عنصر معزز",`الموضوع ${CS.el.i+1}: ${MOD.lessons[CS.el.i].t}`)+`<div class="ar">
    <div class="arview" id="arView"><video id="arVideo" muted playsinline></video><div class="ar-float" id="arFloat"></div>
      <div class="ar-chip" id="arChip" hidden></div></div>
    <div class="arpanel" id="arPanel"></div></div>`
    + pager({href:LU(CS.el.i, CS.el.sec==="a"?"a":"c"), t:CS.el.sec==="a"?"رجوع للنشاط":"رجوع للمحتوى"}, null);
}
function cardInit(){
  if(CS.ready || !CS.el) return; CS.ready = true;
  const view = document.getElementById("arView");
  CS.gl = !!(window.AR && window.THREE && AR.webgl());
  if(CS.gl){ try{ AR.init(view); AR.setStep(0); }catch(e){ CS.gl = false; } }
  arcRec(CS.k, /[?&]k=/.test(location.search) && document.referrer.indexOf(U.card) === -1 && !/lesson/.test(document.referrer) ? "qr" : "open");
  cardUpdate();
}
function cardUpdate(){
  const el = CS.el, p = document.getElementById("arPanel"); if(!p || !el) return;
  const part = partOf(el), list = elements(el.i).filter(e=>e.sec===el.sec), idx = list.findIndex(e=>e.k===el.k);
  const view = document.getElementById("arView"); view.classList.toggle("has3d", !!(part && CS.gl));
  if(CS.gl) AR.focus(part);
  document.getElementById("arFloat").innerHTML = `<b>${ic(el.icon)}</b><span>${esc(el.title)}</span>`;
  const chip = document.getElementById("arChip"); chip.textContent = part ? "اسحب لتدوير النموذج" : ""; chip.hidden = !part || CS.cam;
  p.innerHTML = `<div class="stack s"><div class="row"><span class="chip amber">${ic("scan")}${el.sec==="a"?"النشاط التعليمي":"المحتوى"}</span><span class="grow"></span><span class="chip num">${idx+1} / ${list.length}</span></div>
    <h3 class="sec"><span class="si">${ic(el.icon)}</span>${esc(el.title)}</h3>
    ${el.lines.length>1?`<ul class="ar-lines">${el.lines.map(x=>`<li>${ic("check")}<span>${esc(x)}</span></li>`).join("")}</ul>`:`<p class="ar-text">${esc(el.lines[0]||"")}</p>`}
    ${part?`<div class="fb info">${ic("cpu")}<span>الجزء المضيء في النموذج هو المكوّن المرتبط بهذه الفقرة.</span></div>`:""}
    ${AR.camSupported && AR.camSupported() ? `<button class="btn ${CS.cam?"ghost":"amber"}" data-act="cardCam">${ic("phone")}${CS.cam?"إيقاف الكاميرا":"عرض فوق الكاميرا"}</button>` : ""}
    ${CS.cam?`<div class="fb hint">${ic("scan")}<span>وجّه الكاميرا إلى علامة أخرى على شاشة الدرس لتنتقل إليها مباشرة.</span></div>`:""}
    <div class="row">${idx>0?`<button class="btn ghost sm" data-act="cardGo" data-k="${list[idx-1].k}">${ic("prev")}السابق</button>`:""}<span class="grow"></span>${idx<list.length-1?`<button class="btn sm" data-act="cardGo" data-k="${list[idx+1].k}">التالي${ic("next")}</button>`:""}</div></div>`;
}
function cardGo(k, via){
  const el = elementByKey(k); if(!el || k===CS.k) return;
  CS.k = k; CS.el = el; arcRec(k, via||"open");
  try{ history.replaceState(null, "", `${U.card}?k=${k}`); }catch(e){}
  cardUpdate();
}
function cardCam(){
  const v = document.getElementById("arVideo"), view = document.getElementById("arView");
  if(CS.cam){ AR.stopCamera(); CS.cam = false; view.classList.remove("cam"); cardUpdate(); return; }
  AR.startCamera(v).then(()=>{ CS.cam = true; view.classList.add("cam","found"); cardUpdate();
    AR.scan(a=>{ const m = /[?&]k=([A-Za-z0-9_-]+)/.exec(a.data) || /^([ca]\d+-[A-Za-z0-9-]+)$/.exec(a.data); if(m) cardGo(m[1], "scan"); }, null, null, d=>/ar-card\.html\?k=|^[ca]\d+-/.test(d));
  }).catch(()=>{ CS.cam = false; cardUpdate(); });
}

/* ================= ملخص الأداء ================= */
function pSummary(){
  const st = S(), m = M(), p = progress(m), g = GE(m);
  const gain = m.pre&&m.post ? m.post.score-m.pre.score : null;
  const cell = d => d ? `<span class="chip ok">${ic("check")}تم</span>` : `<span class="chip">لم يتم</span>`;
  return head("chart","ملخص الأداء",esc(st.name))+`<div class="stats">
      <div class="stat"><b class="num">${Object.values(g.d).filter(x=>(x.act||x.mode)==="analytic").length} / ${Object.values(g.d).filter(x=>(x.act||x.mode)==="holistic").length}</b><span>قرارات التوجيه (تحليلي / كلي)</span></div>
      <div class="stat"><b class="num">${g.log.filter(x=>x.pt==="act").length}</b><span>تحولات أثناء الأنشطة</span></div>
      <div class="stat"><b class="num">${m.pre?m.pre.score+" / 10":"-"}</b><span>الاختبار القبلي</span></div>
      <div class="stat"><b class="num">${m.post?m.post.score+" / 10":"-"}</b><span>الاختبار البعدي</span></div>
      <div class="stat"><b class="num">${gain==null?"-":(gain>0?"+":"")+gain}</b><span>الفرق بين القبلي والبعدي</span></div>
      <div class="stat"><b class="num">${lessonsDone(m)} / ${NL}</b><span>موضوعات مكتملة</span></div>
      <div class="stat"><b>${level(m)}</b><span>مستوى الإرشاد</span></div>
      <div class="stat"><b>${m.ar&&m.ar.ram&&m.ar.ram.doneAt?"تمت":"لم تتم"}</b><span>مهارة RAM (واقع معزز)</span></div>
    </div>
    <div class="card stack s"><div class="row"><h3 class="grow">التقدم في ${MOD.no}</h3><b class="num">${p}%</b></div><div class="bar"><i style="width:${p}%"></i></div>
      <div class="scroll"><table class="t"><thead><tr><th>م</th><th>الموضوع</th><th>المحتوى</th><th>النشاط</th><th>التقويم الذاتي</th><th>التوجيه</th></tr></thead><tbody>
      ${MOD.lessons.map((l,i)=>{ const d = g.d[i], md = d && (d.act||d.mode); return `<tr><td class="num">${i+1}</td><td>${l.t}</td><td>${cell(m.f["L"+i+".c"])}</td><td>${cell(m.f["L"+i+".a"])}</td><td>${cell(m.f["L"+i+".s"])}</td><td>${md?`<span class="chip ${md==="analytic"?"an":"ho"}">${ic(md==="analytic"?"steps":"map")}${SNAME[md]}${d.act?" (تحوّل)":""}</span>`:"-"}</td></tr>`; }).join("")}</tbody></table></div></div>`;
}

/* ================= لوحة الباحث ================= */
let adminOk = false; try{ adminOk = sessionStorage.getItem(LS+"-admin")==="1"; }catch(e){}
const q = v => `"${String(v==null?"":v).replace(/"/g,'""')}"`;
function csvSummary(){
  const h = ["code","name","current_guidance","diag_part_correct","diag_whole_correct","decisions_analytic","decisions_holistic","activity_switches","pre_part_pct","pre_whole_pct","pre","post","lessons_done","classify_errors","help_hint","help_example","help_review","map_nodes_explored","ar_ram_done","ar_ram_time_s","ar_ram_attempts","ar_ram_overview_views","ar_ram_plays","ar_ram_camera_scan","ar_elements_opened","ar_element_views","ar_element_scans","started"];
  return [h.join(","),...Object.values(DB.students).map(s=>{ const m=s.m||{f:{},err:""}; const gd = (s.m&&s.m.ge&&s.m.ge.d)||{}, gv = Object.values(gd), pp = s.m&&s.m.pre ? preProfile(s.m) : {}; return [s.code,s.name,guideNow(s)||"",gv.filter(x=>x.dp).length,gv.filter(x=>x.dw).length,gv.filter(x=>(x.act||x.mode)==="analytic").length,gv.filter(x=>(x.act||x.mode)==="holistic").length,gv.filter(x=>x.act).length,pp.p==null?"":Math.round(pp.p*100),pp.w==null?"":Math.round(pp.w*100),m.pre?m.pre.score:"",m.post?m.post.score:"",s.m?lessonsDone(s.m):0,m.err,...(s.m?helpCounts(s.m):["","",""]),s.m&&s.m.map?Object.values(s.m.map).reduce((a,v)=>a+v.length,0):"",...(()=>{ const a = s.m&&s.m.ar&&s.m.ar.ram; return a ? [a.doneAt?1:0, a.time||"", a.attempts||0, a.overview||0, a.plays||0, a.scanned?1:0] : [0,"","","","",""]; })(),...(()=>{ const c = (s.m&&s.m.arc)||{}, v = Object.values(c); return [v.length, v.reduce((a,x)=>a+(x.n||0),0), v.reduce((a,x)=>a+(x.scan||0)+(x.qr||0),0)]; })(),s.created].map(q).join(","); })].join("\n");
}
function csvDecisions(){ const rows = [["code","name","lesson","point","guidance","help_start","rule","rule_condition","diag_part_correct","diag_whole_correct","switched_from","time"].join(",")];
  Object.values(DB.students).forEach(s=>{ ((s.m&&s.m.ge&&s.m.ge.log)||[]).forEach(x=>rows.push([s.code,s.name,x.i+1,x.pt==="diag"?"مؤشر الأداء":"أثناء النشاط",x.mode,x.lv==null?"":HELP[x.lv],x.rule,RID[x.rule]?RID[x.rule].when:"",x.dp==null?"":(x.dp?1:0),x.dw==null?"":(x.dw?1:0),x.from||"",new Date(x.at).toISOString()].map(q).join(","))); });
  return rows.join("\n"); }
function label(k){ const p = k.split("."), i = +p[0].slice(1), l = MOD.lessons[i]; if(!l) return k;
  if(p[1]==="A") return `الموضوع ${i+1} · نشاط · الخطوة ${+p[2].slice(1)+1}: ${l.act.A[+p[2].slice(1)]}`;
  if(p[1]==="H") return `الموضوع ${i+1} · نشاط · التصور المتكامل`;
  if(p[1]==="T") return `الموضوع ${i+1} · نشاط · ${l.act.prod.rows[+p[2].slice(1)]} · ${l.act.prod.cols[+p[3].slice(1)].label}`;
  if(p[1]==="S") return `الموضوع ${i+1} · تقويم ذاتي · ${l.sa[+p[2].slice(1)]}`; return k; }
function csvAnswers(){ const rows = [["code","name","item","answer"].join(",")]; Object.values(DB.students).forEach(s=>{ if(s.m) Object.keys(s.m.r).sort().forEach(k=>{ if((s.m.r[k]||"").trim()) rows.push([s.code,s.name,label(k),s.m.r[k]].map(q).join(",")); }); }); return rows.join("\n"); }
/* ---- لوحة إحصاءات الباحثة ---- */
const avg = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
const f1 = v => v==null ? "-" : (Math.round(v*10)/10).toString();
function adminStats(list){
  const tile = (icon,v,t) => `<div class="stat"><b class="num">${v}</b><span>${ic(icon)} ${t}</span></div>`;
  const pre = list.filter(s=>s.m&&s.m.pre).map(s=>s.m.pre.score), post = list.filter(s=>s.m&&s.m.post).map(s=>s.m.post.score), pairs = list.filter(s=>s.m&&s.m.pre&&s.m.post);
  const D = i => list.map(s=>decOf(s,i)).filter(Boolean), logs = list.flatMap(s=>(s.m&&s.m.ge&&s.m.ge.log)||[]);
  const ruleN = RULES.map(r=>[r.id, logs.filter(x=>x.rule===r.id).length]).filter(x=>x[1]);
  const bar = (v,cls,label) => `<div class="vb ${cls}" style="--h:${v==null?0:v*10}%" title="${label}: ${f1(v)} من 10"><span class="vv num">${f1(v)}</span></div>`;
  return `<div class="card stack s"><h3>${ic("chart")} إحصاءات التجربة</h3>
    <div class="stats">${tile("user",list.length,"طالب مسجل")}${tile("test",pre.length,"أدوا القبلي")}${tile("check",post.length,"أكملوا الموديول")}${tile("brain",logs.filter(x=>x.pt==="diag").length,"قرار توجيه")}${tile("refresh",logs.filter(x=>x.pt==="act").length,"تحول أثناء النشاط")}${tile("scan",list.filter(s=>s.m&&s.m.ar&&s.m.ar.ram&&s.m.ar.ram.doneAt).length,"أتموا مهارة RAM")}</div>
    <div class="g2" style="align-items:start">
      <div class="vchart"><div class="vt">متوسط درجة الاختبار القبلي والبعدي (من 10)</div>
        <div class="vlegend"><span><i class="s1"></i>القبلي</span><span><i class="s2"></i>البعدي</span></div>
        <div class="vplot"><div class="vgrid"><span data-v="10"></span><span data-v="5"></span><span data-v="0"></span></div><div class="vg"><div class="vbars">${bar(avg(pre),"s1","القبلي")}${bar(avg(post),"s2","البعدي")}</div><div class="vl">كل الطلاب<small>متوسط الفرق ${pairs.length?f1(avg(pairs.map(s=>s.m.post.score-s.m.pre.score))):"-"}</small></div></div></div></div>
      <div class="scroll"><table class="t"><thead><tr><th>الموضوع</th><th>تحليلي</th><th>كلي</th><th>تحوّل</th><th>أصاب الجزء</th><th>أصاب الكل</th></tr></thead><tbody>
        ${MOD.lessons.map((l,i)=>{ const d = D(i); return `<tr><td>${i+1}. ${l.t}</td><td class="num">${d.filter(x=>x.mode==="analytic").length}</td><td class="num">${d.filter(x=>x.mode==="holistic").length}</td><td class="num">${d.filter(x=>x.act).length}</td><td class="num">${d.filter(x=>x.dp).length}</td><td class="num">${d.filter(x=>x.dw).length}</td></tr>`; }).join("")}
      </tbody></table><p class="muted small" style="margin-top:6px">تحليلي/كلي: قرار مؤشر الأداء. تحوّل: تحول للتحليلي أثناء النشاط (R9).</p></div>
    </div>
    ${ruleN.length?`<div class="row" style="gap:6px;flex-wrap:wrap"><b class="small">مرات تطبيق القواعد:</b>${ruleN.map(([id,n])=>`<span class="chip" title="${RID[id].when}"><b dir="ltr">${id}</b>&nbsp;${n}</span>`).join("")}</div>`:""}</div>`;
}
function kbCard(){
  return `<details class="card kb"><summary><h3>${ic("brain")} قاعدة المعرفة: قواعد التوجيه الذكي (${RULES.length})</h3></summary>
    <p class="muted small">يطبّق محرك الاستدلال القواعد بالترتيب، وأول قاعدة يتحقق شرطها هي التي تحدد القرار. المدخلات: سؤالا مؤشر الأداء في كل موضوع (جزء/كل)، ومستوى الإرشاد في النشاط السابق، ونتيجة أسئلة الجزء والكل في الاختبار القبلي، والأداء أثناء النشاط.</p>
    <div class="scroll"><table class="t"><thead><tr><th>القاعدة</th><th>نقطة القرار</th><th>إذا</th><th>فإن</th></tr></thead><tbody>${RULES.map(r=>`<tr><td><b dir="ltr">${r.id}</b></td><td>${r.at}</td><td>${r.when}</td><td>${r.then}</td></tr>`).join("")}</tbody></table></div></details>`;
}
function pAdmin(){
  if(!adminOk) return head("lock","دخول الأدمن","لوحة الباحث، للقائم على التجربة فقط.")+`<div class="card" style="max-width:440px;width:100%;margin:0 auto">
    <form id="pinForm" class="stack">${ONLINE?`<div><label for="fEmail">البريد الإلكتروني</label><input type="text" id="fEmail" dir="ltr" autocomplete="username" inputmode="email"></div><div><label for="fPin">كلمة المرور</label><input type="password" id="fPin" autocomplete="current-password"></div>`:`<div><label for="fPin">الرقم السري</label><input type="password" id="fPin" autocomplete="off"></div>`}<div class="err" id="pinErr"></div><button class="btn" type="submit">دخول${ic("next")}</button></form></div>`;
  const list = Object.values(DB.students);
  if(vp.detail && DB.students[vp.detail]){ const s = DB.students[vp.detail], r = s.m ? s.m.r : {};
    const lg = (s.m&&s.m.ge&&s.m.ge.log)||[];
    return head("user",esc(s.name),"سجل قرارات التوجيه والإجابات المكتوبة")+`<div class="card stack s"><h3>${ic("brain")} سجل قرارات التوجيه (${lg.length})</h3>${lg.length?`<div class="scroll"><table class="t"><thead><tr><th>الموضوع</th><th>نقطة القرار</th><th>الجزء</th><th>الكل</th><th>القرار</th><th>القاعدة</th><th>الوقت</th></tr></thead><tbody>${lg.map(x=>`<tr><td class="num">${x.i+1}</td><td>${x.pt==="diag"?"مؤشر الأداء":"أثناء النشاط"}</td><td>${x.dp==null?"-":(x.dp?"✓":"✗")}</td><td>${x.dw==null?"-":(x.dw?"✓":"✗")}</td><td>${SNAME[x.mode]}${x.lv?" + "+HELP[x.lv]:""}</td><td title="${RID[x.rule]?RID[x.rule].when:""}"><b dir="ltr">${x.rule}</b></td><td class="num small">${new Date(x.at).toLocaleString("ar-EG",{dateStyle:"short",timeStyle:"short"})}</td></tr>`).join("")}</tbody></table></div>`:`<p class="muted small">لم يتخذ أي قرار بعد.</p>`}</div>`+Object.keys(r).sort().filter(k=>(r[k]||"").trim()).map(k=>`<div class="card stack s" style="padding:16px"><b class="small" style="color:var(--v)">${esc(label(k))}</b><p>${esc(r[k])}</p></div>`).join("")
      +(Object.keys(r).length?"":`<p class="muted">لا توجد إجابات مكتوبة بعد.</p>`)+`<div class="pager"><button class="btn ghost" data-act="adminBack">${ic("prev")}قائمة الطلاب</button><span></span></div>`; }
  const rows = list.map(s=>{ const m=s.m, cur=guideNow(s), gv=Object.values((m&&m.ge&&m.ge.d)||{});
    return `<tr><td>${esc(s.code)}</td><td>${esc(s.name)}</td>

     <td><select data-ov="${esc(s.code)}" aria-label="نمط التوجيه"><option value="">تلقائي${!s.override&&cur?" · "+SNAME[cur]:""}</option><option value="analytic" ${s.override==="analytic"?"selected":""}>تحليلي (يدوي، R0)</option><option value="holistic" ${s.override==="holistic"?"selected":""}>كلي (يدوي، R0)</option></select></td>
     <td class="num">${gv.filter(x=>(x.act||x.mode)==="analytic").length} / ${gv.filter(x=>(x.act||x.mode)==="holistic").length}${gv.some(x=>x.act)?` <span class="chip amber" title="تحول أثناء النشاط">${gv.filter(x=>x.act).length}</span>`:""}</td>
     <td class="num">${m&&m.pre?m.pre.score:"-"}</td><td class="num">${m&&m.post?m.post.score:"-"}</td><td class="num">${m?lessonsDone(m)+" / "+NL:"-"}</td><td class="num">${m?m.err:"-"}</td>
     <td><button class="btn ghost sm" data-act="detail" data-code="${esc(s.code)}">السجل</button> <button class="btn ghost sm" data-act="delStu" data-code="${esc(s.code)}">${vp.del===s.code?"تأكيد الحذف":"حذف"}</button></td></tr>`; }).join("");
  return head("chart","لوحة الباحث","نمط التوجيه يتحدد لكل طالب في كل موضوع من أدائه، بقواعد النظام الخبير")+`
    <div class="row">${ONLINE?`<span class="chip ok">${ic("check")}متصل بقاعدة البيانات · ${esc(FB.adminEmail()||"")}</span><button class="btn ghost sm" data-act="adminRefresh">${ic("refresh")}تحديث البيانات</button>`:`<span class="chip amber">${ic("alert")}وضع محلي: البيانات من هذا الجهاز فقط</span>`}<span class="grow"></span><button class="btn ghost sm" data-act="adminOut">${ic("out")}خروج الأدمن</button></div>
    ${addCard()}
    <div class="card row" style="align-items:center;gap:18px"><img src="${qrImg(markerURL(), 10)}" alt="علامة QR لمهارة فك وتركيب RAM" class="qr-img">
      <div class="stack s grow"><h3>${ic("scan")} علامة الواقع المعزز: ${SK.title}</h3>
        <p class="muted small">اطبع هذه العلامة (حوالي 5 × 5 سم على الأقل) والصقها على اللوحة الأم أو داخل صندوق الحاسب بجوار الذاكرة. الطالب يوجّه كاميرا الهاتف إليها فيظهر النموذج ثلاثي الأبعاد. العلامة تحمل رابط المهارة، فمسحها بكاميرا أي هاتف يفتح المهارة مباشرة: <b dir="ltr" style="word-break:break-all">${esc(markerURL())}</b></p>
        ${/^https?:/.test(location.protocol)?"":`<p class="fb hint small">${ic("alert")}<span>افتح لوحة الأدمن من رابط الاستضافة ثم اطبع العلامة، حتى تحمل رابط موقعك.</span></p>`}
        <div><a class="btn sm" href="${qrImg(markerURL(), 16)}" download="qr-ram.gif">${ic("save")}تحميل العلامة للطباعة</a></div></div></div>
    ${adminStats(list)}
    ${kbCard()}
    <div class="card stack s"><h3>الطلاب (${list.length})</h3>${ONLINE?`<p class="muted small">الحذف يمسح بيانات الطالب من البيئة. لإعادة استخدام نفس اسم المستخدم، احذف حسابه أيضاً من Firebase Console ← Authentication ← Users.</p>`:""}<div class="scroll"><table class="t"><thead><tr><th>اسم المستخدم</th><th>الاسم</th><th>التوجيه</th><th>قرارات ت / ك</th><th>قبلي</th><th>بعدي</th><th>الموضوعات</th><th>أخطاء</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="9" class="muted">لا توجد بيانات بعد.</td></tr>`}</tbody></table></div></div>
    <div class="g2"><div class="card stack s"><h3>تصدير النتائج (CSV)</h3><textarea class="mono" id="csv1" readonly>${esc(csvSummary())}</textarea><div class="row"><button class="btn sm" data-act="copy" data-t="csv1">نسخ</button><span class="muted small" id="m-csv1"></span></div></div>
      <div class="card stack s"><h3>تصدير سجل قرارات التوجيه (CSV)</h3><textarea class="mono" id="csv3" readonly>${esc(csvDecisions())}</textarea><div class="row"><button class="btn sm" data-act="copy" data-t="csv3">نسخ</button><span class="muted small" id="m-csv3"></span></div></div>
      <div class="card stack s"><h3>تصدير الإجابات المكتوبة (CSV)</h3><textarea class="mono" id="csv2" readonly>${esc(csvAnswers())}</textarea><div class="row"><button class="btn sm" data-act="copy" data-t="csv2">نسخ</button><span class="muted small" id="m-csv2"></span></div></div></div>`;
}

/* ================= العرض والأحداث ================= */
const PAGES = {home:pHome, instructions:pInstructions, login:pLogin, modules:pModules, module:pModule, goals:pGoals, lessons:pLessons,
  pretest:()=>pTest("pre"), preResult:()=>pTestResult("pre"), posttest:()=>pTest("post"), postResult:()=>pTestResult("post"),
  lesson:pLesson, activity:pActivity, self:pSelf, summary:pSummary, admin:pAdmin, skills:pSkills, ar:pAr, card:pCard};
function render(){
  if(PAGE==="ar" && document.getElementById("arView")){ arUpdate(); return; }
  if(PAGE==="card" && document.getElementById("arView")){ cardUpdate(); return; }
  const b = document.getElementById("pbody"), t = document.getElementById("ptop"), g = document.getElementById("pbot"), y = b.scrollTop;
  b.innerHTML = PAGES[PAGE]();
  t.replaceChildren(); g.replaceChildren();
  const h = b.firstElementChild; if(h && h.classList.contains("phead")) t.appendChild(h);
  const p = b.lastElementChild; if(p && p.classList.contains("pager")) g.appendChild(p);
  b.classList.toggle("center", PAGE==="home");
  b.scrollTop = y;
  if(PAGE==="ar") initAR();
  if(PAGE==="card") cardInit();
}
const toTop = () => { const b = document.getElementById("pbody"); if(b) b.scrollTop = 0; };
function fail(msg){ vp.err = msg; render(); const e = document.querySelector("#pbody .err:not(:empty)"); if(e) e.scrollIntoView({block:"center", behavior:"smooth"}); }

document.addEventListener("click", ev=>{
  const ln = ev.target.closest("a[href]");
  if(ln){ const h = ln.getAttribute("href"); if(!ln.target && !/^(https?:|mailto:|tel:|#)/.test(h)){ ev.preventDefault(); goto(h); } return; }
  if(ev.target.id==="mkModal"){ ev.target.remove(); return; }
  const a = ev.target.closest("[data-act]"); if(!a || a.disabled) return;
  const d = a.dataset, m = S() ? M() : null;
  switch(d.act){
    case "logout": (ONLINE ? FB.logout() : Promise.resolve()).catch(()=>{}).then(()=>{ setMe(null); goto(U.home); }); break;
    case "logoutHere": (ONLINE ? FB.logout() : Promise.resolve()).catch(()=>{}).then(()=>{ setMe(null); location.reload(); }); break;
    case "genPass": { const f = document.getElementById("aPass"); if(f) f.value = genPass(); break; }
    case "addBulk": { const box = document.getElementById("fBulk"); vp.bulk = box ? box.value : ""; addBulk(); break; }
    case "clearAdded": ADDED = []; render(); break;
    case "tq": TT[d.kind][+d.q] = +d.o; vp.err = ""; render(); break;
    case "submitTest": submitTest(PAGE==="pretest"?"pre":"post"); break;
    case "dq": vp.dg = vp.dg || {}; vp.dg[d.t] = +d.o; vp.err = ""; render(); break;
    case "doneContent": {
      const st = S();
      if(!decOf(st, PI) && !st.override){ const g = vp.dg||{}; if(g.p==null || g.w==null){ fail("أجب عن سؤالي مؤشر الأداء أولاً."); break; }
        decide(PI, g.p===0, g.w===0); const dd = GE(m).d[PI]; dd.ap = g.p; dd.aw = g.w; save(); vp.dg = null; }
      m.f["L"+PI+".c"] = m.f["L"+PI+".c"] || Date.now(); goto(LU(PI,"a")); break; }
    case "aNext": { const K = "L"+PI; if((m.r[`${K}.A.s${d.j}`]||"").trim().length<2){ vp.err = "اكتب إجابتك في هذه الخطوة أولاً."; } else { m.p[K] = +d.j+1; vp.err = ""; save(); } render(); break; }
    case "rNext": { const K = "L"+PI, pr = MOD.lessons[PI].act.prod; if(!pr.cols.every((_,ci)=>(m.r[`${K}.T.r${d.j}.c${ci}`]||"").trim().length>=2)){ vp.err = "أكمل خانات هذا البند أولاً."; } else { m.p[K] = +d.j+1; vp.err = ""; save(); } render(); break; }
    case "cA": { const c = m.c["L"+PI+".a"], x = MOD.lessons[PI].act.prod.items[c.k], ok = x.c === +d.k; if(!ok){ c.e[c.k] = (c.e[c.k]||0)+1; m.err++; raiseNeed(m, "L"+PI+".a", c.e[c.k]); } save(); vp.cfb = {k:+d.k, ok}; vp.err = ""; render(); break; }
    case "cANext": { const c = m.c["L"+PI+".a"]; c.k++; if(c.k >= MOD.lessons[PI].act.prod.items.length) c.ok = true; save(); vp.cfb = null; render(); break; }
    case "cH": { const c = m.c[d.key]; c.pick[+d.j] = +d.k; c.chk = false; saveSoon(); render(); break; }
    case "cHCheck": { const c = m.c[d.key], n = +d.n, K = d.key.split("."), l = MOD.lessons[+K[0].slice(1)];
      const items = K[1]==="a" ? l.act.prod.items.map(x=>x.c) : l.sa[+K[1].slice(1)].items.map(x=>x[1]);
      if(Object.keys(c.pick).length < n){ const e = document.getElementById("e-"+d.key.replace(/\./g,"-")); if(e) e.textContent = "صنّف كل العناصر أولاً."; break; }
      const wrong = items.filter((k,j)=>c.pick[j]!==k).length; c.chk = true; c.tries++; if(wrong){ m.err += wrong; c.fails = (c.fails||0)+1; raiseNeed(m, d.key, c.fails); } else c.ok = true;
      // R9: في التوجيه الكلي، إخفاقان في التحقق ← تحويل فوري إلى التوجيه التحليلي
      if(wrong && K[1]==="a" && !A && c.fails>=2 && !S().override){ const pi = +K[0].slice(1); switchAct(pi, "R9"); m.c[d.key] = {k:0, e:{}, ok:false, from:{fails:c.fails, tries:c.tries}}; applyStyle(); }
      save(); vp.err = ""; render(); if(A && K[1]==="a") toTop(); break; }
    case "mapNode": { const K = "L"+PI+".map"; m.map = m.map || {}; const s_ = m.map["L"+PI] || (m.map["L"+PI] = []); if(!s_.includes(d.id)) s_.push(d.id); vp.ms = d.id; vp.mf = false; save(); render(); break; }
    case "mapFail": vp.mf = !vp.mf; render(); break;
    case "doneAct": finishActivity(); break;
    case "arCam": startCam(); break;
    case "mk": showMk(d.k); break;
    case "mkClose": { const x = document.getElementById("mkModal"); if(x) x.remove(); break; }
    case "cardGo": cardGo(d.k, "open"); break;
    case "cardCam": cardCam(); break;
    case "arFree": if(AS.gl) AR.setMode("free"); arFound(false); break;
    case "arPreview": if(AS.play>=0) break; AS.view = (AS.view===+d.k && AS.phase==="overview") ? -1 : +d.k; setModel(AS.view>=0 ? AS.view+1 : (AS.phase==="run" ? AS.i+1 : 0)); arUpdate(); break;
    case "arPlay": arPlay(); break;
    case "arStart": { clearTimeout(playT); AS.play = -1; AS.view = -1; AS.phase = "run"; const r = arRec(); r.started = true; save(); setModel(AS.i+1); arUpdate(); break; }
    case "arOverview": { const r = arRec(); r.overview = (r.overview||0) + 1; save(); AS.phase = "overview"; AS.view = -1; setModel(0); arUpdate(); break; }
    case "arBack": AS.view = -1; setModel(AS.i+1); arUpdate(); break;
    case "arDone": arDoneStep(); break;
    case "arRestart": AS.phase = AS.cam || !AS.gl ? "scan" : "scan"; AS.status = ""; arFound(AS.cam); break;
    case "doneSelf": finishSelf(); break;
    case "detail": vp = {detail:d.code}; render(); toTop(); break;
    case "adminBack": vp = {}; render(); break;
    case "adminOut": adminOk = false; try{ sessionStorage.removeItem(LS+"-admin"); }catch(e){} vp = {}; if(ONLINE){ FB.logout().then(()=>{ DB.students = {}; save(); render(); }); } else render(); break;
    case "adminRefresh": loadAdmin().then(render); break;
    case "delStu": if(vp.del===d.code){ const code = d.code; if(ONLINE){ FB.deleteStudent(code).then(()=>{ delete DB.students[code]; save(); vp = {}; render(); }).catch(e=>alertAdmin(e)); } else { delete DB.students[code]; save(); vp = {}; render(); } } else { vp = {del:d.code}; render(); } break;
    case "copy": { const t = document.getElementById(d.t), msg = document.getElementById("m-"+d.t); t.select();
      (navigator.clipboard?navigator.clipboard.writeText(t.value):Promise.reject()).then(()=>msg.textContent="تم النسخ. الصقه في ملف واحفظه بامتداد csv.",()=>msg.textContent="حدد النص وانسخه يدوياً (Ctrl+C)."); break; }
  }
});
document.addEventListener("keydown", ev=>{ if(ev.key==="Escape"){ const x = document.getElementById("mkModal"); if(x) x.remove(); } });
document.addEventListener("keydown", ev=>{ if((ev.key==="Enter"||ev.key===" ") && ev.target.matches && ev.target.matches("g.sn")){ ev.preventDefault(); ev.target.dispatchEvent(new MouseEvent("click",{bubbles:true})); } });
document.addEventListener("input", ev=>{ const k = ev.target.dataset && ev.target.dataset.r; if(k && S()){ M().r[k] = ev.target.value; saveSoon(); } });
document.addEventListener("change", ev=>{
  if(ev.target.dataset && ev.target.dataset.ov){ const code = ev.target.dataset.ov, s = DB.students[code], v = ev.target.value; if(s){ if(v) s.override = v; else delete s.override; save(); if(ONLINE) FB.setOverride(code, v).catch(e=>alertAdmin(e)); render(); } }
  const k = ev.target.dataset && ev.target.dataset.r; if(k && S() && ev.target.tagName==="SELECT"){ M().r[k] = ev.target.value; saveSoon(); }
});
document.addEventListener("submit", ev=>{
  ev.preventDefault();
  if(ev.target.id==="loginForm"){
    const u = document.getElementById("fUser").value.trim().toLowerCase(), pw = document.getElementById("fPass").value, er = document.getElementById("loginErr");
    if(!u || !pw){ er.textContent = "اكتب اسم المستخدم وكلمة المرور."; return; }
    if(ONLINE){ studentLogin(u, pw, er, ev.target.querySelector("button")); return; }
    const ex = DB.students[u];
    if(!ex || ex.pass !== pw){ er.textContent = "اسم المستخدم أو كلمة المرور غير صحيحة."; return; }
    setMe(u); save(); goto(nextAfterLogin(S()));
  }
  if(ev.target.id==="pinForm" && ONLINE){ adminLogin(ev.target); return; }
  if(ev.target.id==="addForm"){ const n = document.getElementById("aName").value, u = document.getElementById("aUser").value, pw = document.getElementById("aPass").value;
    vp.busy = true; vp.addErr = ""; render();
    addStudent(n, u, pw).then(r=>{ vp.busy = false; if(!r.ok) vp.addErr = r.msg; render(); if(r.ok){ const f = document.getElementById("aName"); if(f) f.focus(); } }); return; }
  if(ev.target.id==="pinForm"){ if(document.getElementById("fPin").value === CONFIG.pin){ adminOk = true; try{ sessionStorage.setItem(LS+"-admin","1"); }catch(e){} render(); } else document.getElementById("pinErr").textContent = "الرقم السري غير صحيح."; }
});
window.addEventListener("beforeunload", ()=>{ try{ localStorage.setItem(LS, JSON.stringify(DB)); }catch(e){} if(ONLINE && me) push(); });

/* ---- الأدمن على قاعدة البيانات ---- */
function alertAdmin(e){ console.warn(e); const m = e && e.code==="permission-denied" ? "ليست لديك صلاحية الأدمن على قاعدة البيانات." : "تعذر الحفظ على قاعدة البيانات. تحقق من الإنترنت."; syncNote(m); setTimeout(()=>syncNote(""), 5000); }
async function loadAdmin(){
  const list = await FB.listStudents(); DB.students = list;
  const st = await FB.getSettings().catch(()=>null); 
  try{ localStorage.setItem(LS, JSON.stringify(DB)); }catch(e){}
}
async function adminLogin(form){
  const email = document.getElementById("fEmail").value.trim(), pw = document.getElementById("fPin").value, er = document.getElementById("pinErr"), btn = form.querySelector("button");
  if(!email || !pw){ er.textContent = "اكتب البريد الإلكتروني وكلمة المرور."; return; }
  btn.disabled = true; er.textContent = "";
  try{ await FB.adminLogin(email, pw); }
  catch(e){ btn.disabled = false; er.textContent = /network/.test(e && e.code||"") ? "تعذر الاتصال. تحقق من الإنترنت." : "البريد الإلكتروني أو كلمة المرور غير صحيحة."; return; }
  try{ await loadAdmin(); setMe(null); adminOk = true; render(); }
  catch(e){ await FB.logout(); btn.disabled = false; er.textContent = e && e.code==="permission-denied" ? "هذا الحساب ليس له صلاحية الأدمن. أضف إيميله في قواعد الأمان (Rules)." : "تعذر تحميل البيانات. تحقق من الإنترنت."; }
}

function nextAfterLogin(st){
  let n = ""; try{ n = sessionStorage.getItem("sg-next") || ""; sessionStorage.removeItem("sg-next"); }catch(e){}
  return n && /^[a-z0-9-]+\.html(\?[A-Za-z0-9=&_.-]*)?$/.test(n) && !/^(login|admin|index)\.html/.test(n) ? n : U.modules;
}
/* ---- تسجيل دخول الطالب على قاعدة البيانات ---- */
async function studentLogin(u, pw, er, btn){
  btn.disabled = true; er.textContent = "";
  try{ await FB.studentLogin(u, pw); }
  catch(e){ btn.disabled = false; const c = (e && e.code) || "";
    er.textContent = /network/.test(c) ? "تعذر الاتصال. تأكد من الإنترنت وأعد المحاولة." : (/too-many/.test(c) ? "محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة." : "اسم المستخدم أو كلمة المرور غير صحيحة."); return; }
  let remote = null;
  try{ remote = await FB.getStudent(u); }catch(e){ console.warn(e); }
  if(!remote){ await FB.logout(); btn.disabled = false; er.textContent = "حسابك غير مفعّل في البيئة. راجع القائم على التجربة."; return; }
  DB.students[u] = remote; setMe(u); save();
  goto(nextAfterLogin(remote));
}

/* ---- إضافة الطلاب (الأدمن) ---- */
const USER_RE = /^[a-z0-9._-]{3,30}$/;
function genPass(){ const a = new Uint32Array(1); (crypto||window.crypto).getRandomValues(a); return String(100000 + a[0] % 900000); }
let ADDED = [];   // آخر حسابات أُضيفت في هذه الجلسة (كلمات المرور لا تُحفظ في قاعدة البيانات)
function addMsg(code){ return ({"auth/email-already-in-use":"اسم المستخدم مستخدم من قبل","auth/weak-password":"كلمة المرور أقل من 6 أحرف","auth/invalid-email":"اسم المستخدم غير صالح","auth/too-many-requests":"محاولات كثيرة، أعد المحاولة بعد قليل","auth/network-request-failed":"تعذر الاتصال","permission-denied":"ليست لديك صلاحية الأدمن"})[code] || "تعذر الإضافة"; }
async function addStudent(name, u, pw){
  name = (name||"").trim().replace(/\s+/g," "); u = (u||"").trim().toLowerCase(); pw = (pw||"").trim() || genPass();
  const row = {name, user:u, pass:pw, ok:false, msg:""};
  if(name.split(" ").length < 2) row.msg = "اكتب الاسم كاملاً";
  else if(!USER_RE.test(u)) row.msg = "اسم المستخدم: حروف إنجليزية صغيرة وأرقام فقط (3 أحرف على الأقل)";
  else if(pw.length < 6) row.msg = "كلمة المرور 6 أحرف على الأقل";
  else if(DB.students[u]) row.msg = "اسم المستخدم مستخدم من قبل";
  else if(ONLINE){ try{ DB.students[u] = await FB.createStudentAccount(name, u, pw); row.ok = true; }catch(e){ console.warn(e); row.msg = addMsg(e && e.code); } }
  else { DB.students[u] = {name, code:u, pass:pw, created:new Date().toISOString()}; row.ok = true; }
  ADDED.unshift(row); try{ localStorage.setItem(LS, JSON.stringify(DB)); }catch(e){}
  return row;
}
async function addBulk(){
  const box = document.getElementById("fBulk"), lines = box.value.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!lines.length){ vp.addErr = "الصق قائمة الطلاب أولاً."; render(); return; }
  vp.busy = true; vp.addErr = "";
  for(let k=0; k<lines.length; k++){
    const p = lines[k].split(/[,،\t;]+/).map(x=>x.trim());
    vp.prog = `جارٍ الإضافة ${k+1} من ${lines.length}…`; render();
    await addStudent(p[0], p[1], p[2]);
  }
  vp.busy = false; vp.prog = ""; vp.bulk = ""; render();
}
function addCard(){
  const okRows = ADDED.filter(r=>r.ok), list = okRows.map(r=>`${r.name}\t${r.user}\t${r.pass}`).join("\n");
  return `<div class="card stack s"><h3>${ic("user")} إضافة الطلاب</h3>
    <div class="g2" style="align-items:start">
      <form id="addForm" class="stack s" novalidate><b class="small">طالب واحد</b>
        <div><label for="aName">الاسم الرباعي</label><input type="text" id="aName" autocomplete="off"></div>
        <div class="g2" style="gap:10px"><div><label for="aUser">اسم المستخدم</label><input type="text" id="aUser" dir="ltr" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="s101"></div>
          <div><label for="aPass">كلمة المرور</label><div class="row" style="gap:6px;flex-wrap:nowrap"><input type="text" id="aPass" dir="ltr" autocomplete="off" placeholder="6 أحرف على الأقل"><button class="btn ghost sm" type="button" data-act="genPass" title="توليد كلمة مرور">${ic("refresh")}</button></div></div></div>
        <div><button class="btn" type="submit" ${vp.busy?"disabled":""}>${ic("check")}إضافة الطالب</button></div></form>
      <div class="stack s"><b class="small">قائمة طلاب مرة واحدة</b>
        <label for="fBulk" class="muted small" style="font-weight:500">كل سطر: الاسم، اسم المستخدم، كلمة المرور. لو تركت كلمة المرور فارغة تتولد تلقائياً. تقدر تنسخ الأعمدة الثلاثة من Excel وتلصقها مباشرة.</label>
        <textarea id="fBulk" class="mono" style="direction:rtl" placeholder="أحمد محمد علي حسن، s101، 123987&#10;منى سامي أحمد محمود، s102">${esc(vp.bulk||"")}</textarea>
        <div class="row"><button class="btn" data-act="addBulk" ${vp.busy?"disabled":""}>${ic("list")}إضافة القائمة</button><span class="muted small">${vp.prog||""}</span></div></div>
    </div>
    <div class="err">${vp.addErr||""}</div>
    ${ADDED.length?`<div class="stack s"><div class="fb hint">${ic("alert")}<span>احفظ كلمات المرور دي الآن (انسخها في Excel أو اطبعها للطلاب)؛ لأسباب أمنية لا تُحفظ في قاعدة البيانات ولن تظهر مرة أخرى.</span></div>
      <div class="scroll"><table class="t"><thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>كلمة المرور</th><th>الحالة</th></tr></thead><tbody>
      ${ADDED.map(r=>`<tr><td>${esc(r.name)}</td><td dir="ltr">${esc(r.user)}</td><td dir="ltr" class="num">${r.ok?esc(r.pass):"-"}</td><td>${r.ok?`<span class="chip ok">${ic("check")}تمت الإضافة</span>`:`<span class="chip bad">${esc(r.msg)}</span>`}</td></tr>`).join("")}</tbody></table></div>
      <textarea id="addedList" class="mono" readonly style="position:absolute;left:-9999px;height:1px">${esc("الاسم\tاسم المستخدم\tكلمة المرور\n"+list)}</textarea>
      <div class="row"><button class="btn sm" data-act="copy" data-t="addedList">نسخ الحسابات المضافة (للصق في Excel)</button><span class="muted small" id="m-addedList"></span><span class="grow"></span><button class="btn ghost sm" data-act="clearAdded">مسح القائمة</button></div></div>`:""}
  </div>`;
}

/* ================= التشغيل ================= */
const FB_WAIT = new Promise(res=>{
  if(window.FB) return res(window.FB);
  if(window.FB_FAILED) return res(null);
  addEventListener("fb-ready", ()=>res(window.FB), {once:true});
  addEventListener("fb-fail", ()=>res(null), {once:true});
  setTimeout(()=>res(window.FB||null), 8000);
});
async function boot(){
  document.getElementById("app").innerHTML = '<div class="boot"><span class="spin"></span>جارٍ التحميل…</div>';
  const fb = await FB_WAIT;
  if(fb){
    ONLINE = true;
    try{
      await fb.ready();
      if(PAGE==="admin" && fb.isAdminUser()){ await loadAdmin(); adminOk = true; }
      else if(PAGE==="admin"){ adminOk = false; }
      else {
        const su = fb.studentUser();
        if(su){
          if(me !== su) setMe(su);
          const st = await fb.getSettings().catch(()=>null); 
          // البيانات على الخادم هي المرجع؛ النسخة المحلية للطوارئ فقط (لو انقطع الإنترنت)
          let remote = null; try{ remote = await fb.getStudent(su); }catch(e){ remote = (e && e.code==="permission-denied") ? false : null; }
          if(remote) DB.students[su] = remote;
          else if(remote===false || !DB.students[su]) setMe(null);
        } else if(me) setMe(null);
      }
    }catch(e){ console.warn("boot sync failed, using local copy", e); }
  }
  applyStyle();
  const redirect = gate();
  if(redirect){ location.replace(redirect); return; }
  document.getElementById("app").innerHTML = topBar() + '<main id="main" class="page enter"><div id="ptop"></div><div id="pbody"></div><div id="pbot"></div></main>';
  render();
}
boot();
