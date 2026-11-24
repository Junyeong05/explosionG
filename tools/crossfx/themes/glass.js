// 테마 glass — 클린 SF 글래스 (11-24)
// 어두운 남색·흑연 판 위에 겹친 반투명 유리 패널, 가는 흰 선, 청록·흰 강조, 매끈한 산세리프 (IBM Plex Sans KR · Space Grotesk 숫자).
// 판 = 원근 바닥 격자 + 홀로그램 장벽 막 + 금속 갑판. 적 = 면마다 부드럽게 음영 진 다면체 드론 (위 왼쪽 빛 · 붉은 눈).
// 폭발 = 흰·청 충격파 고리 + 번짐 + 가로 빛줄. 받침 = 금속 육각 패드 + 세계 색 빛 고리 · 빛기둥.
// 매 프레임 같은 그림(적 몸 · 패드 · 빛 · 장벽 막)은 CX.util.sprite 로 한 번만 그린다.
(function () {
  if (!window.CX || !CX.runInfo) return;
  const { W, FIELD_H, GUN, CAT_TH, ORDER } = CX.runInfo;
  const { LINE_Y } = CX.size;
  const { TAU, clamp, ease, roundRect, bgCanvas, sprite } = CX.util;
  const H = FIELD_H;

  // ── 색 · 글꼴 ──
  const INK = '#F2F7FF';
  const MUTE = '#A9B8CC';
  const CY = '#5EE9F5';
  const CY_HI = '#C4FCFF';
  const RED = '#FF4A5E';
  const NAVY = '#04121A';
  const FN = '"Space Grotesk", "IBM Plex Sans KR", system-ui, sans-serif';
  const FK = '"IBM Plex Sans KR", "Noto Sans KR", system-ui, sans-serif';
  const FONTS = ['Space Grotesk', 'IBM Plex Sans KR'];
  if (document.fonts && document.fonts.load) {
    const sample = 'LEVEL UP WAVE 0123456789 →×·/ 레벨 업 강화 새 무기 합성 갈래 칸 장벽 붕괴 잠시 뒤 판 연쇄 지휘 모함 접근 피해 쿨다운 반응 몸 연출 세계 등급 하나 더 이걸로 열린다 까지 최고 웨이브';
    for (const f of FONTS) for (const wt of [500, 700]) document.fonts.load(`${wt} 16px "${f}"`, sample).catch(() => null);
  }

  const wc = (k) => (k && (CX.wo(k).colors || {}).main) || CY;
  function rgba(hex, a) {
    const h = String(hex).replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function spaced(c, px) {
    c.letterSpacing = px + 'px';
  }

  // ── 공통 그림 도우미 ──
  function poly(c, pts) {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
  }
  function hexPath(c, x, y, r, sy) {
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r * (sy || 1);
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
  }
  function heartPath(c, x, y, r) {
    c.beginPath();
    c.moveTo(x, y + r * 0.85);
    c.bezierCurveTo(x - r * 1.25, y - r * 0.05, x - r * 0.65, y - r * 1.05, x, y - r * 0.38);
    c.bezierCurveTo(x + r * 0.65, y - r * 1.05, x + r * 1.25, y - r * 0.05, x, y + r * 0.85);
    c.closePath();
  }
  /** 유리 패널: 짙은 바탕 + 위가 밝은 반투명 겹 + 가는 테 + 위 모서리 빛 */
  function glass(c, x, y, w, h, r, o) {
    o = o || {};
    roundRect(c, x, y, w, h, r);
    c.fillStyle = o.base || 'rgba(9,15,27,0.8)';
    c.fill();
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, `rgba(160,200,245,${o.sheen == null ? 0.12 : o.sheen})`);
    g.addColorStop(0.55, 'rgba(120,160,220,0.035)');
    g.addColorStop(1, 'rgba(120,160,220,0.02)');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = o.edge || 'rgba(220,235,255,0.16)';
    c.lineWidth = o.lw || 1;
    c.stroke();
    const hg = c.createLinearGradient(x, 0, x + w, 0);
    hg.addColorStop(0, 'rgba(255,255,255,0)');
    hg.addColorStop(0.5, `rgba(255,255,255,${o.top == null ? 0.42 : o.top})`);
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    c.strokeStyle = hg;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x + r, y + 0.5);
    c.lineTo(x + w - r, y + 0.5);
    c.stroke();
  }

  // ── 미리 그려 두는 빛 ──
  const glowSpr = (key, stops) =>
    sprite('glass-glow-' + key, 32, 32, (c) => {
      const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
      for (const [o, col] of stops) g.addColorStop(o, col);
      c.fillStyle = g;
      c.fillRect(0, 0, 32, 32);
    });
  const GLOW = () =>
    glowSpr('w', [
      [0, 'rgba(255,255,255,1)'],
      [0.22, 'rgba(210,250,255,0.8)'],
      [0.55, 'rgba(94,233,245,0.24)'],
      [1, 'rgba(94,233,245,0)'],
    ]);
  const GLOW_R = () =>
    glowSpr('r', [
      [0, 'rgba(255,150,160,0.95)'],
      [0.3, 'rgba(255,70,95,0.5)'],
      [1, 'rgba(255,40,70,0)'],
    ]);
  const STREAK = (key, col) =>
    sprite('glass-streak-' + key, 128, 8, (c) => {
      const g = c.createLinearGradient(0, 0, 128, 0);
      g.addColorStop(0, rgba(col, 0));
      g.addColorStop(0.5, rgba(col, 1));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 8);
      c.globalCompositeOperation = 'destination-in';
      const v = c.createLinearGradient(0, 0, 0, 8);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(0.5, 'rgba(0,0,0,1)');
      v.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = v;
      c.fillRect(0, 0, 128, 8);
    });
  const TOPGLOW = () =>
    sprite('glass-top', W, 46, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 46);
      g.addColorStop(0, 'rgba(94,200,245,0.16)');
      g.addColorStop(1, 'rgba(94,200,245,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, W, 46);
      c.globalCompositeOperation = 'destination-in';
      const m = c.createLinearGradient(0, 0, W, 0);
      m.addColorStop(0, 'rgba(0,0,0,0.15)');
      m.addColorStop(0.5, 'rgba(0,0,0,1)');
      m.addColorStop(1, 'rgba(0,0,0,0.15)');
      c.fillStyle = m;
      c.fillRect(0, 0, W, 46);
    });
  const SCAN = () =>
    sprite('glass-scan', W, 70, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 70);
      g.addColorStop(0, 'rgba(94,200,255,0)');
      g.addColorStop(0.85, 'rgba(94,200,255,0.035)');
      g.addColorStop(0.97, 'rgba(150,240,255,0.06)');
      g.addColorStop(1, 'rgba(150,240,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, W, 70);
    });
  /** 장벽 막: 위로 옅어지는 청록 + 육각 무늬 */
  const MEMBRANE = () =>
    sprite('glass-membrane', W, 34, (c) => {
      c.strokeStyle = 'rgba(160,240,255,0.55)';
      c.lineWidth = 0.6;
      const R = 5.2;
      const dy = Math.sqrt(3) * R;
      for (let q = 0, x = 0; x < W + R * 2; q++, x = q * R * 1.5) {
        for (let y = q % 2 ? dy / 2 : 0; y < 40; y += dy) hexPath(c, x, y, R), c.stroke();
      }
      c.globalCompositeOperation = 'destination-in';
      const m = c.createLinearGradient(0, 0, 0, 34);
      m.addColorStop(0, 'rgba(0,0,0,0)');
      m.addColorStop(1, 'rgba(0,0,0,0.5)');
      c.fillStyle = m;
      c.fillRect(0, 0, W, 34);
      c.globalCompositeOperation = 'destination-over';
      const g = c.createLinearGradient(0, 0, 0, 34);
      g.addColorStop(0, 'rgba(94,233,245,0)');
      g.addColorStop(1, 'rgba(94,233,245,0.2)');
      c.fillStyle = g;
      c.fillRect(0, 0, W, 34);
    });
  const SWEEP = () =>
    sprite('glass-sweep', 120, 30, (c) => {
      const g = c.createLinearGradient(0, 0, 120, 0);
      g.addColorStop(0, 'rgba(190,250,255,0)');
      g.addColorStop(0.5, 'rgba(190,250,255,0.35)');
      g.addColorStop(1, 'rgba(190,250,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 120, 30);
      c.globalCompositeOperation = 'destination-in';
      const m = c.createLinearGradient(0, 0, 0, 30);
      m.addColorStop(0, 'rgba(0,0,0,0)');
      m.addColorStop(1, 'rgba(0,0,0,1)');
      c.fillStyle = m;
      c.fillRect(0, 0, 120, 30);
    });

  // ── 적: 다면체 드론 ──
  const LX = -0.55;
  const LY = -0.83;
  const LO = [11, 15, 24];
  const HI = [128, 143, 170];
  function shade(b) {
    b = clamp(b, 0, 1);
    return `rgb(${Math.round(LO[0] + (HI[0] - LO[0]) * b)},${Math.round(LO[1] + (HI[1] - LO[1]) * b)},${Math.round(LO[2] + (HI[2] - LO[2]) * b)})`;
  }
  /** 바깥선 pts 를 가운데 hub 로 모아 면을 나누고, 면 방향과 빛으로 음영 · 모서리 빛 */
  function facets(c, pts, hub, bias) {
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const A = pts[i];
      const B = pts[(i + 1) % n];
      const mx = (A[0] + B[0]) / 2;
      const my = (A[1] + B[1]) / 2;
      let nx = mx - hub[0];
      let ny = my - hub[1];
      const d = Math.hypot(nx, ny) || 1;
      nx /= d;
      ny /= d;
      const b = 0.4 + 0.42 * (nx * LX + ny * LY) + bias;
      const g = c.createLinearGradient(mx, my, hub[0], hub[1]);
      g.addColorStop(0, shade(b + 0.1));
      g.addColorStop(1, shade(b - 0.14));
      c.fillStyle = g;
      c.strokeStyle = g;
      c.lineWidth = 0.35;
      c.beginPath();
      c.moveTo(A[0], A[1]);
      c.lineTo(B[0], B[1]);
      c.lineTo(hub[0], hub[1]);
      c.closePath();
      c.fill();
      c.stroke();
    }
    // 접힌 선 (면 사이 모서리)
    c.lineWidth = 0.45;
    for (const p of pts) {
      const dot = ((p[0] - hub[0]) * LX + (p[1] - hub[1]) * LY) / (Math.hypot(p[0] - hub[0], p[1] - hub[1]) || 1);
      c.strokeStyle = dot > 0 ? `rgba(225,238,255,${0.1 + dot * 0.22})` : 'rgba(0,0,0,0.3)';
      c.beginPath();
      c.moveTo(hub[0], hub[1]);
      c.lineTo(p[0], p[1]);
      c.stroke();
    }
  }
  function rims(c, pts, hub, glow) {
    const n = pts.length;
    c.lineWidth = 0.8;
    c.strokeStyle = 'rgba(3,6,12,0.9)';
    poly(c, pts);
    c.stroke();
    for (let i = 0; i < n; i++) {
      const A = pts[i];
      const B = pts[(i + 1) % n];
      let nx = (A[0] + B[0]) / 2 - hub[0];
      let ny = (A[1] + B[1]) / 2 - hub[1];
      const d = Math.hypot(nx, ny) || 1;
      const dot = (nx / d) * LX + (ny / d) * LY;
      if (dot < -0.45 && glow) {
        // 아래쪽 모서리: 붉은 발광 줄 (적 표시)
        c.strokeStyle = `rgba(255,74,94,${0.25 + -dot * 0.45})`;
        c.lineWidth = 0.6;
        c.beginPath();
        c.moveTo(A[0] + (B[0] - A[0]) * 0.15, A[1] + (B[1] - A[1]) * 0.15);
        c.lineTo(A[0] + (B[0] - A[0]) * 0.85, A[1] + (B[1] - A[1]) * 0.85);
        c.stroke();
        continue;
      }
      if (dot <= 0.05) continue;
      c.strokeStyle = `rgba(235,245,255,${0.18 + dot * 0.6})`;
      c.lineWidth = 0.75;
      c.beginPath();
      c.moveTo(A[0], A[1]);
      c.lineTo(B[0], B[1]);
      c.stroke();
    }
  }
  const ring = (n, rx, ry, off) => Array.from({ length: n }, (_, i) => [Math.cos(off + (i / n) * TAU) * rx, Math.sin(off + (i / n) * TAU) * ry]);
  function shapeOf(kind, r) {
    const S = (pts) => pts.map(([x, y]) => [x * r, y * r]);
    if (kind === 'armor')
      return { pts: ring(6, 1.12 * r, 1.0 * r, 0), inner: ring(6, 0.6 * r, 0.54 * r, 0), hub: [0, 0], eye: [0, 0], ew: 1.0, eh: 0.42 };
    if (kind === 'charge') return { pts: S([[0, 1.8], [-0.85, -0.2], [-0.42, -1.0], [0, -0.55], [0.42, -1.0], [0.85, -0.2]]), hub: [0, 0.2 * r], eye: [0, 0.72 * r], ew: 0.55, eh: 0.55 };
    if (kind === 'boss') return { pts: ring(8, 1.15 * r, 1.15 * r, Math.PI / 8), inner: ring(8, 0.68 * r, 0.68 * r, 0), hub: [0, 0], eye: [0, 0], ew: 1.3, eh: 1.3 };
    const wing = [[-0.56, -0.5], [-1.44, -0.74], [-1.36, -0.4], [-0.68, 0.22]];
    return {
      pts: S([[0, 1.15], [-0.8, 0.05], [-0.5, -0.9], [0.5, -0.9], [0.8, 0.05]]),
      wings: [S(wing), S(wing.map(([x, y]) => [-x, y]).reverse())],
      tips: S([[-1.4, -0.57], [1.4, -0.57]]),
      hub: [0, 0.1 * r],
      eye: [0, 0.4 * r],
      ew: 0.8,
      eh: 0.5,
    };
  }
  function lens(c, x, y, rx, ry) {
    c.fillStyle = '#04070D';
    c.beginPath();
    c.ellipse(x, y, rx * 1.3, ry * 1.6, 0, 0, TAU);
    c.fill();
    const g = c.createLinearGradient(x - rx, 0, x + rx, 0);
    g.addColorStop(0, '#9E1328');
    g.addColorStop(0.5, '#FF6273');
    g.addColorStop(1, '#9E1328');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(255,232,236,0.95)';
    c.beginPath();
    c.ellipse(x - rx * 0.25, y - ry * 0.2, rx * 0.28, ry * 0.32, 0, 0, TAU);
    c.fill();
  }
  function paintEnemy(c, kind, d, r) {
    // 바닥 그림자 (떠 있는 드론)
    c.save();
    c.filter = `blur(${(r * 0.28 * 3).toFixed(1)}px)`;
    c.globalAlpha = 0.55;
    c.translate(r * 0.18, r * 0.6);
    c.fillStyle = '#000';
    poly(c, d.pts);
    c.fill();
    for (const wg of d.wings || []) poly(c, wg), c.fill();
    c.restore();
    if (d.wings)
      for (const wg of d.wings) {
        const hx = wg.reduce((a, p) => a + p[0], 0) / wg.length;
        const hy = wg.reduce((a, p) => a + p[1], 0) / wg.length;
        facets(c, wg, [hx, hy + r * 0.12], -0.08);
        rims(c, wg, [hx, hy], true);
      }
    facets(c, d.pts, d.hub, 0);
    if (d.inner) facets(c, d.inner, d.hub, kind === 'boss' ? -0.2 : -0.16);
    // 매끈한 윗면 반사
    c.save();
    poly(c, d.pts);
    c.clip();
    const sh = c.createRadialGradient(-r * 0.45, -r * 0.55, 0, -r * 0.45, -r * 0.55, r * 1.3);
    sh.addColorStop(0, 'rgba(255,255,255,0.22)');
    sh.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sh;
    c.fillRect(-r * 2, -r * 2, r * 4, r * 4);
    c.restore();
    rims(c, d.pts, d.hub, true);
    if (d.inner) {
      c.strokeStyle = 'rgba(0,0,0,0.6)';
      c.lineWidth = 0.9;
      poly(c, d.inner);
      c.stroke();
      c.strokeStyle = 'rgba(255,74,94,0.42)';
      c.lineWidth = 0.45;
      poly(c, d.inner);
      c.stroke();
    }
    if (d.tips) {
      c.fillStyle = '#FF6A7A';
      for (const [x, y] of d.tips) {
        c.beginPath();
        c.arc(x, y, Math.max(0.6, r * 0.06), 0, TAU);
        c.fill();
      }
    }
    // 눈
    if (kind === 'armor') {
      c.fillStyle = '#04070D';
      roundRect(c, -0.5 * r, -0.11 * r, 1.0 * r, 0.22 * r, 0.11 * r);
      c.fill();
      const g = c.createLinearGradient(-0.4 * r, 0, 0.4 * r, 0);
      g.addColorStop(0, '#9E1328');
      g.addColorStop(0.5, '#FF6273');
      g.addColorStop(1, '#9E1328');
      c.fillStyle = g;
      roundRect(c, -0.4 * r, -0.055 * r, 0.8 * r, 0.11 * r, 0.055 * r);
      c.fill();
    } else if (kind === 'boss') {
      c.fillStyle = '#04070D';
      c.beginPath();
      c.arc(0, 0, 0.38 * r, 0, TAU);
      c.fill();
      const g = c.createRadialGradient(-0.06 * r, -0.06 * r, 0, 0, 0, 0.27 * r);
      g.addColorStop(0, '#FFE4E8');
      g.addColorStop(0.35, '#FF5468');
      g.addColorStop(1, '#8A0F22');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 0.27 * r, 0, TAU);
      c.fill();
      c.strokeStyle = 'rgba(255,74,94,0.65)';
      c.lineWidth = 0.7;
      c.beginPath();
      c.arc(0, 0, 0.47 * r, 0, TAU);
      c.stroke();
      c.fillStyle = 'rgba(255,90,110,0.9)';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + Math.PI / 8;
        c.beginPath();
        c.arc(Math.cos(a) * 0.9 * r, Math.sin(a) * 0.9 * r, 0.035 * r + 0.5, 0, TAU);
        c.fill();
      }
    } else if (kind === 'charge') {
      c.strokeStyle = 'rgba(255,74,94,0.75)';
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(-0.78 * r, -0.12 * r);
      c.lineTo(0, 1.68 * r);
      c.lineTo(0.78 * r, -0.12 * r);
      c.stroke();
      lens(c, 0, 0.72 * r, 0.14 * r, 0.12 * r);
    } else {
      lens(c, 0, 0.42 * r, 0.28 * r, 0.1 * r);
    }
  }
  const EN = {};
  function enemyArt(kind, r) {
    const key = kind + r;
    if (EN[key]) return EN[key];
    const d = shapeOf(kind, r);
    const S = Math.ceil(r * 4.4);
    const body = sprite('glass-en-' + key, S, S, (c) => {
      c.translate(S / 2, S / 2);
      paintEnemy(c, kind, d, r);
    });
    const white = sprite('glass-enw-' + key, S, S, (c) => {
      c.translate(S / 2, S / 2);
      c.fillStyle = '#FFFFFF';
      poly(c, d.pts);
      c.fill();
      for (const wg of d.wings || []) poly(c, wg), c.fill();
    });
    return (EN[key] = { body, white, S, d });
  }
  const TRAIL = () =>
    sprite('glass-trail', 12, 40, (c) => {
      const g = c.createLinearGradient(0, 40, 0, 0);
      g.addColorStop(0, 'rgba(255,200,205,0.95)');
      g.addColorStop(0.25, 'rgba(255,74,94,0.55)');
      g.addColorStop(1, 'rgba(255,74,94,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(1.5, 40);
      c.lineTo(10.5, 40);
      c.lineTo(6, 0);
      c.closePath();
      c.fill();
    });

  // ── 무기 받침: 금속 육각 패드 ──
  function padSprite(s) {
    const w = s * 1.4;
    const h = s * 0.66;
    const cx = w / 2;
    const cy = s * 0.22;
    const spr = sprite('glass-pad-' + s, w, h, (c) => {
      const rx = s * 0.5;
      const ry = s * 0.18;
      const th = s * 0.09;
      c.save();
      c.filter = `blur(${(s * 0.07 * 3).toFixed(1)}px)`;
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.beginPath();
      c.ellipse(cx + s * 0.03, cy + th + s * 0.06, rx * 1.04, ry * 1.25, 0, 0, TAU);
      c.fill();
      c.restore();
      const P = (k, dy) => Array.from({ length: 6 }, (_, i) => [cx + Math.cos((i / 6) * TAU) * rx * k, cy + Math.sin((i / 6) * TAU) * ry * k + (dy || 0)]);
      const top = P(1);
      const sides = ['#1A2231', '#242E3F', '#334056'];
      for (let i = 0; i < 3; i++) {
        const A = top[i];
        const B = top[i + 1];
        const g = c.createLinearGradient(0, Math.min(A[1], B[1]), 0, Math.max(A[1], B[1]) + th);
        g.addColorStop(0, sides[i]);
        g.addColorStop(1, '#0A0E16');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(A[0], A[1]);
        c.lineTo(B[0], B[1]);
        c.lineTo(B[0], B[1] + th);
        c.lineTo(A[0], A[1] + th);
        c.closePath();
        c.fill();
      }
      // 아래 모서리 가는 빛
      c.strokeStyle = 'rgba(160,210,255,0.18)';
      c.lineWidth = 0.5;
      c.beginPath();
      c.moveTo(top[0][0], top[0][1] + th);
      c.lineTo(top[1][0], top[1][1] + th);
      c.lineTo(top[2][0], top[2][1] + th);
      c.lineTo(top[3][0], top[3][1] + th);
      c.stroke();
      const tg = c.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
      tg.addColorStop(0, '#6A778C');
      tg.addColorStop(0.42, '#364154');
      tg.addColorStop(0.7, '#283141');
      tg.addColorStop(1, '#4A566B');
      c.fillStyle = tg;
      poly(c, top);
      c.fill();
      // 가는 결 (안쪽 테)
      c.strokeStyle = 'rgba(255,255,255,0.07)';
      c.lineWidth = 0.4;
      poly(c, P(0.86));
      c.stroke();
      // 위 테: 뒤 모서리 밝게, 앞 모서리 옅게
      c.lineWidth = 0.7;
      for (let i = 0; i < 6; i++) {
        c.strokeStyle = i >= 3 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.16)';
        c.beginPath();
        c.moveTo(top[i][0], top[i][1]);
        c.lineTo(top[(i + 1) % 6][0], top[(i + 1) % 6][1]);
        c.stroke();
      }
      // 움푹한 안쪽
      const inn = P(0.7);
      const ig = c.createLinearGradient(0, cy - ry * 0.7, 0, cy + ry * 0.7);
      ig.addColorStop(0, '#1D2534');
      ig.addColorStop(0.55, '#0B1019');
      ig.addColorStop(1, '#070A11');
      c.fillStyle = ig;
      poly(c, inn);
      c.fill();
      c.lineWidth = 0.6;
      for (let i = 0; i < 3; i++) {
        c.strokeStyle = 'rgba(255,255,255,0.3)';
        c.beginPath();
        c.moveTo(inn[i][0], inn[i][1]);
        c.lineTo(inn[i + 1][0], inn[i + 1][1]);
        c.stroke();
      }
      // 나사
      c.fillStyle = 'rgba(220,235,255,0.35)';
      for (const p of P(0.86)) {
        c.beginPath();
        c.arc(p[0], p[1], s * 0.012 + 0.25, 0, TAU);
        c.fill();
      }
    });
    return { spr, w, h, cx, cy };
  }
  /** 빛기둥 (세계 색): 패드 고리에서 위로 옅어짐 */
  function coneSprite(col, s) {
    return sprite('glass-cone-' + col + s, s, s * 0.95, (c) => {
      const g = c.createLinearGradient(0, s * 0.95, 0, 0);
      g.addColorStop(0, rgba(col, 0.26));
      g.addColorStop(0.35, rgba(col, 0.08));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(s * 0.2, s * 0.95);
      c.lineTo(s * 0.8, s * 0.95);
      c.lineTo(s, 0);
      c.lineTo(0, 0);
      c.closePath();
      c.fill();
    });
  }

  // ── 판 바탕 움직이는 먼지 ──
  const MOTES = Array.from({ length: 26 }, () => ({ x: Math.random() * W, y: Math.random() * LINE_Y, sp: 4 + Math.random() * 9, a: 0.12 + Math.random() * 0.3, s: Math.random() < 0.3 ? 1.5 : 1 }));

  CX.defineTheme('glass', {
    name: '글래스 SF',
    desc: '남색·흑연 유리 패널 · 다면체 드론 · 흰·청 충격파 · 홀로그램 장벽',
    fonts: FONTS,

    bg(scale) {
      return bgCanvas(scale, (c) => {
        const g = c.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0E172A');
        g.addColorStop(0.45, '#0A1222');
        g.addColorStop(LINE_Y / H, '#070C17');
        g.addColorStop(1, '#060A12');
        c.fillStyle = g;
        c.fillRect(0, 0, W, H);
        const blob = (x, y, r, col) => {
          const rg = c.createRadialGradient(x, y, 0, x, y, r);
          rg.addColorStop(0, col);
          rg.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = rg;
          c.fillRect(0, 0, W, H);
        };
        blob(W * 0.5, -40, 300, 'rgba(64,150,230,0.15)');
        blob(-30, 300, 220, 'rgba(80,90,210,0.07)');
        blob(W + 30, 210, 230, 'rgba(40,170,210,0.06)');
        // 원근 바닥 격자 (위가 멀다)
        const HZ = -150;
        const span = LINE_Y - HZ;
        c.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
          const d = 1 + i * 0.26;
          const y = HZ + span / d;
          if (y < 2) break;
          c.strokeStyle = `rgba(150,200,255,${0.012 + 0.07 / d})`;
          c.beginPath();
          c.moveTo(0, Math.round(y) + 0.5);
          c.lineTo(W, Math.round(y) + 0.5);
          c.stroke();
        }
        const lg = c.createLinearGradient(0, 0, 0, LINE_Y);
        lg.addColorStop(0, 'rgba(150,200,255,0)');
        lg.addColorStop(1, 'rgba(150,200,255,0.075)');
        c.strokeStyle = lg;
        for (let j = -10; j <= 10; j++) {
          const xb = W / 2 + j * 40;
          const xt = W / 2 + ((xb - W / 2) * -HZ) / span;
          c.beginPath();
          c.moveTo(xt, 0);
          c.lineTo(xb, LINE_Y);
          c.stroke();
        }
        // 가장자리 어둡게
        for (const [x0, x1] of [
          [0, 70],
          [W, W - 70],
        ]) {
          const vg = c.createLinearGradient(x0, 0, x1, 0);
          vg.addColorStop(0, 'rgba(2,4,9,0.5)');
          vg.addColorStop(1, 'rgba(2,4,9,0)');
          c.fillStyle = vg;
          c.fillRect(Math.min(x0, x1), 0, 70, H);
        }
        // 오른쪽 거리 눈금
        for (let k = 1; LINE_Y - k * 16 > 70; k++) {
          const y = LINE_Y - k * 16 + 0.5;
          const major = k % 5 === 0;
          c.strokeStyle = major ? 'rgba(170,215,255,0.32)' : 'rgba(170,215,255,0.13)';
          c.beginPath();
          c.moveTo(W - 3, y);
          c.lineTo(W - (major ? 11 : 6), y);
          c.stroke();
        }
        // 갑판 (무기가 놓인 바닥)
        const dg = c.createLinearGradient(0, LINE_Y, 0, H);
        dg.addColorStop(0, '#132036');
        dg.addColorStop(0.22, '#0D1627');
        dg.addColorStop(1, '#070B13');
        c.fillStyle = dg;
        c.fillRect(0, LINE_Y, W, H - LINE_Y);
        c.save();
        c.beginPath();
        c.rect(0, LINE_Y + 2, W, H - LINE_Y);
        c.clip();
        c.strokeStyle = 'rgba(160,205,255,0.045)';
        c.lineWidth = 0.7;
        const R = 9;
        const dy = Math.sqrt(3) * R * 0.55;
        for (let q = 0, x = 0; x < W + R * 2; q++, x = q * R * 1.5) for (let y = LINE_Y + (q % 2 ? dy / 2 : 0); y < H + dy; y += dy) hexPath(c, x, y, R, 0.55), c.stroke();
        c.restore();
        // 갑판 이음 · 모서리 꺾쇠
        c.fillStyle = 'rgba(200,230,255,0.06)';
        c.fillRect(0, LINE_Y + 3, W, 1);
        c.strokeStyle = 'rgba(200,230,255,0.22)';
        c.lineWidth = 1;
        for (const [x, sx] of [
          [8, 1],
          [W - 8, -1],
        ]) {
          c.beginPath();
          c.moveTo(x + sx * 12, LINE_Y + 10);
          c.lineTo(x, LINE_Y + 10);
          c.lineTo(x, LINE_Y + 22);
          c.stroke();
        }
      });
    },

    sky(c, t) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      // 위 진입선: 적이 넘어오는 문턱
      c.globalAlpha = 0.75 + 0.25 * Math.sin(t * 1.6);
      c.drawImage(TOPGLOW(), 0, 0, W, 46);
      c.fillStyle = 'rgba(160,235,255,0.35)';
      c.fillRect(30, 0, W - 60, 1);
      // 훑는 띠
      const per = 7.5;
      const q = (t % per) / per;
      c.globalAlpha = Math.sin(q * Math.PI);
      c.drawImage(SCAN(), 0, -70 + q * (LINE_Y + 40), W, 70);
      // 먼지
      c.fillStyle = 'rgb(170,220,255)';
      for (const m of MOTES) {
        c.globalAlpha = m.a;
        c.fillRect(m.x, (m.y + t * m.sp) % LINE_Y, m.s, m.s);
      }
      c.restore();
    },

    enemy(c, e, t) {
      if (!e.alive && e.flash <= 0) return;
      const kind = e.boss ? 'boss' : e.type;
      const A = enemyArt(kind, e.r);
      const S = A.S;
      c.save();
      c.translate(e.x, e.y);
      if (!e.alive) {
        const k = 1 - e.flash / 0.12;
        c.globalAlpha = 1 - k;
        c.scale(1 + k * 0.4, 1 + k * 0.4);
        c.drawImage(A.white, -S / 2, -S / 2, S, S);
        c.restore();
        return;
      }
      const r = e.r;
      if (kind === 'charge') {
        const fl = 0.8 + 0.2 * Math.sin(t * 34 + e.ph * 7);
        c.globalCompositeOperation = 'lighter';
        c.drawImage(TRAIL(), -r * 0.42, -r * (0.75 + 2.6 * fl), r * 0.84, r * 2.6 * fl);
        c.globalCompositeOperation = 'source-over';
      }
      if (kind === 'boss') {
        const a0 = t * 0.9;
        c.strokeStyle = 'rgba(255,74,94,0.55)';
        c.lineWidth = 1.6;
        for (let i = 0; i < 8; i++) {
          c.beginPath();
          c.arc(0, 0, r * 1.42, a0 + (i / 8) * TAU, a0 + (i / 8) * TAU + 0.42);
          c.stroke();
        }
      }
      c.drawImage(A.body, -S / 2, -S / 2, S, S);
      // 눈 빛
      const pul = 0.65 + 0.35 * Math.sin(t * 5 + e.ph);
      const d = A.d;
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.85 * pul;
      const gw = r * d.ew * 1.6;
      const gh = r * d.eh * 1.6;
      c.drawImage(GLOW_R(), d.eye[0] - gw / 2, d.eye[1] - gh / 2, gw, gh);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      if (e.flash > 0) {
        c.globalAlpha = (e.flash / 0.12) * 0.8;
        c.drawImage(A.white, -S / 2, -S / 2, S, S);
        c.globalAlpha = 1;
      }
      if (e.slow > 0) {
        c.strokeStyle = 'rgba(170,225,255,0.75)';
        c.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + t;
          c.beginPath();
          c.arc(0, 0, r * 1.45, a, a + 0.6);
          c.stroke();
        }
      }
      // 체력 (보스 · 깎인 장갑)
      if (kind === 'boss') {
        c.strokeStyle = 'rgba(255,255,255,0.1)';
        c.lineWidth = 2.2;
        c.beginPath();
        c.arc(0, 0, r * 1.62, 0, TAU);
        c.stroke();
        c.strokeStyle = RED;
        c.beginPath();
        c.arc(0, 0, r * 1.62, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(e.hp / e.max, 0, 1));
        c.stroke();
      } else if (kind === 'armor' && e.hp < e.max) {
        const bw = r * 1.4;
        c.fillStyle = 'rgba(4,8,15,0.65)';
        c.fillRect(-bw / 2, r * 1.2, bw, 1.6);
        c.fillStyle = '#FF7A88';
        c.fillRect(-bw / 2, r * 1.2, bw * clamp(e.hp / e.max, 0, 1), 1.6);
      }
      c.restore();
    },

    boom(c, b) {
      const k = clamp(b.age / 0.55, 0, 1);
      c.save();
      c.globalCompositeOperation = 'lighter';
      if (b.leak) {
        c.globalAlpha = 1 - k;
        const s = 30 + k * 30;
        c.drawImage(GLOW_R(), b.x - s / 2, b.y - s / 2, s, s);
        const L = 60 + k * 120;
        c.drawImage(STREAK('r', RED), b.x - L / 2, b.y - 2, L, 4);
        c.strokeStyle = RED;
        c.lineWidth = 1.6;
        c.beginPath();
        c.arc(b.x, b.y, 6 + ease(k) * 22, Math.PI, TAU);
        c.stroke();
        c.restore();
        return;
      }
      const big = !!b.big;
      const R = b.r * (0.28 + ease(k) * 0.92);
      // 번짐
      if (k < 0.6) {
        const q = k / 0.6;
        const s = b.r * (big ? 2.8 : 2.1) * (0.55 + q * 0.65);
        c.globalAlpha = Math.pow(1 - q, 1.5);
        c.drawImage(GLOW(), b.x - s / 2, b.y - s / 2, s, s);
      }
      // 가로 빛줄
      if (k < 0.5) {
        const q = k / 0.5;
        const L = b.r * (big ? 4.4 : 3) * (0.6 + q * 0.6);
        c.globalAlpha = (1 - q) * 0.9;
        c.drawImage(STREAK('c', '#BFF8FF'), b.x - L / 2, b.y - 2, L, 4);
      }
      // 충격파 고리
      c.globalAlpha = Math.pow(1 - k, 1.8);
      c.strokeStyle = 'rgb(130,228,255)';
      c.lineWidth = (big ? 3.4 : 2.4) * (1 - k) + 0.5;
      c.beginPath();
      c.arc(b.x, b.y, R, 0, TAU);
      c.stroke();
      c.strokeStyle = 'rgb(255,255,255)';
      c.lineWidth = Math.max(0.5, (big ? 1.4 : 1) * (1 - k));
      c.beginPath();
      c.arc(b.x, b.y, R * 0.96, 0, TAU);
      c.stroke();
      if (big) {
        const k2 = clamp((k - 0.15) / 0.85, 0, 1);
        c.globalAlpha = (1 - k2) * 0.6;
        c.strokeStyle = 'rgb(94,233,245)';
        c.lineWidth = 1.2;
        c.beginPath();
        c.arc(b.x, b.y, b.r * (0.3 + ease(k2) * 1.5), 0, TAU);
        c.stroke();
      }
      // 조각
      const n = big ? 7 : 5;
      const seed = b.x * 0.37 + b.y * 0.11;
      c.globalAlpha = 1 - k;
      c.strokeStyle = 'rgb(215,250,255)';
      c.lineWidth = 1.1;
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const an = seed + (i / n) * TAU + Math.sin(seed + i) * 0.4;
        const d1 = R * 0.8 + b.r * 0.15;
        const d2 = d1 + b.r * 0.32 * (1 - k);
        c.moveTo(b.x + Math.cos(an) * d1, b.y + Math.sin(an) * d1);
        c.lineTo(b.x + Math.cos(an) * d2, b.y + Math.sin(an) * d2);
      }
      c.stroke();
      c.restore();
    },

    seam(c, s) {
      const k = clamp(s.age / 0.3, 0, 1);
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.lineCap = 'round';
      c.strokeStyle = `rgba(94,233,245,${0.5 * (1 - k)})`;
      c.lineWidth = 2.6;
      c.beginPath();
      c.moveTo(s.x1, s.y1);
      c.lineTo(s.x2, s.y2);
      c.stroke();
      c.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`;
      c.lineWidth = 0.8;
      c.stroke();
      const p = ease(Math.min(1, k * 1.8));
      const sz = 13;
      c.globalAlpha = 1 - k;
      c.drawImage(GLOW(), s.x1 + (s.x2 - s.x1) * p - sz / 2, s.y1 + (s.y2 - s.y1) * p - sz / 2, sz, sz);
      c.restore();
    },

    num(c, n) {
      const a = n.age > 0.5 ? 1 - (n.age - 0.5) / 0.3 : 1;
      const pop = 1 + 0.3 * Math.max(0, 1 - n.age / 0.12);
      const size = n.kind === 2 ? 18 : n.kind === 1 ? 14.5 : 11.5;
      c.save();
      c.globalAlpha = clamp(a, 0, 1);
      c.translate(n.x, n.y);
      c.scale(pop, pop);
      c.font = `700 ${size}px ${FN}`;
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.lineJoin = 'round';
      const s = String(n.v);
      if (n.kind === 2) {
        c.strokeStyle = 'rgba(94,233,245,0.45)';
        c.lineWidth = 6;
        c.strokeText(s, 0, 0);
      }
      c.strokeStyle = 'rgba(3,7,15,0.88)';
      c.lineWidth = 3;
      c.strokeText(s, 0, 0);
      c.fillStyle = n.kind === 2 ? '#FFFFFF' : n.kind === 1 ? '#7FF4FF' : '#E3ECF8';
      c.fillText(s, 0, 0);
      c.restore();
    },

    line(c, t) {
      c.save();
      // 갑판 아래 띠 (캔버스 맨 아래 36px)
      const bg = c.createLinearGradient(0, H, 0, H + 40);
      bg.addColorStop(0, '#060A12');
      bg.addColorStop(1, '#05080F');
      c.fillStyle = bg;
      c.fillRect(0, H, W, 40);
      c.globalCompositeOperation = 'lighter';
      // 홀로그램 막
      c.globalAlpha = 0.8 + 0.2 * Math.sin(t * 2.2);
      c.drawImage(MEMBRANE(), 0, LINE_Y - 34, W, 34);
      const sx = ((t * 95) % (W + 260)) - 130;
      c.globalAlpha = 1;
      c.drawImage(SWEEP(), sx - 60, LINE_Y - 30, 120, 30);
      // 막의 빛줄
      c.fillStyle = 'rgba(94,233,245,0.32)';
      c.fillRect(0, LINE_Y - 2, W, 4);
      c.fillStyle = 'rgba(230,252,255,0.95)';
      c.fillRect(0, LINE_Y - 0.5, W, 1);
      c.globalCompositeOperation = 'source-over';
      // 막을 띄우는 기둥
      for (let i = 0; i < 5; i++) {
        const x = 18 + i * 81;
        c.fillStyle = '#18212F';
        roundRect(c, x - 3.5, LINE_Y - 4.5, 7, 9, 2);
        c.fill();
        c.strokeStyle = 'rgba(220,240,255,0.4)';
        c.lineWidth = 0.8;
        c.stroke();
        c.fillStyle = `rgba(150,245,255,${0.6 + 0.4 * Math.sin(t * 3 + i)})`;
        c.fillRect(x - 1, LINE_Y - 1, 2, 2);
      }
      c.restore();
    },

    chain(c, n, since) {
      const pop = 1 + 0.32 * Math.max(0, 1 - since / 0.16);
      const a = since > 0.8 ? 1 - (since - 0.8) / 0.3 : 1;
      c.save();
      c.globalAlpha = clamp(a, 0, 1);
      c.translate(W / 2, 196);
      c.scale(pop, pop);
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      // 라벨
      c.font = `700 11px ${FN}`;
      spaced(c, 4);
      c.fillStyle = CY;
      c.fillText('CHAIN', 2, -46);
      spaced(c, 0);
      c.fillStyle = 'rgba(94,233,245,0.6)';
      c.fillRect(-58, -50, 26, 1);
      c.fillRect(32, -50, 26, 1);
      // 숫자
      c.font = `700 56px ${FN}`;
      const g = c.createLinearGradient(0, -36, 0, 12);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(1, n >= 10 ? '#8FF6FF' : '#DCEBFF');
      c.shadowColor = 'rgba(94,233,245,0.85)';
      c.shadowBlur = 18;
      c.fillStyle = g;
      c.fillText(String(n), 0, 12);
      c.shadowBlur = 0;
      // 이어 갈 시간
      const left = clamp(1 - since / 1.3, 0, 1);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(-30, 22, 60, 2);
      c.fillStyle = CY;
      c.fillRect(-30, 22, 60 * left, 2);
      c.restore();
    },

    base(c, w, x, y, s, t) {
      const col = wc(w.world);
      const P = padSprite(s);
      const py = y + s * 0.36;
      c.drawImage(P.spr, x - P.w / 2, py - P.cy, P.w, P.h);
      c.save();
      c.globalCompositeOperation = 'lighter';
      // 빛기둥
      c.globalAlpha = 0.9;
      c.drawImage(coneSprite(col, s), x - s / 2, py - s * 0.95, s, s * 0.95);
      // 빛 고리
      const rx = s * 0.3;
      const ry = rx * 0.36;
      const pul = 0.75 + 0.25 * Math.sin(t * 2.4 + x * 0.05);
      const sub = w.sub ? wc(w.subWorld) : null;
      const arcs = sub
        ? [
            [col, Math.PI / 2, Math.PI * 1.5],
            [sub, -Math.PI / 2, Math.PI / 2],
          ]
        : [[col, 0, TAU]];
      for (const [cc, a0, a1] of arcs) {
        c.globalAlpha = 0.35 * pul;
        c.strokeStyle = cc;
        c.lineWidth = 3.2;
        c.beginPath();
        c.ellipse(x, py, rx, ry, 0, a0, a1);
        c.stroke();
        c.globalAlpha = 0.95;
        c.lineWidth = 1.1;
        c.stroke();
      }
      // 같은 세계 합성 = 공명: 그 세계 색 육각이 퍼진다
      if (w.sub && w.world === w.subWorld) {
        for (let k = 0; k < 2; k++) {
          const ph = (t * 0.8 + k * 0.5) % 1;
          c.globalAlpha = 0.7 * (1 - ph);
          c.strokeStyle = col;
          c.lineWidth = 1.4;
          hexPath(c, x, py, s * (0.5 + ph * 0.35), 0.36);
          c.stroke();
        }
      }
      c.restore();
    },

    pips(c, w, x, y, s) {
      const n = 5;
      const bw = 4.2;
      const gap = 1.6;
      const tot = n * bw + (n - 1) * gap;
      const px = x - tot / 2;
      const py = y + s * 0.68;
      c.fillStyle = 'rgba(4,8,15,0.72)';
      roundRect(c, px - 3, py - 2.6, tot + 6, 5.2, 2.6);
      c.fill();
      for (let i = 0; i < n; i++) {
        c.fillStyle = i < w.lv ? (w.lv >= 5 ? CY_HI : CY) : 'rgba(150,175,205,0.25)';
        c.fillRect(px + i * (bw + gap), py - 0.9, bw, 1.8);
      }
    },

    pop(c, p) {
      const k = p.age / 1.6;
      c.globalAlpha = k < 0.75 ? 1 : Math.max(0, 1 - (k - 0.75) / 0.25);
      const isNew = p.text === 'NEW';
      const ty = p.w.y - GUN * 0.82 - ease(Math.min(1, p.age / 0.3)) * 14;
      c.font = `700 10.5px ${FN}`;
      spaced(c, isNew ? 1.5 : 0.3);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const tw = c.measureText(p.text).width + 14;
      roundRect(c, p.w.x - tw / 2, ty - 8.5, tw, 17, 8.5);
      if (isNew) {
        c.fillStyle = CY;
        c.fill();
        c.fillStyle = NAVY;
      } else {
        c.fillStyle = 'rgba(8,14,26,0.92)';
        c.fill();
        c.strokeStyle = 'rgba(94,233,245,0.85)';
        c.lineWidth = 1;
        c.stroke();
        c.fillStyle = CY_HI;
      }
      c.fillText(p.text, p.w.x + (isNew ? 0.75 : 0), ty + 0.5);
      spaced(c, 0);
    },

    hurt(c, run, k) {
      const g = c.createRadialGradient(W / 2, 250, 140, W / 2, 250, 390);
      g.addColorStop(0, 'rgba(255,60,80,0)');
      g.addColorStop(1, `rgba(255,60,80,${0.42 * k})`);
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'lighter';
      const m = c.createLinearGradient(0, LINE_Y - 30, 0, LINE_Y);
      m.addColorStop(0, 'rgba(255,74,94,0)');
      m.addColorStop(1, `rgba(255,74,94,${0.4 * k})`);
      c.fillStyle = m;
      c.fillRect(0, LINE_Y - 30, W, 30);
      c.fillStyle = `rgba(255,90,110,${k})`;
      c.fillRect(0, LINE_Y - 1, W, 2);
    },

    hud(c, run) {
      const oy = run.oy;
      const g = c.createLinearGradient(0, 0, 0, oy);
      g.addColorStop(0, '#0F182B');
      g.addColorStop(1, '#0A111F');
      c.fillStyle = g;
      c.fillRect(0, 0, W, oy);
      c.fillStyle = 'rgba(200,225,255,0.12)';
      c.fillRect(0, oy - 1, W, 1);
      c.textBaseline = 'alphabetic';
      // 목숨: 하트 + 칸 다섯
      glass(c, 10, 11, 122, 30, 15);
      heartPath(c, 26, 26.5, 6.4);
      c.fillStyle = '#FF5D73';
      c.fill();
      const lostFlash = run.hurt > 0 ? run.hurt / 0.6 : 0;
      for (let i = 0; i < 5; i++) {
        const x = 40 + i * 17.5;
        const y = 22.5;
        c.beginPath();
        c.moveTo(x + 2.5, y);
        c.lineTo(x + 14, y);
        c.lineTo(x + 11.5, y + 8);
        c.lineTo(x, y + 8);
        c.closePath();
        if (i < run.hearts) {
          const cg = c.createLinearGradient(0, y, 0, y + 8);
          cg.addColorStop(0, '#FFFFFF');
          cg.addColorStop(1, '#9FEFF8');
          c.fillStyle = cg;
          c.fill();
        } else {
          c.strokeStyle = 'rgba(169,184,204,0.4)';
          c.lineWidth = 1;
          c.stroke();
          if (lostFlash > 0 && i === run.hearts) {
            c.fillStyle = `rgba(255,74,94,${lostFlash})`;
            c.fill();
          }
        }
      }
      // LV: 육각 배지
      const cx = W / 2;
      const cy = 27;
      hexPath(c, cx, cy, 22, 0.86);
      c.fillStyle = 'rgba(9,15,27,0.9)';
      c.fill();
      const hg = c.createLinearGradient(0, cy - 19, 0, cy + 19);
      hg.addColorStop(0, 'rgba(94,233,245,0.22)');
      hg.addColorStop(1, 'rgba(94,233,245,0.02)');
      c.fillStyle = hg;
      c.fill();
      c.strokeStyle = 'rgba(94,233,245,0.7)';
      c.lineWidth = 1.1;
      c.stroke();
      c.textAlign = 'center';
      c.fillStyle = MUTE;
      c.font = `700 7.5px ${FN}`;
      spaced(c, 1.5);
      c.fillText('LV', cx + 0.75, cy - 7);
      spaced(c, 0);
      c.fillStyle = INK;
      c.font = `700 18px ${FN}`;
      c.fillText(String(run.level), cx, cy + 10);
      // 웨이브
      const boss = run.wave % 5 === 0;
      glass(c, W - 108, 11, 98, 30, 15, boss ? { edge: 'rgba(255,74,94,0.6)' } : null);
      c.textAlign = 'left';
      c.fillStyle = boss ? '#FF8794' : MUTE;
      c.font = `700 9px ${FN}`;
      spaced(c, 1.6);
      c.fillText('WAVE', W - 94, 30);
      spaced(c, 0);
      c.textAlign = 'right';
      c.fillStyle = INK;
      c.font = `700 19px ${FN}`;
      c.fillText(String(run.wave).padStart(2, '0'), W - 22, 33);
      // 경험치
      const k = clamp(run.exp / run.need, 0, 1);
      const bx = 10;
      const bw = W - 20;
      c.fillStyle = 'rgba(255,255,255,0.07)';
      roundRect(c, bx, 52, bw, 3, 1.5);
      c.fill();
      const eg = c.createLinearGradient(bx, 0, bx + bw, 0);
      eg.addColorStop(0, '#2696B8');
      eg.addColorStop(0.6, CY);
      eg.addColorStop(1, CY_HI);
      c.fillStyle = eg;
      roundRect(c, bx, 52, Math.max(3, bw * k), 3, 1.5);
      c.fill();
      c.globalCompositeOperation = 'lighter';
      c.drawImage(GLOW(), bx + bw * k - 7, 46.5, 14, 14);
      c.globalCompositeOperation = 'source-over';
    },

    chips(c, run) {
      const m = run.worlds();
      let y = 10;
      for (const k of ORDER) {
        if (!m[k]) continue;
        const wo = CX.wo(k);
        glass(c, 8, y, 44, 22, 11, { edge: rgba(wc(k), 0.5), top: 0.3 });
        c.save();
        wo.crest(c, 12, y + 4, 7);
        c.restore();
        c.textBaseline = 'middle';
        c.textAlign = 'right';
        const ns = String(m[k]);
        c.font = `700 12px ${FN}`;
        const nw = c.measureText(ns).width;
        c.fillStyle = INK;
        c.fillText(ns, 45, y + 11.5);
        c.font = `500 9px ${FN}`;
        c.fillStyle = MUTE;
        c.fillText('×', 44 - nw, y + 11.5);
        y += 26;
      }
    },

    gate(c, run) {
      const n = run.cats().size;
      const next = CAT_TH.find((tt) => tt > n) || 15;
      const slots = run.fuseSlots();
      const y = 10;
      const h = 22;
      const p1 = '갈래';
      const p2 = `${n}/${next}`;
      const p3 = '합성 칸';
      c.font = `500 10.5px ${FK}`;
      const w1 = c.measureText(p1).width;
      const w3 = c.measureText(p3).width;
      c.font = `700 11px ${FN}`;
      const w2 = c.measureText(p2).width;
      const tot = 10 + w1 + 4 + w2 + 14 + w3 + 5 + 14 + 5;
      const x0 = W - 8 - tot;
      glass(c, x0, y, tot, h, 11, slots > 0 ? { edge: 'rgba(94,233,245,0.7)', top: 0.3 } : { top: 0.3 });
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      let x = x0 + 10;
      c.font = `500 10.5px ${FK}`;
      c.fillStyle = MUTE;
      c.fillText(p1, x, y + h / 2 + 0.5);
      x += w1 + 4;
      c.font = `700 11px ${FN}`;
      c.fillStyle = INK;
      c.fillText(p2, x, y + h / 2 + 0.5);
      x += w2 + 7;
      c.fillStyle = 'rgba(220,235,255,0.18)';
      c.fillRect(x, y + 6, 1, h - 12);
      x += 7;
      c.font = `500 10.5px ${FK}`;
      c.fillStyle = slots > 0 ? CY_HI : MUTE;
      c.fillText(p3, x, y + h / 2 + 0.5);
      x += w3 + 5 + 7;
      c.beginPath();
      c.arc(x, y + h / 2, 7, 0, TAU);
      if (slots > 0) {
        c.fillStyle = CY;
        c.fill();
      } else {
        c.strokeStyle = 'rgba(169,184,204,0.45)';
        c.lineWidth = 1;
        c.stroke();
      }
      c.textAlign = 'center';
      c.font = `700 10px ${FN}`;
      c.fillStyle = slots > 0 ? NAVY : MUTE;
      c.fillText(String(slots), x, y + h / 2 + 0.5);
    },

    banner(c, b, run) {
      const k = b.age / b.life;
      const a = clamp(k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1, 0, 1);
      const e = ease(Math.min(1, b.age / 0.4));
      c.save();
      c.globalAlpha = a;
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      if (b.wave) {
        const m = /WAVE\s+(\d+)/.exec(b.text);
        const num = m ? m[1].padStart(2, '0') : String(run.wave).padStart(2, '0');
        const boss = b.text.indexOf('·') >= 0;
        const y = 150;
        const label = `WAVE ${num}`;
        c.font = `700 30px ${FN}`;
        spaced(c, 6);
        const tw = c.measureText(label).width;
        const L = 64 * e;
        const lc = boss ? '255,74,94' : '94,233,245';
        // 뒤 띠: 바쁜 판 위에서도 읽히게
        const band = c.createLinearGradient(0, 0, W, 0);
        band.addColorStop(0, 'rgba(4,8,16,0)');
        band.addColorStop(0.5, 'rgba(4,8,16,0.72)');
        band.addColorStop(1, 'rgba(4,8,16,0)');
        c.fillStyle = band;
        c.fillRect(0, y - 36, W, 70);
        const edge = c.createLinearGradient(0, 0, W, 0);
        edge.addColorStop(0, `rgba(${lc},0)`);
        edge.addColorStop(0.5, `rgba(${lc},0.35)`);
        edge.addColorStop(1, `rgba(${lc},0)`);
        c.fillStyle = edge;
        c.fillRect(0, y - 36, W, 1);
        c.fillRect(0, y + 33, W, 1);
        for (const s of [-1, 1]) {
          const x0 = W / 2 + s * (tw / 2 + 10);
          const lg = c.createLinearGradient(x0, 0, x0 + s * L, 0);
          lg.addColorStop(0, `rgba(${lc},0.9)`);
          lg.addColorStop(1, `rgba(${lc},0)`);
          c.fillStyle = lg;
          c.fillRect(Math.min(x0, x0 + s * L), y - 11, L, 1.2);
        }
        c.shadowColor = `rgba(${lc},0.7)`;
        c.shadowBlur = 16;
        c.fillStyle = '#FFFFFF';
        c.fillText(label, W / 2 + 3, y + (1 - e) * 6);
        c.shadowBlur = 0;
        spaced(c, boss ? 1 : 3);
        c.font = boss ? `700 11.5px ${FK}` : `500 10px ${FN}`;
        c.fillStyle = boss ? '#FF8794' : MUTE;
        c.fillText(boss ? '경고 · 지휘 모함 접근' : 'INCOMING', W / 2 + (boss ? 0.5 : 1.5), y + 22);
        spaced(c, 0);
      } else {
        const y = 118;
        const bw = W - 56;
        const bh = 64;
        const x = 28;
        c.translate(0, (1 - e) * -8);
        const fw = (run.owned || []).find((w) => w.sub && '합성 · ' + w.name === b.text);
        glass(c, x, y, bw, bh, 14, { base: 'rgba(8,14,26,0.9)', edge: 'rgba(94,233,245,0.65)', sheen: 0.16 });
        if (fw) {
          const lg = c.createLinearGradient(x + 20, 0, x + bw - 20, 0);
          lg.addColorStop(0, wc(fw.world));
          lg.addColorStop(1, wc(fw.subWorld));
          c.fillStyle = lg;
          c.fillRect(x + 20, y + bh - 1.5, bw - 40, 1.5);
          c.save();
          CX.wo(fw.world).crest(c, x + 12, y + 12, 7);
          c.restore();
          c.save();
          CX.wo(fw.subWorld).crest(c, x + bw - 26, y + 12, 7);
          c.restore();
        }
        c.font = `700 9.5px ${FN}`;
        spaced(c, 3);
        c.fillStyle = CY;
        c.fillText('FUSION', W / 2 + 1.5, y + 17);
        spaced(c, 0);
        const name = b.text.replace(/^합성\s*·\s*/, '');
        c.fillStyle = INK;
        c.font = `700 18px ${FK}`;
        c.fillText(name, W / 2, y + 39, bw - 60);
        c.fillStyle = MUTE;
        c.font = `500 10.5px ${FK}`;
        c.fillText(b.sub, W / 2, y + 55, bw - 40);
      }
      c.restore();
    },

    offer(c, o, run) {
      const t = o.age;
      const a = Math.min(1, t / 0.2);
      c.save();
      c.fillStyle = `rgba(3,6,13,${0.82 * a})`;
      c.fillRect(0, -run.oy, W, run.ch);
      const rg = c.createRadialGradient(W / 2, 96, 0, W / 2, 96, 280);
      rg.addColorStop(0, `rgba(94,233,245,${0.13 * a})`);
      rg.addColorStop(1, 'rgba(94,233,245,0)');
      c.fillStyle = rg;
      c.fillRect(0, -run.oy, W, run.ch);
      // 제목 뒤 띠: 아래 판(연쇄 수 등)이 비치지 않게
      const hb = c.createLinearGradient(0, 62, 0, 136);
      hb.addColorStop(0, 'rgba(3,6,13,0)');
      hb.addColorStop(0.3, `rgba(3,6,13,${0.6 * a})`);
      hb.addColorStop(1, `rgba(3,6,13,${0.6 * a})`);
      c.fillStyle = hb;
      c.fillRect(0, 62, W, 74);
      const te = ease(clamp(t / 0.3, 0, 1));
      c.globalAlpha = te;
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.font = `700 26px ${FN}`;
      spaced(c, 5);
      const tw = c.measureText('LEVEL UP').width;
      c.fillStyle = INK;
      c.fillText('LEVEL UP', W / 2 + 2.5, 102 + (1 - te) * 8);
      spaced(c, 0);
      for (const s of [-1, 1]) {
        const x0 = W / 2 + s * (tw / 2 + 8);
        const lg = c.createLinearGradient(x0, 0, x0 + s * 46, 0);
        lg.addColorStop(0, 'rgba(94,233,245,0.8)');
        lg.addColorStop(1, 'rgba(94,233,245,0)');
        c.fillStyle = lg;
        c.fillRect(Math.min(x0, x0 + s * 46), 93, 46, 1);
      }
      c.font = `700 11.5px ${FN}`;
      spaced(c, 1.2);
      c.fillStyle = CY;
      c.fillText(`LV ${o.from}  →  ${o.from + 1}`, W / 2 + 0.6, 123);
      spaced(c, 0);
      c.globalAlpha = 1;
      o.cards.forEach((cd, i) => {
        const r = CX.runInfo.card(i);
        const enter = ease(clamp((t - i * 0.08) / 0.32, 0, 1));
        const picked = o.pick === i;
        const faded = o.pick >= 0 && !picked;
        c.save();
        c.globalAlpha = enter * (faded ? 0.32 : 1);
        c.translate(0, (1 - enter) * 22);
        if (picked) {
          const s = 1 + 0.03 * Math.sin(Math.min(1, (t - o.pickAt) / 0.2) * Math.PI);
          c.translate(W / 2, r.y + r.h / 2);
          c.scale(s, s);
          c.translate(-W / 2, -(r.y + r.h / 2));
        }
        CX.th().card(c, cd, r.x, r.y, r.w, r.h, picked, run);
        c.restore();
      });
      if (!run.auto && o.pick < 0) {
        const r = CX.runInfo.card(3);
        c.fillStyle = MUTE;
        c.font = `500 11px ${FK}`;
        c.textAlign = 'center';
        c.fillText('카드를 눌러 고른다', W / 2, r.y + 4);
      }
      c.restore();
    },

    card(c, cd, x, y, w, h, picked, run) {
      const v = cd.view;
      const fuse = cd.kind === 'fuse';
      const main = wc(v.world);
      const sub = v.sub ? wc(v.subWorld) : null;
      glass(c, x, y, w, h, 14, {
        base: 'rgba(10,17,31,0.94)',
        edge: picked ? CY : fuse ? 'rgba(94,233,245,0.55)' : 'rgba(220,235,255,0.15)',
        lw: picked ? 1.8 : 1,
      });
      if (picked) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.shadowColor = 'rgba(94,233,245,0.9)';
        c.shadowBlur = 16;
        c.strokeStyle = 'rgba(94,233,245,0.6)';
        c.lineWidth = 1.2;
        roundRect(c, x, y, w, h, 14);
        c.stroke();
        c.restore();
        // 훑는 빛
        const o = run.offer;
        const q = o ? clamp((o.age - o.pickAt) / 0.45, 0, 1) : 1;
        if (q < 1) {
          c.save();
          roundRect(c, x, y, w, h, 14);
          c.clip();
          const sx = x - 80 + q * (w + 160);
          const sg = c.createLinearGradient(sx - 50, y, sx + 50, y + h);
          sg.addColorStop(0, 'rgba(190,250,255,0)');
          sg.addColorStop(0.5, 'rgba(190,250,255,0.22)');
          sg.addColorStop(1, 'rgba(190,250,255,0)');
          c.fillStyle = sg;
          c.globalCompositeOperation = 'lighter';
          c.fillRect(x, y, w, h);
          c.restore();
        }
      }
      // 왼쪽 세계 색 띠
      if (sub) {
        const sg = c.createLinearGradient(0, y + 16, 0, y + h - 16);
        sg.addColorStop(0, main);
        sg.addColorStop(1, sub);
        c.fillStyle = sg;
      } else c.fillStyle = main;
      roundRect(c, x + 1, y + 18, 2.5, h - 36, 1.25);
      c.fill();
      // 진열 칸 (무기가 놓인 자리)
      const bx = x + 10;
      const by = y + 9;
      const bw = 82;
      const bh = h - 18;
      c.save();
      roundRect(c, bx, by, bw, bh, 10);
      c.fillStyle = 'rgba(3,7,14,0.75)';
      c.fill();
      c.clip();
      const gl = c.createRadialGradient(bx + bw / 2, by + bh * 0.78, 2, bx + bw / 2, by + bh * 0.78, bw * 0.75);
      gl.addColorStop(0, rgba(main, 0.26));
      gl.addColorStop(1, rgba(main, 0));
      c.fillStyle = gl;
      c.fillRect(bx, by, bw, bh);
      if (sub) {
        const g2 = c.createRadialGradient(bx + bw * 0.85, by + bh * 0.2, 2, bx + bw * 0.85, by + bh * 0.2, bw * 0.55);
        g2.addColorStop(0, rgba(sub, 0.2));
        g2.addColorStop(1, rgba(sub, 0));
        c.fillStyle = g2;
        c.fillRect(bx, by, bw, bh);
      }
      c.restore();
      roundRect(c, bx, by, bw, bh, 10);
      c.strokeStyle = 'rgba(220,235,255,0.08)';
      c.lineWidth = 1;
      c.stroke();
      c.save();
      CX.drawGun(c, v, bx + bw / 2, by + bh / 2 + 6, 46, run.t);
      c.restore();
      // 글
      const tx = x + 104;
      const tw = w - 114;
      const wn = (k) => CX.wo(k).name;
      let chip;
      let meta;
      let name;
      let lvTxt = '';
      let l1;
      let l2 = '';
      if (fuse) {
        chip = '합성';
        meta = `칸 ${run.fuseSlots()} 중 1 · 등급 ${Math.min(cd.a.lv, cd.b.lv)}`;
        name = v.name;
        l1 = `몸 ${cd.a.name} (${CX.wo(cd.a.world).short}) + 연출 ${cd.b.name} (${CX.wo(cd.b.world).short})`;
        l2 = `반응 · ${v.react}`;
      } else if (cd.kind === 'new') {
        const own = run.worlds();
        chip = '새 무기';
        meta = `${wn(v.world)} · ${v.catLabel}${own[v.world] ? '' : ' · 새 세계'}`;
        name = v.name;
        const left = (CAT_TH.find((tt) => tt > run.cats().size) || 15) - run.cats().size - 1;
        l1 = run.cats().has(v.cat) ? `${v.catLabel} 갈래 하나 더` : left <= 0 ? '새 갈래 · 이걸로 합성 칸이 열린다' : `새 갈래 · 합성 칸까지 갈래 ${left}`;
      } else {
        chip = '강화';
        meta = `${wn(v.world)} · ${v.catLabel}`;
        name = v.name;
        lvTxt = `Lv ${v.lv} → ${v.lv + 1}`;
        l1 = '피해 +28% · 쿨다운 −6%';
      }
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.font = `700 10px ${FK}`;
      const cw = c.measureText(chip).width + 14;
      roundRect(c, tx, y + 12, cw, 17, 8.5);
      if (fuse) {
        c.fillStyle = CY;
        c.fill();
        c.fillStyle = NAVY;
      } else if (cd.kind === 'new') {
        c.fillStyle = 'rgba(242,247,255,0.94)';
        c.fill();
        c.fillStyle = '#0A1120';
      } else {
        c.fillStyle = 'rgba(94,233,245,0.12)';
        c.fill();
        c.strokeStyle = 'rgba(94,233,245,0.7)';
        c.lineWidth = 1;
        c.stroke();
        c.fillStyle = CY_HI;
      }
      c.fillText(chip, tx + 7, y + 21);
      c.font = `500 10.5px ${FK}`;
      c.fillStyle = MUTE;
      c.fillText(meta, tx + cw + 7, y + 21, tw - cw - 7);
      c.textBaseline = 'alphabetic';
      c.font = `700 17px ${FK}`;
      c.fillStyle = INK;
      const nmax = lvTxt ? tw - 76 : tw;
      c.fillText(name, tx, y + 52, nmax);
      if (lvTxt) {
        const nw = Math.min(nmax, c.measureText(name).width);
        c.font = `700 12.5px ${FN}`;
        c.fillStyle = CY;
        c.fillText(lvTxt, tx + nw + 8, y + 51);
      }
      c.font = `500 11px ${FK}`;
      c.fillStyle = MUTE;
      c.fillText(l1, tx, y + 72, tw);
      if (l2) {
        c.font = `700 11px ${FK}`;
        c.fillStyle = CY_HI;
        c.fillText(l2, tx, y + 89, tw);
      }
    },

    over(c, run) {
      const a = Math.min(1, run.over / 0.4);
      const e = ease(Math.min(1, run.over / 0.6));
      c.save();
      c.fillStyle = `rgba(3,6,13,${0.86 * a})`;
      c.fillRect(0, -run.oy, W, run.ch);
      const rg = c.createRadialGradient(W / 2, 200, 0, W / 2, 200, 240);
      rg.addColorStop(0, `rgba(255,74,94,${0.16 * a})`);
      rg.addColorStop(1, 'rgba(255,74,94,0)');
      c.fillStyle = rg;
      c.fillRect(0, -run.oy, W, run.ch);
      c.globalAlpha = a;
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.font = `700 11px ${FN}`;
      spaced(c, 4);
      c.fillStyle = '#FF8794';
      c.fillText('BARRIER DOWN', W / 2 + 2, 176);
      spaced(c, 0);
      c.font = `700 30px ${FK}`;
      c.fillStyle = INK;
      c.fillText('장벽 붕괴', W / 2, 214 + (1 - e) * 8);
      c.fillStyle = 'rgba(255,74,94,0.8)';
      c.fillRect(W / 2 - 24 * e, 230, 48 * e, 1.5);
      const stats = [
        ['웨이브', run.wave],
        ['LV', run.level],
        ['최고 연쇄', run.chainPeak],
        ['합성', run.fusedN],
      ];
      const gap = 8;
      const tw = (W - 48 - gap * 3) / 4;
      stats.forEach(([lb, val], i) => {
        const x = 24 + i * (tw + gap);
        const y = 252 + (1 - ease(clamp((run.over - 0.15 - i * 0.06) / 0.4, 0, 1))) * 10;
        glass(c, x, y, tw, 60, 12, { top: 0.3 });
        c.font = `500 10px ${FK}`;
        c.fillStyle = MUTE;
        c.fillText(lb, x + tw / 2, y + 21);
        c.font = `700 21px ${FN}`;
        c.fillStyle = INK;
        c.fillText(String(val), x + tw / 2, y + 47);
      });
      c.font = `500 11.5px ${FK}`;
      c.fillStyle = MUTE;
      c.fillText('잠시 뒤 새 판', W / 2, 352);
      const pk = clamp(run.over / 4, 0, 1);
      c.fillStyle = 'rgba(255,255,255,0.1)';
      roundRect(c, W / 2 - 60, 364, 120, 3, 1.5);
      c.fill();
      c.fillStyle = CY;
      roundRect(c, W / 2 - 60, 364, Math.max(3, 120 * pk), 3, 1.5);
      c.fill();
      c.restore();
    },
  });
})();
