"use strict";
/* ================= أساسيات ================= */
const PAGE = document.body.dataset.page || "home";
const PI = document.body.dataset.i != null ? +document.body.dataset.i : null;
// نمط التوجيه يتحدد لكل طالب من نتيجة مقياس الأسلوب المعرفي
let A = false, PNAME = "";
const NL = MOD.lessons.length;
const LETTERS = ["أ","ب","ج","د"];
const SNAME = {analytic:"تحليلي", holistic:"كلي"};
const TITLE = "تصميم بيئة تعلم معززة قائمة على التوجيه الذكي وأثرها في تنمية مهارات صيانة الحاسب الآلي والتفكير المنظومي لدى طلاب تكنولوجيا التعليم";

/* ================= التخزين ================= */
const LS = "smart-guidance-adaptive-v1";
let DB = {students:{}, cfg:{cutoff:CONFIG.cutoff}};
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
function medianRT(sub, ans, rt){ const ok = rt.filter((t,k)=>ans[k]===KEY[sub][k]); return Math.round(median(ok.length>=4 ? ok : rt)); }
const lowAcc = sc => sc && ((sc.s3 && sc.s3.score < 9) || (sc.s4 && sc.s4.score < 9));
const fmt = sec => { sec = Math.round(sec); return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0"); };
function styleOf(st){ if(!st) return null; if(st.override) return st.override; if(!st.scale||!st.scale.done) return null; return st.scale.style || (st.scale.ratio <= DB.cfg.cutoff ? "holistic" : "analytic"); }
function applyStyle(){ const sty = styleOf(S()); A = sty==="analytic"; PNAME = sty ? (A?"التحليلي":"الكلي") : ""; if(sty) document.documentElement.dataset.style = sty; else delete document.documentElement.dataset.style; }
const scaleDone = st => !!(st && st.scale && st.scale.done);
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
const U = {home:"index.html", instructions:"instructions.html", login:"login.html", scale:"scale.html", scaleResult:"scale-result.html",
  modules:"modules.html", module:"module1.html", goals:"module1-goals.html", lessons:"module1-lessons.html",
  pretest:"pretest.html", preResult:"pretest-result.html", posttest:"posttest.html", postResult:"posttest-result.html",
  summary:"summary.html", admin:"admin.html"};
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
  const login = ["scale","scaleResult","modules","module","goals","lessons","pretest","preResult","posttest","postResult","lesson","activity","self","summary"];
  if(login.includes(PAGE) && !st) return U.login;
  if(!st) return null;
  const sd = scaleDone(st);
  if(PAGE==="scale" && sd) return U.scaleResult;
  if(PAGE==="scaleResult" && !sd) return U.scale;
  const mod = ["modules","module","goals","lessons","pretest","preResult","posttest","postResult","lesson","activity","self"];
  if(mod.includes(PAGE) && !sd) return U.scale;
  if(!mod.includes(PAGE)) return null;
  const m = M();
  if(PAGE==="pretest" && m.pre) return U.preResult;
  if(PAGE==="preResult" && !m.pre) return U.pretest;
  if(["lessons","lesson","activity","self","posttest","postResult"].includes(PAGE) && !m.pre) return U.pretest;
  if(PAGE==="lesson" && PI>0 && !lessonDone(m,PI-1)) return U.lessons;
  if(PAGE==="activity" && !m.f["L"+PI+".c"]) return LU(PI,"c");
  if(PAGE==="self" && !m.f["L"+PI+".a"]) return LU(PI,"a");
  if(PAGE==="posttest" && m.post) return U.postResult;
  if(PAGE==="posttest" && lessonsDone(m)<NL) return U.lessons;
  if(PAGE==="postResult" && !m.post) return U.posttest;
  return null;
}

/* ================= الهيدر والأيقونات ================= */
const SECTION = {home:"home", instructions:"instructions", login:"account", scale:"scale", scaleResult:"scale", summary:"summary", admin:"admin"};
function topBar(){
  const st = S(), sec = SECTION[PAGE] != null ? SECTION[PAGE] : "modules";
  const items = [["home",U.home,"home","الرئيسية","#2f7cf6"],["instructions",U.instructions,"info","التعليمات","#f59e0b"],["scale",U.scale,"shapes","مقياس الأسلوب","#8b5cf6"],
                 ["modules",U.modules,"layers","الموديولات","#10b981"],["summary",U.summary,"chart","ملخص الأداء","#ec4899"]];
  const locked = !st || !scaleDone(st);
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
  const steps = [["user","سجل بياناتك","اكتب اسمك وكودك مرة واحدة، وادخل بهما في كل مرة."],["shapes","أجب عن مقياس الأسلوب المعرفي","اختباران فرعيان من 16 مفردة، يُحسب زمنهما آلياً."],
    ["test","أدِّ الاختبار القبلي","قبل دراسة الموديول."],["book","ادرس الموضوعات بالترتيب","لكل موضوع صفحة محتوى، ثم صفحة نشاط، ثم صفحة تقويم ذاتي."],
    ["test","أدِّ الاختبار البعدي","بعد إتمام كل موضوعات الموديول."],["chart","راجع ملخص أدائك","درجاتك وتقدمك."]];
  const rules = [["lock","الموضوعات تُفتح بالترتيب، ولا يُفتح موضوع قبل إتمام السابق."],["clock","مقياس الأسلوب والاختباران يُؤدَّى كل منها مرة واحدة فقط."],
    ["save","إجاباتك تُحفظ تلقائياً على هذا الجهاز، فاستخدم نفس الجهاز والمتصفح دائماً."],["shield","الأنشطة العملية تُنفذ في المعمل بعد فصل الكهرباء واتباع قواعد السلامة."],
    ["pen","اكتب إجاباتك بأسلوبك، فالمطلوب تفكيرك أنت."],["help","إذا واجهتك مشكلة فنية فارجع إلى القائم على التجربة."]];
  return head("info","تعليمات استخدام البيئة","اقرأ هذه التعليمات قبل أن تبدأ.")+`
    <h2 class="sec"><span class="si">${ic("steps")}</span>خطوات السير داخل البيئة</h2>
    <div class="g3">${steps.map((s,k)=>`<div class="tile"><span class="stepno">${k+1}</span><div class="ti">${ic(s[0])}</div><h3>${s[1]}</h3><p class="muted small">${s[2]}</p></div>`).join("")}</div>
    <h2 class="sec"><span class="si">${ic("brain")}</span>التوجيه الذكي</h2>
    <div class="def">${ic("brain")}<div>لا تُفتح الموديولات إلا بعد إجابتك عن مقياس الأسلوب المعرفي. تحلل البيئة نتيجتك وتحدد أسلوبك (تحليلي أو كلي)، ثم توجهك تلقائياً إلى نمط التوجيه المناسب لك، وتدرس كل الأنشطة وفقه.</div></div>
    ${PNAME?`<h2 class="sec"><span class="si">${ic(A?"steps":"map")}</span>نمط التوجيه الخاص بك: ${PNAME}</h2>
    <div class="def">${ic(A?"steps":"map")}<div>${A?"تُقدَّم لك المهمة في كل نشاط مقسمة إلى خطوات فرعية متتابعة. تنجز خطوة ثم تُفتح التالية، وتحصل على تغذية راجعة محددة عند كل إجراء.":"تُعرض عليك المهمة في كل نشاط كاملة مع خريطة توجيه تربط جوانبها ببعضها. تنظر للصورة الكلية أولاً، ثم تكوّن تصوراً متكاملاً."}</div></div>`:""}
    <h2 class="sec"><span class="si">${ic("flag")}</span>قواعد مهمة</h2>
    <div class="ilist">${rules.map(r=>`<div class="il"><div class="ii">${ic(r[0])}</div><span>${r[1]}</span></div>`).join("")}</div>`
    + pager(null, S() ? (scaleDone(S()) ? {href:U.modules, t:"الموديولات"} : {href:U.scale, t:"مقياس الأسلوب المعرفي"}) : {href:U.login, t:"تسجيل الدخول"});
}

