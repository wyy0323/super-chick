/* 超级小鸡 · 游戏主逻辑：队伍跟随 / 吃蛋孵化 / 老鹰来袭 / 计分 */
(function () {
  'use strict';

  // ---------------- DOM ----------------
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');

  const ui = {
    score: document.getElementById('score'),
    scoreChip: document.getElementById('scoreChip'),
    chickCount: document.getElementById('chickCount'),
    chickChip: document.getElementById('chickChip'),
    startScreen: document.getElementById('startScreen'),
    overScreen: document.getElementById('overScreen'),
    pauseScreen: document.getElementById('pauseScreen'),
    startBtn: document.getElementById('startBtn'),
    againBtn: document.getElementById('againBtn'),
    homeBtn: document.getElementById('homeBtn'),
    resumeBtn: document.getElementById('resumeBtn'),
    restartBtn: document.getElementById('restartBtn'),
    soundBtn: document.getElementById('soundBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    icoSoundOn: document.querySelector('#soundBtn .ico-on'),
    icoSoundOff: document.querySelector('#soundBtn .ico-off'),
    icoPause: document.querySelector('#pauseBtn .ico-pause'),
    icoPlay: document.querySelector('#pauseBtn .ico-play'),
    bestStart: document.getElementById('bestStart'),
    finalScore: document.getElementById('finalScore'),
    bestScore: document.getElementById('bestScore'),
    toast: document.getElementById('toast'),
    joystick: document.getElementById('joystick'),
    joyKnob: document.getElementById('joyKnob')
  };

  // ---------------- 配置 ----------------
  const CFG = {
    spacing: 26,        // 小鸡之间的跟随间距
    speed: 360,         // 队伍移动速度 px/s
    hawkSpeed: 205,     // 老鹰追击速度
    startChicks: 3,     // 开局队伍数量（含老大）
    eggCount: 6,        // 场上鸡蛋数量
    maxTrail: 900,      // 轨迹点上限
    maxChicks: 60
  };

  const BEST_KEY = 'super-chick-best';
  const SOUND_KEY = 'super-chick-sound';

  let W = 0;
  let H = 0;
  let dpr = 1;
  let state = null;
  let best = 0;
  let soundOn = true;
  let hintTimerId = 0;

  // 虚拟摇杆：x/y 为 -1~1 的方向与力度
  const joy = { active: false, id: null, x: 0, y: 0 };

  function rand(a, b) { return a + Math.random() * (b - a); }
  function hide(el) { el.classList.add('hidden'); }
  function show(el) { el.classList.remove('hidden'); }
  function haptic(pattern) {
    if (!navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch (e) { /* 忽略 */ }
  }
  function bump(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  // ---------------- 本地存档 ----------------
  try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { best = 0; }
  try { soundOn = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (e) { soundOn = true; }
  Sfx.muted = !soundOn;
  ui.bestStart.textContent = best;

  function syncSoundIcon() {
    ui.icoSoundOn.classList.toggle('hidden', !soundOn);
    ui.icoSoundOff.classList.toggle('hidden', soundOn);
    ui.soundBtn.setAttribute('aria-pressed', String(soundOn));
    ui.soundBtn.setAttribute('aria-label', soundOn ? '关闭音效' : '开启音效');
  }

  function syncPauseIcon() {
    const paused = state && state.mode === 'paused';
    ui.icoPause.classList.toggle('hidden', paused);
    ui.icoPlay.classList.toggle('hidden', !paused);
    ui.pauseBtn.setAttribute('aria-label', paused ? '继续' : '暂停');
  }

  // ---------------- 画布尺寸 ----------------
  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(320, Math.round(rect.width));
    H = Math.max(360, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (state) clampWorld();
  }

  function clampWorld() {
    const p = state.player;
    p.x = Math.min(Math.max(34, p.x), Math.max(34, W - 34));
    p.y = Math.min(Math.max(34, p.y), Math.max(34, H - 34));
    state.eggs.forEach(function (e) {
      e.x = Math.min(Math.max(50, e.x), Math.max(50, W - 50));
      e.y = Math.min(Math.max(118, e.y), Math.max(118, H - 50));
    });
    state.pointer.x = Math.min(Math.max(0, state.pointer.x), W);
    state.pointer.y = Math.min(Math.max(0, state.pointer.y), H);
  }

  // ---------------- 状态 ----------------
  function createState(mode) {
    const x = W * 0.5;
    const y = H * 0.6;
    const trail = [];
    for (let i = 0; i < 90; i++) trail.push({ x: x - i * 3, y: y });

    return {
      mode: mode,
      t: 0,
      score: 0,
      chicks: CFG.startChicks,
      popTimers: new Array(CFG.startChicks).fill(0),
      player: { x: x, y: y, vx: 0, vy: 0, flip: 1 },
      trail: trail,
      pointer: { active: false, x: x, y: y },
      eggs: [],
      hawks: [],
      warnings: [],
      particles: [],
      texts: [],
      eggTimer: 0,
      hawkTimer: 5.5,
      shake: 0
    };
  }

  function spawnEgg() {
    for (let tries = 0; tries < 40; tries++) {
      const x = rand(70, Math.max(80, W - 70));
      const y = rand(130, Math.max(140, H - 60));
      if (Math.hypot(x - state.player.x, y - state.player.y) < 150) continue;
      // 避开左下角的虚拟摇杆
      if (x < 190 && y > H - 210) continue;

      let ok = true;
      for (let i = 0; i < state.eggs.length; i++) {
        const o = state.eggs[i];
        if (Math.hypot(x - o.x, y - o.y) < 85) { ok = false; break; }
      }
      if (!ok) continue;

      state.eggs.push({
        x: x,
        y: y,
        phase: rand(0, Math.PI * 2),
        r: 15
      });
      return;
    }
  }

  // ---------------- 轨迹与跟随 ----------------
  function updateTrail() {
    const p = state.player;
    const tr = state.trail;
    const head = tr[0];
    if (!head || Math.hypot(p.x - head.x, p.y - head.y) > 2.5) {
      tr.unshift({ x: p.x, y: p.y });
      if (tr.length > CFG.maxTrail) tr.length = CFG.maxTrail;
    }
  }

  // 沿着轨迹，取距头部 d 像素处的点
  function trailPointAt(d) {
    const tr = state.trail;
    if (tr.length < 2) return { x: state.player.x, y: state.player.y };
    let acc = 0;
    for (let i = 0; i < tr.length - 1; i++) {
      const a = tr[i];
      const b = tr[i + 1];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (seg < 0.001) continue;
      if (acc + seg >= d) {
        const k = (d - acc) / seg;
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
      acc += seg;
    }
    const last = tr[tr.length - 1];
    return { x: last.x, y: last.y };
  }

  function popScale(i) {
    const t = state.popTimers[i] || 0;
    if (t <= 0) return 1;
    const k = Math.min(1, 1 - t / 0.35);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const e = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
    return 0.5 + 0.5 * e;
  }

  function getChickPositions() {
    const list = [];
    if (state.chicks <= 0) return list;

    const p = state.player;
    list.push({
      x: p.x,
      y: p.y,
      leader: true,
      bob: Math.sin(state.t * 6) * 1.2,
      scale: 1,
      flip: p.flip
    });

    for (let i = 1; i < state.chicks; i++) {
      const d = i * CFG.spacing;
      const a = trailPointAt(d);
      const near = trailPointAt(Math.max(0, d - 9));
      const far = trailPointAt(d + 9);
      const ang = Math.atan2(near.y - far.y, near.x - far.x);
      const wob = Math.sin(state.t * 6.2 + i * 1.1) * 4;
      list.push({
        x: a.x + Math.cos(ang + Math.PI / 2) * wob,
        y: a.y + Math.sin(ang + Math.PI / 2) * wob,
        leader: false,
        bob: Math.sin(state.t * 8 + i * 0.9) * 1.8,
        scale: popScale(i),
        flip: Math.cos(ang) < -0.05 ? -1 : 1
      });
    }
    return list;
  }

  // ---------------- 输入 ----------------
  const keys = new Set();

  window.addEventListener('keydown', function (e) {
    const k = e.key.toLowerCase();
    const onButton = e.target && e.target.tagName === 'BUTTON';

    if ((k === ' ' || k === 'enter') && onButton) return;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();

    if (k === 'p' || k === 'escape') {
      if (state.mode === 'playing' || state.mode === 'paused') togglePause();
      return;
    }
    if (k === ' ' || k === 'enter') {
      if (state.mode === 'idle' || state.mode === 'over') startRun();
      else if (state.mode === 'paused') togglePause();
      return;
    }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k) >= 0) keys.add(k);
  });

  window.addEventListener('keyup', function (e) {
    keys.delete(e.key.toLowerCase());
  });

  function updatePointer(e) {
    if (state.mode !== 'playing') return;
    const r = canvas.getBoundingClientRect();
    let x = e.clientX - r.left;
    let y = e.clientY - r.top;
    // 触屏时把目标点抬到手指上方，避免手指挡住小鸡
    if (e.pointerType === 'touch' || e.pointerType === 'pen') y -= 56;
    state.pointer.x = Math.min(Math.max(34, x), Math.max(34, W - 34));
    state.pointer.y = Math.min(Math.max(34, y), Math.max(34, H - 34));
    state.pointer.active = true;
  }

  canvas.addEventListener('pointerdown', function (e) {
    updatePointer(e);
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    }
  });
  canvas.addEventListener('pointermove', updatePointer);
  canvas.addEventListener('pointerup', function (e) {
    if (canvas.releasePointerCapture) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    }
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---------------- 虚拟摇杆 ----------------
  function joyMove(e) {
    const r = ui.joystick.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const knobR = ui.joyKnob.offsetWidth / 2;
    const maxR = Math.max(18, r.width / 2 - knobR + 2);

    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > maxR) {
      dx = (dx / d) * maxR;
      dy = (dy / d) * maxR;
    }
    ui.joyKnob.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';

    const mag = Math.min(1, d / maxR);
    if (mag < 0.14) {
      joy.x = 0;
      joy.y = 0;
    } else {
      joy.x = dx / maxR;
      joy.y = dy / maxR;
    }
  }

  function joyRelease(e) {
    if (!joy.active) return;
    if (e && joy.id !== null && e.pointerId !== joy.id) return;
    joy.active = false;
    joy.id = null;
    joy.x = 0;
    joy.y = 0;
    ui.joyKnob.style.transform = '';
    ui.joystick.classList.remove('active');
  }

  ui.joystick.addEventListener('pointerdown', function (e) {
    if (state.mode !== 'playing') return;
    e.preventDefault();
    joy.active = true;
    joy.id = e.pointerId;
    ui.joystick.classList.add('active');
    if (ui.joystick.setPointerCapture) {
      try { ui.joystick.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    }
    joyMove(e);
  });

  ui.joystick.addEventListener('pointermove', function (e) {
    if (!joy.active || e.pointerId !== joy.id) return;
    e.preventDefault();
    joyMove(e);
  });

  ui.joystick.addEventListener('pointerup', joyRelease);
  ui.joystick.addEventListener('pointercancel', joyRelease);
  ui.joystick.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function syncControls() {
    const showJoy = !!state && state.mode === 'playing';
    ui.joystick.classList.toggle('hidden', !showJoy);
    if (!showJoy) joyRelease();
  }

  // ---------------- 移动 ----------------
  function movePlayer(dt) {
    const p = state.player;
    let dx = 0;
    let dy = 0;

    if (state.mode === 'idle') {
      const cx = W * 0.5 + Math.cos(state.t * 0.6) * Math.min(W * 0.26, 240);
      const cy = H * 0.58 + Math.sin(state.t * 0.9) * Math.min(H * 0.18, 120);
      const ox = cx - p.x;
      const oy = cy - p.y;
      const d = Math.hypot(ox, oy);
      if (d > 6) {
        const k = Math.min(1, d / 140);
        dx = (ox / d) * k;
        dy = (oy / d) * k;
      }
    } else {
      const kx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
      const ky = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0);
      if (kx || ky) {
        const d = Math.hypot(kx, ky) || 1;
        dx = kx / d;
        dy = ky / d;
      } else if (joy.active) {
        dx = joy.x;
        dy = joy.y;
      } else if (state.pointer.active) {
        const ox = state.pointer.x - p.x;
        const oy = state.pointer.y - p.y;
        const d = Math.hypot(ox, oy);
        if (d > 8) {
          const k = Math.min(1, d / 130);
          dx = (ox / d) * k;
          dy = (oy / d) * k;
        }
      }
    }

    const ease = Math.min(1, dt * 13);
    p.vx += (dx * CFG.speed - p.vx) * ease;
    p.vy += (dy * CFG.speed - p.vy) * ease;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const m = 34;
    if (p.x < m) { p.x = m; if (p.vx < 0) p.vx = 0; }
    if (p.x > W - m) { p.x = W - m; if (p.vx > 0) p.vx = 0; }
    if (p.y < m) { p.y = m; if (p.vy < 0) p.vy = 0; }
    if (p.y > H - m) { p.y = H - m; if (p.vy > 0) p.vy = 0; }

    if (p.vx < -25) p.flip = -1;
    else if (p.vx > 25) p.flip = 1;
  }

  // ---------------- 鸡蛋 ----------------
  function collectEggs() {
    const p = state.player;
    for (let i = state.eggs.length - 1; i >= 0; i--) {
      const e = state.eggs[i];
      if (Math.hypot(e.x - p.x, e.y - p.y) < 34) {
        state.eggs.splice(i, 1);
        hatch(e);
      }
    }
  }

  function hatch(e) {
    state.score += 10;

    const before = state.chicks;
    state.chicks = Math.min(CFG.maxChicks, state.chicks + 1);
    state.popTimers.length = state.chicks;
    if (state.chicks > before) state.popTimers[state.chicks - 1] = 0.35;

    state.particles = state.particles.concat(makeBurst(e.x, e.y, 7, 'spark'), makeBurst(e.x, e.y, 4, 'puff'));
    state.texts.push({ x: e.x, y: e.y - 16, text: '+10', color: '#15934A', life: 0.95, max: 0.95 });
    state.shake = Math.max(state.shake, 3);
    Sfx.pickup();
    haptic(12);
    bump(ui.scoreChip);
  }

  function makeBurst(x, y, n, kind) {
    const arr = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = kind === 'spark' ? rand(80, 260) : rand(20, 90);
      const life = kind === 'spark' ? rand(0.35, 0.7) : rand(0.3, 0.6);
      arr.push({
        x: x,
        y: y,
        kind: kind,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (kind === 'puff' ? 20 : 0),
        life: life,
        max: life,
        size: kind === 'spark' ? rand(3, 6) : rand(6, 12),
        rot: Math.random() * Math.PI * 2,
        vr: rand(-6, 6),
        color: kind === 'spark' ? '#FFE066' : 'rgba(255, 255, 255, 0.9)'
      });
    }
    return arr;
  }

  function burstFeathers(x, y, n) {
    n = n || 12;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(40, 190);
      const life = rand(0.5, 1.1);
      state.particles.push({
        x: x,
        y: y,
        kind: 'feather',
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 50,
        life: life,
        max: life,
        size: rand(3, 6),
        rot: Math.random() * Math.PI,
        vr: rand(-8, 8),
        color: i % 3 === 0 ? '#FF5A5F' : '#FFD93D'
      });
    }
  }

  // ---------------- 老鹰 ----------------
  function queueHawk() {
    let x;
    let y;
    const edge = Math.floor(Math.random() * 4);
    if (edge === 0) { x = rand(80, Math.max(90, W - 80)); y = -50; }
    else if (edge === 1) { x = W + 50; y = rand(130, Math.max(140, H - 60)); }
    else if (edge === 2) { x = rand(80, Math.max(90, W - 80)); y = H + 50; }
    else { x = -50; y = rand(130, Math.max(140, H - 60)); }

    state.warnings.push({ x: x, y: y, t: 1, max: 1 });
    Sfx.warn();
  }

  function spawnHawk(w) {
    const ang = Math.atan2(state.player.y - w.y, state.player.x - w.x);
    state.hawks.push({
      x: w.x,
      y: w.y,
      vx: Math.cos(ang) * 140,
      vy: Math.sin(ang) * 140,
      phase: Math.random() * Math.PI * 2,
      age: 0,
      retarget: 0,
      targetIdx: 1,
      mode: 'hunt'
    });
  }

  function toLeave(hawk, forceAngle) {
    hawk.mode = 'leave';
    const ang = (forceAngle == null ? Math.atan2(hawk.y - H / 2, hawk.x - W / 2) : forceAngle) + rand(-0.35, 0.35);
    hawk.vx = Math.cos(ang) * CFG.hawkSpeed * 1.35;
    hawk.vy = Math.sin(ang) * CFG.hawkSpeed * 1.35;
  }

  function stealChick(pos, hawk) {
    state.chicks -= 1;
    state.popTimers.length = Math.max(0, state.chicks);
    burstFeathers(pos.x, pos.y, 14);
    state.texts.push({ x: pos.x, y: pos.y - 18, text: '-1', color: '#FF4455', life: 1, max: 1 });
    state.shake = 14;
    Sfx.lose();
    haptic(40);
    toLeave(hawk, -Math.PI / 2);
  }

  function updateHawks(dt) {
    // 预警倒计时
    for (let i = state.warnings.length - 1; i >= 0; i--) {
      const w = state.warnings[i];
      w.t -= dt;
      if (w.t <= 0) {
        state.warnings.splice(i, 1);
        spawnHawk(w);
      }
    }

    state.hawkTimer -= dt;
    const maxHawks = Math.min(3, 1 + Math.floor(state.t / 30));
    if (state.hawkTimer <= 0 && state.hawks.length + state.warnings.length < maxHawks) {
      queueHawk();
      state.hawkTimer = Math.max(2, 4.8 - state.t * 0.03);
    }

    const pos = getChickPositions();

    for (let i = state.hawks.length - 1; i >= 0; i--) {
      const h = state.hawks[i];
      h.age += dt;

      if (h.mode === 'leave') {
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        if (h.x < -180 || h.x > W + 180 || h.y < -180 || h.y > H + 180) state.hawks.splice(i, 1);
        continue;
      }

      h.retarget -= dt;
      if (h.retarget <= 0 || !pos[h.targetIdx]) {
        h.targetIdx = state.chicks > 1 ? 1 + Math.floor(Math.random() * (state.chicks - 1)) : 0;
        h.retarget = 0.55 + Math.random() * 0.5;
      }

      const target = pos[Math.min(h.targetIdx, pos.length - 1)];
      if (!target) { state.hawks.splice(i, 1); continue; }

      let dx = target.x - h.x;
      let dy = target.y - h.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;

      // 蛇形俯冲，给玩家留出躲避空间
      const wob = Math.sin(state.t * 2.6 + h.phase) * 0.55;
      const cs = Math.cos(wob);
      const sn = Math.sin(wob);
      const sx = dx * cs - dy * sn;
      const sy = dx * sn + dy * cs;

      const k = Math.min(1, dt * 3.2);
      h.vx += (sx * CFG.hawkSpeed - h.vx) * k;
      h.vy += (sy * CFG.hawkSpeed - h.vy) * k;
      h.x += h.vx * dt;
      h.y += h.vy * dt;

      if (state.chicks > 1) {
        for (let c = 1; c < pos.length; c++) {
          if (Math.hypot(pos[c].x - h.x, pos[c].y - h.y) < 25) {
            stealChick(pos[c], h);
            break;
          }
        }
      } else if (pos[0] && Math.hypot(pos[0].x - h.x, pos[0].y - h.y) < 30) {
        endRun();
        return;
      }

      if (h.mode === 'hunt' && h.age > 8) toLeave(h);
    }
  }

  // ---------------- 粒子 / 飘字 ----------------
  function updateParticles(dt) {
    const ps = state.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }

      if (p.kind === 'feather') {
        p.vy += 260 * dt;
        p.vx *= 0.985;
        if (p.vy > 170) p.vy = 170;
        p.rot += p.vr * dt;
      } else if (p.kind === 'spark') {
        p.vx *= 0.94;
        p.vy = p.vy * 0.94 + 80 * dt;
      } else {
        p.vx *= 0.9;
        p.vy *= 0.9;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function updateTexts(dt) {
    const ts = state.texts;
    for (let i = ts.length - 1; i >= 0; i--) {
      const t = ts[i];
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) ts.splice(i, 1);
    }
  }

  // ---------------- 主循环 ----------------
  function update(dt) {
    if (state.mode === 'paused') return;

    state.t += dt;
    state.shake = Math.max(0, state.shake - dt * 34);

    if (state.mode === 'playing' || state.mode === 'idle') {
      movePlayer(dt);
      updateTrail();

      for (let i = 0; i < state.popTimers.length; i++) {
        if (state.popTimers[i] > 0) state.popTimers[i] = Math.max(0, state.popTimers[i] - dt);
      }

      if (state.mode === 'playing') collectEggs();

      state.eggTimer -= dt;
      if (state.eggs.length < CFG.eggCount && state.eggTimer <= 0) {
        spawnEgg();
        state.eggTimer = 0.4;
      }

      if (state.mode === 'playing') updateHawks(dt);
    }

    updateParticles(dt);
    updateTexts(dt);
    updateHud();
  }

  function updateHud() {
    const scoreText = String(state.score);
    if (ui.score.textContent !== scoreText) ui.score.textContent = scoreText;

    const chickText = String(state.chicks);
    if (ui.chickCount.textContent !== chickText) {
      ui.chickCount.textContent = chickText;
      bump(ui.chickChip);
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    const sh = state.shake;
    const ox = sh > 0.4 ? rand(-1, 1) * sh * 0.7 : 0;
    const oy = sh > 0.4 ? rand(-1, 1) * sh * 0.7 : 0;

    ctx.save();
    ctx.translate(ox, oy);

    Art.sky(ctx, W, H);
    Art.clouds(ctx, W, H, state.t);

    if (state.mode === 'playing' && state.pointer.active && !joy.active) {
      Art.pointerRing(ctx, state.pointer.x, state.pointer.y, state.t);
    }

    for (let i = 0; i < state.eggs.length; i++) {
      const e = state.eggs[i];
      Art.shadow(ctx, e.x, e.y + 21, 14, 5, 0.1);
      Art.egg(ctx, e, state.t);
    }

    const pos = getChickPositions();

    for (let i = pos.length - 1; i >= 0; i--) {
      const c = pos[i];
      const s = c.scale * (c.leader ? 1.1 : 1);
      Art.shadow(ctx, c.x, c.y + 18 * s + (c.bob || 0) * 0.5, 15 * s, 5.5 * s, 0.13);
    }
    for (let i = pos.length - 1; i >= 0; i--) {
      const c = pos[i];
      Art.chick(ctx, {
        x: c.x,
        y: c.y,
        scale: c.scale * (c.leader ? 1.1 : 1),
        leader: c.leader,
        t: state.t,
        flip: c.flip,
        bob: c.bob
      });
    }

    for (let i = 0; i < state.hawks.length; i++) {
      const h = state.hawks[i];
      Art.shadow(ctx, h.x + 6, h.y + 24, 20, 7, 0.16);
      Art.hawk(ctx, h, state.t);
    }

    Art.particles(ctx, state.particles);
    Art.texts(ctx, state.texts);

    ctx.restore();

    for (let i = 0; i < state.warnings.length; i++) {
      Art.warning(ctx, state.warnings[i], W, H, state.t);
    }
  }

  let lastTime = 0;
  function frame(now) {
    if (!lastTime) lastTime = now;
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > 1 / 30) dt = 1 / 30;

    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // ---------------- 流程控制 ----------------
  function startRun() {
    Sfx.ensure();
    Sfx.start();

    state = createState('playing');
    for (let i = 0; i < CFG.eggCount; i++) spawnEgg();

    hide(ui.startScreen);
    hide(ui.overScreen);
    hide(ui.pauseScreen);
    syncPauseIcon();
    syncControls();

    ui.toast.classList.add('show');
    clearTimeout(hintTimerId);
    hintTimerId = setTimeout(function () { ui.toast.classList.remove('show'); }, 3000);

    updateHud();
  }

  function goHome() {
    hide(ui.overScreen);
    hide(ui.pauseScreen);
    show(ui.startScreen);

    state = createState('idle');
    for (let i = 0; i < CFG.eggCount; i++) spawnEgg();

    ui.bestStart.textContent = best;
    syncPauseIcon();
    syncControls();
    updateHud();
  }

  function togglePause() {
    if (state.mode === 'playing') {
      state.mode = 'paused';
      show(ui.pauseScreen);
      syncPauseIcon();
    } else if (state.mode === 'paused') {
      state.mode = 'playing';
      hide(ui.pauseScreen);
      lastTime = 0;
      syncPauseIcon();
    }
    syncControls();
  }

  function endRun() {
    if (state.mode !== 'playing') return;

    state.mode = 'over';
    state.chicks = 0;
    state.popTimers.length = 0;
    state.shake = 20;
    burstFeathers(state.player.x, state.player.y, 22);
    Sfx.over();
    haptic([50, 60, 90]);
    syncControls();

    if (state.score > best) {
      best = state.score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* 忽略 */ }
    }

    ui.finalScore.textContent = state.score;
    ui.bestScore.textContent = best;
    ui.bestStart.textContent = best;

    const snapshot = state;
    setTimeout(function () {
      if (state === snapshot && state.mode === 'over') show(ui.overScreen);
    }, 760);
  }

  // ---------------- 按钮绑定 ----------------
  ui.startBtn.addEventListener('click', startRun);
  ui.againBtn.addEventListener('click', startRun);
  ui.homeBtn.addEventListener('click', goHome);
  ui.resumeBtn.addEventListener('click', togglePause);
  ui.restartBtn.addEventListener('click', startRun);

  ui.pauseBtn.addEventListener('click', function () {
    if (state.mode === 'playing' || state.mode === 'paused') togglePause();
  });

  ui.soundBtn.addEventListener('click', function () {
    soundOn = !soundOn;
    Sfx.muted = !soundOn;
    syncSoundIcon();
    try { localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off'); } catch (e) { /* 忽略 */ }
    if (soundOn) Sfx.pickup();
  });

  window.addEventListener('blur', function () {
    if (state.mode === 'playing') togglePause();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state.mode === 'playing') togglePause();
  });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () {
    setTimeout(resize, 280);
    setTimeout(resize, 640);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resize);
  }

  // ---------------- 启动 ----------------
  resize();
  state = createState('idle');
  for (let i = 0; i < CFG.eggCount; i++) spawnEgg();
  syncSoundIcon();
  syncPauseIcon();
  syncControls();
  updateHud();
  requestAnimationFrame(frame);
})();
