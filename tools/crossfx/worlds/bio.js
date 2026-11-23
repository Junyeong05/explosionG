// 미시 생체 (bio): 현미경 속 생물·독. 반투명 세포막 몸 · 점액 자취 · 세포가 터지면 지시선 표지.
// 무기: 모기 떼(떼) · 독늪(장판) · 산성비(공중). 보조일 때: 점액 자취 + 작은 세포, 반응 = 번지는 떼 / 번지는 장판 / 융단 폭격.
(function () {
  const { TAU, rnd, clamp, ease, lerp } = CX.util;
  const { W, LINE_Y } = CX.size;
  const CYAN = '#5CF2E6';
  const CORAL = '#FF6F61';
  const LIME = '#C6FF4D';
  const TEAL = '#0E3B3F';
  const DEEP = '#04161A';
  const PALE = '#9FF7EF';
  const CREAM = '#E9FFB8';
  const SG = '"Space Grotesk", "Noto Sans KR", sans-serif';
  const KR = '"Noto Sans KR", sans-serif';
  const spr = CX.util.sprite;

  // 판마다 표지 간격 (같은 순간에 표지가 쌓이지 않게)
  const memo = new WeakMap();
  const st = (api) => {
    let s = memo.get(api);
    if (!s) memo.set(api, (s = { tag: -9, subTag: -9 }));
    return s;
  };
  const angLerp = (a, b, k) => {
    let d = b - a;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return a + d * clamp(k, 0, 1);
  };

  // ── 미리 그려 두는 그림 ──────────────────────────────────────
  // 세포 터짐 빛 (흰 → 산호)
  const burstSpr = () =>
    spr('bio-burst', 32, 32, (g) => {
      const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      rg.addColorStop(0, 'rgba(255,255,255,1)');
      rg.addColorStop(0.3, 'rgba(255,180,169,0.85)');
      rg.addColorStop(1, 'rgba(255,111,97,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, 32, 32);
    });
  // 라임 독 빛
  const limeGlow = () =>
    spr('bio-lglow', 32, 32, (g) => {
      const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      rg.addColorStop(0, 'rgba(233,255,184,0.9)');
      rg.addColorStop(0.35, 'rgba(198,255,77,0.45)');
      rg.addColorStop(1, 'rgba(198,255,77,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, 32, 32);
    });
  // 산성 구름: 세포 군체 (막 원 여럿이 붙은 덩어리)
  const CLOUD = [
    [17, 25, 10],
    [28, 17, 11],
    [42, 14, 12.5],
    [56, 19, 11],
    [64, 26, 7.5],
    [40, 26, 11],
    [25, 28, 8],
    [53, 28, 8.5],
  ];
  const cloudSpr = () =>
    spr('bio-cloud', 80, 44, (g) => {
      // 바깥 막 (굵게 그은 뒤 안을 칠하면 바깥 테만 남는다)
      g.strokeStyle = 'rgba(92,242,230,0.25)';
      g.lineWidth = 5;
      for (const [x, y, r] of CLOUD) (g.beginPath(), g.arc(x, y, r, 0, TAU), g.stroke());
      g.strokeStyle = CYAN;
      g.lineWidth = 2.4;
      for (const [x, y, r] of CLOUD) (g.beginPath(), g.arc(x, y, r, 0, TAU), g.stroke());
      g.fillStyle = '#0A2A2D';
      for (const [x, y, r] of CLOUD) (g.beginPath(), g.arc(x, y, r, 0, TAU), g.fill());
      // 세포 사이 막 (안쪽 옅은 선)
      g.strokeStyle = 'rgba(92,242,230,0.28)';
      g.lineWidth = 0.6;
      for (const [x, y, r] of CLOUD) (g.beginPath(), g.arc(x, y, r * 0.78, 0, TAU), g.stroke());
      // 소기관
      g.fillStyle = 'rgba(92,242,230,0.55)';
      for (const [x, y, r] of [
        [24, 22, 1.5],
        [36, 15, 1.9],
        [50, 19, 1.3],
        [58, 25, 1.1],
        [31, 28, 1],
      ])
        (g.beginPath(), g.arc(x, y, r, 0, TAU), g.fill());
      g.fillStyle = LIME;
      g.beginPath();
      g.arc(44, 20, 2.3, 0, TAU);
      g.fill();
      g.fillStyle = CORAL;
      g.beginPath();
      g.arc(20, 26, 1, 0, TAU);
      g.fill();
      // 밑에 맺힌 산 방울
      g.fillStyle = LIME;
      for (const [x, y] of [
        [22, 36],
        [40, 37.5],
        [55, 36],
      ]) {
        dropPath(g, x, y, 0.75);
        g.fill();
      }
    });

  /** 물방울 길 (끝이 위, 가운데 x,y, 크기 s) */
  function dropPath(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y - 4.2 * s);
    c.bezierCurveTo(x + 2.3 * s, y - 1 * s, x + 2.6 * s, y + 0.6 * s, x + 2.6 * s, y + 1.4 * s);
    c.arc(x, y + 1.4 * s, 2.6 * s, 0, Math.PI);
    c.bezierCurveTo(x - 2.6 * s, y + 0.6 * s, x - 2.3 * s, y - 1 * s, x, y - 4.2 * s);
    c.closePath();
  }

  /** 모기 (위에서 본 몸, 머리 +x). wing 0..1 날갯짓 */
  function fly(c, x, y, dir, sc, wing, alpha) {
    c.save();
    c.translate(x, y);
    c.rotate(dir);
    c.scale(sc, sc);
    c.globalAlpha = alpha;
    const lw = 1 / sc;
    // 다리 (긴 여섯)
    c.strokeStyle = 'rgba(159,247,239,0.38)';
    c.lineWidth = 0.65 * lw;
    c.beginPath();
    for (const s of [-1, 1]) {
      c.moveTo(1.4, -0.7 * s);
      c.lineTo(3.6, -4 * s);
      c.lineTo(5.4, -4.6 * s);
      c.moveTo(0.6, -0.9 * s);
      c.lineTo(-0.8, -4.6 * s);
      c.lineTo(-1.8, -6.2 * s);
      c.moveTo(-0.2, -0.8 * s);
      c.lineTo(-3.4, -3.6 * s);
      c.lineTo(-6.4, -4.2 * s);
    }
    c.stroke();
    // 날개 (막, 깜빡)
    const sq = 0.45 + 0.55 * wing;
    c.fillStyle = `rgba(159,247,239,${0.1 + 0.16 * wing})`;
    c.strokeStyle = `rgba(210,255,250,${0.45 + 0.4 * wing})`;
    c.lineWidth = 0.6 * lw;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.ellipse(-2.4, s * 3.1 * sq, 4.8, 1.55, s * (0.32 + 0.3 * (1 - wing)), 0, TAU);
      c.fill();
      c.stroke();
    }
    // 배 (반투명 세포)
    c.beginPath();
    c.ellipse(-3.5, 0, 4.6, 1.9, 0, 0, TAU);
    c.fillStyle = 'rgba(92,242,230,0.22)';
    c.fill();
    c.strokeStyle = CYAN;
    c.lineWidth = 0.95 * lw;
    c.stroke();
    c.strokeStyle = 'rgba(92,242,230,0.5)';
    c.lineWidth = 0.5 * lw;
    c.beginPath();
    c.moveTo(-5.2, -1.5);
    c.quadraticCurveTo(-4.7, 0, -5.2, 1.5);
    c.moveTo(-2.9, -1.8);
    c.quadraticCurveTo(-2.4, 0, -2.9, 1.8);
    c.stroke();
    c.fillStyle = LIME;
    c.beginPath();
    c.arc(-3.9, 0.2, 0.8, 0, TAU);
    c.fill();
    // 가슴 · 머리
    c.fillStyle = 'rgba(14,59,63,0.9)';
    c.strokeStyle = CYAN;
    c.lineWidth = 0.95 * lw;
    c.beginPath();
    c.arc(0.9, 0, 1.75, 0, TAU);
    c.fill();
    c.stroke();
    c.beginPath();
    c.arc(3.1, 0, 1.1, 0, TAU);
    c.fill();
    c.stroke();
    // 침
    c.strokeStyle = CORAL;
    c.lineWidth = 1.05 * lw;
    c.beginPath();
    c.moveTo(4.1, 0);
    c.lineTo(8.8, 0);
    c.stroke();
    c.restore();
  }

  // ── 맞는 무늬: 세포 터짐 + 지시선 표지 ────────────────────────
  function lysis(api, x, y, R, sub, soft) {
    const nf = sub ? 4 : 5;
    const a0 = rnd(0, TAU);
    const dr = [];
    const nd = sub ? 3 : soft ? 3 : 6;
    for (let i = 0; i < nd; i++) dr.push({ a: rnd(0, TAU), v: rnd(0.8, 2), r: rnd(0.8, 1.7), c: i % 3 === 0 ? CORAL : i % 3 === 1 ? LIME : CYAN });
    const life = sub ? 0.34 : 0.48;
    CX.mark(api, x, y, life, (c, k) => {
      const rp = Math.max(0, (k - 0.2) / 0.8);
      // 빛
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = (1 - rp) * (sub ? 0.45 : soft ? 0.5 : 0.85);
      const fr = R * (1.1 + rp * 1.4);
      c.drawImage(burstSpr(), x - fr, y - fr, fr * 2, fr * 2);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      if (rp === 0) {
        // 부푸는 막
        const rr = R * (0.55 + 0.45 * (k / 0.2));
        c.beginPath();
        c.arc(x, y, rr, 0, TAU);
        c.fillStyle = 'rgba(92,242,230,0.18)';
        c.fill();
        c.strokeStyle = sub ? CYAN : '#FF8A7E';
        c.lineWidth = 1.6;
        c.stroke();
        c.fillStyle = LIME;
        c.beginPath();
        c.arc(x + rr * 0.25, y - rr * 0.2, rr * 0.28, 0, TAU);
        c.fill();
        return;
      }
      // 찢어지는 막 조각
      const er = ease(rp);
      const rr = R * (1 + er * 1.3);
      c.lineCap = 'round';
      c.strokeStyle = sub ? `rgba(92,242,230,${1 - rp})` : `rgba(255,138,126,${1 - rp})`;
      c.lineWidth = (sub ? 1.3 : 2.2) * (1 - rp * 0.6);
      for (let i = 0; i < nf; i++) {
        const aa = a0 + (i / nf) * TAU;
        c.beginPath();
        c.arc(x, y, rr, aa, aa + (TAU / nf) * (0.55 - rp * 0.25));
        c.stroke();
      }
      if (!sub && !soft) {
        c.setLineDash([2, 4]);
        c.strokeStyle = `rgba(92,242,230,${0.7 * (1 - rp)})`;
        c.lineWidth = 1;
        c.beginPath();
        c.arc(x, y, rr * 1.35, 0, TAU);
        c.stroke();
        c.setLineDash([]);
      }
      // 세포질 방울
      c.globalAlpha = 1 - rp;
      for (const d of dr) {
        const dd = R * (0.6 + d.v * er * 1.6);
        c.fillStyle = d.c;
        c.beginPath();
        c.arc(x + Math.cos(d.a) * dd, y + Math.sin(d.a) * dd, d.r, 0, TAU);
        c.fill();
      }
      // 녹는 거품 (독늪)
      if (soft) {
        c.strokeStyle = CREAM;
        c.lineWidth = 0.8;
        for (let j = 0; j < 3; j++) {
          c.beginPath();
          c.arc(x + (j - 1) * 5, y - 4 - er * (8 + j * 5), 1 + er * 1.5, 0, TAU);
          c.stroke();
        }
      }
      c.globalAlpha = 1;
    });
  }

  // 지시선 + 표지 상자 ("용해 LYSIS")
  function tag(api, x, y, text, sub) {
    const dir = x > W - 96 ? -1 : 1;
    const L = sub ? 9 : 13;
    CX.mark(
      api,
      x,
      y,
      sub ? 0.62 : 0.85,
      (c, k) => {
        const fade = k > 0.72 ? 1 - (k - 0.72) / 0.28 : 1;
        const p = Math.min(1, k / 0.2);
        const x0 = x + dir * 6;
        const y0 = y - 6;
        const x1 = x0 + dir * L;
        const y1 = y0 - L;
        const x2 = x1 + dir * 7;
        c.globalAlpha = fade;
        c.strokeStyle = LIME;
        c.lineWidth = 0.9;
        c.beginPath();
        c.moveTo(x0, y0);
        if (p < 0.7) c.lineTo(lerp(x0, x1, p / 0.7), lerp(y0, y1, p / 0.7));
        else {
          c.lineTo(x1, y1);
          c.lineTo(lerp(x1, x2, (p - 0.7) / 0.3), y1);
        }
        c.stroke();
        c.fillStyle = LIME;
        c.beginPath();
        c.arc(x0, y0, sub ? 1.3 : 1.7, 0, TAU);
        c.fill();
        if (p < 1) return;
        c.font = `700 ${sub ? 7.5 : 8.5}px ${SG}`;
        const tw = c.measureText(text).width;
        const bw = tw + 9;
        const bh = sub ? 11 : 13;
        const open = clamp((k - 0.2) / 0.1, 0, 1);
        const ow = bw * open;
        const bx = dir > 0 ? x2 : x2 - ow;
        const by = y1 - bh / 2;
        c.fillStyle = 'rgba(4,22,26,0.92)';
        c.fillRect(bx, by, ow, bh);
        c.strokeStyle = LIME;
        c.lineWidth = 0.8;
        c.strokeRect(bx + 0.4, by + 0.4, ow - 0.8, bh - 0.8);
        if (open < 1) return;
        c.fillStyle = LIME;
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText(text, bx + 4.5, by + bh / 2 + 0.5);
      },
      1,
    );
  }

  // ── 모기 떼 ──────────────────────────────────────────────────
  function swarm(api, w, tg, o) {
    o = o || {};
    const N = o.n || 6;
    const sx = w.x;
    const sy = w.y - 22;
    const flies = [];
    for (let i = 0; i < N; i++)
      flies.push({
        x: sx + rnd(-6, 6),
        y: sy + rnd(-3, 3),
        vx: 0,
        vy: -80,
        dir: -Math.PI / 2,
        orb: (i / N) * TAU,
        // 무리 안 자리 (앞뒤 al · 옆 ac): 성긴 쐐기꼴 + 흔들림
        al: [8, -5, -7, -18, -20, -30][i % 6] + rnd(-3, 3),
        ac: [0, -14, 14, -26, 25, 2][i % 6] + rnd(-3, 3),
        spin: rnd(1.3, 2.2) * (i % 2 ? 1 : -1),
        ph: rnd(0, TAU),
        s: i === 0 ? 1.85 : rnd(1.45, 1.7),
        dart: 0,
        delay: i * 0.05,
      });
    let pick = 0;
    const fx = {
      x: sx,
      y: sy,
      vx: rnd(-40, 40),
      vy: -160,
      z: 1,
      tgt: tg,
      left: o.targets || 3,
      mode: 0, // 0 날아감 · 1 무는 중 · 2 흩어짐
      bites: 0,
      bt: 0,
      lt: 0,
      alpha: 1,
      next(a) {
        this.left--;
        this.tgt = this.left > 0 ? a.target('near', this.x, this.y) : null;
        this.mode = this.tgt ? 0 : 2;
      },
      update(dt, a) {
        if (!(dt > 0)) return true;
        if (this.mode < 2 && (!this.tgt || !this.tgt.alive)) {
          if (this.mode === 1) this.next(a);
          else {
            this.tgt = a.target('near', this.x, this.y);
            if (!this.tgt) this.mode = 2;
          }
        }
        const t = this.tgt;
        if (this.mode === 0 && t) {
          const dx = t.x - this.x;
          const dy = t.y - this.y;
          const d = Math.hypot(dx, dy) || 1;
          const sp = 205;
          const weave = Math.sin(this.age * 6.5) * 70;
          const dvx = (dx / d) * sp - (dy / d) * weave;
          const dvy = (dy / d) * sp + (dx / d) * weave;
          const k = Math.min(1, dt * 5);
          this.vx += (dvx - this.vx) * k;
          this.vy += (dvy - this.vy) * k;
          this.x += this.vx * dt;
          this.y += this.vy * dt;
          if (d < t.r + 12) {
            this.mode = 1;
            this.bites = o.bites || 3;
            this.bt = 0.05;
          }
        } else if (this.mode === 1 && t) {
          this.vx = (t.x - this.x) * 8;
          this.vy = (t.y - this.y) * 8;
          this.x += this.vx * dt;
          this.y += this.vy * dt;
          this.bt -= dt;
          if (this.bt <= 0) {
            this.bt = 0.15;
            const f = flies[pick++ % N];
            f.dart = 0.2;
            const ang = Math.atan2(f.y - t.y, f.x - t.x);
            a.hit(w, t, o.dmg || 2, t.x + Math.cos(ang) * t.r * 0.7, t.y + Math.sin(ang) * t.r * 0.7);
            this.bites--;
            if (this.bites <= 0) this.next(a);
          }
        } else {
          this.mode = 2;
          this.lt += dt;
          this.vy -= 240 * dt;
          this.x += this.vx * 0.3 * dt;
          this.y += this.vy * dt;
          this.alpha = Math.max(0, 1 - this.lt / 0.55);
          if (this.lt > 0.55) return false;
        }
        // 한 마리씩: 날 때는 흩어진 무리 꼴로 떨며 따라오고, 물 때는 적 둘레를 돈다 (떼 맛)
        const tt = this.tgt;
        const hd = Math.atan2(this.vy, this.vx);
        const ca = Math.cos(hd);
        const sa = Math.sin(hd);
        for (const f of flies) {
          if (this.age < f.delay) continue;
          f.orb += f.spin * dt;
          let hx;
          let hy;
          if (this.mode === 1 && tt) {
            const rad = tt.r + 12 + Math.sin(this.age * 7 + f.ph) * 3;
            hx = this.x + Math.cos(f.orb) * rad;
            hy = this.y + Math.sin(f.orb) * rad * 0.8;
          } else {
            const al = f.al + Math.sin(this.age * 5.3 + f.ph) * 4;
            const ac = f.ac + Math.sin(this.age * 7.1 + f.ph * 1.7) * 4.5;
            hx = this.x + ca * al - sa * ac;
            hy = this.y + sa * al + ca * ac;
          }
          let k = Math.min(1, dt * 9);
          if (f.dart > 0 && tt) {
            f.dart -= dt;
            const q = Math.sin(Math.PI * clamp(1 - f.dart / 0.2, 0, 1));
            hx = lerp(hx, tt.x, q * 0.7);
            hy = lerp(hy, tt.y, q * 0.7);
            k = Math.min(1, dt * 20);
          }
          const nx = f.x + (hx - f.x) * k;
          const ny = f.y + (hy - f.y) * k;
          f.vx += ((nx - f.x) / dt - f.vx) * Math.min(1, dt * 10);
          f.vy += ((ny - f.y) / dt - f.vy) * Math.min(1, dt * 10);
          f.x = nx;
          f.y = ny;
          if (f.dart > 0 && tt) f.dir = Math.atan2(tt.y - f.y, tt.x - f.x);
          else if (this.mode === 1 && tt) f.dir = angLerp(f.dir, Math.atan2(tt.y - f.y, tt.x - f.x), dt * 8);
          else if (f.vx * f.vx + f.vy * f.vy > 500) f.dir = angLerp(f.dir, Math.atan2(f.vy, f.vx), dt * 9);
        }
        return this.age < 7;
      },
      draw(c, a) {
        // 비행 자취 (표본 추적선)
        const h = this.hist;
        if (h.length > 6 && this.mode === 0) {
          c.setLineDash([2, 3]);
          c.strokeStyle = 'rgba(92,242,230,0.35)';
          c.lineWidth = 0.9;
          c.beginPath();
          c.moveTo(h[0], h[1]);
          for (let i = 2; i < h.length; i += 2) c.lineTo(h[i], h[i + 1]);
          c.stroke();
          c.setLineDash([]);
        }
        for (const f of flies) {
          if (this.age < f.delay) continue;
          const wing = Math.abs(Math.sin(a.t * 46 + f.ph));
          fly(c, f.x, f.y, f.dir, f.s, wing, this.alpha * (f.dart > 0 ? 1 : 0.92));
        }
      },
    };
    return api.add(fx, w);
  }

  // ── 독늪 ────────────────────────────────────────────────────
  function poolPath(c, x, y, R, t, seed, lobe) {
    c.beginPath();
    for (let i = 0; i <= 30; i++) {
      const a = (i / 30) * TAU;
      let r = R * (1 + 0.07 * Math.sin(a * 3 + t * 2.1 + seed) + 0.045 * Math.sin(a * 5 - t * 2.7 + seed * 2));
      if (lobe) r += R * lobe * Math.max(0, Math.sin(a * 6 + seed));
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r * 0.64;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
  }
  function drawPool(c, x, y, R, t, seed, alpha, lobe) {
    // 독 빛 (바닥에 번지는 라임)
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.32 * alpha * (0.85 + Math.sin(t * 3 + seed) * 0.15);
    c.drawImage(limeGlow(), x - R * 1.25, y - R * 0.85, R * 2.5, R * 1.7);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    const g = c.createRadialGradient(x - R * 0.15, y - R * 0.18, 0, x, y, R);
    g.addColorStop(0, `rgba(233,255,184,${0.5 * alpha})`);
    g.addColorStop(0.45, `rgba(198,255,77,${0.3 * alpha})`);
    g.addColorStop(1, `rgba(98,150,24,${0.3 * alpha})`);
    poolPath(c, x, y, R, t, seed, lobe);
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = `rgba(92,242,230,${0.2 * alpha})`;
    c.lineWidth = 5;
    c.stroke();
    c.strokeStyle = `rgba(198,255,77,${0.95 * alpha})`;
    c.lineWidth = 1.5;
    c.stroke();
    // 안쪽 막 (두 겹 막)
    poolPath(c, x, y, R * 0.83, t * 1.3, seed + 1, lobe * 0.6);
    c.strokeStyle = `rgba(233,255,184,${0.45 * alpha})`;
    c.lineWidth = 0.7;
    c.stroke();
    // 떠다니는 핵
    for (let k = 0; k < 3; k++) {
      const a = seed + k * 2.1 + t * 0.45;
      const nx = x + Math.cos(a) * R * 0.48;
      const ny = y + Math.sin(a * 1.3) * R * 0.26;
      c.fillStyle = `rgba(255,111,97,${0.9 * alpha})`;
      c.beginPath();
      c.arc(nx, ny, 1.8, 0, TAU);
      c.fill();
      c.strokeStyle = `rgba(255,170,160,${0.45 * alpha})`;
      c.lineWidth = 0.7;
      c.beginPath();
      c.arc(nx, ny, 3.4, 0, TAU);
      c.stroke();
    }
    // 거품: 부풀다 터진다
    c.lineWidth = 0.9;
    for (let k = 0; k < 6; k++) {
      const u = t * 0.95 + k * 0.37 + seed;
      const cyc = Math.floor(u);
      const ph = u - cyc;
      const ang = cyc * 2.39 + k * 1.7;
      const rr = R * (0.15 + (((cyc * 7 + k * 3) % 5) / 5) * 0.6);
      const bx = x + Math.cos(ang) * rr;
      const by = y + Math.sin(ang) * rr * 0.6;
      if (ph < 0.8) {
        c.strokeStyle = `rgba(233,255,184,${0.85 * alpha})`;
        c.beginPath();
        c.arc(bx, by - ph * 3, 0.6 + ph * 3, 0, TAU);
        c.stroke();
      } else {
        const q = (ph - 0.8) / 0.2;
        c.strokeStyle = `rgba(233,255,184,${(1 - q) * 0.7 * alpha})`;
        c.beginPath();
        c.arc(bx, by - 2.4, 3.2 + q * 5, 0, TAU);
        c.stroke();
      }
    }
    // 피어오르는 독 기운
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.55 + k / 3 + seed) % 1;
      c.fillStyle = `rgba(198,255,77,${(1 - ph) * 0.32 * alpha})`;
      c.beginPath();
      c.arc(x + (k - 1) * R * 0.38 + Math.sin(ph * 6 + k) * 4, y - R * 0.2 - ph * 24, 1.4 + ph * 2.4, 0, TAU);
      c.fill();
    }
  }

  function swamp(api, w, tg) {
    const sx = w.x;
    const sy = w.y - 22;
    const tx = clamp(tg.x, 40, W - 40);
    const ty = clamp(tg.y + tg.sp * 0.9 + 10, 70, LINE_Y - 34);
    const dur = 0.5;
    const spin = rnd(-6, 6);
    api.add(
      {
        x: sx,
        y: sy,
        vx: 0,
        vy: -1,
        z: 1,
        update(dt, a) {
          if (!(dt > 0)) return true;
          const k = Math.min(1, this.age / dur);
          const px = this.x;
          const py = this.y;
          this.x = lerp(sx, tx, k);
          this.y = lerp(sy, ty, k) - Math.sin(Math.PI * k) * 80;
          this.vx = (this.x - px) / dt;
          this.vy = (this.y - py) / dt;
          if (k >= 1) {
            pool(a, w, tx, ty);
            return false;
          }
          return true;
        },
        draw(c) {
          // 포자 세포: 날아가며 늘어난다
          const ang = Math.atan2(this.vy, this.vx);
          const sp = Math.min(1, Math.hypot(this.vx, this.vy) / 500);
          c.translate(this.x, this.y);
          c.rotate(ang);
          c.beginPath();
          c.ellipse(0, 0, 6.5 * (1 + sp * 0.35), 6.5 * (1 - sp * 0.2), 0, 0, TAU);
          c.fillStyle = 'rgba(198,255,77,0.28)';
          c.fill();
          c.strokeStyle = LIME;
          c.lineWidth = 1.4;
          c.stroke();
          c.rotate(-ang + this.age * spin);
          c.strokeStyle = 'rgba(233,255,184,0.6)';
          c.lineWidth = 0.6;
          c.beginPath();
          c.arc(0, 0, 4.4, 0.3, 4.6);
          c.stroke();
          c.fillStyle = CORAL;
          c.beginPath();
          c.arc(1.4, -1, 1.9, 0, TAU);
          c.fill();
        },
      },
      w,
    );
  }

  function pool(api, w, x, y) {
    const seed = rnd(0, 10);
    const R0 = 40;
    // 철퍽: 떨어진 자리 물결
    CX.mark(
      api,
      x,
      y,
      0.45,
      (c, k) => {
        c.strokeStyle = `rgba(198,255,77,${0.9 * (1 - k)})`;
        c.lineWidth = 2 * (1 - k) + 0.5;
        c.beginPath();
        c.ellipse(x, y, 8 + ease(k) * 46, (8 + ease(k) * 46) * 0.64, 0, 0, TAU);
        c.stroke();
      },
      -1,
    );
    CX.zone(api, w, x, y, {
      r: R0,
      dur: 2.6,
      tick: 0.45,
      dmg: 2,
      slow: 0.6,
      draw(c, z, a) {
        const k = z.age / z.dur;
        const grow = ease(Math.min(1, z.age / 0.32));
        const out = k > 0.85 ? (1 - k) / 0.15 : 1;
        drawPool(c, z.x, z.y, R0 * (0.3 + 0.7 * grow) * (0.85 + 0.15 * out), a.t, seed, out, 0);
      },
    });
  }

  // ── 산성비 ──────────────────────────────────────────────────
  function drawCloud(c, x, y, sc, alpha) {
    c.globalAlpha = alpha * 0.9;
    c.drawImage(cloudSpr(), x - 40 * sc, y - 22 * sc, 80 * sc, 44 * sc);
    c.globalAlpha = 1;
  }

  function splash(api, x, y, big) {
    const ds = [];
    for (let i = 0; i < (big ? 5 : 4); i++) ds.push({ vx: rnd(-42, 42), vy: rnd(-80, -40) });
    const s = big ? 1.4 : 1;
    CX.mark(
      api,
      x,
      y,
      0.5,
      (c, k) => {
        const e = ease(k);
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = (1 - k) * 0.55;
        const gr = 7 * s + e * 6;
        c.drawImage(limeGlow(), x - gr, y - gr * 0.6, gr * 2, gr * 1.2);
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = 1;
        c.strokeStyle = `rgba(198,255,77,${0.85 * (1 - k)})`;
        c.lineWidth = 1.2;
        c.beginPath();
        c.ellipse(x, y, (3 + e * 11) * s, (3 + e * 11) * s * 0.38, 0, 0, TAU);
        c.stroke();
        c.fillStyle = `rgba(198,255,77,${1 - k})`;
        const tt = k * 0.5;
        for (const d of ds) {
          c.beginPath();
          c.arc(x + d.vx * tt * s, y + d.vy * tt * s + 320 * tt * tt, 1.1, 0, TAU);
          c.fill();
        }
        c.strokeStyle = `rgba(233,255,184,${0.85 * (1 - k)})`;
        c.lineWidth = 0.8;
        for (let j = 0; j < 3; j++) {
          c.beginPath();
          c.arc(x + (j - 1) * 4.5 + Math.sin(k * 9 + j) * 1.5, y - 2 - k * (8 + j * 5), 0.8 + k * 1.6, 0, TAU);
          c.stroke();
        }
      },
      1,
    );
  }

  /** 산 방울 하나 (o: {dmg, r, react, burn:Set, big, noW}) */
  function drop(api, w, x, y0, ty, o) {
    o = o || {};
    return api.add(
      {
        x,
        y: y0,
        vx: 0,
        vy: 70,
        z: 1,
        update(dt, a) {
          if (!(dt > 0)) return true;
          this.vy += 1150 * dt;
          this.y += this.vy * dt;
          if (this.y >= ty) {
            this.y = ty;
            const hits = a.near(this.x, ty, o.r || 12);
            for (const e of hits) a.hit(w, e, o.dmg || 2, this.x, ty, o.react ? { isReact: true } : undefined);
            splash(a, this.x, ty, o.big);
            if (o.burn) for (const e of hits) if (!o.burn.has(e)) (o.burn.add(e), burn(a, w, e));
            return false;
          }
          return this.age < 2;
        },
        draw(c) {
          const len = clamp(this.vy * 0.04, 4, 22);
          c.strokeStyle = 'rgba(198,255,77,0.4)';
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(this.x, this.y - len - 3);
          c.lineTo(this.x, this.y - 3);
          c.stroke();
          dropPath(c, this.x, this.y, o.big ? 1.15 : 1);
          c.fillStyle = 'rgba(198,255,77,0.92)';
          c.fill();
          c.fillStyle = 'rgba(255,255,255,0.85)';
          c.beginPath();
          c.arc(this.x - 0.7, this.y + 0.6, 0.6, 0, TAU);
          c.fill();
        },
      },
      o.noW ? null : w,
    );
  }

  function acid(api, w, tg) {
    const cx = clamp(tg.x, 34, W - 34);
    const cy = clamp(tg.y - 92, 52, 300);
    const n = 9;
    const life = 0.3 + n * 0.1 + 0.55;
    const cloud = api.add({
      x: cx,
      y: cy,
      z: 1,
      life,
      noTrail: true,
      update(dt) {
        this.x += Math.sin(this.age * 2.2) * 7 * dt;
      },
      draw(c, a) {
        const k = this.age / life;
        const al = Math.min(1, this.age / 0.22) * (k > 0.78 ? (1 - k) / 0.22 : 1);
        const sc = 0.8 + 0.2 * ease(Math.min(1, this.age / 0.3));
        // 비 장막
        if (this.age > 0.3 && k < 0.85) {
          c.strokeStyle = `rgba(198,255,77,${0.1 * al})`;
          c.lineWidth = 1;
          c.setLineDash([5, 7]);
          c.lineDashOffset = -a.t * 160;
          c.beginPath();
          for (let i = -2; i <= 2; i++) {
            c.moveTo(this.x + i * 11, this.y + 12);
            c.lineTo(this.x + i * 11, this.y + 82);
          }
          c.stroke();
          c.setLineDash([]);
        }
        drawCloud(c, this.x, this.y + Math.sin(a.t * 3) * 1.2, sc, al);
      },
    });
    for (let i = 0; i < n; i++)
      api.later(0.3 + i * 0.1, (a) => {
        const t = tg.alive ? tg : a.target('near', cloud.x, cloud.y + 90);
        const x = clamp((t ? t.x : cloud.x) + rnd(-20, 20), cloud.x - 30, cloud.x + 30);
        const ty = t ? clamp(t.y + t.sp * 0.3 + rnd(-12, 12), cloud.y + 30, LINE_Y - 10) : cloud.y + 90 + rnd(-12, 12);
        drop(a, w, x, cloud.y + 10, ty);
      });
  }

  // ── 반응 (보조일 때 큰 한 방) ─────────────────────────────────
  // 번지는 떼 · 추적: 세포가 터져 모기 떼가 퍼져 나가 주변 적을 하나씩 쫓아 문다
  function brood(api, e, w) {
    const x = e.x;
    const y = e.y;
    CX.mark(api, x, y, 0.6, (c, k) => {
      const er = ease(k);
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = (1 - k) * 0.8;
      const fr = 18 + er * 30;
      c.drawImage(burstSpr(), x - fr, y - fr, fr * 2, fr * 2);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1 - k;
      c.strokeStyle = CYAN;
      c.lineWidth = 2.2 * (1 - k) + 0.6;
      for (let i = 0; i < 6; i++) {
        const a0 = (i / 6) * TAU + 0.3;
        c.beginPath();
        c.arc(x, y, 14 + er * 44, a0, a0 + 0.62);
        c.stroke();
      }
      c.strokeStyle = LIME;
      c.lineWidth = 1;
      c.setLineDash([2, 4]);
      c.beginPath();
      c.arc(x, y, 20 + er * 62, 0, TAU);
      c.stroke();
      c.setLineDash([]);
    });
    api.shake(2);
    const tgs = api.near(x, y, 150).sort((a, b) => (a.x - x) ** 2 + (a.y - y) ** 2 - ((b.x - x) ** 2 + (b.y - y) ** 2));
    const list = tgs.slice(0, 6);
    if (!list.length) return;
    const N = 9;
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * TAU + rnd(-0.2, 0.2);
      const first = i < list.length;
      const ph = rnd(0, TAU);
      api.add({
        x,
        y,
        vx: Math.cos(ang) * 230,
        vy: Math.sin(ang) * 230,
        dir: ang,
        tgt: list[i % list.length],
        z: 1,
        noTrail: true,
        update(dt, a) {
          if (!(dt > 0)) return true;
          if (!this.tgt || !this.tgt.alive) {
            this.tgt = a.target('near', this.x, this.y);
            if (!this.tgt) return this.age < 0.5;
          }
          const t = this.tgt;
          const dx = t.x - this.x;
          const dy = t.y - this.y;
          const d = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, dt * (2 + this.age * 14));
          this.vx += ((dx / d) * 330 - this.vx) * k;
          this.vy += ((dy / d) * 330 - this.vy) * k;
          this.x += this.vx * dt;
          this.y += this.vy * dt;
          this.dir = Math.atan2(this.vy, this.vx);
          if (d < t.r + 5) {
            a.hit(w, t, 3, this.x, this.y, { isReact: true });
            return false;
          }
          return this.age < 1.8;
        },
        draw(c, a) {
          const t = this.tgt;
          if (t && t.alive && first) {
            // 추적 표지: 점선 지시선 + 돌아가는 표본 원
            c.strokeStyle = 'rgba(198,255,77,0.55)';
            c.lineWidth = 0.8;
            c.setLineDash([3, 3]);
            c.beginPath();
            c.moveTo(this.x, this.y);
            c.lineTo(t.x, t.y);
            c.stroke();
            c.setLineDash([4, 3]);
            c.lineDashOffset = -a.t * 20;
            c.strokeStyle = LIME;
            c.lineWidth = 1.2;
            c.beginPath();
            c.arc(t.x, t.y, t.r + 6, 0, TAU);
            c.stroke();
            c.setLineDash([]);
            c.beginPath();
            for (let q = 0; q < 4; q++) {
              const qa = (q / 4) * TAU + a.t * 1.5;
              c.moveTo(t.x + Math.cos(qa) * (t.r + 3), t.y + Math.sin(qa) * (t.r + 3));
              c.lineTo(t.x + Math.cos(qa) * (t.r + 10), t.y + Math.sin(qa) * (t.r + 10));
            }
            c.stroke();
          }
          fly(c, this.x, this.y, this.dir, 1.55, Math.abs(Math.sin(a.t * 46 + ph)), 1);
        },
      });
    }
  }

  // 번지는 장판 · 강타: 큰 막 세포가 떨어져 쾅 → 늪이 촉수처럼 번진다
  function slam(api, e, w) {
    const x = e.x;
    const y = e.y;
    const seed = rnd(0, 10);
    const hitSet = new Set();
    api.add({
      x,
      y: y - 130,
      vy: 120,
      z: 1,
      noTrail: true,
      update(dt, a) {
        if (!(dt > 0)) return true;
        this.vy += 2300 * dt;
        this.y += this.vy * dt;
        if (this.y < y) return true;
        a.shake(5);
        if (e.alive) {
          hitSet.add(e);
          a.hit(w, e, 8, x, y, { isReact: true, big: true });
        }
        spread(a);
        return false;
      },
      draw(c) {
        const k = clamp(1 - (y - this.y) / 130, 0, 1);
        // 땅 그림자
        c.fillStyle = `rgba(198,255,77,${0.12 + k * 0.2})`;
        c.beginPath();
        c.ellipse(x, y, 8 + k * 12, (8 + k * 12) * 0.5, 0, 0, TAU);
        c.fill();
        const st = Math.min(0.5, this.vy / 2600);
        // 떨어지는 자국
        c.strokeStyle = 'rgba(198,255,77,0.35)';
        c.lineWidth = 1.2;
        c.beginPath();
        for (const ox of [-9, 0, 9]) {
          c.moveTo(this.x + ox, this.y - 22 - Math.abs(ox));
          c.lineTo(this.x + ox, this.y - 22 - Math.abs(ox) - st * 70);
        }
        c.stroke();
        c.beginPath();
        c.ellipse(this.x, this.y, 18 * (1 - st * 0.4), 18 * (1 + st), 0, 0, TAU);
        c.fillStyle = 'rgba(198,255,77,0.3)';
        c.fill();
        c.strokeStyle = LIME;
        c.lineWidth = 2;
        c.stroke();
        c.strokeStyle = 'rgba(233,255,184,0.6)';
        c.lineWidth = 0.8;
        c.beginPath();
        c.ellipse(this.x, this.y, 13.5 * (1 - st * 0.4), 13.5 * (1 + st), 0, 0, TAU);
        c.stroke();
        c.fillStyle = CORAL;
        c.beginPath();
        c.arc(this.x + 3, this.y - 3, 4.8, 0, TAU);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.7)';
        c.beginPath();
        c.arc(this.x - 6, this.y - 7, 2, 0, TAU);
        c.fill();
      },
    });
    function spread(a) {
      // 쾅: 충격 고리
      CX.mark(a, x, y, 0.5, (c, k) => {
        const er = ease(k);
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = (1 - k) * 0.9;
        const fr = 22 + er * 26;
        c.drawImage(limeGlow(), x - fr, y - fr, fr * 2, fr * 2);
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = 1;
        c.strokeStyle = `rgba(233,255,184,${1 - k})`;
        c.lineWidth = 3 * (1 - k) + 0.5;
        c.beginPath();
        c.ellipse(x, y, 14 + er * 90, (14 + er * 90) * 0.64, 0, 0, TAU);
        c.stroke();
      });
      const RM = 88;
      a.add({
        x,
        y,
        z: -1,
        life: 1.9,
        noTrail: true,
        update(dt, b) {
          const R = RM * ease(Math.min(1, this.age / 0.42));
          for (const n of b.near(x, y, R)) {
            if (hitSet.has(n)) continue;
            hitSet.add(n);
            b.hit(w, n, 4, n.x, n.y, { isReact: true, slow: 1.6 });
          }
        },
        draw(c, b) {
          const g = Math.min(1, this.age / 0.42);
          const out = this.age > 1.3 ? 1 - (this.age - 1.3) / 0.6 : 1;
          drawPool(c, x, y, RM * (0.2 + 0.8 * ease(g)), b.t, seed, out, 0.16 * (1 - g * 0.5));
        },
      });
    }
  }

  // 융단 폭격 · 화염: 세포 구름 띠가 줄 전체를 덮고 산성비를 쓸어 붓는다 → 맞은 적은 산에 타들어 간다
  function carpet(api, e, w) {
    const by = clamp(e.y - 118, 100, 290);
    const bx = clamp(e.x, 125, W - 125);
    const half = 118;
    const rowY = e.y;
    api.add({
      x: bx,
      y: by,
      z: 1,
      life: 1.6,
      noTrail: true,
      update() {},
      draw(c, a) {
        for (let i = 0; i < 4; i++) {
          const t0 = i * 0.06;
          const ag = this.age - t0;
          if (ag <= 0) continue;
          const al = Math.min(1, ag / 0.18) * (this.age > 1.25 ? (1.6 - this.age) / 0.35 : 1);
          drawCloud(c, bx - half + 30 + i * ((2 * half - 60) / 3), by + (i % 2 ? 4 : -3) + Math.sin(a.t * 3 + i) * 1.2, 0.92, al);
        }
      },
    });
    const N = 22;
    const burned = new Set();
    for (let i = 0; i < N; i++)
      api.later(0.16 + i * 0.03, (a) => {
        const x = bx - half + (i + rnd(0.15, 0.85)) * ((2 * half) / N);
        drop(a, w, x, by + 10 + rnd(-4, 4), clamp(rowY + 18 + rnd(-30, 30), by + 40, LINE_Y - 8), { dmg: 3, r: 14, react: true, burn: burned, big: true, noW: true });
      });
  }

  // 산에 타들어 감: 적 몸에서 산호·라임 거품과 김이 오르고 두 번 더 녹는다
  function burn(api, w, e) {
    const ph = rnd(0, TAU);
    CX.mark(api, e.x, e.y, 1.2, (c, k, f) => {
      const x = e.x;
      const y = e.y;
      f.x = x;
      f.y = y;
      const a = k > 0.7 ? (1 - k) / 0.3 : 1;
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = a * (0.45 + Math.sin(k * 40 + ph) * 0.15);
      const gr = e.r * 1.6;
      c.drawImage(burstSpr(), x - gr, y - gr, gr * 2, gr * 2);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = a;
      for (let j = 0; j < 5; j++) {
        const q = (k * 2.2 + j / 5) % 1;
        const bx = x + Math.sin(j * 2.3 + ph) * e.r * 0.8 + Math.sin(q * 8 + j) * 2;
        const byy = y - q * (e.r + 16);
        c.strokeStyle = j % 2 ? `rgba(255,138,126,${1 - q})` : `rgba(198,255,77,${1 - q})`;
        c.lineWidth = 1;
        c.beginPath();
        c.arc(bx, byy, 0.8 + q * 2.4, 0, TAU);
        c.stroke();
      }
      // 김
      c.strokeStyle = `rgba(233,255,184,${0.35 * a})`;
      c.lineWidth = 1.2;
      c.beginPath();
      for (let j = -1; j <= 1; j += 2) {
        const sx = x + j * e.r * 0.45;
        c.moveTo(sx, y - e.r * 0.6);
        c.bezierCurveTo(sx + 5 * j, y - e.r - 6, sx - 5 * j, y - e.r - 12, sx + 2 * j, y - e.r - 20 - k * 6);
      }
      c.stroke();
    });
    for (const at of [0.42, 0.84]) api.later(at, (a) => e.alive && a.hit(w, e, 2, e.x, e.y, { isReact: true, noMark: true }));
  }

  // ── 반응 글씨 라틴 말 ───────────────────────────────────────
  const LAT = { '번지는 떼': 'SWARM SPREAD', 추적: 'TRACK', '번지는 장판': 'FIELD SPREAD', 강타: 'SLAM', '융단 폭격': 'CARPET', 화염: 'BURN' };

  CX.world('bio', {
    name: '미시 생체',
    short: '미시',
    desc: '현미경 속 생물·독. 반투명 세포막 몸이 날고 번지고 떨어진다. 맞으면 세포가 터지고 지시선 표지 "LYSIS".',
    colors: { main: CYAN, soft: TEAL },
    fonts: ['Space Grotesk', 'Noto Sans KR'],

    box(c, x, y, w, h) {
      const s = spr(`bio-box-${w}x${h}`, w, h, (g, w, h) => {
        g.fillStyle = DEEP;
        g.fillRect(0, 0, w, h);
        const rg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
        rg.addColorStop(0, TEAL);
        rg.addColorStop(1, DEEP);
        g.fillStyle = rg;
        g.fillRect(0, 0, w, h);
        // 세포막 원 두 겹
        g.strokeStyle = 'rgba(92,242,230,0.45)';
        g.lineWidth = 0.7;
        g.beginPath();
        g.arc(w / 2, h * 0.52, w * 0.39, 0, TAU);
        g.stroke();
        g.strokeStyle = 'rgba(92,242,230,0.28)';
        g.lineWidth = 0.4;
        g.beginPath();
        g.arc(w / 2, h * 0.52, w * 0.35, 0, TAU);
        g.stroke();
        // 떠다니는 작은 세포
        g.strokeStyle = 'rgba(92,242,230,0.35)';
        g.lineWidth = 0.4;
        for (const [px, py, r] of [
          [0.14, 0.2, 0.05],
          [0.86, 0.72, 0.04],
          [0.82, 0.18, 0.03],
        ]) {
          g.beginPath();
          g.arc(w * px, h * py, w * r, 0, TAU);
          g.stroke();
        }
        g.fillStyle = 'rgba(159,247,239,0.5)';
        for (const [px, py] of [
          [0.2, 0.32],
          [0.8, 0.26],
          [0.84, 0.64],
          [0.15, 0.64],
          [0.5, 0.12],
        ])
          g.fillRect(w * px, h * py, 0.6, 0.6);
        // 눈금자
        g.strokeStyle = 'rgba(92,242,230,0.7)';
        g.lineWidth = 0.45;
        g.beginPath();
        const y0 = h * 0.9;
        g.moveTo(w * 0.22, y0);
        g.lineTo(w * 0.78, y0);
        for (let i = 0; i <= 6; i++) {
          const tx = w * (0.22 + (0.56 * i) / 6);
          g.moveTo(tx, y0);
          g.lineTo(tx, y0 - (i % 3 === 0 ? 2 : 1.1));
        }
        g.stroke();
      });
      c.drawImage(s, x, y, w, h);
    },

    crest(c, x, y, r) {
      const s = spr('bio-crest', 20, 20, (g) => {
        g.beginPath();
        g.arc(10, 10, 9.2, 0, TAU);
        g.fillStyle = DEEP;
        g.fill();
        g.strokeStyle = CYAN;
        g.lineWidth = 1.3;
        g.stroke();
        g.beginPath();
        g.arc(10, 10, 6.2, 0, TAU);
        g.fillStyle = 'rgba(92,242,230,0.16)';
        g.fill();
        g.lineWidth = 0.8;
        g.stroke();
        g.fillStyle = LIME;
        g.beginPath();
        g.arc(11.6, 8.8, 2.5, 0, TAU);
        g.fill();
        g.fillStyle = CORAL;
        g.beginPath();
        g.arc(7.5, 12.1, 1, 0, TAU);
        g.fill();
      });
      c.drawImage(s, x, y, r * 2, r * 2);
    },

    icon(c, id, x, y, s) {
      const q = Math.round(s * 2) / 2;
      const small = q < 24;
      const known = id === 'arm_sw_mosquito' || id === 'arm_f_swamp' || id === 'arm_acid';
      if (!known) {
        c.strokeStyle = CYAN;
        c.lineWidth = 1.6;
        c.fillStyle = 'rgba(92,242,230,0.14)';
        c.beginPath();
        c.arc(x, y, s * 0.32, 0, TAU);
        c.fill();
        c.stroke();
        c.font = `700 ${Math.round(s * 0.34)}px ${KR}`;
        c.fillStyle = '#FFFFFF';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText((CX.data.weapons[id] || { name: '?' }).name.slice(0, 1), x, y + 1);
        return;
      }
      const im = spr(`bio-ic-${id}-${q}`, q, q, (g) => {
        // 시안 좌표(62칸)로 그린다
        g.translate(q / 2, q / 2);
        g.scale(q / 62, q / 62);
        g.translate(-31, -31);
        const L = (px) => (px * 62) / q; // 화면 px 두께
        if (id === 'arm_sw_mosquito') {
          const one = (tx, ty, sc, bold) => {
            g.save();
            g.translate(tx, ty);
            g.scale(sc, sc);
            const l = (px) => L(px) / sc;
            g.lineCap = 'round';
            g.fillStyle = 'rgba(92,242,230,0.25)';
            g.strokeStyle = PALE;
            g.lineWidth = l(bold ? 1 : 0.7);
            g.beginPath();
            g.ellipse(-1, -4, 4.6, 1.9, -0.44, 0, TAU);
            g.fill();
            g.stroke();
            g.beginPath();
            g.ellipse(-3.2, -3.4, 4, 1.6, -0.87, 0, TAU);
            g.fill();
            g.stroke();
            g.beginPath();
            g.moveTo(-2, 2);
            g.lineTo(-4.2, 6.2);
            g.moveTo(0, 2);
            g.lineTo(1, 6.2);
            g.moveTo(2, 1.8);
            g.lineTo(4.2, 5.6);
            g.stroke();
            g.fillStyle = TEAL;
            g.strokeStyle = CYAN;
            g.lineWidth = l(bold ? 1.4 : 1);
            g.beginPath();
            g.ellipse(-3, 0, 5, 2.3, 0, 0, TAU);
            g.fill();
            g.stroke();
            g.beginPath();
            g.arc(3.5, 0.4, 2, 0, TAU);
            g.fill();
            g.stroke();
            g.strokeStyle = CORAL;
            g.lineWidth = l(bold ? 1.6 : 1.1);
            g.beginPath();
            g.moveTo(5.2, 1.1);
            g.lineTo(10.4, 3.6);
            g.stroke();
            g.fillStyle = LIME;
            g.beginPath();
            g.arc(4, 0, 0.75, 0, TAU);
            g.fill();
            g.beginPath();
            g.arc(-3.4, 0.2, 0.9, 0, TAU);
            g.fill();
            g.restore();
          };
          if (small) one(28, 31, 2.75, true);
          else {
            g.setLineDash([L(1.4), L(1.8)]);
            g.strokeStyle = 'rgba(92,242,230,0.6)';
            g.lineWidth = L(0.7);
            g.beginPath();
            g.moveTo(10, 50);
            g.bezierCurveTo(20, 40, 28, 46, 36, 38);
            g.bezierCurveTo(42, 32, 48, 34, 53, 27);
            g.stroke();
            g.setLineDash([]);
            one(27, 23, 1.75, false);
            one(43, 40, 1.35, false);
            one(18, 45, 1.05, false);
          }
        } else if (id === 'arm_f_swamp') {
          const pg = g.createRadialGradient(31, 38, 0, 31, 40, 22);
          pg.addColorStop(0, CREAM);
          pg.addColorStop(0.4, 'rgba(198,255,77,0.75)');
          pg.addColorStop(1, 'rgba(78,122,18,0.5)');
          g.fillStyle = pg;
          g.strokeStyle = LIME;
          g.lineWidth = L(small ? 1.4 : 1);
          const rim = (rx, ry) => {
            g.beginPath();
            for (let i = 0; i <= 36; i++) {
              const a = (i / 36) * TAU;
              const k = 1 + 0.07 * Math.sin(a * 3 + 0.6) + 0.04 * Math.sin(a * 5 + 2);
              const px = 31 + Math.cos(a) * rx * k;
              const py = 40 + Math.sin(a) * ry * k;
              i ? g.lineTo(px, py) : g.moveTo(px, py);
            }
            g.closePath();
          };
          rim(small ? 24 : 21, small ? 11 : 9);
          g.fill();
          g.stroke();
          g.strokeStyle = 'rgba(233,255,184,0.7)';
          g.lineWidth = L(0.6);
          rim(small ? 19 : 17, small ? 8 : 6.5);
          g.stroke();
          g.strokeStyle = CREAM;
          g.lineWidth = L(small ? 1.2 : 0.9);
          const bub = small
            ? [
                [23, 37, 3.2],
                [37, 25, 3],
                [28, 16, 2],
              ]
            : [
                [24, 38, 2.4],
                [37, 41, 1.6],
                [31, 27, 2],
                [38, 19, 1.3],
                [26, 16, 1],
              ];
          for (const [bx, by, br] of bub) (g.beginPath(), g.arc(bx, by, br, 0, TAU), g.stroke());
          g.fillStyle = CORAL;
          for (const [nx, ny, nr] of [
            [31, 42, small ? 1.7 : 1.1],
            [42, 38, small ? 1.4 : 0.9],
            [20, 41, 0.9],
          ])
            (g.beginPath(), g.arc(nx, ny, nr, 0, TAU), g.fill());
          // 가장자리에서 흘러내리는 방울
          g.fillStyle = LIME;
          for (const [dx, dy, ds] of small
            ? [
                [15, 52, 1.1],
                [44, 53, 1],
              ]
            : [
                [18, 51, 0.8],
                [41, 53, 0.9],
                [47, 49, 0.6],
              ]) {
            dropPath(g, dx, dy, ds);
            g.fill();
          }
        } else {
          // 산성비: 세포 구름 + 방울
          g.fillStyle = TEAL;
          g.strokeStyle = CYAN;
          g.lineWidth = L(small ? 1.5 : 1.1);
          g.beginPath();
          g.moveTo(15, 22);
          g.bezierCurveTo(13, 15, 19, 10, 25, 12);
          g.bezierCurveTo(27, 6, 37, 6, 40, 11);
          g.bezierCurveTo(46, 9, 51, 14, 49, 20);
          g.bezierCurveTo(52, 24, 48, 28, 43, 27);
          g.lineTo(19, 27);
          g.bezierCurveTo(14, 28, 12, 24, 15, 22);
          g.closePath();
          g.fill();
          g.stroke();
          g.fillStyle = 'rgba(92,242,230,0.6)';
          for (const [cx, cy, r] of [
            [25, 19, 1.4],
            [34, 16, 1.8],
            [42, 20, 1.2],
          ])
            (g.beginPath(), g.arc(cx, cy, r, 0, TAU), g.fill());
          g.strokeStyle = 'rgba(198,255,77,0.5)';
          g.lineWidth = L(0.8);
          g.beginPath();
          for (const [lx, a, b] of [
            [21, 30, 33],
            [31, 31, 37],
            [41, 30, 33],
          ])
            (g.moveTo(lx, a), g.lineTo(lx, b));
          g.stroke();
          g.fillStyle = LIME;
          const drops = small
            ? [
                [21, 38, 1.35],
                [33, 44, 1.35],
                [44, 37, 1.2],
              ]
            : [
                [21, 36, 1],
                [31, 41, 1],
                [41, 36, 1],
                [27, 50, 0.9],
                [37, 50, 0.9],
              ];
          for (const [dx, dy, ds] of drops) {
            dropPath(g, dx, dy, ds * 0.8);
            g.fill();
          }
          g.strokeStyle = LIME;
          g.lineWidth = L(small ? 1.3 : 1);
          g.beginPath();
          g.moveTo(18, 56);
          g.quadraticCurveTo(22, 53, 26, 56);
          g.moveTo(34, 56);
          g.quadraticCurveTo(38, 53, 42, 56);
          g.stroke();
        }
      });
      c.drawImage(im, x - q / 2, y - q / 2, q, q);
    },

    fire(api, w, tg) {
      if (w.id === 'arm_sw_mosquito') {
        swarm(api, w, tg);
        return 2.5;
      }
      if (w.id === 'arm_f_swamp') {
        swamp(api, w, tg);
        return 2.7;
      }
      if (w.id === 'arm_acid') {
        acid(api, w, tg);
        return 2.4;
      }
      return CX.worlds.base.fire(api, w, tg);
    },

    // 보조 층: 반투명 점액 자취 + 작은 세포, 머리에 막 한 겹
    trail(c, e, t) {
      const h = e.hist;
      const n = h.length >> 1;
      const moved = n >= 2 ? Math.abs(h[0] - e.x) + Math.abs(h[1] - e.y) : 0;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      if (moved > 6) {
        c.beginPath();
        c.moveTo(h[0], h[1]);
        for (let i = 1; i < n; i++) c.lineTo(h[i * 2], h[i * 2 + 1]);
        c.lineTo(e.x, e.y);
        c.strokeStyle = 'rgba(198,255,77,0.15)';
        c.lineWidth = 8;
        c.stroke();
        c.strokeStyle = 'rgba(92,242,230,0.55)';
        c.lineWidth = 1.1;
        c.stroke();
        // 자취에 남은 작은 세포
        for (let j = 0; j < 3; j++) {
          const idx = Math.floor((0.15 + j * 0.3) * (n - 1));
          const px = h[idx * 2] + Math.sin(t * 4 + j * 2.7) * 2.5;
          const py = h[idx * 2 + 1] + Math.cos(t * 3.3 + j * 1.9) * 2.5;
          const r = 1.5 + j * 0.7;
          c.beginPath();
          c.arc(px, py, r, 0, TAU);
          c.fillStyle = 'rgba(92,242,230,0.2)';
          c.fill();
          c.strokeStyle = 'rgba(159,247,239,0.85)';
          c.lineWidth = 0.7;
          c.stroke();
          c.fillStyle = j === 1 ? CORAL : LIME;
          c.beginPath();
          c.arc(px + r * 0.25, py - r * 0.2, Math.max(0.5, r * 0.35), 0, TAU);
          c.fill();
        }
      }
      // 머리를 감싸는 막
      const R = clamp((e.r || 5) + 4, 7, 15);
      const ang = Math.atan2(e.vy || 0, e.vx || 1);
      const str = moved > 6 ? 0.22 : 0;
      const wob = Math.sin(t * 7 + e.age * 3) * 0.08;
      c.save();
      c.translate(e.x, e.y);
      c.rotate(ang);
      c.beginPath();
      c.ellipse(-R * str, 0, R * (1 + str + wob), R * (1 - str * 0.4 - wob), 0, 0, TAU);
      c.fillStyle = 'rgba(92,242,230,0.07)';
      c.fill();
      c.strokeStyle = 'rgba(92,242,230,0.7)';
      c.lineWidth = 1;
      c.stroke();
      c.setLineDash([1.5, 2.5]);
      c.strokeStyle = 'rgba(198,255,77,0.6)';
      c.lineWidth = 0.8;
      c.beginPath();
      c.ellipse(-R * str, 0, R * (1 + str + wob) + 3, R * (1 - str * 0.4 - wob) + 3, 0, 0, TAU);
      c.stroke();
      c.setLineDash([]);
      c.restore();
      // 멈춘 것(장판 가운데·광선 끝)에는 세포가 둘레를 돈다
      if (moved <= 6) {
        for (let j = 0; j < 3; j++) {
          const a = t * 1.7 + (j * TAU) / 3;
          const px = e.x + Math.cos(a) * (R + 7);
          const py = e.y + Math.sin(a) * (R + 7) * 0.8;
          c.beginPath();
          c.arc(px, py, 2.2, 0, TAU);
          c.fillStyle = 'rgba(92,242,230,0.22)';
          c.fill();
          c.strokeStyle = PALE;
          c.lineWidth = 0.7;
          c.stroke();
          c.fillStyle = LIME;
          c.beginPath();
          c.arc(px + 0.6, py - 0.5, 0.8, 0, TAU);
          c.fill();
        }
      }
    },

    hit(api, x, y, w, asSub) {
      const s = st(api);
      if (asSub) {
        lysis(api, x, y, 5.5, true, false);
        if (api.t - s.subTag > 1.0) {
          s.subTag = api.t;
          tag(api, x, y, 'LYSIS', true);
        }
        return;
      }
      const id = w && w.id;
      const R = id === 'arm_sw_mosquito' ? 6.5 : id === 'arm_f_swamp' ? 6 : id === 'arm_acid' ? 7.5 : 8;
      lysis(api, x, y, R, false, id === 'arm_f_swamp');
      if (api.t - s.tag > 0.55) {
        s.tag = api.t;
        tag(api, x, y, '용해 LYSIS', false);
      }
    },

    react(api, e, w) {
      if (w.sub === 'arm_f_swamp') return slam(api, e, w);
      if (w.sub === 'arm_acid') return carpet(api, e, w);
      return brood(api, e, w);
    },

    // 반응 글씨: 표본 표지 상자 + 지시선. 지시선이 그어지고 → 상자가 열리고 → 초점이 맞듯 글씨가 훑어 나타난다
    label(c, text, x, y, age, life) {
      const parts = String(text).split(' · ');
      const a = parts[0];
      const b = parts.slice(1).join(' · ');
      const lat = [LAT[a] || 'REACTION', b ? LAT[b] || '' : ''].filter(Boolean).join(' · ');
      let code = 0;
      for (const ch of String(text)) code = (code * 31 + ch.charCodeAt(0)) % 997;
      const head = `RXN-${String(code % 900 + 100)}`;
      let fs = 21;
      c.font = `900 ${fs}px ${KR}`;
      const sep = b ? ' · ' : '';
      let wa = c.measureText(a).width;
      let ws = c.measureText(sep).width;
      let wb = b ? c.measureText(b).width : 0;
      const tw0 = wa + ws + wb;
      if (tw0 > 236) {
        fs = (fs * 236) / tw0;
        c.font = `900 ${fs}px ${KR}`;
        wa = c.measureText(a).width;
        ws = c.measureText(sep).width;
        wb = b ? c.measureText(b).width : 0;
      }
      const tw = wa + ws + wb;
      const bw = Math.max(168, tw + 40);
      const bh = 46;
      const bx = x - bw / 2;
      const by = y - bh / 2;
      const outK = clamp((age - (life - 0.32)) / 0.32, 0, 1);
      const p1 = clamp(age / 0.14, 0, 1);
      const p2 = ease(clamp((age - 0.08) / 0.16, 0, 1));
      const p3 = clamp((age - 0.16) / 0.26, 0, 1);
      // 초점: 들어올 때 맞고, 나갈 때 다시 흐려진다
      const foc = Math.max(1 - ease(clamp((age - 0.16) / 0.4, 0, 1)), outK);
      c.globalAlpha = 1 - outK;
      // 지시선: 표본 점 → 상자 왼쪽 아래 모서리
      const dx = x - 6;
      const dy = y + 44;
      const ex = bx + 14;
      const ey = by + bh;
      const lp = p1 * (1 - outK);
      c.strokeStyle = LIME;
      c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(dx, dy);
      c.lineTo(lerp(dx, ex, lp), lerp(dy, ey, lp));
      c.stroke();
      c.fillStyle = LIME;
      c.beginPath();
      c.arc(dx, dy, 2.4, 0, TAU);
      c.fill();
      c.strokeStyle = `rgba(198,255,77,${0.7 * (1 - p1 * 0.6)})`;
      c.lineWidth = 1;
      c.beginPath();
      c.arc(dx, dy, 2.4 + p1 * 5, 0, TAU);
      c.stroke();
      if (p2 <= 0) return;
      // 상자 (가운데서 옆으로 열리고, 나갈 때 위아래로 닫힌다)
      const ow = bw * p2 * (1 + outK * 0.06);
      const oh = bh * (1 + outK * 0.12);
      const ox = x - ow / 2;
      const oy = y - oh / 2;
      c.fillStyle = 'rgba(4,22,26,0.9)';
      c.fillRect(ox, oy, ow, oh);
      c.strokeStyle = 'rgba(92,242,230,0.55)';
      c.lineWidth = 1;
      c.strokeRect(ox + 0.5, oy + 0.5, ow - 1, oh - 1);
      // 모서리 꺾쇠
      c.strokeStyle = LIME;
      c.lineWidth = 1.8;
      c.beginPath();
      const K = 8;
      for (const [cx, cy, sx, sy] of [
        [ox, oy, 1, 1],
        [ox + ow, oy, -1, 1],
        [ox, oy + oh, 1, -1],
        [ox + ow, oy + oh, -1, -1],
      ]) {
        c.moveTo(cx + sx * K, cy);
        c.lineTo(cx, cy);
        c.lineTo(cx, cy + sy * Math.min(K, oh / 2));
      }
      c.stroke();
      if (p2 < 1) return;
      // 위 테: 표본 번호 · 배율 / 아래 테: 라틴
      c.font = `700 8px ${SG}`;
      c.textBaseline = 'middle';
      const hw = c.measureText(head).width;
      c.fillStyle = DEEP;
      c.fillRect(bx + 12, oy - 4, hw + 8, 8);
      c.fillRect(bx + bw - 40, oy - 4, 30, 8);
      c.fillStyle = CYAN;
      c.textAlign = 'left';
      c.fillText(head, bx + 16, oy + 0.5);
      c.textAlign = 'right';
      c.fillText('×400', bx + bw - 14, oy + 0.5);
      c.font = `500 8px ${SG}`;
      const lw = c.measureText(lat).width;
      c.fillStyle = DEEP;
      c.fillRect(x - lw / 2 - 5, oy + oh - 4, lw + 10, 8);
      c.fillStyle = 'rgba(143,233,224,0.95)';
      c.textAlign = 'center';
      c.fillText(lat, x, oy + oh + 0.5);
      if (p3 <= 0) return;
      // 글씨: 왼쪽에서 훑어 나타나며 초점이 맞는다 (청록·산호 겹이 모인다)
      c.save();
      c.beginPath();
      c.rect(bx, oy, bw * p3, oh);
      c.clip();
      c.font = `900 ${fs}px ${KR}`;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      const tx = x - tw / 2;
      const ty = y + 1;
      if (foc > 0.02) {
        c.globalAlpha = (1 - outK) * 0.55 * foc;
        c.fillStyle = CYAN;
        c.fillText(a + sep + b, tx - foc * 5, ty);
        c.fillStyle = CORAL;
        c.fillText(a + sep + b, tx + foc * 5, ty);
        c.globalAlpha = 1 - outK;
      }
      c.shadowColor = 'rgba(198,255,77,0.75)';
      c.shadowBlur = 8;
      c.fillStyle = '#F6FFE6';
      c.fillText(a + sep, tx, ty);
      if (b) {
        c.fillStyle = LIME;
        c.fillText(b, tx + wa + ws, ty);
      }
      c.restore();
      // 훑는 선
      if (p3 < 1) {
        const sx = bx + bw * p3;
        c.strokeStyle = CYAN;
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(sx, oy + 3);
        c.lineTo(sx, oy + oh - 3);
        c.stroke();
      }
    },
  });
})();