/* ================= الدخول ================= */
function pLogin(){
  const st = S();
  if(st) return head("user","تسجيل الدخول")+`<div class="card stack" style="max-width:560px;width:100%;margin:0 auto">
      <div class="fb ok">${ic("check")}<span>أنت مسجل الآن باسم <b>${esc(st.name)}</b>.</span></div>
      <div class="row"><a class="btn" href="${scaleDone(st)?U.modules:U.scale}">متابعة${ic("next")}</a><button class="btn ghost" data-act="logoutHere">لست أنا، تسجيل خروج</button></div></div>`;
  return head("user","تسجيل بيانات الطالب","اكتب اسمك وكودك، وادخل بهما في كل مرة.")+`<div class="card" style="max-width:560px;width:100%;margin:0 auto">
    <form id="loginForm" class="stack" novalidate>
      <div><label for="fName">الاسم الرباعي</label><input type="text" id="fName" autocomplete="off"></div>
      <div><label for="fCode">كود الطالب / رقم الجلوس</label><input type="text" id="fCode" autocomplete="off" inputmode="numeric"></div>
      <div class="err" id="loginErr"></div>
      <button class="btn" type="submit">دخول${ic("next")}</button>
    </form></div>`;
}

/* ================= المقياس ================= */
let run = null, tick = null;
function pScale(){
  if(run) return scaleItem();
  const sc = S().scale || {}, sub = sc.s3 ? "s4" : "s3", d = SUB[sub];
  return head("shapes","مقياس الأساليب المعرفية",`${d.name} · الجزء ${sub==="s3"?1:2} من 2`)+`<div class="card stack">
    <h2 class="sec"><span class="si">${ic("info")}</span>تعليمات ${d.name}</h2>
    <div class="stack s">${d.intro.map((t,k)=>`<div class="il" style="box-shadow:none"><div class="ii">${k+1}</div><span>${t}</span></div>`).join("")}</div>
    <div class="fb hint">${ic("clock")}<span>عدد المفردات 16. لا يمكن الرجوع لمفردة سابقة، ولا إعادة الاختبار بعد إنهائه.</span></div>
    <div><button class="btn amber" data-act="startSub" data-sub="${sub}">${ic("play")}ابدأ ${d.name}</button></div>
    <p class="muted small">المقياس من إعداد د. عادل سعد خضر، أستاذ علم النفس، جامعة الزقازيق.</p></div>`;
}
function scaleItem(){
  const d = SUB[run.sub], n = run.i+1;
  clearInterval(tick);
  tick = setInterval(()=>{ const e = document.getElementById("clk"); if(e && run) e.textContent = fmt((performance.now()-run.t0)/1000); else clearInterval(tick); }, 500);
  return `<div class="card stack">
    <div class="row"><span class="chip v">${d.name}</span><span class="grow"></span><span class="chip num">${ic("clock")}<span id="clk">${fmt((performance.now()-run.t0)/1000)}</span></span><span class="chip amber num">المفردة ${n} من 16</span></div>
    <div class="bar"><i style="width:${(run.i/16)*100}%"></i></div>
    <div class="pair">
      <div class="fig"><span class="cap">${d.capA}</span><div class="box"><img alt="الشكل الأول" src="assets/scale/${run.sub}_${n}_a.png"></div></div>
      <div class="fig"><span class="cap">${d.capB}</span><div class="box"><img alt="الشكل الثاني" src="assets/scale/${run.sub}_${n}_b.png"></div></div>
    </div>
    <div class="yn"><button class="y" data-act="ans" data-v="1">${ic("check")}نعم</button><button class="no" data-act="ans" data-v="0">${ic("x")}لا</button></div></div>`;
}
function answer(v){
  const now = performance.now();
  run.ans.push(!!v); run.rt.push(Math.round(now-run.last)); run.last = now; run.i++;
  if(run.i < 16){ render(); return; }
  clearInterval(tick);
  const st = S(); st.scale = st.scale || {};
  st.scale[run.sub] = {ans:run.ans, rt:run.rt, time:+((now-run.t0)/1000).toFixed(1), med:medianRT(run.sub, run.ans, run.rt), score:run.ans.filter((a,k)=>a===KEY[run.sub][k]).length};
  const sub = run.sub; run = null;
  if(sub==="s4"){ st.scale.ratio = +(st.scale.s3.med/st.scale.s4.med).toFixed(3); st.scale.style = st.scale.ratio <= DB.cfg.cutoff ? "holistic" : "analytic"; st.scale.done = true; st.scale.at = new Date().toISOString(); save(); goto(U.scaleResult); return; }
  save(); render(); toTop();
}
function pScaleResult(){
  const st = S(), sc = st.scale, sty = styleOf(st), an = sty==="analytic";
  return head("brain","نتيجة مقياس الأسلوب المعرفي")+`<div class="card stack">
    <div class="row" style="gap:18px"><div class="big">${ic(an?"steps":"map")}</div>
      <div class="grow"><p class="muted">أسلوبك المعرفي</p><h2 style="font-size:1.9rem;color:var(--v-deep)">الأسلوب ال${SNAME[sty]}</h2>
      <p>${an?"تميل إلى معالجة المعلومات جزءاً بعد جزء: تفحص كل عنصر على حدة ثم تبني الصورة الكاملة.":"تميل إلى معالجة المعلومات كصورة واحدة: ترى الكل وعلاقاته أولاً ثم تنزل إلى التفاصيل."}</p></div></div>
    <div class="stats">
      <div class="stat"><b class="num">${sc.s3.score} / 16</b><span>درجة الاختبار الثالث</span></div><div class="stat"><b class="num">${(sc.s3.med/1000).toFixed(2)} ث</b><span>متوسط زمن المفردة (الثالث)</span></div>
      <div class="stat"><b class="num">${sc.s4.score} / 16</b><span>درجة الاختبار الرابع</span></div><div class="stat"><b class="num">${(sc.s4.med/1000).toFixed(2)} ث</b><span>متوسط زمن المفردة (الرابع)</span></div>
    </div></div>
    <div class="card stack s"><h2 class="sec"><span class="si">${ic(an?"steps":"map")}</span>تم توجيهك إلى: التوجيه ال${SNAME[sty]}</h2>
      <div class="ilist">${(an?[["steps","من الجزء إلى الكل."],["list","المهمة مقسمة إلى خطوات فرعية متتابعة."],["bulb","إرشادات تفصيلية عند كل خطوة."],["check","تغذية راجعة محددة حول كل إجراء."]]
        :[["map","من الكل إلى الجزء."],["eye","رؤية شاملة للمهمة قبل تفاصيلها."],["link","توضيح العلاقات بين جوانب المهمة."],["brain","تكوين تصور متكامل للحل."]]).map(x=>`<div class="il"><div class="ii">${ic(x[0])}</div><span>${x[1]}</span></div>`).join("")}</div></div>`
    + pager(null, {href:U.modules, t:"ابدأ الدراسة: الموديولات"});
}

