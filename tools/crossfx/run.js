// 균열 크로스오버 실전 판 (11-24 유저: "실제 게임에서 시뮬 느낌으로라도, 실제 전투 느낌에서 어떻게 되는지")
// 실제 게임 한 판처럼: 위 HUD(목숨 · LV · 웨이브 · 경험치) · 웨이브마다 대형으로 내려오는 적 · 레벨 업 카드(새 무기 · 강화 · 합성)
// · 갈래 4·7·10·13 마다 합성 칸 (게임의 '폭=칸' 규칙) · 재료 중 낮은 레벨 = 등급 · 무기 줄 두 줄.
// 그림은 세계 모듈(worlds/*.js)과 공통 틀(runtime.js) 그대로.
(function () {
  const { W, LINE_Y } = CX.size;
  const { TAU, clamp, rnd, ease, roundRect } = CX.util;
  const HUD_H = 64;
  const CH = 640;
  const MB = 36;
  /** 판 위 무기 크기 */
  const GUN = 40;
  const CAT_TH = [4, 7, 10, 13];
  const GRADE = { 1: 1.2, 2: 1.3, 3: 1.45, 4: 1.6, 5: 1.8 };
  const D = CX.data;
  const ORDER = ['ops', 'steel', 'sumi', 'rift', 'comic', 'bio'];

  class Run extends CX.Scene {
    constructor(canvas, opt) {
      super(canvas, Object.assign({ height: CH, offsetY: HUD_H, density: 0, phases: [{ mounts: [], dur: 1e9 }] }, opt));
      this.auto = true;
      this.minTargetY = 150;
      /** 난이도: 웨이브 체력 = 1 + hpA·(w−1) + hpB·(w−1)², 수 = 9 + cnt·w, 속도 +spd·(w−1) */
      this.tune = Object.assign({ hpA: 0.36, hpB: 0.014, cnt: 2.3, spd: 0.012, dur: 14 }, (opt && opt.tune) || {});
      this.best = { wave: 0, chain: 0 };
      this.reset();
    }

    reset() {
      this.enemies = [];
      this.fx = [];
      this.nums = [];
      this.booms = [];
      this.seams = [];
      this.pend = [];
      this.labels = [];
      this.timers = [];
      this.pops = [];
      this.chainN = 0;
      this.chainPeak = 0;
      this.hearts = 5;
      this.level = 1;
      this.exp = 0;
      this.need = this.needFor(1);
      this.wave = 0;
      this.waveT = 0;
      this.clearT = 0;
      this.queue = [];
      this.kills = 0;
      this.fusedN = 0;
      this.offer = null;
      this.over = 0;
      this.banner = null;
      this.hurt = 0;
      this.stat = { deathY: 0, deaths: 0, leaks: 0, firstFuse: 0 };
      this.owned = [];
      for (const id of this.opt.start || ['arm_rifle', 'arm_cannon']) this.addWeapon(id, true);
      this.nextWave();
    }

    needFor(lv) {
      return 4 + lv * 2;
    }

    // ── 무기 ──
    ownedIds() {
      const s = new Set();
      for (const w of this.owned) {
        s.add(w.id);
        if (w.sub) s.add(w.sub);
      }
      return s;
    }
    cats() {
      const s = new Set();
      for (const w of this.owned) {
        s.add(w.cat);
        if (w.sub) s.add(D.weapons[w.sub].cat);
      }
      return s;
    }
    worlds() {
      const m = {};
      for (const w of this.owned) {
        m[w.world] = (m[w.world] || 0) + 1;
        if (w.sub) m[w.subWorld] = (m[w.subWorld] || 0) + 1;
      }
      return m;
    }
    fuseSlots() {
      const n = this.cats().size;
      return CAT_TH.filter((t) => n >= t).length - this.fusedN;
    }
    applyLv(w) {
      w.pow = (1 + 0.28 * (w.lv - 1)) * (w.sub ? w.fuseMul : 1);
      w.cdMul = 1 - 0.06 * (w.lv - 1);
    }
    addWeapon(id, quiet) {
      const w = CX.weapon(id);
      w.lv = 1;
      this.applyLv(w);
      this.owned.push(w);
      this.relayout();
      if (!quiet) this.pop(w, 'NEW');
      return w;
    }
    fuse(a, b) {
      const f = CX.weapon(a.id, b.id);
      f.lv = Math.max(a.lv, b.lv);
      f.grade = Math.min(a.lv, b.lv);
      f.fuseMul = GRADE[f.grade] || 1.3;
      this.applyLv(f);
      const i = this.owned.indexOf(a);
      this.owned[i] = f;
      this.owned = this.owned.filter((w) => w !== b);
      this.fusedN++;
      if (!this.stat.firstFuse) this.stat.firstFuse = Math.round(this.t);
      this.relayout();
      this.fx.push(CX.introFx(f));
      this.banner = { text: '합성 · ' + f.name, sub: `몸 ${a.name} + 연출 ${b.name}`, age: 0, life: 1.8 };
      return f;
    }
    relayout() {
      const n = this.owned.length;
      const rows = n <= 7 ? [this.owned] : [this.owned.slice(0, Math.ceil(n / 2)), this.owned.slice(Math.ceil(n / 2))];
      // 판 위에 놓인 총처럼: 한 줄이면 방어선 아래 가운데, 둘이면 앞뒤 두 줄 엇갈려
      const ys = rows.length === 1 ? [496] : [480, 522];
      rows.forEach((row, r) => {
        const gap = Math.min(50, (W - 34) / row.length);
        row.forEach((w, i) => {
          w.x = W / 2 + (i - (row.length - 1) / 2) * gap + (rows.length > 1 ? (r ? gap / 4 : -gap / 4) : 0);
          w.y = ys[r];
        });
      });
      this.mounts = this.owned;
      this.active = this.owned.map((_, i) => i);
    }
    pop(w, text) {
      this.pops.push({ w, text, age: 0 });
    }

    // ── 웨이브 ──
    mkEnemy(type, x, y, hpMul) {
      const boss = type === 'boss';
      const t = boss ? 'armor' : type;
      const e = {
        type: t,
        boss,
        x: clamp(x, 16, W - 16),
        y,
        r: boss ? 24 : t === 'armor' ? 15 : t === 'charge' ? 10 : 11,
        hp: (boss ? 90 : t === 'armor' ? 15 : t === 'charge' ? 4 : 6) * hpMul,
        sp: (boss ? 9 : t === 'armor' ? 14 : t === 'charge' ? 36 : 20) * (this.spdMul || 1),
        ph: rnd(0, TAU),
        alive: true,
        flash: 0,
        slow: 0,
      };
      e.max = e.hp;
      return e;
    }
    nextWave() {
      this.wave++;
      this.waveT = 0;
      this.clearT = 0;
      const wv = this.wave;
      const T = this.tune;
      const n = Math.round(Math.min(50, 9 + wv * T.cnt));
      const hpMul = 1 + T.hpA * (wv - 1) + T.hpB * (wv - 1) ** 2;
      this.spdMul = 1 + T.spd * (wv - 1);
      const armorP = Math.min(0.32, 0.06 + wv * 0.018);
      const chargeP = Math.min(0.22, 0.04 + wv * 0.012);
      const typ = () => {
        const r = Math.random();
        return r < armorP ? 'armor' : r < armorP + chargeP ? 'charge' : 'normal';
      };
      const pat = ['rows', 'wedge', 'clusters', 'stream'][(wv - 1) % 4];
      const q = [];
      if (pat === 'rows') {
        const per = Math.min(8, Math.max(5, Math.round(n / 3)));
        for (let i = 0; i < n; i++) {
          const row = Math.floor(i / per);
          const col = i % per;
          q.push({ at: row * 1.9, e: this.mkEnemy(typ(), 30 + (col + 0.5) * ((W - 60) / per) + (row % 2 ? 10 : -10), -20 - (row % 2) * 6, hpMul) });
        }
      } else if (pat === 'wedge') {
        let k = 0;
        for (let g = 0; k < n; g++) {
          const cx = rnd(90, W - 90);
          for (let j = 0; j < 7 && k < n; j++, k++) {
            const side = j === 0 ? 0 : (j % 2 ? 1 : -1) * Math.ceil(j / 2);
            q.push({ at: g * 2.6 + Math.abs(side) * 0.35, e: this.mkEnemy(typ(), cx + side * 26, -20, hpMul) });
          }
        }
      } else if (pat === 'clusters') {
        let k = 0;
        for (let g = 0; k < n; g++) {
          const cx = rnd(50, W - 50);
          const m = 4 + Math.floor(Math.random() * 3);
          for (let j = 0; j < m && k < n; j++, k++) q.push({ at: g * 1.7, e: this.mkEnemy(typ(), cx + rnd(-30, 30), -20 + rnd(-26, 6), hpMul) });
        }
      } else {
        for (let i = 0; i < n; i++) q.push({ at: i * 0.42, e: this.mkEnemy(typ(), W / 2 + Math.sin(i * 0.7) * 120, -20, hpMul) });
      }
      if (wv % 5 === 0) q.push({ at: 2.5, e: this.mkEnemy('boss', W / 2, -30, 1 + 0.25 * (wv / 5 - 1)) });
      q.sort((a, b) => a.at - b.at);
      // 앞 웨이브가 아직 내려오는 중이면 남은 줄 뒤에 잇는다 (웨이브가 겹치며 압박)
      this.queue = this.queue.map((x) => ({ at: Math.max(0, x.at - this.waveT), e: x.e })).concat(q).sort((a, b) => a.at - b.at);
      this.banner = { text: wv % 5 === 0 ? `WAVE ${wv} · 균열 군주` : `WAVE ${wv}`, sub: '', age: 0, life: 1.4, wave: true };
    }
    spawnTick(dt) {
      this.waveT += dt;
      while (this.queue.length && this.queue[0].at <= this.waveT) this.enemies.push(this.queue.shift().e);
      const alive = this.enemies.some((e) => e.alive);
      if (!this.queue.length && !alive) {
        this.clearT += dt;
        if (this.clearT > 1.2) this.nextWave();
      } else if (this.waveT > (this.tune.dur || 13)) this.nextWave();
    }
    onKill(e) {
      this.kills++;
      this.stat.deathY += e.y;
      this.stat.deaths++;
      this.exp += e.boss ? 10 : e.type === 'armor' ? 2 : 1;
    }
    onLeak(e) {
      this.stat.leaks++;
      this.hearts -= e.boss ? 2 : 1;
      this.hurt = 0.6;
      this.shake(4);
      if (this.hearts <= 0 && !this.over) {
        this.hearts = 0;
        this.over = 0.001;
      }
    }

    // ── 레벨 업 카드 ──
    openOffer() {
      const cards = [];
      const own = this.ownedIds();
      const ownWorlds = this.worlds();
      const cats = this.cats();
      if (this.fuseSlots() > 0) {
        let best = null;
        let bs = -1;
        const free = this.owned.filter((w) => !w.sub && w.lv >= 2);
        for (const a of free)
          for (const b of free) {
            if (a === b || a.cat === b.cat) continue;
            const s = Math.min(a.lv, b.lv) * 10 + (a.world !== b.world ? 5 : 0) + a.lv + Math.random();
            if (s > bs) (bs = s), (best = [a, b]);
          }
        if (best) cards.push({ kind: 'fuse', a: best[0], b: best[1] });
      }
      const fresh = Object.keys(D.weapons).filter((id) => !own.has(id));
      fresh.sort((x, y) => {
        const sx = (ownWorlds[D.weapons[x].world] ? 0 : 2) + (cats.has(D.weapons[x].cat) ? 0 : 1) + Math.random();
        const sy = (ownWorlds[D.weapons[y].world] ? 0 : 2) + (cats.has(D.weapons[y].cat) ? 0 : 1) + Math.random();
        return sy - sx;
      });
      if (this.owned.length < 12) for (const id of fresh.slice(0, cards.length ? 1 : 2)) cards.push({ kind: 'new', id });
      const ups = this.owned.filter((w) => w.lv < 5).sort((a, b) => a.lv - b.lv + Math.random() * 0.5);
      for (const w of ups) {
        if (cards.length >= 3) break;
        cards.push({ kind: 'up', w });
      }
      for (const id of fresh.slice(2)) {
        if (cards.length >= 3) break;
        cards.push({ kind: 'new', id });
      }
      for (const c of cards) c.view = c.kind === 'fuse' ? CX.weapon(c.a.id, c.b.id) : c.kind === 'new' ? CX.weapon(c.id) : c.w;
      this.offer = { cards: cards.slice(0, 3), age: 0, pick: -1, pickAt: 0, from: this.level - 1 };
    }
    autoPick() {
      const cs = this.offer.cards;
      let i = cs.findIndex((c) => c.kind === 'fuse');
      // 합성 칸이 열렸는데 Lv 2 재료가 모자라면 강화부터 (재료 만들기)
      if (i < 0 && this.fuseSlots() > 0 && this.owned.filter((w) => !w.sub && w.lv >= 2).length < 2) i = cs.findIndex((c) => c.kind === 'up' && c.w.lv === 1 && !c.w.sub);
      if (i < 0 && this.owned.length < 10) i = cs.findIndex((c) => c.kind === 'new');
      if (i < 0) i = cs.findIndex((c) => c.kind === 'up');
      return Math.max(0, i);
    }
    choose(i) {
      if (!this.offer || this.offer.pick >= 0 || !this.offer.cards[i]) return;
      this.offer.pick = i;
      this.offer.pickAt = this.offer.age;
    }
    applyCard(c) {
      if (c.kind === 'new') this.addWeapon(c.id);
      else if (c.kind === 'up') {
        c.w.lv++;
        this.applyLv(c.w);
        this.pop(c.w, `Lv ${c.w.lv - 1} → ${c.w.lv}`);
      } else this.fuse(c.a, c.b);
    }
    /** 캔버스 클릭 (논리 좌표) → 카드 고르기 */
    click(x, y) {
      if (!this.offer || this.offer.pick >= 0) return;
      const fy = y - this.oy;
      this.offer.cards.forEach((c, i) => {
        const cy = 140 + i * 112;
        if (x > 18 && x < W - 18 && fy > cy && fy < cy + 100) this.choose(i);
      });
    }

    // ── 한 틱 ──
    step(dt) {
      this.hurt = Math.max(0, this.hurt - dt);
      for (const p of this.pops) p.age += dt;
      this.pops = this.pops.filter((p) => p.age < 1.6);
      if (this.banner) {
        this.banner.age += dt;
        if (this.banner.age > this.banner.life) this.banner = null;
      }
      if (this.over) {
        this.over += dt;
        this.t += dt;
        if (this.over > 4) this.reset();
        return;
      }
      if (this.offer) {
        const o = this.offer;
        o.age += dt;
        if (this.auto && o.pick < 0 && o.age > 1.5) this.choose(this.autoPick());
        if (o.pick >= 0 && o.age - o.pickAt > 0.55) {
          this.applyCard(o.cards[o.pick]);
          this.offer = null;
        }
        return;
      }
      super.step(dt);
      this.best.wave = Math.max(this.best.wave, this.wave);
      this.best.chain = Math.max(this.best.chain, this.chainPeak);
      if (this.exp >= this.need) {
        this.exp -= this.need;
        this.level++;
        this.need = this.needFor(this.level);
        this.openOffer();
      }
    }

    // ── 그리기: 틀은 테마 (CX.th()), 세계 그림은 세계 모듈 ──
    draw() {
      super.draw();
      const c = this.ctx;
      const T = CX.th();
      c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      c.save();
      T.hud(c, this);
      c.restore();
      c.translate(0, this.oy);
      for (const f of ['chips', 'gate']) {
        c.save();
        T[f](c, this);
        c.restore();
      }
      if (this.hurt > 0) {
        c.save();
        T.hurt(c, this, this.hurt / 0.6);
        c.restore();
      }
      if (this.banner) {
        c.save();
        T.banner(c, this.banner, this);
        c.restore();
      }
      if (this.offer) {
        c.save();
        T.offer(c, this.offer, this);
        c.restore();
      }
      if (this.over) {
        c.save();
        T.over(c, this);
        c.restore();
      }
    }

    drawMounts() {
      const c = this.ctx;
      const T = CX.th();
      for (const w of this.owned) {
        CX.drawGun(c, w, w.x, w.y, GUN, this.t);
        c.save();
        T.pips(c, w, w.x, w.y, GUN, this);
        c.restore();
      }
      for (const p of this.pops) {
        c.save();
        T.pop(c, p, this);
        c.restore();
      }
    }
  }

  // 지금 틀(균열)의 실전 판 그림. 다른 테마는 themes/<key>.js 에서 같은 이름으로 바꾼다 (CX.defineTheme).
  CX.extendTheme('rift', {
    /** 무기 받침 (판 위에 놓인 총의 자리): (x,y) 무기 가운데, s 크기. 세계 색은 CX.wo(w.world).colors.main */
    base(c, w, x, y, s) {
      const col = (CX.wo(w.world).colors || {}).main || '#E9C46A';
      const g = c.createRadialGradient(x, y + s * 0.42, 2, x, y + s * 0.42, s * 0.62);
      g.addColorStop(0, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - s, y, s * 2, s);
      c.fillStyle = '#1A1030';
      c.beginPath();
      c.ellipse(x, y + s * 0.36, s * 0.46, s * 0.15, 0, 0, TAU);
      c.fill();
      c.strokeStyle = '#E9C46A';
      c.lineWidth = 1.3;
      c.stroke();
      c.strokeStyle = col;
      c.globalAlpha = 0.8;
      c.beginPath();
      c.ellipse(x, y + s * 0.36, s * 0.34, s * 0.1, 0, 0, TAU);
      c.stroke();
      if (w.sub) {
        c.strokeStyle = (CX.wo(w.subWorld).colors || {}).main || '#E9C46A';
        c.beginPath();
        c.ellipse(x, y + s * 0.36, s * 0.52, s * 0.18, 0, 0.2, Math.PI - 0.2);
        c.stroke();
      }
    },
    /** 무기 레벨 (1~5) 표시: 받침 아래 */
    pips(c, w, x, y, s) {
      for (let i = 0; i < 5; i++) {
        c.fillStyle = i < w.lv ? '#E9C46A' : 'rgba(233,196,106,0.22)';
        c.beginPath();
        const px = x - 12 + i * 6;
        const py = y + s * 0.62;
        c.moveTo(px, py - 2.2);
        c.lineTo(px + 2.2, py);
        c.lineTo(px, py + 2.2);
        c.lineTo(px - 2.2, py);
        c.closePath();
        c.fill();
      }
    },
    /** 무기 위에 잠깐 뜨는 글 (NEW, Lv 3 → 4): p = { w, text, age(0~1.6) } */
    pop(c, p) {
      const k = p.age / 1.6;
      c.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      c.font = '800 12px "Noto Sans KR", sans-serif';
      c.textAlign = 'center';
      const ty = p.w.y - GUN * 0.75 - ease(Math.min(1, p.age / 0.3)) * 14;
      const tw = c.measureText(p.text).width + 14;
      c.fillStyle = 'rgba(12,6,26,0.9)';
      roundRect(c, p.w.x - tw / 2, ty - 11, tw, 17, 6);
      c.fill();
      c.strokeStyle = '#E9C46A';
      c.lineWidth = 1;
      c.stroke();
      c.fillStyle = '#FFE7A3';
      c.fillText(p.text, p.w.x, ty + 2);
    },
    /** 목숨을 잃은 순간 (k 1 → 0) */
    hurt(c, run, k) {
      const g = c.createRadialGradient(W / 2, 270, 120, W / 2, 270, 360);
      g.addColorStop(0, 'rgba(255,40,80,0)');
      g.addColorStop(1, `rgba(255,40,80,${0.45 * k})`);
      c.fillStyle = g;
      c.fillRect(0, 0, W, 540);
    },
    hud(c, run) {
      const g = c.createLinearGradient(0, 0, 0, run.oy);
      g.addColorStop(0, '#120926');
      g.addColorStop(1, '#0B0816');
      c.fillStyle = g;
      c.fillRect(0, 0, W, run.oy);
      c.strokeStyle = 'rgba(233,196,106,0.55)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, run.oy - 0.5);
      c.lineTo(W, run.oy - 0.5);
      c.stroke();
      // 목숨
      for (let i = 0; i < 5; i++) heart(c, 20 + i * 21, 21, 8.5, i < run.hearts);
      // LV
      c.textBaseline = 'alphabetic';
      c.textAlign = 'center';
      c.fillStyle = '#CDBEF2';
      c.font = '700 10px "Noto Sans KR", sans-serif';
      c.fillText('LV', W / 2 - 16, 27);
      c.fillStyle = '#FFFFFF';
      c.font = '900 22px "Cinzel", serif';
      c.fillText(String(run.level), W / 2 + 8, 29);
      // 웨이브
      c.textAlign = 'right';
      c.fillStyle = '#CDBEF2';
      c.font = '700 10px "Noto Sans KR", sans-serif';
      c.fillText('WAVE', W - 46, 27);
      c.fillStyle = '#FFFFFF';
      c.font = '900 22px "Cinzel", serif';
      c.fillText(String(run.wave), W - 14, 29);
      // 경험치
      const k = clamp(run.exp / run.need, 0, 1);
      c.fillStyle = 'rgba(233,196,106,0.16)';
      roundRect(c, 14, 44, W - 28, 7, 3.5);
      c.fill();
      const eg = c.createLinearGradient(14, 0, W - 14, 0);
      eg.addColorStop(0, '#B8913A');
      eg.addColorStop(1, '#FFE7A3');
      c.fillStyle = eg;
      roundRect(c, 14, 44, Math.max(7, (W - 28) * k), 7, 3.5);
      c.fill();
    },
    chips(c, run) {
      const m = run.worlds();
      let y = 44;
      for (const k of ORDER) {
        if (!m[k]) continue;
        const wo = CX.wo(k);
        c.fillStyle = 'rgba(12,6,26,0.82)';
        roundRect(c, 6, y, 40, 19, 6);
        c.fill();
        c.strokeStyle = (wo.colors && wo.colors.main) || '#E9C46A';
        c.lineWidth = 1;
        c.stroke();
        c.save();
        wo.crest(c, 9, y + 3, 6.5);
        c.restore();
        c.fillStyle = '#FFFFFF';
        c.font = '900 11px "Cinzel", serif';
        c.textAlign = 'right';
        c.textBaseline = 'middle';
        c.fillText(String(m[k]), 41, y + 10);
        y += 23;
      }
    },
    gate(c, run) {
      const n = run.cats().size;
      const next = CAT_TH.find((t) => t > n) || 15;
      const slots = run.fuseSlots();
      const text = `갈래 ${n}/${next} · 합성 칸 ${slots}`;
      c.font = '700 10.5px "Noto Sans KR", sans-serif';
      const tw = c.measureText(text).width + 16;
      c.fillStyle = 'rgba(12,6,26,0.82)';
      roundRect(c, W - tw - 8, 40, tw, 20, 7);
      c.fill();
      c.strokeStyle = slots > 0 ? '#E9C46A' : 'rgba(233,196,106,0.4)';
      c.lineWidth = 1;
      c.stroke();
      c.fillStyle = slots > 0 ? '#FFE7A3' : '#CDBEF2';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(text, W - tw, 50);
    },
    banner(c, b, run) {
      const k = b.age / b.life;
      const a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
      c.save();
      c.globalAlpha = Math.max(0, a);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      if (b.wave) {
        c.font = '900 30px "Cinzel", "Orbit", serif';
        c.shadowColor = 'rgba(255,63,164,0.8)';
        c.shadowBlur = 16;
        c.fillStyle = '#FFFFFF';
        c.fillText(b.text, W / 2, 140);
      } else {
        const y = 150;
        c.fillStyle = 'rgba(12,6,26,0.86)';
        roundRect(c, 26, y - 30, W - 52, 58, 10);
        c.fill();
        c.strokeStyle = '#E9C46A';
        c.lineWidth = 1.5;
        c.stroke();
        c.fillStyle = '#FFE7A3';
        c.font = '900 19px "Noto Sans KR", sans-serif';
        c.fillText(b.text, W / 2, y - 7, W - 70);
        c.fillStyle = '#CDBEF2';
        c.font = '500 11px "Noto Sans KR", sans-serif';
        c.fillText(b.sub, W / 2, y + 15, W - 70);
      }
      c.restore();
    },
    offer(c, o, run) {
      const t = o.age;
      c.save();
      c.fillStyle = `rgba(7,4,16,${0.78 * Math.min(1, t / 0.2)})`;
      c.fillRect(0, -run.oy, W, run.ch);
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.fillStyle = '#E9C46A';
      c.font = '400 26px "Orbit", "Noto Sans KR", sans-serif';
      c.fillText('레벨 업', W / 2, 104);
      c.fillStyle = '#CDBEF2';
      c.font = '700 11px "Cinzel", serif';
      c.fillText(`LV ${o.from} → ${o.from + 1}`, W / 2, 124);
      o.cards.forEach((cd, i) => {
        const y = 140 + i * 112;
        const enter = ease(clamp((t - i * 0.08) / 0.3, 0, 1));
        const picked = o.pick === i;
        const faded = o.pick >= 0 && !picked;
        c.save();
        c.globalAlpha = enter * (faded ? 0.35 : 1);
        c.translate((1 - enter) * 60, 0);
        if (picked) {
          const s = 1 + 0.03 * Math.sin(Math.min(1, (t - o.pickAt) / 0.2) * Math.PI);
          c.translate(W / 2, y + 50);
          c.scale(s, s);
          c.translate(-W / 2, -(y + 50));
        }
        CX.th().card(c, cd, 18, y, W - 36, 100, picked, run);
        c.restore();
      });
      if (!run.auto && o.pick < 0) {
        c.fillStyle = '#CDBEF2';
        c.font = '500 11px "Noto Sans KR", sans-serif';
        c.textAlign = 'center';
        c.fillText('카드를 눌러 고른다', W / 2, 140 + 3 * 112 + 4);
      }
      c.restore();
    },
    card(c, cd, x, y, w, h, picked, run) {
      const g = c.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, '#22163E');
      g.addColorStop(1, '#140C26');
      c.fillStyle = g;
      roundRect(c, x, y, w, h, 12);
      c.fill();
      c.strokeStyle = picked ? '#FFE7A3' : cd.kind === 'fuse' ? '#E9C46A' : 'rgba(233,196,106,0.55)';
      c.lineWidth = picked ? 2.4 : cd.kind === 'fuse' ? 1.8 : 1.1;
      c.stroke();
      if (picked) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.shadowColor = 'rgba(233,196,106,0.9)';
        c.shadowBlur = 18;
        c.stroke();
        c.restore();
      }
      // 그림: 유물함 (합성이면 사선 두 세계)
      const v = cd.view;
      c.save();
      CX.drawGun(c, v, x + 50, y + h / 2 + 10, 50, run.t);
      c.restore();
      const tx = x + 96;
      const tw = w - 106;
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      const wn = (k) => CX.wo(k).name;
      let tag;
      let name;
      let l1;
      let l2 = '';
      if (cd.kind === 'fuse') {
        tag = `합성 · 칸 ${run.fuseSlots()} 중 1 · 등급 ${Math.min(cd.a.lv, cd.b.lv)}`;
        name = v.name;
        l1 = `몸 ${cd.a.name} (${CX.wo(cd.a.world).short}) + 연출 ${cd.b.name} (${CX.wo(cd.b.world).short})`;
        l2 = `반응: ${v.react}`;
      } else if (cd.kind === 'new') {
        const own = run.worlds();
        tag = `새 무기 · ${wn(v.world)} · ${v.catLabel}${own[v.world] ? '' : ' · 새 세계'}`;
        name = v.name;
        const left = (CAT_TH.find((tt) => tt > run.cats().size) || 15) - run.cats().size - 1;
        l1 = run.cats().has(v.cat) ? `${v.catLabel} 갈래 하나 더` : left <= 0 ? '새 갈래 · 이걸로 합성 칸이 열린다' : `새 갈래 · 합성 칸까지 갈래 ${left}`;
      } else {
        tag = `강화 · ${wn(v.world)} · ${v.catLabel}`;
        name = `${v.name}  Lv ${v.lv} → ${v.lv + 1}`;
        l1 = '피해 +28% · 쿨다운 −6%';
      }
      c.fillStyle = cd.kind === 'fuse' ? '#E9C46A' : '#CDBEF2';
      c.font = '700 10.5px "Noto Sans KR", sans-serif';
      c.fillText(tag, tx, y + 24, tw);
      c.fillStyle = '#FFFFFF';
      c.font = '900 18px "Noto Sans KR", sans-serif';
      c.fillText(name, tx, y + 49, tw);
      c.fillStyle = '#CDBEF2';
      c.font = '500 11px "Noto Sans KR", sans-serif';
      c.fillText(l1, tx, y + 70, tw);
      if (l2) {
        c.fillStyle = '#FFE7A3';
        c.font = '700 11px "Noto Sans KR", sans-serif';
        c.fillText(l2, tx, y + 87, tw);
      }
    },
    over(c, run) {
      const a = Math.min(1, run.over / 0.4);
      c.save();
      c.fillStyle = `rgba(7,4,16,${0.8 * a})`;
      c.fillRect(0, -run.oy, W, run.ch);
      c.globalAlpha = a;
      c.textAlign = 'center';
      c.fillStyle = '#FF7A9C';
      c.font = '400 28px "Orbit", "Noto Sans KR", sans-serif';
      c.fillText('봉인선 붕괴', W / 2, 220);
      c.fillStyle = '#FFFFFF';
      c.font = '700 14px "Noto Sans KR", sans-serif';
      c.fillText(`웨이브 ${run.wave} · LV ${run.level} · 연쇄 최고 ${run.chainPeak} · 합성 ${run.fusedN}`, W / 2, 252);
      c.fillStyle = '#CDBEF2';
      c.font = '500 12px "Noto Sans KR", sans-serif';
      c.fillText('잠시 뒤 새 판', W / 2, 278);
      c.restore();
    },
  });

  function heart(c, x, y, r, full) {
    c.save();
    c.translate(x, y);
    c.beginPath();
    c.moveTo(0, r * 0.9);
    c.bezierCurveTo(-r * 1.3, -r * 0.1, -r * 0.7, -r * 1.1, 0, -r * 0.45);
    c.bezierCurveTo(r * 0.7, -r * 1.1, r * 1.3, -r * 0.1, 0, r * 0.9);
    c.closePath();
    if (full) {
      const g = c.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, '#FF8FC6');
      g.addColorStop(1, '#FF3FA4');
      c.fillStyle = g;
      c.fill();
    } else {
      c.strokeStyle = 'rgba(255,63,164,0.55)';
      c.lineWidth = 1.4;
      c.stroke();
    }
    c.restore();
  }

  CX.Run = Run;
  CX.util.heart = heart;
  /** 테마가 쓰는 실전 판 치수 · 규칙 (themes/*.js) */
  CX.runInfo = { W, CH, HUD: HUD_H, FIELD_H: 540, GUN, CAT_TH, ORDER, card: (i) => ({ x: 18, y: 140 + i * 112, w: W - 36, h: 100 }) };

  // ── 쪽 ──
  function boot() {
    const cv = document.getElementById('run');
    const s = new Run(cv, {});
    CX.mount(cv, null, s);
    s.visible = true;
    window.__run = s;
    cv.addEventListener('click', (ev) => {
      const r = cv.getBoundingClientRect();
      s.click(((ev.clientX - r.left) / r.width) * W, ((ev.clientY - r.top) / r.height) * CH);
    });
    const sp = document.getElementById('speed');
    sp.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      CX.speed = Number(b.dataset.s);
      for (const x of sp.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    });
    const au = document.getElementById('auto');
    au.addEventListener('click', () => {
      s.auto = !s.auto;
      au.setAttribute('aria-pressed', String(s.auto));
      au.textContent = s.auto ? '자동 고르기 켬' : '자동 고르기 끔 (카드를 눌러 고름)';
    });
    document.getElementById('again').addEventListener('click', () => s.reset());
    // 테마 고르기: 같은 판을 그대로 두고 틀만 바꾼다
    const box = document.getElementById('themes');
    const keys = ['rift', ...Object.keys(CX.themes).filter((k) => k !== 'rift')];
    const note = document.getElementById('themeNote');
    const pick = (k) => {
      if (!CX.themes[k]) k = 'rift';
      CX.themeKey = k;
      for (const b of box.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.k === k));
      const th = CX.themes[k];
      note.textContent = th.desc || '';
      try {
        history.replaceState(null, '', '#theme-' + k);
      } catch (e) {
        location.hash = 'theme-' + k;
      }
    };
    for (const k of keys) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.k = k;
      b.textContent = CX.themes[k].name || k;
      b.addEventListener('click', () => pick(k));
      box.appendChild(b);
    }
    pick((/#theme-([a-z]+)/.exec(location.hash) || [])[1] || keys[1] || 'rift');
    window.addEventListener('hashchange', () => {
      const k = (/#theme-([a-z]+)/.exec(location.hash) || [])[1];
      if (k && k !== CX.themeKey) pick(k);
    });
    CX.start();
  }
  void LINE_Y;
  // 테마 파일(run.js 뒤에 오는 <script>)까지 다 읽힌 뒤, 세계·테마 글꼴을 불러오고 시작
  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    boot();
  };
  const ready = new Promise((r) => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', r) : r()));
  ready.then(() => {
    const fams = new Set(['Noto Sans KR', 'Cinzel', 'Orbit']);
    for (const k of Object.keys(CX.worlds)) for (const f of CX.worlds[k].fonts || []) fams.add(f);
    for (const k of Object.keys(CX.themes)) for (const f of CX.themes[k].fonts || []) fams.add(f);
    const loads = [...fams].map((f) => (document.fonts && document.fonts.load ? document.fonts.load(`700 20px "${f}"`).catch(() => null) : null));
    Promise.all(loads).then(go);
  });
  setTimeout(() => ready.then(go), 2500);
})();
