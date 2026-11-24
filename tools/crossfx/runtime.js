// 균열 크로스오버 연출 미리보기 — 공통 런타임 (11-23)
// 틀은 하나: 판 바탕 · 적(균열 결정 그림자) · 연쇄 폭발 · 피해 숫자 · 방어선(봉인선) · 무기 자리(유물함 틀) 는 모든 세계가 같다.
// 세계마다 다른 것은 세계 모듈(worlds/<key>.js)이 그린다: 유물함 안 재질 · 문장 · 무기 아이콘 · 공격 · 맞는 무늬 · 반응 연출 · 반응 글씨.
// 합성 = 메인 + 보조: 몸·쏘는 법은 메인 세계(fire), 궤적 층(trail)·맞는 무늬(hit asSub)·반응(react)·반응 글씨(label)는 보조 세계.
(function () {
  'use strict';
  const CX = (window.CX = window.CX || {});
  CX.worlds = CX.worlds || {};
  const W = 360;
  const H = 540;
  const LINE_Y = 446;
  const MOUNT_Y = 492;
  const BOX = 42;
  CX.size = { W, H, LINE_Y, MOUNT_Y, BOX };
  CX.speed = 1;

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  CX.util = { TAU, clamp, rnd, ease, lerp: (a, b, t) => a + (b - a) * t };

  // ── 세계 등록 ────────────────────────────────────────────────
  /** 세계 모듈 등록. 빠진 함수는 base 세계(worlds/base.js)의 것을 쓴다 */
  CX.world = function (key, def) {
    CX.worlds[key] = Object.assign({ key }, def);
  };
  const merged = {};
  /** 세계 찾기 (빠진 함수는 base 로 채움) */
  CX.wo = function (key) {
    if (merged[key]) return merged[key];
    const base = CX.worlds.base || {};
    const w = CX.worlds[key];
    const m = Object.assign({}, base, w || {}, { key, missing: !w });
    merged[key] = m;
    return m;
  };

  // ── 무기 ────────────────────────────────────────────────────
  /** 무기 하나 (subId 가 있으면 합친 무기: 메인 id + 보조 subId) */
  CX.weapon = function (id, subId) {
    const d = CX.data.weapons[id];
    const s = subId ? CX.data.weapons[subId] : null;
    const f = subId ? CX.data.fuse[id + '+' + subId] : null;
    if (!d) throw new Error('무기 없음 ' + id);
    return {
      id,
      sub: subId || null,
      world: d.world,
      subWorld: s ? s.world : null,
      name: f ? f.name : d.name,
      baseName: d.name,
      subName: s ? s.name : null,
      cat: d.cat,
      catLabel: d.catLabel,
      subCat: s ? s.catLabel : null,
      react: f ? f.react : null,
      cool: rnd(0.2, 0.9),
      hits: 0,
      lastReact: -9,
      x: W / 2,
      y: MOUNT_Y,
      mem: {},
    };
  };

  // ── 판 한 장 ────────────────────────────────────────────────
  class Scene {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {{phases: {mounts: object[], active?: number[], dur: number, title?: string, note?: string, intro?: boolean}[], density?: number, compact?: boolean}} opt
     */
    constructor(canvas, opt) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.opt = Object.assign({ density: 11 }, opt);
      /** 캔버스 논리 높이 · 판을 아래로 미는 값 (실전 판은 위에 HUD 띠) */
      this.ch = this.opt.height || H;
      this.oy = this.opt.offsetY || 0;
      this.t = 0;
      this.enemies = [];
      this.fx = [];
      this.nums = [];
      this.booms = [];
      this.seams = [];
      this.pend = [];
      this.labels = [];
      this.timers = [];
      this.chainN = 0;
      this.chainT = -9;
      this.chainPeak = 0;
      this.shakeA = 0;
      this.phaseI = -1;
      this.phaseT = 0;
      this.visible = false;
      this.mounts = [];
      this.active = [];
      for (let i = 0; i < 6; i++) this.spawnCluster(rnd(40, 320));
      this.nextPhase();
      this.resize();
    }

    resize() {
      const r = this.cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = Math.max(200, r.width || 360);
      this.scale = (cw / W) * dpr;
      this.cv.width = Math.round(W * this.scale);
      this.cv.height = Math.round(this.ch * this.scale);
      this.bg = null;
    }

    // ── 단계 (한 무기씩 → 함께, 메인만 → 합성) ──
    nextPhase() {
      const ph = this.opt.phases;
      this.phaseI = (this.phaseI + 1) % ph.length;
      this.phaseT = 0;
      const p = ph[this.phaseI];
      this.mounts = p.mounts;
      this.active = p.active || p.mounts.map((_, i) => i);
      const n = this.mounts.length;
      const gap = n <= 3 ? 100 : (W - 28) / n;
      this.mounts.forEach((w, i) => {
        w.x = W / 2 + (i - (n - 1) / 2) * gap;
        w.y = MOUNT_Y;
      });
      if (p.intro) for (const i of this.active) if (this.mounts[i].sub) this.fx.push(introFx(this.mounts[i]));
    }

    // ── 적 ──
    spawnCluster(y0) {
      const cx = rnd(46, W - 46);
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const roll = Math.random();
        const type = roll < 0.7 ? 'normal' : roll < 0.88 ? 'armor' : 'charge';
        const e = {
          type,
          x: clamp(cx + rnd(-30, 30), 18, W - 18),
          y: (y0 == null ? -20 : y0) + rnd(-26, 10),
          r: type === 'armor' ? 15 : type === 'charge' ? 10 : 11,
          hp: type === 'armor' ? 15 : type === 'charge' ? 4 : 6,
          sp: type === 'armor' ? 15 : type === 'charge' ? 38 : 22,
          ph: rnd(0, TAU),
          alive: true,
          flash: 0,
          slow: 0,
        };
        e.max = e.hp;
        this.enemies.push(e);
      }
    }

    /** 노릴 적: 'front' 방어선에 가까운 쪽(셋 중 하나), 'near' (x,y)에 가까운, 'cluster' 이웃 많은, 'any' 아무나 */
    target(mode, x, y) {
      // 사거리: 이 높이 아래로 내려온 적만 노린다 (실전 판은 더 아래로: 대형이 내려오는 게 보이게)
      const top = this.minTargetY || 34;
      const al = this.enemies.filter((e) => e.alive && e.y > top && e.y < LINE_Y - 8);
      if (!al.length) return null;
      if (mode === 'near') {
        let best = null;
        let bd = 1e9;
        for (const e of al) {
          const d = (e.x - x) ** 2 + (e.y - y) ** 2;
          if (d < bd) (bd = d), (best = e);
        }
        return best;
      }
      if (mode === 'cluster') {
        let best = al[0];
        let bn = -1;
        for (const e of al) {
          const n = this.near(e.x, e.y, 56).length;
          if (n > bn) (bn = n), (best = e);
        }
        return best;
      }
      if (mode === 'any') return al[Math.floor(Math.random() * al.length)];
      al.sort((a, b) => b.y - a.y);
      return al[Math.floor(Math.random() * Math.min(3, al.length))];
    }

    /** (x,y)에서 r 안의 살아 있는 적 */
    near(x, y, r) {
      return this.enemies.filter((e) => e.alive && (e.x - x) ** 2 + (e.y - y) ** 2 <= (r + e.r) ** 2);
    }

    /** 효과 추가. e: {update(dt, api)→false 면 끝, draw(ctx, api), life?, z?(-1 적 아래, 1 위), x?, y?, vx?, vy?}. w 를 주면 그 무기의 보조 세계 궤적 층이 (x,y)에 얹힌다 */
    add(e, w) {
      e.age = 0;
      e.w = w || e.w || null;
      e.hist = [];
      this.fx.push(e);
      return e;
    }

    /** 맞힘: 피해 · 숫자 · 맞는 무늬(메인 세계, 합성이면 보조 세계 층도) · 반응 · 죽으면 연쇄 */
    hit(w, e, dmg, x, y, o) {
      if (!e || !e.alive) return false;
      o = o || {};
      const hx = x == null ? e.x : x;
      const hy = y == null ? e.y : y;
      e.hp -= dmg;
      e.flash = 0.12;
      if (w && w.pow) dmg *= w.pow;
      if (o.push) e.y = Math.max(-30, e.y - o.push);
      if (o.slow) e.slow = Math.max(e.slow, o.slow);
      this.num(hx, hy - e.r - 4, dmg, o.big ? 2 : o.isReact ? 1 : 0);
      if (!o.noMark && w) {
        CX.wo(w.world).hit(this, hx, hy, w, false, e);
        if (w.sub) CX.wo(w.subWorld).hit(this, hx, hy, w, true, e);
      }
      if (w) {
        w.hits++;
        if (w.sub && !o.isReact && w.hits >= 3 && this.t - w.lastReact > 3.4) {
          w.hits = 0;
          w.lastReact = this.t;
          this.react(w, e);
        }
      }
      if (e.hp <= 0) this.kill(e);
      return true;
    }

    /** 합친 무기의 반응: 보조 세계가 연출하고, 반응 이름도 보조 세계 글씨로 */
    react(w, e) {
      const sw = CX.wo(w.subWorld);
      sw.react(this, e, w);
      this.labels = this.labels.filter((l) => l.age < 0.5);
      // 글씨는 반응 그림을 가리지 않게 적에서 떨어진 쪽(위쪽 적이면 아래, 아래쪽 적이면 위)에
      const ly = e.y < 240 ? Math.min(e.y + 96, 372) : Math.max(e.y - 96, 120);
      this.labels.push({ text: w.react || '반응', world: w.subWorld, age: 0, life: 1.9, x: clamp(e.x, 112, W - 112), y: ly });
    }

    // ── 공통 연쇄 ──
    kill(e) {
      if (!e.alive) return;
      e.alive = false;
      if (this.onKill) this.onKill(e);
      if (this.t - this.chainT > 1.3) this.chainN = 0;
      this.chainN++;
      this.chainT = this.t;
      this.chainPeak = Math.max(this.chainPeak, this.chainN);
      this.booms.push({ x: e.x, y: e.y, r: 22 + e.r * 1.4, age: 0, big: e.type === 'armor' });
      this.shake(e.type === 'armor' ? 3 : 1.5);
      this.pend.push({ x: e.x, y: e.y, at: this.t + 0.13 });
    }

    chainStep() {
      const due = this.pend.filter((p) => p.at <= this.t);
      if (!due.length) return;
      this.pend = this.pend.filter((p) => p.at > this.t);
      for (const p of due) {
        for (const nb of this.near(p.x, p.y, 44)) {
          this.seams.push({ x1: p.x, y1: p.y, x2: nb.x, y2: nb.y, age: 0 });
          nb.hp -= 5;
          nb.flash = 0.12;
          this.num(nb.x, nb.y - nb.r - 4, 5, 0);
          if (nb.hp <= 0) this.kill(nb);
        }
      }
    }

    /** 적 채우기 (실전 판은 웨이브로 바꿔 씀) */
    spawnTick() {
      const alive = this.enemies.filter((e) => e.alive).length;
      if (alive < (this.opt.density || 11)) this.spawnCluster(-24);
    }

    /** sec 초 뒤에 fn(api) (판 시간 기준: 속도·멈춤을 따른다). 연발·지연 폭발에 */
    later(sec, fn) {
      this.timers.push({ at: this.t + sec, fn });
    }

    num(x, y, v, kind) {
      this.nums.push({ x: x + rnd(-4, 4), y, v: Math.round(v), age: 0, kind });
    }

    shake(a) {
      this.shakeA = Math.max(this.shakeA, a);
    }

    // ── 한 틱 ──
    step(dt) {
      this.t += dt;
      this.phaseT += dt;
      const ph = this.opt.phases[this.phaseI];
      if (this.opt.phases.length > 1 && this.phaseT >= ph.dur) this.nextPhase();

      // 적
      this.spawnTick(dt);
      for (const e of this.enemies) {
        if (!e.alive) {
          e.flash = Math.max(0, e.flash - dt);
          continue;
        }
        e.ph += dt;
        const slow = e.slow > 0 ? 0.45 : 1;
        e.slow = Math.max(0, e.slow - dt);
        e.y += e.sp * slow * dt;
        e.x += Math.sin(e.ph * 1.3) * 6 * dt;
        e.flash = Math.max(0, e.flash - dt);
        if (e.y > LINE_Y - 6) {
          e.alive = false;
          this.booms.push({ x: e.x, y: LINE_Y, r: 14, age: 0, leak: true });
          if (this.onLeak) this.onLeak(e);
        }
      }
      this.enemies = this.enemies.filter((e) => e.alive || e.flash > 0);

      // 무기
      for (const i of this.active) {
        const w = this.mounts[i];
        if (!w) continue;
        const wo = CX.wo(w.world);
        w.aim = (w.aim || 0) + ((w.aimTo || 0) - (w.aim || 0)) * Math.min(1, dt * 8);
        w.kick = Math.max(0, (w.kick || 0) - dt * 5);
        if (wo.tick) wo.tick(this, w, dt);
        w.cool -= dt;
        if (w.cool <= 0) {
          const tg = this.target('front');
          if (tg) {
            const cd = wo.fire(this, w, tg);
            w.aimTo = Math.atan2(tg.x - w.x, w.y - tg.y);
            w.kick = 1;
            w.cool = (cd || 1.2) * (w.cdMul || 1) * rnd(0.9, 1.1);
          } else w.cool = 0.25;
        }
      }

      // 예약
      if (this.timers.length) {
        const due = this.timers.filter((x) => x.at <= this.t);
        if (due.length) {
          this.timers = this.timers.filter((x) => x.at > this.t);
          for (const x of due) x.fn(this);
        }
      }

      // 효과
      for (const e of this.fx) {
        e.age += dt;
        if (e.x != null) {
          e.hist.push(e.x, e.y);
          if (e.hist.length > 24) e.hist.splice(0, 2);
        }
        if ((e.update && e.update(dt, this) === false) || (e.life != null && e.age > e.life)) e.dead = true;
      }
      this.fx = this.fx.filter((e) => !e.dead);
      this.chainStep();
      for (const b of this.booms) b.age += dt;
      this.booms = this.booms.filter((b) => b.age < 0.55);
      for (const s of this.seams) s.age += dt;
      this.seams = this.seams.filter((s) => s.age < 0.3);
      for (const n of this.nums) (n.age += dt), (n.y -= 26 * dt);
      this.nums = this.nums.filter((n) => n.age < 0.8);
      for (const l of this.labels) l.age += dt;
      this.labels = this.labels.filter((l) => l.age < l.life);
      this.shakeA = Math.max(0, this.shakeA - dt * 12);
    }

    // ── 그리기 ──
    draw() {
      const c = this.ctx;
      c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      if (this.ch > H) {
        c.fillStyle = '#07050F';
        c.fillRect(0, 0, W, this.ch);
      }
      if (this.oy) c.translate(0, this.oy);
      const T = CX.th();
      if (!this.bg || this.bgKey !== T.key) {
        this.bg = T.bg(this.scale);
        this.bgKey = T.key;
      }
      c.drawImage(this.bg, 0, 0, W, H);
      T.sky(c, this.t);
      const sx = this.shakeA ? rnd(-this.shakeA, this.shakeA) : 0;
      const sy = this.shakeA ? rnd(-this.shakeA, this.shakeA) : 0;
      c.save();
      c.translate(sx, sy);
      this.drawFx(-1);
      for (const e of this.enemies) if (e.alive || e.flash > 0) T.enemy(c, e, this.t);
      this.drawFx(0);
      for (const s of this.seams) T.seam(c, s);
      for (const b of this.booms) T.boom(c, b);
      this.drawFx(1);
      c.restore();
      T.line(c, this.t);
      this.drawMounts();
      for (const n of this.nums) T.num(c, n);
      this.drawChain();
      for (const l of this.labels) {
        c.save();
        CX.wo(l.world).label(c, l.text, l.x, l.y, l.age, l.life);
        c.restore();
      }
      this.drawCaption();
    }

    drawFx(z) {
      const c = this.ctx;
      for (const e of this.fx) {
        if ((e.z || 0) !== z) continue;
        c.save();
        e.draw(c, this);
        c.restore();
        if (e.w && e.w.sub && e.x != null && !e.noTrail) {
          c.save();
          CX.wo(e.w.subWorld).trail(c, e, this.t, e.w);
          c.restore();
        }
      }
    }

    drawMounts() {
      const c = this.ctx;
      this.mounts.forEach((w, i) => {
        const on = this.active.includes(i);
        c.save();
        c.globalAlpha = on ? 1 : 0.32;
        const sz = this.mounts.length <= 3 ? 52 : BOX;
        drawMount(c, w, w.x, w.y, sz, this.t, on && this.mounts.length > 1 && this.active.length === 1);
        c.restore();
        if (!this.opt.compact || this.mounts.length <= 4) {
          c.save();
          c.globalAlpha = on ? 1 : 0.45;
          c.font = `600 ${this.mounts.length > 5 ? 8.5 : 10}px "Noto Sans KR", sans-serif`;
          c.textAlign = 'center';
          c.textBaseline = 'top';
          c.fillStyle = '#EDE6FF';
          const name = w.name;
          c.fillText(name, w.x, w.y + (this.mounts.length <= 3 ? 26 : BOX / 2) + 5, this.mounts.length > 5 ? 44 : 110);
          c.restore();
        }
      });
    }

    drawChain() {
      const since = this.t - this.chainT;
      if (this.chainN < 3 || since > 1.1) return;
      CX.th().chain(this.ctx, this.chainN, since);
    }

    drawCaption() {
      const ph = this.opt.phases[this.phaseI];
      if (!ph.title) return;
      const c = this.ctx;
      c.save();
      c.font = '700 13px "Noto Sans KR", sans-serif';
      const tw = c.measureText(ph.title).width;
      c.font = '500 10.5px "Noto Sans KR", sans-serif';
      const nw = ph.note ? c.measureText(ph.note).width : 0;
      const bw = Math.min(W - 20, Math.max(tw, nw) + 22);
      const bh = ph.note ? 42 : 26;
      c.fillStyle = 'rgba(8,4,18,0.78)';
      roundRect(c, 10, 46, bw, bh, 8);
      c.fill();
      c.strokeStyle = 'rgba(233,196,106,0.55)';
      c.lineWidth = 1;
      c.stroke();
      c.textAlign = 'left';
      c.textBaseline = 'top';
      c.fillStyle = '#FFFFFF';
      c.font = '700 13px "Noto Sans KR", sans-serif';
      c.fillText(ph.title, 21, 52, W - 40);
      if (ph.note) {
        c.fillStyle = '#CDBEF2';
        c.font = '500 10.5px "Noto Sans KR", sans-serif';
        c.fillText(ph.note, 21, 70, W - 40);
      }
      // 단계 점
      const n = this.opt.phases.length;
      if (n > 1) {
        for (let i = 0; i < n; i++) {
          c.beginPath();
          c.arc(W - 16 - (n - 1 - i) * 11, 58, i === this.phaseI ? 3.6 : 2.4, 0, TAU);
          c.fillStyle = i === this.phaseI ? '#E9C46A' : 'rgba(233,196,106,0.35)';
          c.fill();
        }
      }
      c.restore();
    }
  }
  CX.Scene = Scene;

  /** 공통(균열) 연쇄 숫자: n 연쇄 수, since 마지막 폭발 뒤 초 (0 ~ 1.1) */
  function drawChainNum(c, n, since) {
      const pop = 1 + 0.35 * Math.max(0, 1 - since / 0.18);
      const a = since > 0.8 ? 1 - (since - 0.8) / 0.3 : 1;
      c.save();
      c.globalAlpha = a;
      c.translate(W / 2, 196);
      c.scale(pop, pop);
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.font = '700 15px "Noto Sans KR", sans-serif';
      c.fillStyle = '#E9C46A';
      c.fillText('연쇄', 0, -44);
      c.font = '900 58px "Cinzel", "Orbit", serif';
      c.shadowColor = 'rgba(233,196,106,0.9)';
      c.shadowBlur = 18;
      c.fillStyle = '#FFFFFF';
      c.fillText(String(n), 0, 12);
      c.restore();
  }

  // ── 공통 그림 ───────────────────────────────────────────────
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  CX.util.roundRect = roundRect;

  /** 미리 그려 두는 그림 (재질·아이콘 등 매 프레임 같은 것): 3배 해상도 오프스크린. c.drawImage(spr, x, y, w, h) */
  const SPR = {};
  CX.util.sprite = function (key, w, h, draw) {
    if (SPR[key]) return SPR[key];
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * 3);
    cv.height = Math.ceil(h * 3);
    const c = cv.getContext('2d');
    c.scale(3, 3);
    draw(c, w, h);
    SPR[key] = cv;
    return cv;
  };

  function makeBg(scale) {
    const cv = document.createElement('canvas');
    cv.width = Math.round(W * scale);
    cv.height = Math.round(H * scale);
    const c = cv.getContext('2d');
    c.setTransform(scale, 0, 0, scale, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#120926');
    g.addColorStop(0.55, '#0B0816');
    g.addColorStop(1, '#07050F');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    const blob = (x, y, r, col) => {
      const rg = c.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, col);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg;
      c.fillRect(0, 0, W, H);
    };
    blob(70, 150, 170, 'rgba(42,20,80,0.55)');
    blob(300, 280, 190, 'rgba(58,22,96,0.35)');
    blob(180, 40, 160, 'rgba(255,63,164,0.10)');
    for (let i = 0; i < 70; i++) {
      c.fillStyle = `rgba(220,210,255,${rnd(0.08, 0.4)})`;
      c.fillRect(rnd(0, W), rnd(0, LINE_Y), rnd(0.6, 1.4), rnd(0.6, 1.4));
    }
    // 방어선 아래 받침
    const g2 = c.createLinearGradient(0, LINE_Y, 0, H);
    g2.addColorStop(0, 'rgba(233,196,106,0.10)');
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g2;
    c.fillRect(0, LINE_Y, W, H - LINE_Y);
    return cv;
  }

  // 하늘의 균열 (공통)
  const RIFT = [];
  for (let i = 0; i <= 18; i++) RIFT.push([(i / 18) * W, 22 + (i % 2 ? -6 : 5) + Math.sin(i * 1.7) * 4]);
  function drawRift(c, t) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    const pulse = 0.75 + Math.sin(t * 2.1) * 0.15;
    for (const [lw, a] of [
      [9, 0.12],
      [4, 0.35],
      [1.6, 0.95],
    ]) {
      c.beginPath();
      RIFT.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.strokeStyle = i2c(a * pulse);
      c.lineWidth = lw;
      c.stroke();
    }
    c.restore();
    function i2c(a) {
      return `rgba(255,110,190,${a})`;
    }
  }

  function drawEnemy(c, e, t) {
    if (!e.alive && e.flash <= 0) return;
    c.save();
    c.translate(e.x, e.y);
    const r = e.r;
    const pul = 0.75 + Math.sin(t * 4 + e.ph) * 0.25;
    let pts;
    if (e.type === 'armor') {
      pts = [];
      for (let i = 0; i < 6; i++) pts.push([Math.cos((i / 6) * TAU + Math.PI / 6) * r * 1.1, Math.sin((i / 6) * TAU + Math.PI / 6) * r * 1.05]);
    } else if (e.type === 'charge') {
      pts = [
        [0, r * 1.9],
        [r * 0.7, r * 0.2],
        [r * 0.45, -r * 1.1],
        [-r * 0.45, -r * 1.1],
        [-r * 0.7, r * 0.2],
      ];
      // 꼬리
      const g = c.createLinearGradient(0, -r * 1.1, 0, -r * 3.4);
      g.addColorStop(0, 'rgba(255,63,164,0.55)');
      g.addColorStop(1, 'rgba(255,63,164,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-r * 0.4, -r * 1.1);
      c.lineTo(r * 0.4, -r * 1.1);
      c.lineTo(0, -r * 3.4);
      c.closePath();
      c.fill();
    } else {
      pts = [
        [0, -r * 1.25],
        [r * 0.95, -r * 0.15],
        [r * 0.55, r * 1.05],
        [-r * 0.55, r * 1.05],
        [-r * 0.95, -r * 0.15],
      ];
    }
    const g = c.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#3A2468');
    g.addColorStop(1, '#0D0720');
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = e.type === 'armor' ? '#A994E6' : '#7C5CC4';
    c.lineWidth = e.type === 'armor' ? 2 : 1.2;
    c.stroke();
    // 면
    c.strokeStyle = 'rgba(190,170,255,0.35)';
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    c.lineTo(0, r * 0.2);
    c.lineTo(pts[2][0], pts[2][1]);
    c.moveTo(0, r * 0.2);
    c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    c.stroke();
    if (e.type === 'armor') {
      c.strokeStyle = 'rgba(169,148,230,0.6)';
      c.lineWidth = 1;
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + Math.PI / 6;
        const x = Math.cos(a) * r * 0.7;
        const y = Math.sin(a) * r * 0.68;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.closePath();
      c.stroke();
    }
    // 핵
    const cr = r * (e.type === 'armor' ? 0.34 : 0.42);
    const rg = c.createRadialGradient(0, r * 0.15, 0, 0, r * 0.15, cr * 2.2);
    rg.addColorStop(0, `rgba(255,190,230,${0.95 * pul})`);
    rg.addColorStop(0.35, `rgba(255,63,164,${0.8 * pul})`);
    rg.addColorStop(1, 'rgba(255,63,164,0)');
    c.fillStyle = rg;
    c.beginPath();
    c.arc(0, r * 0.15, cr * 2.2, 0, TAU);
    c.fill();
    if (e.slow > 0) {
      c.strokeStyle = 'rgba(170,230,255,0.7)';
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(0, 0, r * 1.35, 0, TAU);
      c.stroke();
    }
    if (e.flash > 0) {
      c.globalAlpha = e.flash / 0.12;
      c.fillStyle = '#FFFFFF';
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  // 공통 연쇄 폭발: 흰 섬광 + 금 빛줄
  function drawBoom(c, b) {
    const k = b.age / 0.55;
    c.save();
    c.globalCompositeOperation = 'lighter';
    if (b.leak) {
      c.globalAlpha = 1 - k;
      c.strokeStyle = '#FF4D6D';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(b.x, b.y, 6 + k * 16, Math.PI, TAU);
      c.stroke();
      c.restore();
      return;
    }
    const r = b.r * (0.35 + ease(k * 1.6) * 0.75);
    const rg = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    rg.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - k)})`);
    rg.addColorStop(0.4, `rgba(255,236,190,${0.6 * (1 - k)})`);
    rg.addColorStop(1, 'rgba(233,196,106,0)');
    c.fillStyle = rg;
    c.beginPath();
    c.arc(b.x, b.y, r, 0, TAU);
    c.fill();
    c.strokeStyle = `rgba(233,196,106,${0.8 * (1 - k)})`;
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(b.x, b.y, r * 1.12, 0, TAU);
    c.stroke();
    // 빛 조각
    c.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`;
    c.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + b.x;
      c.beginPath();
      c.moveTo(b.x + Math.cos(a) * r * 0.6, b.y + Math.sin(a) * r * 0.6);
      c.lineTo(b.x + Math.cos(a) * r * 1.25, b.y + Math.sin(a) * r * 1.25);
      c.stroke();
    }
    c.restore();
  }

  function drawSeam(c, s) {
    const k = s.age / 0.3;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(233,196,106,${1 - k})`;
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(s.x1, s.y1);
    const mx = (s.x1 + s.x2) / 2 + (s.y2 - s.y1) * 0.12;
    const my = (s.y1 + s.y2) / 2 - (s.x2 - s.x1) * 0.12;
    c.quadraticCurveTo(mx, my, s.x2, s.y2);
    c.stroke();
    c.strokeStyle = `rgba(255,255,255,${0.8 * (1 - k)})`;
    c.lineWidth = 0.8;
    c.stroke();
    c.restore();
  }

  function drawNum(c, n) {
    const a = n.age > 0.5 ? 1 - (n.age - 0.5) / 0.3 : 1;
    c.save();
    c.globalAlpha = a;
    const size = n.kind === 2 ? 19 : n.kind === 1 ? 16 : 12;
    c.font = `900 ${size}px "Cinzel", "Orbit", serif`;
    c.textAlign = 'center';
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(10,5,22,0.9)';
    c.strokeText(String(n.v), n.x, n.y);
    c.fillStyle = n.kind ? '#FFE7A3' : '#FFFFFF';
    c.fillText(String(n.v), n.x, n.y);
    c.restore();
  }

  // 방어선: 흰 빛줄 + 금 룬 마디 (봉인선)
  function drawLine(c, t) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(0, LINE_Y - 8, 0, LINE_Y + 8);
    g.addColorStop(0, 'rgba(233,196,106,0)');
    g.addColorStop(0.5, 'rgba(233,196,106,0.28)');
    g.addColorStop(1, 'rgba(233,196,106,0)');
    c.fillStyle = g;
    c.fillRect(0, LINE_Y - 8, W, 16);
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(0, LINE_Y);
    c.lineTo(W, LINE_Y);
    c.stroke();
    c.restore();
    c.save();
    for (let x = 22; x < W; x += 45) {
      const p = 0.6 + Math.sin(t * 2 + x * 0.05) * 0.4;
      c.fillStyle = `rgba(233,196,106,${0.55 + p * 0.45})`;
      c.beginPath();
      c.moveTo(x, LINE_Y - 4.5);
      c.lineTo(x + 3.5, LINE_Y);
      c.lineTo(x, LINE_Y + 4.5);
      c.lineTo(x - 3.5, LINE_Y);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  /** 무기 자리: 공통 유물함 틀 + 세계 재질 + 아이콘 + 문장. 합친 무기는 사선으로 메인 2/3 · 보조 1/3, 문장 둘 */
  function drawMount(c, w, x, y, s, t, focus) {
    const half = s / 2;
    const mw = CX.wo(w.world);
    c.save();
    if (focus) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(233,196,106,${0.45 + Math.sin(t * 5) * 0.25})`;
      c.lineWidth = 2;
      roundRect(c, x - half - 4, y - half - 4, s + 8, s + 8, 10);
      c.stroke();
      c.restore();
    }
    // 같은 세계 합성 = 세계 공명: 그 세계 색 겹 테가 맥박친다
    if (w.sub && w.world === w.subWorld) {
      const col = (mw.colors && mw.colors.main) || '#E9C46A';
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 2; k++) {
        const ph = (t * 0.9 + k * 0.5) % 1;
        c.globalAlpha = 0.7 * (1 - ph);
        c.strokeStyle = col;
        c.lineWidth = 2;
        roundRect(c, x - half - 3 - ph * 10, y - half - 3 - ph * 10, s + 6 + ph * 20, s + 6 + ph * 20, 9 + ph * 6);
        c.stroke();
      }
      c.restore();
    }
    // 틀 바깥
    c.fillStyle = '#120A22';
    roundRect(c, x - half - 2, y - half - 2, s + 4, s + 4, 8);
    c.fill();
    // 안쪽 재질
    c.save();
    roundRect(c, x - half, y - half, s, s, 7);
    c.clip();
    mw.box(c, x - half, y - half, s, s, t);
    if (w.sub) {
      const sw = CX.wo(w.subWorld);
      c.save();
      c.beginPath();
      c.moveTo(x + half, y - half + s * 0.34);
      c.lineTo(x + half, y + half);
      c.lineTo(x - half + s * 0.34, y + half);
      c.closePath();
      c.clip();
      sw.box(c, x - half, y - half, s, s, t);
      c.restore();
      c.strokeStyle = 'rgba(233,196,106,0.9)';
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(x + half, y - half + s * 0.34);
      c.lineTo(x - half + s * 0.34, y + half);
      c.stroke();
    }
    c.restore();
    // 아이콘
    c.save();
    mw.icon(c, w.id, x - (w.sub ? 3 : 0), y - (w.sub ? 3 : 0), s * (w.sub ? 0.7 : 0.8), t);
    c.restore();
    if (w.sub) {
      c.save();
      CX.wo(w.subWorld).icon(c, w.sub, x + half * 0.5, y + half * 0.5, s * 0.42, t);
      c.restore();
    }
    // 틀 테
    c.strokeStyle = '#E9C46A';
    c.lineWidth = 1.6;
    roundRect(c, x - half, y - half, s, s, 7);
    c.stroke();
    // 문장
    c.save();
    mw.crest(c, x - half + 1, y - half + 1, 6.5);
    c.restore();
    if (w.sub) {
      c.save();
      CX.wo(w.subWorld).crest(c, x - half + 11, y - half + 1, 6.5);
      c.restore();
    }
    c.restore();
  }
  CX.drawMount = drawMount;

  // 합성 순간: 보조 무기가 메인 유물함으로 날아 들어가 박힌다
  CX.introFx = (w) => introFx(w);
  function introFx(w) {
    return {
      age: 0,
      life: 0.9,
      z: 1,
      hist: [],
      update() {},
      draw(c) {
        const k = ease(this.age / 0.6);
        const sx = w.x + 80;
        const sy = w.y - 120;
        const x = sx + (w.x - sx) * k;
        const y = sy + (w.y - sy) * k;
        if (this.age < 0.6) {
          c.save();
          c.globalAlpha = 0.95;
          CX.wo(w.subWorld).icon(c, w.sub, x, y, 30, this.age);
          c.restore();
        } else {
          const q = (this.age - 0.6) / 0.3;
          c.globalCompositeOperation = 'lighter';
          c.strokeStyle = `rgba(233,196,106,${1 - q})`;
          c.lineWidth = 3;
          c.beginPath();
          c.arc(w.x, w.y, 22 + q * 26, 0, TAU);
          c.stroke();
        }
      },
    };
  }

  // ── 세계 모듈이 쓰는 도우미 ────────────────────────────────
  // 모두 api.add 로 효과를 만들고 x,y(머리 위치)·vx,vy 를 내놓는다 → 합친 무기면 보조 세계 궤적 층이 자동으로 얹힌다.
  // 맞힘은 api.hit 로 → 맞는 무늬(메인 + 보조) · 반응 · 연쇄가 자동.

  /**
   * 투사체. o: {speed=420, dmg=3, r=4, arc=0(포물선 높이), splash=0, pierce=0, life=2.2, draw(ctx,p,api), onHit(api,p,e), z}
   * p: {x,y,vx,vy,tx,ty,age,...}
   */
  CX.shoot = function (api, w, tg, o) {
    o = o || {};
    const sx = o.x == null ? w.x : o.x;
    const sy = o.y == null ? w.y - BOX / 2 : o.y;
    const lead = o.arc ? 0.5 : 0.15;
    const tx = tg.x + (o.spread ? rnd(-o.spread, o.spread) : 0);
    const ty = tg.y + tg.sp * lead;
    const sp = o.speed || 420;
    const d = Math.hypot(tx - sx, ty - sy);
    const dur = d / sp;
    const p = {
      x: sx,
      y: sy,
      vx: 0,
      vy: 0,
      sx,
      sy,
      tx,
      ty,
      dur,
      r: o.r || 4,
      hitSet: new Set(),
      pierceLeft: o.pierce || 0,
      z: o.z || 0,
      data: o.data || {},
      update(dt, a) {
        const k = this.age / this.dur;
        const px = this.x;
        const py = this.y;
        if (o.arc) {
          this.x = sx + (tx - sx) * k;
          this.y = sy + (ty - sy) * k - Math.sin(Math.PI * Math.min(1, k)) * o.arc;
        } else {
          this.x = sx + ((tx - sx) / dur) * this.age;
          this.y = sy + ((ty - sy) / dur) * this.age;
        }
        this.vx = (this.x - px) / Math.max(dt, 1e-4);
        this.vy = (this.y - py) / Math.max(dt, 1e-4);
        if (o.arc) {
          if (k >= 1) {
            land(a, this);
            return false;
          }
          return true;
        }
        for (const e of a.near(this.x, this.y, this.r)) {
          if (this.hitSet.has(e)) continue;
          this.hitSet.add(e);
          if (o.splash) {
            land(a, this);
            return false;
          }
          a.hit(w, e, o.dmg || 3, this.x, this.y);
          if (o.onHit) o.onHit(a, this, e);
          if (this.pierceLeft-- <= 0) return false;
        }
        return this.age < (o.life || dur + 0.4) && this.y > -20 && this.x > -20 && this.x < W + 20;
      },
      draw(c, a) {
        (o.draw || defaultBullet)(c, this, a);
      },
    };
    function land(a, pr) {
      const hitAny = a.near(pr.x, pr.y, o.splash || 14);
      for (const e of hitAny) a.hit(w, e, o.dmg || 3, e.x, e.y);
      if (!hitAny.length) {
        CX.wo(w.world).hit(a, pr.x, pr.y, w, false, null);
        if (w.sub) CX.wo(w.subWorld).hit(a, pr.x, pr.y, w, true, null);
      }
      if (o.onLand) o.onLand(a, pr, hitAny);
    }
    return api.add(p, w);
  };
  function defaultBullet(c, p) {
    c.fillStyle = '#FFFFFF';
    c.beginPath();
    c.arc(p.x, p.y, p.r, 0, TAU);
    c.fill();
  }

  /**
   * 광선 (즉시). o: {dmg=4, dur=0.35, width=3, draw(ctx,b,api), pierce=false(길게 꿰뚫기), x,y(시작)}
   * b: {x1,y1,x2,y2,x,y(=끝),age}
   */
  CX.beam = function (api, w, tg, o) {
    o = o || {};
    const x1 = o.x == null ? w.x : o.x;
    const y1 = o.y == null ? w.y - BOX / 2 : o.y;
    let x2 = tg.x;
    let y2 = tg.y;
    if (o.pierce) {
      const d = Math.hypot(x2 - x1, y2 - y1) || 1;
      x2 = x1 + ((x2 - x1) / d) * 640;
      y2 = y1 + ((y2 - y1) / d) * 640;
    }
    const hits = o.pierce ? api.enemies.filter((e) => e.alive && distSeg(e.x, e.y, x1, y1, x2, y2) < e.r + (o.width || 3)) : [tg];
    for (const e of hits) api.hit(w, e, o.dmg || 4, e.x, e.y);
    const b = {
      x1,
      y1,
      x2,
      y2,
      x: tg.x,
      y: tg.y,
      vx: x2 - x1,
      vy: y2 - y1,
      life: o.dur || 0.35,
      z: o.z || 0,
      update() {},
      draw(c, a) {
        (o.draw || defaultBeam)(c, this, a);
      },
    };
    return api.add(b, w);
  };
  function defaultBeam(c, b) {
    c.strokeStyle = '#FFFFFF';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(b.x1, b.y1);
    c.lineTo(b.x2, b.y2);
    c.stroke();
  }
  function distSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l = dx * dx + dy * dy || 1;
    const k = clamp(((px - x1) * dx + (py - y1) * dy) / l, 0, 1);
    return Math.hypot(px - (x1 + dx * k), py - (y1 + dy * k));
  }
  CX.util.distSeg = distSeg;

  /**
   * 장판 (자리에 남아 틱마다 피해). o: {r=40, dur=2.5, tick=0.5, dmg=2, slow=0, draw(ctx,z,api), z=-1}
   * z: {x,y,r,age,dur}
   */
  CX.zone = function (api, w, x, y, o) {
    o = o || {};
    let next = 0;
    const zz = {
      x,
      y,
      vx: 0,
      vy: 0,
      r: o.r || 40,
      dur: o.dur || 2.5,
      life: o.dur || 2.5,
      z: o.z == null ? -1 : o.z,
      update(dt, a) {
        if (this.age >= next) {
          next += o.tick || 0.5;
          for (const e of a.near(this.x, this.y, this.r)) a.hit(w, e, o.dmg || 2, e.x, e.y, { slow: o.slow || 0, noMark: !!o.quiet });
        }
      },
      draw(c, a) {
        (o.draw || defaultZone)(c, this, a);
      },
    };
    return api.add(zz, w);
  };
  function defaultZone(c, z) {
    c.strokeStyle = 'rgba(255,255,255,0.6)';
    c.beginPath();
    c.arc(z.x, z.y, z.r, 0, TAU);
    c.stroke();
  }

  /**
   * 달려가는 것 (소환수·돌격). 무기 자리에서 나와 적에게 달려가 들이받고 다음 적으로, n 번 뒤 사라짐.
   * o: {speed=180, dmg=4, n=3, r=9, draw(ctx,u,api), onHit(api,u,e), line=false(돌격: 위로 곧게 한 번)}
   * u: {x,y,vx,vy,dir,age}
   */
  CX.runner = function (api, w, tg, o) {
    o = o || {};
    const u = {
      x: w.x,
      y: w.y - BOX / 2,
      vx: 0,
      vy: -1,
      dir: -Math.PI / 2,
      tgt: tg,
      left: o.n || 3,
      r: o.r || 9,
      z: o.z || 0,
      hitSet: new Set(),
      update(dt, a) {
        const sp = o.speed || 180;
        if (o.line) {
          if (this.age < 0.01) {
            const d = Math.hypot(tg.x - this.x, tg.y - this.y) || 1;
            this.vx = ((tg.x - this.x) / d) * sp;
            this.vy = ((tg.y - this.y) / d) * sp;
          }
          this.x += this.vx * dt;
          this.y += this.vy * dt;
          this.dir = Math.atan2(this.vy, this.vx);
          for (const e of a.near(this.x, this.y, this.r)) {
            if (this.hitSet.has(e)) continue;
            this.hitSet.add(e);
            a.hit(w, e, o.dmg || 4, e.x, e.y, { push: 10 });
            if (o.onHit) o.onHit(a, this, e);
          }
          return this.y > -40 && this.x > -40 && this.x < W + 40;
        }
        if (!this.tgt || !this.tgt.alive) {
          this.tgt = a.target('near', this.x, this.y);
          if (!this.tgt) return this.age < 4;
        }
        const dx = this.tgt.x - this.x;
        const dy = this.tgt.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.vx = (dx / d) * sp;
        this.vy = (dy / d) * sp;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.dir = Math.atan2(this.vy, this.vx);
        if (d < this.r + this.tgt.r) {
          a.hit(w, this.tgt, o.dmg || 4, this.tgt.x, this.tgt.y, { push: 8 });
          if (o.onHit) o.onHit(a, this, this.tgt);
          this.left--;
          this.tgt = null;
          if (this.left <= 0) return false;
        }
        return this.age < 6;
      },
      draw(c, a) {
        (o.draw || defaultRunner)(c, this, a);
      },
    };
    return api.add(u, w);
  };
  function defaultRunner(c, u) {
    c.fillStyle = '#FFFFFF';
    c.beginPath();
    c.arc(u.x, u.y, u.r, 0, TAU);
    c.fill();
  }

  /** 잠깐 그리고 사라지는 장식 (맞는 무늬·반응 연출 등). draw(ctx, k(0→1), fx, api) */
  CX.mark = function (api, x, y, life, draw, z) {
    return api.add({ x, y, life, z: z == null ? 1 : z, noTrail: true, update() {}, draw(c, a) {
      draw(c, clamp(this.age / life, 0, 1), this, a);
    } });
  };

  // ── 테마: 판의 틀 (바탕 · 하늘 · 적 · 연쇄 폭발 · 숫자 · 방어선 · 연쇄 수 · 무기 받침 · HUD · 카드 …) ──
  // 세계 모듈(무기 그림·공격·반응)은 그대로, 틀만 바꾼다. 빠진 함수는 'rift'(지금 틀)의 것을 쓴다.
  CX.themes = CX.themes || {};
  let thVer = 0;
  const thCache = { k: null, v: -1, t: null };
  CX.defineTheme = function (key, def) {
    CX.themes[key] = Object.assign({ key }, def);
    thVer++;
  };
  CX.extendTheme = function (key, def) {
    CX.themes[key] = Object.assign(CX.themes[key] || { key }, def);
    thVer++;
  };
  CX.themeKey = 'rift';
  CX.th = function () {
    if (thCache.k === CX.themeKey && thCache.v === thVer) return thCache.t;
    const t = Object.assign({}, CX.themes.rift, CX.themes[CX.themeKey] || {}, { key: CX.themeKey });
    thCache.k = CX.themeKey;
    thCache.v = thVer;
    thCache.t = t;
    return t;
  };
  /** 판 바탕 한 장 (W×H, 배율 scale 로 미리 그려 둠): theme.bg(scale) 에서 쓴다 */
  CX.util.bgCanvas = function (scale, draw) {
    const cv = document.createElement('canvas');
    cv.width = Math.round(W * scale);
    cv.height = Math.round(H * scale);
    const c = cv.getContext('2d');
    c.setTransform(scale, 0, 0, scale, 0, 0);
    draw(c, W, H);
    return cv;
  };
  CX.defineTheme('rift', {
    name: '균열 (지금)',
    desc: '보라 허공 · 금테 · 세리프 숫자',
    bg: (scale) => makeBg(scale),
    sky: drawRift,
    enemy: drawEnemy,
    boom: drawBoom,
    seam: drawSeam,
    num: drawNum,
    line: drawLine,
    chain: drawChainNum,
  });

  /**
   * 무기를 판 위에 "놓인 총"처럼: 테마 받침(theme.base) 위에 세계 그림(아이콘)을 세우고,
   * 겨누는 무기(총·광선·포·투척·회전체·음파)는 쏜 쪽으로 기울고 쏠 때 뒤로 튄다. 합친 무기는 보조가 곁에 붙어 맴돈다.
   */
  const AIM = { gun: 1, ray: 1, turret: 1, throw: 1, spinner: 1, sound: 1 };
  CX.drawGun = function (c, w, x, y, s, t) {
    const T = CX.th();
    c.save();
    if (T.base) {
      c.save();
      T.base(c, w, x, y, s, t);
      c.restore();
    }
    const tilt = AIM[w.cat] ? clamp(w.aim || 0, -0.55, 0.55) : 0;
    c.translate(x, y - s * 0.18);
    c.rotate(tilt);
    c.translate(0, (w.kick || 0) * s * 0.12);
    CX.wo(w.world).icon(c, w.id, 0, 0, s, t);
    if (w.sub) {
      c.rotate(-tilt);
      const a = t * 1.7;
      CX.wo(w.subWorld).icon(c, w.sub, s * 0.46 + Math.cos(a) * 1.6, -s * 0.34 + Math.sin(a) * 1.6, s * 0.5, t);
    }
    c.restore();
  };

  // ── 돌리기 ──────────────────────────────────────────────────
  const scenes = [];
  CX.mount = function (canvas, opt, existing) {
    const s = existing || new Scene(canvas, opt);
    scenes.push(s);
    if ('IntersectionObserver' in window) {
      io.observe(canvas);
    } else s.visible = true;
    canvas.__scene = s;
    // 처음 한 장은 보이게 미리 몇 프레임 돌려 그린다
    if (!existing) for (let i = 0; i < 40; i++) s.step(1 / 30);
    s.draw();
    return s;
  };
  CX.unmount = function (s) {
    const i = scenes.indexOf(s);
    if (i >= 0) scenes.splice(i, 1);
    if (io) io.unobserve(s.cv);
  };
  const io =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (ents) => {
            for (const en of ents) if (en.target.__scene) en.target.__scene.visible = en.isIntersecting;
          },
          { rootMargin: '80px' },
        )
      : null;
  let last = 0;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!document.hidden) {
      for (const s of scenes) {
        if (!s.visible) continue;
        const d = dt * CX.speed * (reduce ? 0.5 : 1);
        // 큰 dt 는 나눠서
        const n = Math.ceil(d / (1 / 60)) || 1;
        for (let i = 0; i < n; i++) s.step(d / n);
        s.draw();
      }
    }
    requestAnimationFrame(frame);
  }
  CX.start = function () {
    requestAnimationFrame((t) => {
      last = t;
      requestAnimationFrame(frame);
    });
  };
  window.addEventListener('resize', () => {
    for (const s of scenes) s.resize();
  });
})();