/* ================= الموديولات ================= */
function pModules(){
  return head("layers","الموديولات التعليمية","اختر الموديول الذي تريد دراسته.")+`
    <a class="modcard" href="${U.module}"><div class="side">${ic("wrench")}<b>1</b></div>
      <div class="main"><span class="chip v">${MOD.no}</span><h2>${MOD.title}</h2><p class="muted">${NL} موضوعات تعليمية</p><span class="btn">ادخل الموديول${ic("next")}</span></div></a>`;
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
    <p class="muted">${kind==="pre"?"هذه درجتك قبل دراسة الموديول. ابدأ الآن دراسة الموضوعات.":"أتممت الموديول الأول."}</p></div>`
    + pager(null, kind==="pre" ? {href:U.lessons, t:"موضوعات الموديول"} : {href:U.summary, t:"ملخص الأداء"});
}

/* ================= صفحة المحتوى ================= */
function blocks(l){
  const tone = {ok:"var(--ok)", bad:"var(--bad)", info:"var(--info)"};
  return l.blocks.map(b=>{
    if(b.def) return `<div class="def">${ic("book")}<div>${b.def}</div></div>`;
    if(b.p) return `<p style="font-size:1.06rem">${b.p}</p>`;
    if(b.note) return `<div class="note">${ic("bulb")}<span>${b.note}</span></div>`;
    if(b.list) return `<h3 class="sec"><span class="si">${ic("list")}</span>${b.h}</h3><div class="ilist">${b.list.map(x=>`<div class="il"><div class="ii">${ic(x[0])}</div><span>${x[1]}</span></div>`).join("")}</div>`;
    if(b.cards) return `<h3 class="sec"><span class="si">${ic("list")}</span>${b.h}</h3><div class="g3">${b.cards.map((x,k)=>`<div class="tile"><span class="stepno">${k+1}</span><div class="ti">${ic(x[0])}</div><h3>${x[1]}</h3><p class="muted">${x[2]}</p></div>`).join("")}</div>`;
    if(b.types) return `<div class="types">${b.types.map(t=>`<div class="ty" style="--tc:${tone[t.tone]}"><div class="hd">${ic(t.icon)}<div><b>${t.name}</b><span dir="auto">${t.en}</span></div></div><div class="bd">${t.def?`<p>${t.def}</p>`:""}${t.ex.length?`<ul>${t.ex.map(e=>`<li>${ic("check")}<span>${e}</span></li>`).join("")}</ul>`:""}</div></div>`).join("")}</div>`;
    if(b.comp) return `<div class="comp">${b.comp.map(c=>`<div class="cp"><div class="ci">${ic(c[0])}</div><h4>${c[1]}<span dir="ltr">${c[2]}</span></h4><dl><div><dt>الوظيفة</dt><dd>${c[3]}</dd></div><div><dt>ما يُفحص أثناء الصيانة</dt><dd>${c[4]}</dd></div></dl></div>`).join("")}</div>`;
    if(b.rules) return `<div class="rules">${b.rules.map((r,k)=>`<div class="rule"><div class="rn">${ic(r[0])}<i>${k+1}</i></div><span>${r[1]}</span></div>`).join("")}</div>`;
    if(b.steps) return `<h3 class="sec"><span class="si">${ic("steps")}</span>${b.h}</h3><div class="tl">${b.steps.map((s,k)=>`<div class="st"><div class="ln"><b>${ic(s.icon)}</b></div><div class="bx"><h4><small>الخطوة ${k+1}:</small> ${s.t}</h4><ul>${s.items.map(x=>`<li>${x}</li>`).join("")}</ul></div></div>`).join("")}</div>`;
    return "";
  }).join("");
}
function pLesson(){
  const l = MOD.lessons[PI];
  return head(l.icon,l.t,`الموضوع ${PI+1} من ${NL}`)+blocks(l)
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
  const brief = `<div class="brief"><div class="b goal-b">${ic("target")}<div><b>الهدف من النشاط</b>${a.goal}</div></div>
     <div class="b lvl-b">${ic(a.lab?"wrench":"pen")}<div><b>${a.lab?"نشاط عملي يُنفذ في المعمل":"نشاط تحليل وتطبيق"}</b>مستوى الإرشاد الحالي: ${HELP[(m.need||{})[K+".a"]||0]}</div></div>
     <div class="b task-b">${ic("alert")}<div><b>المهمة المطلوب تنفيذها</b>${a.task}</div></div></div>`;
  const strip = `<div class="strip">${a.A.map((s,k)=>`<div><b>${k+1}</b><span>${s}</span></div>`).join("")}</div>`;
  let guide, product = "";
  if(A){
    if(pr.type==="text"){
      const k = Math.min(m.p[K]||0, a.A.length-1);
      guide = a.A.map((s,j)=>`<div class="astep ${j<k||done?"dn":(j===k?"cur":"lk")}"><b>${j<k||done?ic("check"):j+1}</b><div class="tx"><p>${s}</p>${j<=k||done?ta(`${K}.A.s${j}`):`<span class="muted small">${ic("lock")} تُفتح بعد إتمام الخطوة السابقة</span>`}
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
    guide = `<div class="hub"><div class="core">${ic("eye")}انظر للمهمة كصورة واحدة</div><div class="stem"></div><div class="ring">${a.H.map(s=>`<div>${ic("link")}<span>${s}</span></div>`).join("")}</div></div>`;
    if(pr.type==="table") product = `<h3 class="sec"><span class="si">${ic("test")}</span>${pr.name}</h3><div class="scroll"><table class="ftable"><thead><tr><th>${pr.rowLabel}</th>${pr.cols.map(c=>`<th>${c.label}</th>`).join("")}</tr></thead><tbody>${pr.rows.map((r,j)=>`<tr><td>${r}</td>${pr.cols.map((c,ci)=>`<td>${field(`${K}.T.r${j}.c${ci}`,c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    if(pr.type==="classify") product = classifyH(m,K+".a",pr.cats,pr.items.map(x=>[x.t,x.c,x.why]),pr.hintH,"صنّف البطاقات كلها ثم تحقق",pr.ex,i);
    product += `<div class="stack s"><h3 class="sec"><span class="si">${ic("map")}</span>تصورك المتكامل</h3><p class="muted">اكتب تصوراً واحداً يجمع جوانب التوجيه السابقة ويربط بينها.</p>${ta(`${K}.H.all`,"اكتب تصورك المتكامل هنا")}</div>`;
  }
  return head("pen",`النشاط التعليمي (${i+1})`,l.t)+brief
    + (!A && MAP_LESSONS.includes(i) ? systemMap(m,K) : "")
    + `<div class="gpanel"><div class="gh">${ic(A?"steps":"map")}${A?"التوجيه التحليلي: نفّذ المهمة خطوة بخطوة":"التوجيه الكلي: كوّن الصورة الكاملة أولاً"}</div><div class="gb">${guide}</div></div>`
    + product + (done?`<div class="fb ok">${ic("check")}<span>أتممت هذا النشاط.</span></div>`:"") + `<div class="err">${vp.err||""}</div>`
    + pager({href:LU(i,"c"), t:"المحتوى"}, {act:"doneAct", t:"التقويم الذاتي"});
}
const helpChip = lv => lv ? `<span class="chip amber">${ic("bulb")}مستوى الإرشاد: ${HELP[lv]}</span>` : "";
const workedEx = (ex,cats) => ex ? `<div class="worked"><b>${ic("book")}مثال محلول</b><div class="wk-q">${ex.t}</div><div class="wk-a"><span class="chip ok">${ic("check")}${cats[ex.c]}</span><span>${ex.why}</span></div></div>` : "";
const reviewBox = i => `<div class="fb hint">${ic("refresh")}<span>راجع صفحة المحتوى، فيها تعريف كل فئة وأمثلتها. <a class="btn ghost sm" href="${LU(i,"c")}">${ic("book")}صفحة المحتوى</a></span></div>`;
// تحليلي: بطاقة واحدة في كل مرة، وتغذية راجعة محددة تتدرج مع الخطأ: تلميح ← مثال محلول ← مراجعة المحتوى وإظهار الإجابة
function classifyA(m,i,pr){
  const key = "L"+i+".a", c = m.c[key] || (m.c[key] = {k:0, e:{}, ok:false}), n = pr.items.length;
  const past = pr.items.slice(0,c.k).map(x=>`<div class="citem r"><div class="row"><span class="chip ok">${ic("check")}${pr.cats[x.c]}</span><b class="grow">${x.t}</b></div><span class="small">${x.why}</span></div>`).join("");
  if(c.k>=n) return `<h3 class="sec"><span class="si">${ic("shapes")}</span>نتيجة التصنيف</h3>${past}`;
  const x = pr.items[c.k], fb = vp.cfb, wrong = c.e[c.k]||0, solved = fb && fb.ok, lv = Math.min(3, wrong);
  return `<div class="row"><h3 class="sec grow"><span class="si">${ic("shapes")}</span>صنّف البطاقات واحدة بعد أخرى <span class="chip amber num">${c.k+1} من ${n}</span></h3>${helpChip(lv)}</div>${past}
    <div class="bigcard">${x.t}</div>
    <div class="cats" style="justify-content:center">${pr.cats.map((t,k)=>`<button class="cat ${fb&&fb.k===k?"sel":""}" ${solved?"disabled":""} data-act="cA" data-k="${k}">${t}</button>`).join("")}</div>
    ${solved?`<div class="fb ok">${ic("check")}<span><b>صحيح.</b> ${x.why}</span></div><div style="text-align:center"><button class="btn sm" data-act="cANext">${c.k<n-1?"البطاقة التالية":"إنهاء التصنيف"}${ic("next")}</button></div>`:""}
    ${fb&&!fb.ok?`<div class="fb bad">${ic("x")}<span><b>ليست «${pr.cats[fb.k]}».</b> ${HINT_A[i]||""}</span></div>`:""}
    ${!solved&&lv>=2?workedEx(pr.ex,pr.cats):""}
    ${!solved&&lv>=3?reviewBox(i)+`<div class="fb info">${ic("info")}<span>الإجابة الصحيحة: <b>${pr.cats[x.c]}</b>. ${x.why} اختر الفئة الصحيحة لتكمل.</span></div>`:""}`;
}
// كلي: كل العناصر معاً ثم تحقق واحد؛ الإرشاد يتدرج مع المحاولات: تلميح عام ← مثال محلول ← مراجعة المحتوى وإظهار الصحيح
function classifyH(m,key,cats,items,hint,title,ex,li){
  const c = m.c[key] || (m.c[key] = {pick:{}, chk:false, ok:false, tries:0});
  const right = items.filter((x,j)=>c.pick[j]===x[1]).length, fails = c.fails||0, lv = c.ok ? 0 : Math.min(3, fails);
  return `<div class="row"><h3 class="sec grow"><span class="si">${ic("shapes")}</span>${title}</h3>${helpChip(lv)}</div>
    ${items.map((x,j)=>{ const st = c.chk ? (c.pick[j]===x[1]?"r":"w") : ""; return `<div class="citem ${st}"><b>${x[0]}</b><div class="cats">${cats.map((t,k)=>`<button class="cat ${c.pick[j]===k?"sel":""}" ${c.ok?"disabled":""} data-act="cH" data-key="${key}" data-j="${j}" data-k="${k}">${t}</button>`).join("")}</div>${c.ok&&x[2]?`<span class="small">${x[2]}</span>`:""}${!c.ok&&lv>=3&&st==="w"?`<span class="small">الصحيح: <b>${cats[x[1]]}</b>${x[2]?" · "+x[2]:""}</span>`:""}</div>`; }).join("")}
    ${c.chk&&!c.ok?`<div class="fb bad">${ic("x")}<span><b>${right} من ${items.length} في موضعها الصحيح.</b> العناصر المظللة بالأحمر تحتاج إعادة نظر.</span></div>`:""}
    ${!c.ok&&lv>=1&&hint?`<div class="fb hint">${ic("bulb")}<span>${hint}</span></div>`:""}
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

/* ================= ملخص الأداء ================= */
function pSummary(){
  const st = S(), m = M(), sty = styleOf(st), p = progress(m);
  const gain = m.pre&&m.post ? m.post.score-m.pre.score : null;
  const cell = d => d ? `<span class="chip ok">${ic("check")}تم</span>` : `<span class="chip">لم يتم</span>`;
  return head("chart","ملخص الأداء",esc(st.name))+`<div class="stats">
      <div class="stat"><b>${sty?SNAME[sty]:"-"}</b><span>الأسلوب المعرفي</span></div>
      <div class="stat"><b>${PNAME||"-"}</b><span>نمط التوجيه</span></div>
      <div class="stat"><b class="num">${m.pre?m.pre.score+" / 10":"-"}</b><span>الاختبار القبلي</span></div>
      <div class="stat"><b class="num">${m.post?m.post.score+" / 10":"-"}</b><span>الاختبار البعدي</span></div>
      <div class="stat"><b class="num">${gain==null?"-":(gain>0?"+":"")+gain}</b><span>الفرق بين القبلي والبعدي</span></div>
      <div class="stat"><b class="num">${lessonsDone(m)} / ${NL}</b><span>موضوعات مكتملة</span></div>
      <div class="stat"><b>${level(m)}</b><span>مستوى الإرشاد</span></div>
    </div>
    <div class="card stack s"><div class="row"><h3 class="grow">التقدم في ${MOD.no}</h3><b class="num">${p}%</b></div><div class="bar"><i style="width:${p}%"></i></div>
      <div class="scroll"><table class="t"><thead><tr><th>م</th><th>الموضوع</th><th>المحتوى</th><th>النشاط</th><th>التقويم الذاتي</th></tr></thead><tbody>
      ${MOD.lessons.map((l,i)=>`<tr><td class="num">${i+1}</td><td>${l.t}</td><td>${cell(m.f["L"+i+".c"])}</td><td>${cell(m.f["L"+i+".a"])}</td><td>${cell(m.f["L"+i+".s"])}</td></tr>`).join("")}</tbody></table></div></div>`;
}

/* ================= لوحة الباحث ================= */
let adminOk = false; try{ adminOk = sessionStorage.getItem(LS+"-admin")==="1"; }catch(e){}
const q = v => `"${String(v==null?"":v).replace(/"/g,'""')}"`;
function csvSummary(){
  const h = ["code","name","guidance","s3_score","s3_median_rt_ms","s3_total_s","s4_score","s4_median_rt_ms","s4_total_s","wa_ratio","cognitive_style","pre","post","lessons_done","classify_errors","help_hint","help_example","help_review","map_nodes_explored","started"];
  return [h.join(","),...Object.values(DB.students).map(s=>{ const c=s.scale||{}, m=s.m||{f:{},err:""}; return [s.code,s.name,styleOf(s)||"",c.s3?c.s3.score:"",c.s3?c.s3.med:"",c.s3?c.s3.time:"",c.s4?c.s4.score:"",c.s4?c.s4.med:"",c.s4?c.s4.time:"",c.ratio||"",styleOf(s)||"",m.pre?m.pre.score:"",m.post?m.post.score:"",s.m?lessonsDone(s.m):0,m.err,...(s.m?helpCounts(s.m):["","",""]),s.m&&s.m.map?Object.values(s.m.map).reduce((a,v)=>a+v.length,0):"",s.created].map(q).join(","); })].join("\n");
}
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
  const done = list.filter(s=>scaleDone(s)), by = k => done.filter(s=>styleOf(s)===k);
  const grp = k => { const g = by(k), pre = g.filter(s=>s.m&&s.m.pre).map(s=>s.m.pre.score), post = g.filter(s=>s.m&&s.m.post).map(s=>s.m.post.score);
    const pairs = g.filter(s=>s.m&&s.m.pre&&s.m.post); return {n:g.length, pre:avg(pre), post:avg(post), npre:pre.length, npost:post.length,
      gain:avg(pairs.map(s=>s.m.post.score-s.m.pre.score)), done:avg(g.map(s=>s.m?lessonsDone(s.m):0)), fin:g.filter(s=>s.m&&s.m.post).length}; };
  const G = {analytic:grp("analytic"), holistic:grp("holistic")};
  const tile = (icon,v,t) => `<div class="stat"><b class="num">${v}</b><span>${ic(icon)} ${t}</span></div>`;
  const bar = (v,cls,label,sw) => `<div class="vb ${cls}" style="--h:${v==null?0:v*10}%" title="${label}: ${f1(v)} من 10"><span class="vv num">${f1(v)}</span></div>`;
  const group = (k,name) => `<div class="vg"><div class="vbars">${bar(G[k].pre,"s1","القبلي")}${bar(G[k].post,"s2","البعدي")}</div><div class="vl">${name}<small>ن = ${G[k].n}</small></div></div>`;
  return `<div class="card stack s"><h3>${ic("chart")} إحصاءات التجربة</h3>
    <div class="stats">${tile("user",list.length,"طالب مسجل")}${tile("shapes",done.length,"أكملوا المقياس")}${tile("steps",G.analytic.n,"نمط تحليلي")}${tile("map",G.holistic.n,"نمط كلي")}${tile("check",G.analytic.fin+G.holistic.fin,"أكملوا الموديول")}</div>
    <div class="g2" style="align-items:start">
      <div class="vchart"><div class="vt">متوسط درجة الاختبار القبلي والبعدي (من 10) حسب نمط التوجيه</div>
        <div class="vlegend"><span><i class="s1"></i>القبلي</span><span><i class="s2"></i>البعدي</span></div>
        <div class="vplot"><div class="vgrid"><span data-v="10"></span><span data-v="5"></span><span data-v="0"></span></div>${group("analytic","التوجيه التحليلي")}${group("holistic","التوجيه الكلي")}</div></div>
      <div class="scroll"><table class="t"><thead><tr><th>النمط</th><th>العدد</th><th>متوسط القبلي</th><th>متوسط البعدي</th><th>متوسط الفرق</th><th>متوسط الموضوعات المكتملة</th></tr></thead><tbody>
        ${[["analytic","تحليلي"],["holistic","كلي"]].map(([k,n])=>`<tr><td>${n}</td><td class="num">${G[k].n}</td><td class="num">${f1(G[k].pre)} <small class="muted">(${G[k].npre})</small></td><td class="num">${f1(G[k].post)} <small class="muted">(${G[k].npost})</small></td><td class="num">${G[k].gain==null?"-":(G[k].gain>0?"+":"")+f1(G[k].gain)}</td><td class="num">${f1(G[k].done)} / ${NL}</td></tr>`).join("")}
      </tbody></table><p class="muted small" style="margin-top:6px">الأرقام بين القوسين عدد من أدّى الاختبار. الفرق محسوب لمن أدّى الاختبارين.</p></div>
    </div></div>`;
}
function pAdmin(){
  if(!adminOk) return head("lock","دخول الأدمن","لوحة الباحث، للقائم على التجربة فقط.")+`<div class="card" style="max-width:440px;width:100%;margin:0 auto">
    <form id="pinForm" class="stack">${ONLINE?`<div><label for="fEmail">البريد الإلكتروني</label><input type="text" id="fEmail" dir="ltr" autocomplete="username" inputmode="email"></div><div><label for="fPin">كلمة المرور</label><input type="password" id="fPin" autocomplete="current-password"></div>`:`<div><label for="fPin">الرقم السري</label><input type="password" id="fPin" autocomplete="off"></div>`}<div class="err" id="pinErr"></div><button class="btn" type="submit">دخول${ic("next")}</button></form></div>`;
  const list = Object.values(DB.students);
  if(vp.detail && DB.students[vp.detail]){ const s = DB.students[vp.detail], r = s.m ? s.m.r : {};
    return head("user",esc(s.name),"إجابات الطالب المكتوبة")+Object.keys(r).sort().filter(k=>(r[k]||"").trim()).map(k=>`<div class="card stack s" style="padding:16px"><b class="small" style="color:var(--v)">${esc(label(k))}</b><p>${esc(r[k])}</p></div>`).join("")
      +(Object.keys(r).length?"":`<p class="muted">لا توجد إجابات مكتوبة بعد.</p>`)+`<div class="pager"><button class="btn ghost" data-act="adminBack">${ic("prev")}قائمة الطلاب</button><span></span></div>`; }
  const rows = list.map(s=>{ const c=s.scale||{}, sty=styleOf(s), m=s.m;
    return `<tr><td>${esc(s.code)}</td><td>${esc(s.name)}</td><td class="num">${c.s3?c.s3.score+" · "+(c.s3.med/1000).toFixed(2)+" ث":"-"}</td><td class="num">${c.s4?c.s4.score+" · "+(c.s4.med/1000).toFixed(2)+" ث":"-"}</td><td class="num">${c.ratio||"-"}${lowAcc(c)?` <span class="chip amber" title="درجة أقل من 9 من 16 في أحد الاختبارين">دقة منخفضة</span>`:""}</td>
     <td>${s.scale&&s.scale.done?`<select data-ov="${esc(s.code)}" aria-label="نمط التوجيه"><option value="">${SNAME[s.scale.style||(s.scale.ratio<=DB.cfg.cutoff?"holistic":"analytic")]} (من المقياس)</option><option value="analytic" ${s.override==="analytic"?"selected":""}>تحليلي (يدوي)</option><option value="holistic" ${s.override==="holistic"?"selected":""}>كلي (يدوي)</option></select>`:`<span class="chip">لم يُكمل المقياس</span>`}</td>
     <td class="num">${m&&m.pre?m.pre.score:"-"}</td><td class="num">${m&&m.post?m.post.score:"-"}</td><td class="num">${m?lessonsDone(m)+" / "+NL:"-"}</td><td class="num">${m?m.err:"-"}</td>
     <td><button class="btn ghost sm" data-act="detail" data-code="${esc(s.code)}">الإجابات</button> <button class="btn ghost sm" data-act="delStu" data-code="${esc(s.code)}">${vp.del===s.code?"تأكيد الحذف":"حذف"}</button></td></tr>`; }).join("");
  return head("chart","لوحة الباحث","نمط التوجيه يتحدد لكل طالب تلقائياً من مقياس الأسلوب المعرفي")+`
    <div class="row">${ONLINE?`<span class="chip ok">${ic("check")}متصل بقاعدة البيانات · ${esc(FB.adminEmail()||"")}</span><button class="btn ghost sm" data-act="adminRefresh">${ic("refresh")}تحديث البيانات</button>`:`<span class="chip amber">${ic("alert")}وضع محلي: البيانات من هذا الجهاز فقط</span>`}<span class="grow"></span><button class="btn ghost sm" data-act="adminOut">${ic("out")}خروج الأدمن</button></div>
    ${adminStats(list)}
    <div class="card row"><div style="flex:0 1 280px"><label for="fCut">حد تصنيف الأسلوب (نسبة كلي/تحليلي)</label><input type="number" id="fCut" step="0.01" min="0.1" value="${DB.cfg.cutoff}"></div><p class="muted small grow">النسبة = وسيط زمن الاستجابة في الاختبار الثالث (مطابقة الأشكال) ÷ وسيطه في الاختبار الرابع (الأشكال المتضمنة)، محسوباً على المفردات الصحيحة. النسبة ≤ الحد = كلي، وأكبر منه = تحليلي. يُطبَّق الحد على من يُكمل المقياس بعد تعديله، ونمط من أكمله يبقى ثابتاً إلا إذا غيرته يدوياً من جدول الطلاب.</p></div>
    <div class="card stack s"><h3>الطلاب (${list.length})</h3><div class="scroll"><table class="t"><thead><tr><th>الكود</th><th>الاسم</th><th>الثالث (درجة · وسيط الزمن)</th><th>الرابع (درجة · وسيط الزمن)</th><th>النسبة</th><th>نمط التوجيه</th><th>قبلي</th><th>بعدي</th><th>الموضوعات</th><th>أخطاء</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="11" class="muted">لا توجد بيانات بعد.</td></tr>`}</tbody></table></div></div>
    <div class="g2"><div class="card stack s"><h3>تصدير النتائج (CSV)</h3><textarea class="mono" id="csv1" readonly>${esc(csvSummary())}</textarea><div class="row"><button class="btn sm" data-act="copy" data-t="csv1">نسخ</button><span class="muted small" id="m-csv1"></span></div></div>
      <div class="card stack s"><h3>تصدير الإجابات المكتوبة (CSV)</h3><textarea class="mono" id="csv2" readonly>${esc(csvAnswers())}</textarea><div class="row"><button class="btn sm" data-act="copy" data-t="csv2">نسخ</button><span class="muted small" id="m-csv2"></span></div></div></div>`;
}

/* ================= العرض والأحداث ================= */
const PAGES = {home:pHome, instructions:pInstructions, login:pLogin, scale:pScale, scaleResult:pScaleResult, modules:pModules, module:pModule, goals:pGoals, lessons:pLessons,
  pretest:()=>pTest("pre"), preResult:()=>pTestResult("pre"), posttest:()=>pTest("post"), postResult:()=>pTestResult("post"),
  lesson:pLesson, activity:pActivity, self:pSelf, summary:pSummary, admin:pAdmin};
function render(){
  const b = document.getElementById("pbody"), t = document.getElementById("ptop"), g = document.getElementById("pbot"), y = b.scrollTop;
  b.innerHTML = PAGES[PAGE]();
  t.replaceChildren(); g.replaceChildren();
  const h = b.firstElementChild; if(h && h.classList.contains("phead")) t.appendChild(h);
  const p = b.lastElementChild; if(p && p.classList.contains("pager")) g.appendChild(p);
  b.classList.toggle("center", PAGE==="home");
  b.scrollTop = y;
}
const toTop = () => { const b = document.getElementById("pbody"); if(b) b.scrollTop = 0; };
function fail(msg){ vp.err = msg; render(); const e = document.querySelector("#pbody .err:not(:empty)"); if(e) e.scrollIntoView({block:"center", behavior:"smooth"}); }

document.addEventListener("click", ev=>{
  const ln = ev.target.closest("a[href]");
  if(ln){ const h = ln.getAttribute("href"); if(!ln.target && !/^(https?:|mailto:|tel:|#)/.test(h)){ ev.preventDefault(); goto(h); } return; }
  const a = ev.target.closest("[data-act]"); if(!a || a.disabled) return;
  const d = a.dataset, m = S() ? M() : null;
  switch(d.act){
    case "logout": setMe(null); goto(U.home); break;
    case "logoutHere": setMe(null); location.reload(); break;
    case "startSub": run = {sub:d.sub, i:0, ans:[], rt:[], t0:performance.now(), last:performance.now()}; render(); toTop(); break;
    case "ans": answer(d.v==="1"); break;
    case "tq": TT[d.kind][+d.q] = +d.o; vp.err = ""; render(); break;
    case "submitTest": submitTest(PAGE==="pretest"?"pre":"post"); break;
    case "doneContent": m.f["L"+PI+".c"] = m.f["L"+PI+".c"] || Date.now(); goto(LU(PI,"a")); break;
    case "aNext": { const K = "L"+PI; if((m.r[`${K}.A.s${d.j}`]||"").trim().length<2){ vp.err = "اكتب إجابتك في هذه الخطوة أولاً."; } else { m.p[K] = +d.j+1; vp.err = ""; save(); } render(); break; }
    case "rNext": { const K = "L"+PI, pr = MOD.lessons[PI].act.prod; if(!pr.cols.every((_,ci)=>(m.r[`${K}.T.r${d.j}.c${ci}`]||"").trim().length>=2)){ vp.err = "أكمل خانات هذا البند أولاً."; } else { m.p[K] = +d.j+1; vp.err = ""; save(); } render(); break; }
    case "cA": { const c = m.c["L"+PI+".a"], x = MOD.lessons[PI].act.prod.items[c.k], ok = x.c === +d.k; if(!ok){ c.e[c.k] = (c.e[c.k]||0)+1; m.err++; raiseNeed(m, "L"+PI+".a", c.e[c.k]); } save(); vp.cfb = {k:+d.k, ok}; vp.err = ""; render(); break; }
    case "cANext": { const c = m.c["L"+PI+".a"]; c.k++; if(c.k >= MOD.lessons[PI].act.prod.items.length) c.ok = true; save(); vp.cfb = null; render(); break; }
    case "cH": { const c = m.c[d.key]; c.pick[+d.j] = +d.k; c.chk = false; saveSoon(); render(); break; }
    case "cHCheck": { const c = m.c[d.key], n = +d.n, K = d.key.split("."), l = MOD.lessons[+K[0].slice(1)];
      const items = K[1]==="a" ? l.act.prod.items.map(x=>x.c) : l.sa[+K[1].slice(1)].items.map(x=>x[1]);
      if(Object.keys(c.pick).length < n){ const e = document.getElementById("e-"+d.key.replace(/\./g,"-")); if(e) e.textContent = "صنّف كل العناصر أولاً."; break; }
      const wrong = items.filter((k,j)=>c.pick[j]!==k).length; c.chk = true; c.tries++; if(wrong){ m.err += wrong; c.fails = (c.fails||0)+1; raiseNeed(m, d.key, c.fails); } else c.ok = true; save(); vp.err = ""; render(); break; }
    case "mapNode": { const K = "L"+PI+".map"; m.map = m.map || {}; const s_ = m.map["L"+PI] || (m.map["L"+PI] = []); if(!s_.includes(d.id)) s_.push(d.id); vp.ms = d.id; vp.mf = false; save(); render(); break; }
    case "mapFail": vp.mf = !vp.mf; render(); break;
    case "doneAct": finishActivity(); break;
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
document.addEventListener("keydown", ev=>{ if((ev.key==="Enter"||ev.key===" ") && ev.target.matches && ev.target.matches("g.sn")){ ev.preventDefault(); ev.target.dispatchEvent(new MouseEvent("click",{bubbles:true})); } });
document.addEventListener("input", ev=>{ const k = ev.target.dataset && ev.target.dataset.r; if(k && S()){ M().r[k] = ev.target.value; saveSoon(); } });
document.addEventListener("change", ev=>{
  if(ev.target.id==="fCut"){ const v = parseFloat(ev.target.value); if(v>0){ DB.cfg.cutoff = v; save(); if(ONLINE) FB.saveSettings({cutoff:v}).catch(e=>alertAdmin(e)); render(); } }
  if(ev.target.dataset && ev.target.dataset.ov){ const code = ev.target.dataset.ov, s = DB.students[code], v = ev.target.value; if(s){ if(v) s.override = v; else delete s.override; save(); if(ONLINE) FB.setOverride(code, v).catch(e=>alertAdmin(e)); render(); } }
  const k = ev.target.dataset && ev.target.dataset.r; if(k && S() && ev.target.tagName==="SELECT"){ M().r[k] = ev.target.value; saveSoon(); }
});
document.addEventListener("submit", ev=>{
  ev.preventDefault();
  if(ev.target.id==="loginForm"){
    const name = document.getElementById("fName").value.trim().replace(/\s+/g," "), code = document.getElementById("fCode").value.trim(), er = document.getElementById("loginErr");
    if(name.split(" ").length < 2){ er.textContent = "اكتب اسمك كاملاً."; return; }
    if(!code){ er.textContent = "اكتب كود الطالب."; return; }
    if(!/^[0-9A-Za-z\u0660-\u0669_-]{1,30}$/.test(code)){ er.textContent = "الكود يتكون من أرقام أو حروف إنجليزية فقط."; return; }
    if(ONLINE){ studentLogin(name, code, er, ev.target.querySelector("button")); return; }
    const ex = DB.students[code];
    if(ex && ex.name !== name){ er.textContent = "هذا الكود مسجل باسم آخر. راجع الكود أو الاسم."; return; }
    if(!ex) DB.students[code] = {name, code, created:new Date().toISOString()};
    setMe(code); save(); goto(scaleDone(S()) ? U.modules : U.scale);
  }
  if(ev.target.id==="pinForm" && ONLINE){ adminLogin(ev.target); return; }
  if(ev.target.id==="pinForm"){ if(document.getElementById("fPin").value === CONFIG.pin){ adminOk = true; try{ sessionStorage.setItem(LS+"-admin","1"); }catch(e){} render(); } else document.getElementById("pinErr").textContent = "الرقم السري غير صحيح."; }
});
window.addEventListener("beforeunload", ()=>{ try{ localStorage.setItem(LS, JSON.stringify(DB)); }catch(e){} if(ONLINE && me) push(); });

/* ---- الأدمن على قاعدة البيانات ---- */
function alertAdmin(e){ console.warn(e); const m = e && e.code==="permission-denied" ? "ليست لديك صلاحية الأدمن على قاعدة البيانات." : "تعذر الحفظ على قاعدة البيانات. تحقق من الإنترنت."; syncNote(m); setTimeout(()=>syncNote(""), 5000); }
async function loadAdmin(){
  const list = await FB.listStudents(); DB.students = list;
  const st = await FB.getSettings().catch(()=>null); if(st && st.cutoff) DB.cfg.cutoff = st.cutoff;
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

/* ---- تسجيل دخول الطالب على قاعدة البيانات ---- */
async function studentLogin(name, code, er, btn){
  btn.disabled = true; er.textContent = "";
  try{
    await FB.ensureStudentAuth();
    let state, remote = null;
    try{ remote = await FB.getStudent(code); state = remote ? "own" : "none"; }
    catch(e){ if(e && e.code==="permission-denied") state = "other"; else throw e; }
    if(state==="own" && remote.name !== name){ er.textContent = "هذا الكود مسجل باسم آخر. راجع الكود أو الاسم."; btn.disabled = false; return; }
    if(state==="none"){ remote = {name, code, uid:FB.uid(), created:new Date().toISOString()}; await FB.createStudent(code, remote); }
    if(state==="other"){
      try{ await FB.claimStudent(code, name); remote = await FB.getStudent(code); }
      catch(e){ er.textContent = "هذا الكود مسجل باسم آخر. اكتب اسمك كما سجلته أول مرة."; btn.disabled = false; return; }
    }
    DB.students[code] = remote; setMe(code); save();
    goto(scaleDone(remote) ? U.modules : U.scale);
  }catch(e){
    console.warn(e); er.textContent = "تعذر الاتصال بقاعدة البيانات. تأكد من الإنترنت وأعد المحاولة."; btn.disabled = false;
  }
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
        await fb.ensureAnon();
        const st = await fb.getSettings().catch(()=>null); if(st && st.cutoff) DB.cfg.cutoff = st.cutoff;
        if(me){
          // البيانات على الخادم هي المرجع؛ النسخة المحلية للطوارئ فقط
          let remote = null; try{ remote = await fb.getStudent(me); }catch(e){ if(e && e.code==="permission-denied") remote = false; }
          if(remote) DB.students[me] = remote;
          else if(remote===false || fb.isAdminUser()) setMe(null);
        }
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
