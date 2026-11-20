/* ================= الواقع المعزز: نموذج اللوحة الأم ثلاثي الأبعاد + الكاميرا + قراءة علامة QR ================= */
/* global THREE, jsQR */
window.AR = (function () {
  let renderer, scene, camera, root, inner, wrap, raf = 0, last = 0, t = 0;
  let step = 0, mode = "free", anchor = null, lostAt = 0, part = null;
  let rotY = -0.55, rotX = 0, drag = null;
  const O = {};          // الأجزاء المتحركة
  const T = {};          // القيم المستهدفة للحركة
  const MARK = "SG-RAM"; // محتوى علامة QR لمهارة الذاكرة

  const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0.1 }, o || {}));
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  function label(text, bg, fg) {
    const c = document.createElement("canvas"); c.width = 512; c.height = 128;
    const g = c.getContext("2d"); g.fillStyle = bg; const r = 40;
    g.beginPath(); g.moveTo(r, 8); g.arcTo(504, 8, 504, 120, r); g.arcTo(504, 120, 8, 120, r); g.arcTo(8, 120, 8, 8, r); g.arcTo(8, 8, 504, 8, r); g.fill();
    g.fillStyle = fg; g.font = "bold 58px Tajawal, Cairo, Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.direction = "rtl";
    g.fillText(text, 256, 68);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    s.scale.set(2.6, 0.65, 1); s.renderOrder = 10; return s;
  }
  function ramStick(color) {
    const g = new THREE.Group();
    g.add(box(0.07, 1.25, 5.2, mat(color)));
    for (let i = 0; i < 8; i++) { const ch = box(0.06, 0.5, 0.48, mat(0x15181d)); ch.position.set(0.06, 0.12, -2.1 + i * 0.6); g.add(ch); }
    const gold = box(0.075, 0.12, 5.0, mat(0xd4a017, { metalness: 0.8, roughness: 0.3 })); gold.position.y = -0.56; g.add(gold);
    return g;
  }
  function build() {
    root = new THREE.Group(); scene.add(root);
    inner = new THREE.Group(); inner.position.set(-1.6, 0, -0.4); root.add(inner);
    const board = box(10, 0.16, 8, mat(0x1d6b46)); inner.add(board);
    // عناصر اللوحة
    const caps = [[-3.6, 1.6], [-3.2, 2.6], [0.4, 2.2], [0.9, -3.2], [-0.4, -3.3], [3.8, -3.0], [4.2, 3.2]];
    caps.forEach(([x, z]) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.45, 16), mat(0x2b2f36, { metalness: 0.4 })); c.position.set(x, 0.3, z); inner.add(c); });
    const socket = box(2.4, 0.25, 2.4, mat(0x9aa3ad, { metalness: 0.6 })); socket.position.set(-1.6, 0.2, -0.6); inner.add(socket); O.socket = socket; O.board = board;
    const fins = box(2.2, 0.9, 2.2, mat(0xb8c0c8, { metalness: 0.7, roughness: 0.35 })); fins.position.set(-1.6, 0.78, -0.6); inner.add(fins); O.fins = fins;
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.16, 32), mat(0x30353d)); fan.position.set(-1.6, 1.32, -0.6); inner.add(fan); O.fan = fan;
    const chip = box(1.4, 0.4, 1.4, mat(0x2b3440)); chip.position.set(-1.4, 0.28, 2.6); inner.add(chip);
    const io = box(1, 1, 4, mat(0x4a525c, { metalness: 0.5 })); io.position.set(-4.5, 0.58, -1.6); inner.add(io);
    const pcie = box(6, 0.3, 0.35, mat(0x22262c)); pcie.position.set(-1, 0.23, 3.4); inner.add(pcie);
    const lbl = label("اللوحة الأم", "rgba(255,255,255,.92)", "#1d2939"); lbl.position.set(-3.2, 1.3, 3.4); lbl.scale.set(2.2, 0.55, 1); inner.add(lbl);
    // شقوق الذاكرة
    [1.9, 2.6].forEach((x, i) => { const s = box(0.3, 0.38, 5.6, mat(0x23272e)); s.position.set(x, 0.27, -0.6); inner.add(s); if (i === 0) O.slot = s; });
    O.clips = [];
    [-1, 1].forEach(sd => {
      const pivot = new THREE.Group(); pivot.position.set(1.9, 0.3, -0.6 + sd * 2.92); inner.add(pivot);
      const c = box(0.34, 0.6, 0.22, mat(0xf2f2f2)); c.position.y = 0.3; pivot.add(c); pivot.userData.sd = sd; O.clips.push(pivot);
    });
    O.old = ramStick(0x1f7a4d); O.old.position.set(1.9, 1.08, -0.6); inner.add(O.old);
    O.neu = ramStick(0x2d5fae); O.neu.position.set(1.9, 5, -0.6); O.neu.visible = false; inner.add(O.neu);
    // تحديد مكان الذاكرة
    O.hl = box(0.7, 1.8, 6.1, new THREE.MeshBasicMaterial({ color: 0xffc83d, transparent: true, opacity: 0.22, depthWrite: false }));
    O.hl.position.set(1.9, 0.95, -0.6); inner.add(O.hl);
    O.hle = new THREE.LineSegments(new THREE.EdgesGeometry(O.hl.geometry), new THREE.LineBasicMaterial({ color: 0xffb000 }));
    O.hle.position.copy(O.hl.position); inner.add(O.hle);
    O.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 20), new THREE.MeshStandardMaterial({ color: 0xffb000, emissive: 0x996600 }));
    O.arrow.rotation.x = Math.PI; O.arrow.position.set(1.9, 2.9, -0.6); inner.add(O.arrow);
    O.ramLbl = label("RAM", "#ffb000", "#2b1d00"); O.ramLbl.position.set(1.9, 3.7, -0.6); O.ramLbl.scale.set(1.5, 0.38, 1); inner.add(O.ramLbl);
    // مصدر الطاقة والكابل
    const sock = box(0.5, 0.6, 1.6, mat(0xf4f4f4)); sock.position.set(4.55, 0.38, 1.2); inner.add(sock);
    O.plug = new THREE.Group(); O.plug.position.set(4.95, 0.42, 1.2); inner.add(O.plug);
    O.plugBody = box(0.55, 0.62, 1.55, mat(0x2a2a2a)); O.plug.add(O.plugBody);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.25, 0, 0), new THREE.Vector3(1.6, 0.2, 0.6), new THREE.Vector3(2.6, 0.5, 2.2), new THREE.Vector3(3.0, 0.6, 3.0)]);
    O.cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.16, 10), mat(0x2f3338)); O.plug.add(O.cable);
    const psu = box(2.4, 1.6, 2.4, mat(0x3a3f47, { metalness: 0.5 })); psu.position.set(8.4, 0.8, 4.4); inner.add(psu); O.psu = psu;
    const drive = box(1.3, 0.22, 1.9, mat(0x6b7480, { metalness: 0.6, roughness: 0.4 })); drive.position.set(3.4, 0.2, 2.7); inner.add(drive); O.drive = drive;
    const dl = box(1.0, 0.02, 1.2, mat(0xdde3ea)); dl.position.set(3.4, 0.32, 2.7); inner.add(dl);
    // أجزاء يمكن إبرازها من بطاقات المحتوى المعززة
    const PL = { cpu: "المعالج CPU", ram: "ذاكرة RAM", fan: "المروحة", psu: "مزود الطاقة", sto: "وحدة التخزين", mb: "اللوحة الأم", plug: "الكابلات والتوصيلات" };
    O.parts = {
      cpu: { m: [O.socket, O.fins], at: [-1.6, 2.4, -0.6] }, fan: { m: [O.fan], at: [-1.6, 2.6, -0.6] }, ram: { m: [O.old.children[0]], at: [1.9, 2.9, -0.6] },
      psu: { m: [O.psu], at: [8.4, 2.9, 4.4] }, sto: { m: [O.drive], at: [3.4, 1.6, 2.7] }, mb: { m: [O.board], at: [-0.5, 1.4, 1.6] }, plug: { m: [O.plugBody, O.cable], at: [5.4, 2.0, 1.2] }
    };
    O.partLbl = {}; Object.keys(PL).forEach(k => { const l = label(PL[k], "#ffb000", "#2b1d00"); l.visible = false; inner.add(l); O.partLbl[k] = l; });
    const psuL = label("مزود الطاقة", "rgba(255,255,255,.92)", "#1d2939"); psuL.position.set(8.4, 2.2, 4.4); psuL.scale.set(2.2, 0.55, 1); inner.add(psuL);
    // غطاء الصندوق
    O.panel = box(12.6, 0.08, 10.6, new THREE.MeshStandardMaterial({ color: 0x9fb3c8, transparent: true, opacity: 0.3, depthWrite: false }));
    O.panel.position.set(1.4, 3.6, 0.4); inner.add(O.panel);
    O.frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(12.6, 3.6, 10.6)), new THREE.LineBasicMaterial({ color: 0x8a9bb0, transparent: true, opacity: 0.55 }));
    O.frame.position.set(1.4, 1.8, 0.4); inner.add(O.frame);
    O.check = label("✓ تم التحقق", "#12805c", "#ffffff"); O.check.position.set(1.9, 4.2, -0.6); O.check.visible = false; inner.add(O.check);
  }
  // الحالة المستهدفة لكل خطوة (0 = العرض الكلي للوحة مجمعة)
  function targets(k) {
    const unplug = k >= 1 && k <= 6;
    T.plugX = unplug ? 6.6 : 4.95;
    T.panelX = (k >= 2 && k <= 6) ? 14 : 1.4; T.panelOp = (k >= 2 && k <= 6) ? 0 : 0.3;
    T.clip = (k === 4 || k === 5) ? 0.7 : 0;
    T.oldY = k <= 3 ? 1.08 : (k === 4 ? 1.3 : 5.2); T.oldVis = k <= 5;
    T.newY = k >= 6 ? 1.08 : 5.2; T.newVis = k >= 5;
    T.hl = (k === 0 || k === 3) ? 1 : (k === 4 || k === 5 || k === 6 ? 0.45 : 0);
    T.arrow = (k >= 3 && k <= 6) || k === 0;
    T.check = k === 7;
    T.cable = k === 1 ? 0xd03b3b : (k === 7 ? 0x12805c : 0x2f3338);
    T.focus = { 1: "plug", 2: "panel", 4: "clips", 5: "old", 6: "neu", 7: "plug" }[k] || null;
  }
  const lerp = (a, b, f) => a + (b - a) * f;
  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; t += dt;
    const f = 1 - Math.exp(-dt * 5);
    O.plug.position.x = lerp(O.plug.position.x, T.plugX, f);
    O.panel.position.x = lerp(O.panel.position.x, T.panelX, f); O.panel.material.opacity = lerp(O.panel.material.opacity, T.panelOp, f);
    O.frame.material.opacity = lerp(O.frame.material.opacity, T.panelOp > 0.1 ? 0.55 : 0.18, f);
    O.clips.forEach(p => { p.rotation.x = lerp(p.rotation.x, p.userData.sd * T.clip, f); });
    O.old.position.y = lerp(O.old.position.y, T.oldY, f); O.old.visible = T.oldVis || O.old.position.y < 5;
    O.neu.visible = T.newVis; O.neu.position.y = lerp(O.neu.position.y, T.newY, f);
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    O.hl.material.opacity = T.hl * (0.12 + 0.18 * pulse); O.hle.visible = T.hl > 0;
    O.arrow.visible = T.arrow; O.arrow.position.y = 2.9 + 0.25 * Math.sin(t * 3);
    O.ramLbl.visible = T.arrow;
    O.check.visible = T.check;
    O.cable.material.color.lerp(new THREE.Color(T.cable), f);
    O.fan.rotation.y += dt * (step === 7 ? 8 : (step >= 1 && step <= 6 ? 0 : 3));
    // إبراز الجزء الخاص بالخطوة
    const glow = 0.35 + 0.35 * pulse;
    [["plug", O.plugBody], ["old", O.old.children[0]], ["neu", O.neu.children[0]]].forEach(([k, m]) => { m.material.emissive = new THREE.Color(T.focus === k ? 0xffb000 : 0x000000); m.material.emissiveIntensity = T.focus === k ? glow : 0; });
    O.clips.forEach(p => { const m = p.children[0].material; m.emissive = new THREE.Color(T.focus === "clips" ? 0xffb000 : 0x000000); m.emissiveIntensity = T.focus === "clips" ? glow : 0; });
    if (part && O.parts[part]) {
      const P = O.parts[part];
      Object.values(O.parts).forEach(q => q.m.forEach(m => { if (m.material && m.material.emissive) { m.material.emissive = new THREE.Color(0x000000); m.material.emissiveIntensity = 0; } }));
      P.m.forEach(m => { if (m.material && m.material.emissive) { m.material.emissive = new THREE.Color(0xffb000); m.material.emissiveIntensity = glow; } });
      O.hl.material.opacity = part === "ram" ? 0.12 + 0.18 * pulse : 0; O.hle.visible = part === "ram";
      O.arrow.visible = true; O.arrow.position.set(P.at[0], P.at[1] + 0.25 * Math.sin(t * 3), P.at[2]); O.ramLbl.visible = false;
      Object.keys(O.partLbl).forEach(k => { const l = O.partLbl[k]; l.visible = k === part; if (l.visible) l.position.set(P.at[0], P.at[1] + 0.9, P.at[2]); });
    } else if (O.partLbl) { Object.values(O.partLbl).forEach(l => { l.visible = false; }); O.arrow.position.x = 1.9; O.arrow.position.z = -0.6; }
    // الوضع: حر (سحب للتدوير) أو مثبت على علامة QR
    if (mode === "ar" && anchor) {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      const ndc = new THREE.Vector3((anchor.cx / w) * 2 - 1, -(anchor.cy / h) * 2 + 1, 0.5).unproject(camera);
      const dir = ndc.sub(camera.position).normalize();
      const pos = camera.position.clone().add(dir.multiplyScalar(26));
      root.position.lerp(pos, f);
      const s = Math.max(0.45, Math.min(1.6, anchor.size / (Math.min(w, h) * 0.3)));
      root.scale.setScalar(lerp(root.scale.x, s, f));
      root.rotation.y = lerp(root.rotation.y, -0.5 - anchor.angle, f); root.rotation.x = lerp(root.rotation.x, 0, f);
    } else {
      root.position.lerp(new THREE.Vector3(0, -0.6, 0), f); root.scale.setScalar(lerp(root.scale.x, 1, f));
      if (!drag) rotY += dt * 0.12;
      root.rotation.y = lerp(root.rotation.y, rotY, f * 2); root.rotation.x = lerp(root.rotation.x, rotX, f * 2);
    }
    renderer.render(scene, camera);
  }
  function resize() {
    if (!renderer) return; const w = wrap.clientWidth, h = wrap.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.position.set(0, 13, 16 * Math.max(1, 1.25 / (w / h))); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
  }

  /* ---------- الكاميرا وقراءة QR ---------- */
  let stream = null, video = null, scanT = 0, det = null, cvs = null, ctx = null;
  const camSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext;
  async function startCamera(v) {
    video = v;
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = stream; video.setAttribute("playsinline", ""); video.muted = true; await video.play();
    try { if ("BarcodeDetector" in window && (await BarcodeDetector.getSupportedFormats()).includes("qr_code")) det = new BarcodeDetector({ formats: ["qr_code"] }); } catch (e) { det = null; }
  }
  function stopCamera() { clearTimeout(scanT); if (stream) stream.getTracks().forEach(tr => tr.stop()); stream = null; }
  function toScreen(pts) { // من إحداثيات الفيديو إلى إحداثيات العرض (object-fit: cover)
    const w = wrap.clientWidth, h = wrap.clientHeight, vw = video.videoWidth, vh = video.videoHeight, s = Math.max(w / vw, h / vh);
    const ox = (w - vw * s) / 2, oy = (h - vh * s) / 2; return pts.map(p => ({ x: ox + p.x * s, y: oy + p.y * s }));
  }
  async function readOnce() {
    if (!video || !video.videoWidth) return null;
    if (det) { const r = await det.detect(video); if (!r.length) return null; return { data: r[0].rawValue, pts: r[0].cornerPoints }; }
    if (typeof jsQR !== "function") return null;
    const sc = Math.min(1, 640 / video.videoWidth), w = Math.round(video.videoWidth * sc), h = Math.round(video.videoHeight * sc);
    if (!cvs) { cvs = document.createElement("canvas"); ctx = cvs.getContext("2d", { willReadFrequently: true }); }
    cvs.width = w; cvs.height = h; ctx.drawImage(video, 0, 0, w, h);
    const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" }); if (!r) return null;
    const L = r.location; return { data: r.data, pts: [L.topLeftCorner, L.topRightCorner, L.bottomRightCorner, L.bottomLeftCorner].map(p => ({ x: p.x / sc, y: p.y / sc })) };
  }
  function scan(onFound, onWrong, onLost, match) {
    const ok = match || (d => String(d).indexOf(MARK) !== -1);
    const loop = async () => {
      let r = null; try { r = await readOnce(); } catch (e) { r = null; }
      if (r) {
        if (!ok(r.data)) onWrong && onWrong(r.data);
        else {
          const p = toScreen(r.pts), cx = p.reduce((a, q) => a + q.x, 0) / 4, cy = p.reduce((a, q) => a + q.y, 0) / 4;
          const size = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y), angle = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
          anchor = { cx, cy, size, angle, data: String(r.data) }; lostAt = 0; onFound && onFound(anchor);
        }
      } else if (anchor && !lostAt) { lostAt = Date.now(); }
      else if (anchor && lostAt && Date.now() - lostAt > 1500) { onLost && onLost(); lostAt = Date.now() + 1e9; }
      scanT = setTimeout(loop, 110);
    };
    loop();
  }

  return {
    init(container) {
      wrap = container;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setClearColor(0x000000, 0);
      renderer.domElement.className = "ar-canvas"; wrap.appendChild(renderer.domElement);
      scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.9));
      const d = new THREE.DirectionalLight(0xffffff, 0.8); d.position.set(6, 14, 8); scene.add(d);
      build(); targets(0); resize();
      if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap); else window.addEventListener("resize", resize);
      const el = renderer.domElement;
      el.addEventListener("pointerdown", e => { if (mode === "ar") return; drag = { x: e.clientX, y: e.clientY, ry: rotY, rx: rotX }; el.setPointerCapture(e.pointerId); });
      el.addEventListener("pointermove", e => { if (!drag) return; rotY = drag.ry + (e.clientX - drag.x) * 0.01; rotX = Math.max(-0.5, Math.min(0.6, drag.rx + (e.clientY - drag.y) * 0.006)); });
      el.addEventListener("pointerup", () => { drag = null; }); el.addEventListener("pointercancel", () => { drag = null; });
      raf = requestAnimationFrame(tick);
    },
    setStep(k) { step = k; targets(k); },
    focus(p) { part = p || null; },
    setMode(m) { mode = m; if (m !== "ar") anchor = null; },
    camSupported, startCamera, stopCamera, scan,
    webgl() { try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); } catch (e) { return false; } }
  };
})();
