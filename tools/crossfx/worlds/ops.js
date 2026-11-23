// 관제 전선 (ops): 근미래 군사·전술. 어두운 녹색 스코프 · 녹색 예광선 · 조준 브래킷 · 호박색 코드 꼬리표.
// 판 위 규칙: 녹색 선은 가늘게, 경고·코드만 호박색. 글씨는 Share Tech Mono (한글은 Noto Sans KR).
(function () {
  const { TAU, rnd, clamp, ease, lerp } = CX.util;
  const { W } = CX.size;

  const G = '#6CFFA0';
  const A = '#FFB547';
  const DK = '#07110C';
  const ga = (a) => `rgba(108,255,160,${a})`;
  const aa = (a) => `rgba(255,181,71,${a})`;
  const MONO = '"Share Tech Mono", "Noto Sans KR", monospace';
  const KR = '"Noto Sans KR", sans-serif';
  const DEG = Math.PI / 180;

  const hex = () => '0x' + ((Math.random() * 256) | 0).toString(16).toUpperCase().padStart(2, '0');
  const tgtNo = () => 'TGT-' + String(1 + ((Math.random() * 40) | 0)).padStart(2, '0');
  const range = (y) => Math.max(40, Math.round((446 - y) * 2.4)) + 'm';

  // 네 모서리 브래킷 (가운데 x,y, 반폭 hw·반높이 hh, 모서리 길이 len)
  function bracket(c, x, y, hw, hh, len) {
    c.beginPath();
    c.moveTo(x - hw, y - hh + len);
    c.lineTo(x - hw, y - hh);
    c.lineTo(x - hw + len, y - hh);
    c.moveTo(x + hw - len, y - hh);
    c.lineTo(x + hw, y - hh);
    c.lineTo(x + hw, y - hh + len);
    c.moveTo(x + hw, y + hh - len);
    c.lineTo(x + hw, y + hh);
    c.lineTo(x + hw - len, y + hh);
    c.moveTo(x - hw + len, y + hh);
    c.lineTo(x - hw, y + hh);
    c.lineTo(x - hw, y + hh - len);
    c.stroke();
  }

  // 코드 꼬리표: 지시선 + 어두운 상자 + 모노 글씨 (타자 치듯 n 글자까지)
  function codeTag(c, x, y, text, col, size, n) {
    const s = n == null ? text : text.slice(0, Math.max(1, n));
    c.font = `${size}px ${MONO}`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    const tw = c.measureText(s).width;
    c.fillStyle = 'rgba(7,17,12,0.88)';
    c.fillRect(x, y - size * 0.75, tw + 6, size * 1.5);
    c.strokeStyle = col;
    c.lineWidth = 0.8;
    c.strokeRect(x + 0.4, y - size * 0.75 + 0.4, tw + 5.2, size * 1.5 - 0.8);
    c.fillStyle = col;
    c.fillText(s, x + 3, y + 0.5);
  }

  // 예광선 한 줄 (머리 x,y, 방향 ux,uy, 길이 len)
  // 앞쪽 절반은 굵고 밝게, 뒤쪽은 가늘게 사라지고, 그 뒤로 옅은 탄도 점선 (run: 지금까지 날아온 거리)
  function tracer(c, x, y, ux, uy, len, a, run) {
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    const tx = x - ux * len;
    const ty = y - uy * len;
    const mx = x - ux * len * 0.5;
    const my = y - uy * len * 0.5;
    const seg = (x1, y1, x2, y2) => {
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
    };
    if (run > len + 8) {
      const back = Math.min(run, len * 3.4);
      c.setLineDash([7, 6]);
      c.strokeStyle = ga(0.16 * a);
      c.lineWidth = 1;
      seg(x - ux * back, y - uy * back, tx, ty);
      c.setLineDash([]);
    }
    c.strokeStyle = ga(0.22 * a);
    c.lineWidth = 6;
    seg(mx, my, x, y);
    c.strokeStyle = ga(0.45 * a);
    c.lineWidth = 1.6;
    seg(tx, ty, mx, my);
    c.strokeStyle = ga(a);
    c.lineWidth = 2.6;
    seg(mx, my, x, y);
    c.strokeStyle = `rgba(240,255,245,${a})`;
    c.lineWidth = 1.3;
    seg(x - ux * 8, y - uy * 8, x, y);
  }

  // 총구 섬광 (호박·흰 별 세 갈래)
  function muzzle(api, x, y, ux, uy, big) {
    const L = big ? 14 : 10;
    CX.mark(api, x, y, 0.09, (c, k) => {
      c.globalCompositeOperation = 'lighter';
      const f = 1 - k;
      const nx = -uy;
      const ny = ux;
      c.fillStyle = aa(0.9 * f);
      c.beginPath();
      c.moveTo(x + ux * L, y + uy * L);
      c.lineTo(x + nx * 3, y + ny * 3);
      c.lineTo(x - ux * 2, y - uy * 2);
      c.lineTo(x - nx * 3, y - ny * 3);
      c.closePath();
      c.fill();
      c.strokeStyle = aa(0.8 * f);
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(x + ux * 2 + nx * 2, y + uy * 2 + ny * 2);
      c.lineTo(x + ux * 6 + nx * 7, y + uy * 6 + ny * 7);
      c.moveTo(x + ux * 2 - nx * 2, y + uy * 2 - ny * 2);
      c.lineTo(x + ux * 6 - nx * 7, y + uy * 6 - ny * 7);
      c.stroke();
      c.fillStyle = `rgba(255,255,240,${f})`;
      c.beginPath();
      c.arc(x, y, 2.4, 0, TAU);
      c.fill();
    });
  }

  // 탄피 (작은 놋쇠 막대가 옆으로 튀어 떨어진다)
  function casing(api, x, y) {
    const vx = rnd(38, 62);
    const vy = rnd(-70, -48);
    const spin = rnd(14, 22);
    CX.mark(api, x, y, 0.42, (c, k) => {
      const t = k * 0.42;
      const px = x + vx * t;
      const py = y + vy * t + 260 * t * t;
      c.globalAlpha = 1 - k * 0.6;
      c.translate(px, py);
      c.rotate(t * spin);
      c.fillStyle = '#E0A848';
      c.fillRect(-1.8, -0.7, 3.6, 1.4);
    });
  }

  // ── 무기 아이콘 (64 단위 칸에 미리 그림) ──
  const RIFLE = 'M-23,1 L-19,-3 L-9,-3 L-8,-5 L9,-5 L9,-3.5 L22,-3.5 L22,-1 L9,-1 L7,2 L-1,2 L-3,8 L-7,8 L-6,2 L-12,2 L-20,6 L-23,5 Z';
  const RIFLE_MAG = 'M1,2 L5,2 L7.5,10 L4,11 Z';
  // 레이저 소총: 불펍 몸통 (탄창 없음) — 각진 윗면, 손잡이 하나
  const LASER = 'M-22,3 L-22,-3 L-17,-7 L5,-7 L8,-4 L12,-4 L12,1 L3,1 L1,4 L-3,4 L-4.5,10 L-8.5,10 L-7.5,4 L-15,4 L-17,6.5 L-22,6.5 Z';
  const DOG = 'M-14,-5 L6,-5 L9,-10 L11,-16 L13.5,-12 L16,-12 L22,-9 L22,-7 L16,-5.5 L11,0 L9,3 L9,12 L6,12 L5.5,3 L-8,3 L-9,12 L-12,12 L-13,3 L-15,0 Z';

  function iconSprite(id, bold) {
    return CX.util.sprite(`ops-ic-${id}-${bold ? 'b' : 'n'}`, 64, 64, (c) => {
      c.lineJoin = 'round';
      c.lineCap = 'round';
      const lw = bold ? 2.8 : 1.6;
      if (id === 'arm_rifle') {
        c.translate(29, 35);
        c.rotate(-18 * DEG);
        c.scale(1.2, 1.2);
        const p = new Path2D(RIFLE);
        c.fillStyle = ga(bold ? 0.5 : 0.26);
        c.fill(p);
        c.strokeStyle = G;
        c.lineWidth = lw;
        c.stroke(p);
        const m = new Path2D(RIFLE_MAG);
        c.fillStyle = ga(bold ? 0.6 : 0.4);
        c.fill(m);
        c.stroke(m);
        if (!bold) {
          c.fillStyle = DK;
          c.fillRect(-4, -9, 9, 3);
          c.lineWidth = 1.1;
          c.strokeRect(-4, -9, 9, 3);
        }
        c.strokeStyle = A;
        c.lineWidth = bold ? 3 : 2;
        c.beginPath();
        c.moveTo(23, -2.2);
        c.lineTo(29, -2.2);
        c.stroke();
      } else if (id === 'arm_laser') {
        c.translate(26, 35);
        c.rotate(-18 * DEG);
        c.scale(1.15, 1.15);
        const p = new Path2D(LASER);
        c.fillStyle = ga(bold ? 0.5 : 0.26);
        c.fill(p);
        c.strokeStyle = G;
        c.lineWidth = lw;
        c.stroke(p);
        // 에너지 줄 (몸통을 따라 밝은 선)
        c.strokeStyle = '#EFFFF5';
        c.lineWidth = bold ? 1.6 : 1;
        c.beginPath();
        c.moveTo(-15, -4);
        c.lineTo(4, -4);
        c.stroke();
        // 방출 총열 + 코일 고리
        c.fillStyle = DK;
        c.strokeStyle = G;
        c.lineWidth = bold ? 2 : 1.2;
        c.fillRect(12, -4.4, 12, 4.8);
        c.strokeRect(12, -4.4, 12, 4.8);
        c.lineWidth = bold ? 1.6 : 1;
        c.beginPath();
        for (const cx of bold ? [17, 21] : [15, 18, 21]) {
          c.moveTo(cx, -5.6);
          c.lineTo(cx, 1.6);
        }
        c.stroke();
        // 전지 (호박, 개머리 쪽)
        c.fillStyle = aa(0.6);
        c.fillRect(-20.5, -2.5, 6, 6);
        c.strokeStyle = A;
        c.lineWidth = bold ? 1.6 : 1;
        c.strokeRect(-20.5, -2.5, 6, 6);
        // 렌즈 고리 + 빛
        c.fillStyle = ga(0.35);
        c.beginPath();
        c.arc(26.5, -2, bold ? 7 : 6, 0, TAU);
        c.fill();
        c.strokeStyle = G;
        c.lineWidth = bold ? 2 : 1.3;
        c.beginPath();
        c.arc(26.5, -2, bold ? 4.4 : 3.8, 0, TAU);
        c.stroke();
        c.fillStyle = '#EFFFF5';
        c.beginPath();
        c.arc(26.5, -2, bold ? 2.6 : 2, 0, TAU);
        c.fill();
      } else if (id === 'arm_dog') {
        c.translate(31, 38);
        c.scale(1.22, 1.22);
        const p = new Path2D(DOG);
        c.fillStyle = ga(bold ? 0.45 : 0.2);
        c.fill(p);
        c.strokeStyle = G;
        c.lineWidth = lw;
        c.stroke(p);
        c.lineWidth = bold ? 2.6 : 1.5;
        c.beginPath();
        c.moveTo(-14, -4);
        c.quadraticCurveTo(-19, -7, -20, -12);
        c.stroke();
        c.fillStyle = aa(bold ? 0.6 : 0.4);
        c.fillRect(-6, -5, 9, 8);
        c.strokeStyle = A;
        c.lineWidth = bold ? 1.4 : 0.9;
        c.strokeRect(-6, -5, 9, 8);
        if (!bold) {
          c.fillStyle = G;
          c.beginPath();
          c.arc(15, -9.5, 1, 0, TAU);
          c.fill();
          // IFF 표지 (등 위 작은 마름모)
          c.strokeStyle = G;
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(-1.5, -12);
          c.lineTo(1, -9.5);
          c.lineTo(-1.5, -7);
          c.lineTo(-4, -9.5);
          c.closePath();
          c.stroke();
        }
      }
    });
  }

  const boxSprite = () =>
    CX.util.sprite('ops-box', 42, 42, (c, w, h) => {
      c.fillStyle = DK;
      c.fillRect(0, 0, w, h);
      const rg = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.62);
      rg.addColorStop(0, 'rgba(46,122,78,0.55)');
      rg.addColorStop(0.6, 'rgba(20,48,31,0.5)');
      rg.addColorStop(1, 'rgba(7,17,12,0)');
      c.fillStyle = rg;
      c.fillRect(0, 0, w, h);
      c.strokeStyle = ga(0.08);
      c.lineWidth = 0.5;
      c.beginPath();
      for (let i = 3; i < w; i += 6) {
        c.moveTo(i, 0);
        c.lineTo(i, h);
        c.moveTo(0, i);
        c.lineTo(w, i);
      }
      c.stroke();
      c.strokeStyle = '#2E7A4E';
      c.lineWidth = 0.7;
      c.beginPath();
      c.arc(w / 2, h / 2, 16, 0, TAU);
      c.stroke();
      c.setLineDash([1.5, 1.5]);
      c.strokeStyle = '#1F5A39';
      c.beginPath();
      c.arc(w / 2, h / 2, 9, 0, TAU);
      c.stroke();
      c.setLineDash([]);
      c.strokeStyle = '#2E7A4E';
      c.beginPath();
      c.moveTo(w / 2, 2);
      c.lineTo(w / 2, 6);
      c.moveTo(w / 2, h - 6);
      c.lineTo(w / 2, h - 2);
      c.moveTo(2, h / 2);
      c.lineTo(6, h / 2);
      c.moveTo(w - 6, h / 2);
      c.lineTo(w - 2, h / 2);
      c.stroke();
      c.fillStyle = ga(0.07);
      c.fillRect(0, h * 0.64, w, 0.8);
      c.fillRect(0, h * 0.3, w, 0.5);
    });

  // ── 돌격소총: 브래킷이 적에 잠기고 → 녹색 예광 3연발 ──
  function fireRifle(api, w, tg) {
    const code = tgtNo();
    const LIFE = 0.42 + Math.hypot(tg.x - w.x, tg.y - w.y) / 600;
    CX.mark(api, tg.x, tg.y, LIFE, (c, k, fx) => {
      if (tg.alive) {
        fx.x = tg.x;
        fx.y = tg.y;
      }
      const t = k * LIFE;
      const q = ease(t / 0.2);
      const hs = lerp(30, tg.r + 6, q);
      const locked = t > 0.2;
      c.globalAlpha = k > 0.86 ? (1 - k) / 0.14 : 1;
      c.strokeStyle = locked ? G : A;
      c.lineWidth = locked ? 1.5 : 1.2;
      bracket(c, fx.x, fx.y, hs, hs, 5);
      if (!locked && ((t * 30) | 0) % 2) return;
      c.strokeStyle = locked ? ga(0.8) : aa(0.7);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(fx.x - hs - 5, fx.y);
      c.lineTo(fx.x - hs + 1, fx.y);
      c.moveTo(fx.x + hs - 1, fx.y);
      c.lineTo(fx.x + hs + 5, fx.y);
      c.stroke();
      c.font = `8px ${MONO}`;
      c.textAlign = 'left';
      c.textBaseline = 'bottom';
      c.fillStyle = locked ? G : A;
      c.fillText(locked ? `${code} LOCK` : 'ACQ..', fx.x - hs, fx.y - hs - 2);
    });
    for (let i = 0; i < 3; i++) {
      api.later(0.21 + i * 0.075, (a) => {
        const t = tg.alive ? tg : a.target('near', tg.x, tg.y);
        if (!t) return;
        const mx = w.x + 3;
        const my = w.y - 22;
        const d = Math.hypot(t.x - mx, t.y - my) || 1;
        muzzle(a, mx, my, (t.x - mx) / d, (t.y - my) / d, false);
        casing(a, w.x + 8, w.y - 14);
        CX.shoot(a, w, t, { x: mx, y: my, speed: 600, dmg: 2, r: 4, spread: 4, life: 1.2, draw: drawTracer });
      });
    }
    return 1.05;
  }
  function drawTracer(c, p) {
    const dx = p.tx - p.sx;
    const dy = p.ty - p.sy;
    const d = Math.hypot(dx, dy) || 1;
    const run = Math.hypot(p.x - p.sx, p.y - p.sy);
    tracer(c, p.x, p.y, dx / d, dy / d, Math.min(34, run), 1, run);
  }

  // ── 레이저 소총: 충전 선 → 가는 녹색 빔 (꿰뚫음) + 레티클 ──
  function fireLaser(api, w, tg) {
    const mx = w.x + 4;
    const my = w.y - 23;
    const CH = 0.38;
    CX.mark(api, mx, my, CH, (c, k) => {
      c.globalCompositeOperation = 'lighter';
      // 조준선 (호박 점선, 적을 따라감)
      if (tg.alive) {
        c.setLineDash([3, 4]);
        c.lineDashOffset = -k * 30;
        c.strokeStyle = aa(0.25 + k * 0.5);
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(mx, my);
        c.lineTo(tg.x, tg.y);
        c.stroke();
        c.setLineDash([]);
        c.strokeStyle = aa(0.4 + k * 0.5);
        c.lineWidth = 1;
        const r = lerp(18, 10, k);
        c.beginPath();
        c.arc(tg.x, tg.y, r, 0, TAU);
        c.stroke();
      }
      // 모이는 충전 고리 + 빛 조각
      const r = lerp(16, 3, ease(k));
      c.strokeStyle = ga(0.9);
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(mx, my, r, 0, TAU);
      c.stroke();
      for (let i = 0; i < 4; i++) {
        const an = i * (TAU / 4) + k * 3;
        const r0 = lerp(22, 4, k);
        c.beginPath();
        c.moveTo(mx + Math.cos(an) * r0, my + Math.sin(an) * r0);
        c.lineTo(mx + Math.cos(an) * (r0 + 5), my + Math.sin(an) * (r0 + 5));
        c.stroke();
      }
      c.fillStyle = ga(0.3 + k * 0.6);
      c.beginPath();
      c.arc(mx, my, 1.5 + k * 3, 0, TAU);
      c.fill();
      // 충전 막대
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = 'rgba(7,17,12,0.85)';
      c.fillRect(mx + 12, my - 4, 22, 5);
      c.strokeStyle = ga(0.7);
      c.lineWidth = 0.7;
      c.strokeRect(mx + 12.4, my - 3.6, 21.2, 4.2);
      c.fillStyle = k > 0.85 ? A : G;
      c.fillRect(mx + 13.5, my - 2.5, 19 * k, 2);
    });
    api.later(CH, (a) => {
      const t = tg.alive ? tg : a.target('front');
      if (!t) return;
      CX.beam(a, w, t, { x: mx, y: my, dmg: 3, dur: 0.42, pierce: true, width: 4, draw: drawLaser });
    });
    return 1.7;
  }
  function drawLaser(c, b) {
    const k = clamp(b.age / b.life, 0, 1);
    const f = 1 - k;
    const flash = b.age < 0.06 ? 1 - b.age / 0.06 : 0;
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    const line = () => {
      c.beginPath();
      c.moveTo(b.x1, b.y1);
      c.lineTo(b.x2, b.y2);
      c.stroke();
    };
    c.strokeStyle = ga(0.14 * f + 0.2 * flash);
    c.lineWidth = 8 + flash * 6;
    line();
    c.strokeStyle = ga(0.95 * f);
    c.lineWidth = 1.8 + flash * 1.6;
    line();
    c.strokeStyle = `rgba(240,255,245,${f})`;
    c.lineWidth = 0.7;
    line();
    // 빔을 타고 나가는 펄스
    const dx = b.x2 - b.x1;
    const dy = b.y2 - b.y1;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L;
    const uy = dy / L;
    c.strokeStyle = `rgba(240,255,245,${0.9 * f})`;
    c.lineWidth = 2.2;
    for (let i = 0; i < 4; i++) {
      const s = ((b.age * 2.4 + i / 4) % 1) * 520;
      c.beginPath();
      c.moveTo(b.x1 + ux * s, b.y1 + uy * s);
      c.lineTo(b.x1 + ux * (s + 9), b.y1 + uy * (s + 9));
      c.stroke();
    }
    // 총구 렌즈
    c.fillStyle = ga(0.6 * f + 0.4 * flash);
    c.beginPath();
    c.arc(b.x1, b.y1, 3 + flash * 4, 0, TAU);
    c.fill();
    // 레티클 (맞힌 자리)
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = f;
    c.translate(b.x, b.y);
    c.strokeStyle = G;
    c.lineWidth = 1.1;
    c.beginPath();
    c.arc(0, 0, 10, 0, TAU);
    c.stroke();
    c.rotate(b.age * 4);
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      const an = (i * TAU) / 4;
      c.moveTo(Math.cos(an) * 7, Math.sin(an) * 7);
      c.lineTo(Math.cos(an) * 15, Math.sin(an) * 15);
    }
    c.stroke();
    c.rotate(-b.age * 4);
    c.fillStyle = A;
    c.fillRect(-1.3, -1.3, 2.6, 2.6);
    c.font = `7.5px ${MONO}`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillStyle = A;
    c.fillText('LZR 4.2kW', 14, -12);
  }

  // ── 군견: IFF 표지를 단 K9 가 달려가 문다 (두 마리) ──
  function fireDog(api, w, tg) {
    CX.mark(api, w.x, w.y, 0.5, (c, k) => {
      c.globalAlpha = 1 - k;
      c.strokeStyle = A;
      c.lineWidth = 1.4;
      bracket(c, w.x, w.y, 25 + k * 6, 25 + k * 6, 6);
      c.font = `8px ${MONO}`;
      c.textAlign = 'center';
      c.textBaseline = 'bottom';
      c.fillStyle = A;
      c.fillText('K9 DEPLOY', w.x, w.y - 30 - k * 6);
    });
    for (let i = 0; i < 2; i++) {
      api.later(i * 0.24, (a) => {
        const t = i === 0 && tg.alive ? tg : a.target('front');
        if (!t) return;
        const u = CX.runner(a, w, t, { speed: 205, dmg: 4, n: 3, r: 10, draw: drawDog, onHit: bite });
        u.x += i ? 9 : -9;
        u.k9 = i + 1;
      });
    }
    return 2.8;
  }
  function drawDog(c, u) {
    const ph = u.age * 19 + (u.k9 || 0) * 1.7;
    // 지나온 길 (점선 추적선)
    const h = u.hist;
    if (h.length >= 6) {
      c.strokeStyle = ga(0.3);
      c.lineWidth = 1;
      c.setLineDash([2, 3]);
      c.beginPath();
      c.moveTo(h[0], h[1] + 6);
      for (let i = 2; i < h.length; i += 2) c.lineTo(h[i], h[i + 1] + 6);
      c.stroke();
      c.setLineDash([]);
    }
    // 바라보는 쪽은 옆으로 확실히 움직일 때만 바꾼다 (위로 달릴 때 좌우로 깜빡이지 않게)
    if (u.face == null) u.face = u.vx >= 0 ? 1 : -1;
    if (u.vx > 30) u.face = 1;
    else if (u.vx < -30) u.face = -1;
    const tilt = clamp(Math.atan2(u.vy, Math.abs(u.vx) + 1e-3) * 0.4, -0.4, 0.3);
    const bound = Math.sin(ph);
    c.save();
    c.translate(u.x, u.y - Math.abs(bound) * 1.5);
    c.scale(u.face * 1.18, 1.18);
    c.rotate(tilt + bound * 0.06);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    // 두 마디 다리: sw 는 -1(뒤)..1(앞) 흔들림, 앞다리는 무릎이 뒤로, 뒷다리는 앞으로 꺾임
    const leg = (hx, hy, sw, front, col, lw) => {
      const a1 = sw * 0.75;
      const kx = hx + Math.sin(a1) * 4.8;
      const ky = hy + Math.cos(a1) * 4.8;
      const a2 = a1 + (front ? -1 : 1) * (0.25 + 0.45 * (1 - sw) * 0.5);
      c.strokeStyle = col;
      c.lineWidth = lw;
      c.beginPath();
      c.moveTo(hx, hy);
      c.lineTo(kx, ky);
      c.lineTo(kx + Math.sin(a2) * 5, ky + Math.cos(a2) * 5);
      c.stroke();
    };
    // 먼 쪽 다리 (모았다 뻗는 질주: 앞다리 둘·뒷다리 둘이 같은 박자, 조금 어긋나게)
    leg(6, 0.5, Math.sin(ph + 0.5), true, ga(0.45), 1.8);
    leg(-7, 0.5, Math.sin(ph + Math.PI + 0.5), false, ga(0.45), 1.8);
    // 몸
    c.beginPath();
    c.moveTo(-11, -3);
    c.quadraticCurveTo(-4, -6.2, 5, -5);
    c.lineTo(8.5, -6.4);
    c.lineTo(10.6, -8.8);
    c.lineTo(11.4, -12.6);
    c.lineTo(13, -9.2);
    c.lineTo(14.2, -8.8);
    c.lineTo(19.2, -7.2);
    c.lineTo(19.4, -5.4);
    c.lineTo(14, -4.4);
    c.lineTo(10.8, -2.2);
    c.quadraticCurveTo(8, 1, 4, 2.2);
    c.lineTo(-6, 2.4);
    c.quadraticCurveTo(-11, 2, -11.5, -1);
    c.closePath();
    c.fillStyle = 'rgba(9,26,17,0.95)';
    c.fill();
    c.strokeStyle = G;
    c.lineWidth = 1.3;
    c.stroke();
    // 꼬리
    c.beginPath();
    c.moveTo(-11, -2.5);
    c.quadraticCurveTo(-15.5, -4, -17.5, -7.5 + Math.sin(ph * 0.5) * 1.5);
    c.stroke();
    // 전술 조끼
    c.fillStyle = aa(0.5);
    c.fillRect(-5, -5.2, 7.5, 6.6);
    c.strokeStyle = A;
    c.lineWidth = 0.8;
    c.strokeRect(-5, -5.2, 7.5, 6.6);
    c.fillStyle = G;
    c.beginPath();
    c.arc(15, -7.6, 0.9, 0, TAU);
    c.fill();
    // 가까운 쪽 다리
    leg(6, 0.5, Math.sin(ph), true, G, 2);
    leg(-7, 0.5, Math.sin(ph + Math.PI), false, G, 2);
    c.restore();
    // IFF 표지 (화면 기준, 위에)
    const bx = u.x;
    const by = u.y - 24;
    const bl = 0.6 + 0.4 * Math.sin(u.age * 12);
    c.strokeStyle = ga(bl);
    c.lineWidth = 1.1;
    c.beginPath();
    c.moveTo(bx, by - 3.5);
    c.lineTo(bx + 3.5, by);
    c.lineTo(bx, by + 3.5);
    c.lineTo(bx - 3.5, by);
    c.closePath();
    c.stroke();
    c.fillStyle = A;
    c.fillRect(bx - 1, by - 1, 2, 2);
    c.font = `7px ${MONO}`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillStyle = ga(0.85);
    c.fillText('K9-0' + (u.k9 || 1), bx + 6, by + 0.5);
  }
  // 무는 순간: 위아래 이빨 줄이 닫힌다
  function bite(api, u, e) {
    const x = e.x;
    const y = e.y;
    CX.mark(api, x, y, 0.3, (c, k) => {
      const q = ease(k / 0.35);
      const gap = lerp(11, 3, q);
      c.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
      c.strokeStyle = A;
      c.lineWidth = 1.5;
      c.lineJoin = 'miter';
      for (const s of [-1, 1]) {
        c.beginPath();
        const yy = y + s * gap;
        c.moveTo(x - 9, yy + s * 3);
        for (let i = 0; i <= 4; i++) c.lineTo(x - 9 + i * 4.5, yy + (i % 2 ? -s * 2.5 : 0));
        c.lineTo(x + 9, yy + s * 3);
        c.stroke();
      }
    });
  }

  // ── 반응 (보조일 때의 큰 한 방) ──
  // 집중 난사 · 난사 (돌격소총): 구역을 지정하면 양옆·아래 세 곳에서 예광이 십자로 쏟아진다
  function reactBarrage(api, e, w) {
    const cx = e.x;
    const cy = e.y;
    const R = 58;
    const tag = 'FIRE MSN // AO-' + String(1 + ((Math.random() * 9) | 0));
    CX.mark(api, cx, cy, 1.2, (c, k) => {
      const t = k * 1.2;
      const q = ease(t / 0.18);
      const hw = lerp(R + 34, R, q);
      const hh = hw * 0.78;
      c.globalAlpha = t > 1 ? (1.2 - t) / 0.2 : 1;
      c.fillStyle = aa(0.05 + (t < 0.18 ? 0.08 : 0));
      c.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
      c.strokeStyle = ga(0.18);
      c.lineWidth = 0.6;
      c.beginPath();
      for (let i = -2; i <= 2; i++) {
        c.moveTo(cx + (i * hw) / 3, cy - hh);
        c.lineTo(cx + (i * hw) / 3, cy + hh);
        c.moveTo(cx - hw, cy + (i * hh) / 3);
        c.lineTo(cx + hw, cy + (i * hh) / 3);
      }
      c.stroke();
      c.strokeStyle = A;
      c.lineWidth = 2;
      bracket(c, cx, cy, hw, hh, 11);
      c.font = `9px ${MONO}`;
      c.textAlign = 'left';
      c.textBaseline = 'bottom';
      c.fillStyle = A;
      c.fillText(tag, cx - hw, cy - hh - 3);
      c.textAlign = 'right';
      c.textBaseline = 'top';
      c.fillStyle = G;
      const left = Math.max(0, 12 - Math.floor(Math.max(0, t - 0.14) / 0.045));
      c.fillText('RDS ' + String(left).padStart(2, '0'), cx + hw, cy + hh + 3);
    });
    const srcs = [
      [-2, clamp(cy + 80, 90, 420)],
      [W + 2, clamp(cy + 50, 90, 420)],
      [w.x, w.y - 22],
    ];
    for (let i = 0; i < 12; i++) {
      api.later(0.14 + i * 0.045, (a) => {
        const s = srcs[i % 3];
        const pool = a.near(cx, cy, R);
        const tgt = pool.length ? pool[(Math.random() * pool.length) | 0] : null;
        const tx = tgt ? tgt.x + rnd(-3, 3) : cx + rnd(-R * 0.7, R * 0.7);
        const ty = tgt ? tgt.y + rnd(-3, 3) : cy + rnd(-R * 0.5, R * 0.5);
        const d = Math.hypot(tx - s[0], ty - s[1]) || 1;
        const ux = (tx - s[0]) / d;
        const uy = (ty - s[1]) / d;
        muzzle(a, s[0] + ux * 4, s[1] + uy * 4, ux, uy, true);
        const dur = d / 1150;
        a.add({
          x: s[0],
          y: s[1],
          z: 1,
          noTrail: true,
          update(dt, A2) {
            const k = this.age / dur;
            if (k >= 1) {
              if (tgt && tgt.alive) A2.hit(w, tgt, 2, tx, ty, { isReact: true });
              else spark(A2, tx, ty);
              return false;
            }
            this.x = s[0] + (tx - s[0]) * k;
            this.y = s[1] + (ty - s[1]) * k;
            return true;
          },
          draw(c) {
            tracer(c, this.x, this.y, ux, uy, Math.min(34, this.age * 1150), 1, this.age * 1150);
          },
        });
      });
    }
    api.later(0.3, (a) => a.shake(1.5));
  }
  function spark(api, x, y) {
    CX.mark(api, x, y, 0.2, (c, k) => {
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = aa(1 - k);
      c.lineWidth = 1;
      c.beginPath();
      for (let i = 0; i < 4; i++) {
        const an = i * 1.7 + x;
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(an) * (3 + k * 6), y + Math.sin(an) * (3 + k * 6));
      }
      c.stroke();
    });
  }

  // 갈래 광선 · 관통 (레이저 소총): 맞은 자리에 분광점, 주변 적을 잠그고 → 갈래 빔이 사방으로 꿰뚫는다
  function reactPrism(api, e, w) {
    const cx = e.x;
    const cy = e.y;
    const near = api.enemies
      .filter((n) => n.alive && n !== e && (n.x - cx) ** 2 + (n.y - cy) ** 2 < 170 * 170)
      .sort((p, q) => (p.x - cx) ** 2 + (p.y - cy) ** 2 - ((q.x - cx) ** 2 + (q.y - cy) ** 2))
      .slice(0, 4);
    const locks = near.slice();
    const dirs = near.map((n) => Math.atan2(n.y - cy, n.x - cx));
    while (dirs.length < 4) dirs.push(-Math.PI / 2 + rnd(-1.4, 1.4));
    const ARM = 0.3;
    CX.mark(api, cx, cy, ARM, (c, k) => {
      c.save();
      c.translate(cx, cy);
      c.rotate(k * 4);
      const s = lerp(4, 9, ease(k));
      c.strokeStyle = G;
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(0, -s);
      c.lineTo(s, 0);
      c.lineTo(0, s);
      c.lineTo(-s, 0);
      c.closePath();
      c.stroke();
      c.restore();
      c.setLineDash([3, 3]);
      c.strokeStyle = aa(0.4 + k * 0.5);
      c.lineWidth = 0.9;
      for (const an of dirs) {
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx + Math.cos(an) * 160 * ease(k * 1.6), cy + Math.sin(an) * 160 * ease(k * 1.6));
        c.stroke();
      }
      c.setLineDash([]);
      c.strokeStyle = A;
      c.lineWidth = 1.2;
      locks.forEach((n, i) => {
        if (!n.alive || k < i * 0.15) return;
        const hs = n.r + 5;
        bracket(c, n.x, n.y, hs, hs, 4);
        c.font = `7.5px ${MONO}`;
        c.textAlign = 'left';
        c.textBaseline = 'bottom';
        c.fillStyle = A;
        c.fillText(`LOCK ${i + 1}/${locks.length}`, n.x - hs, n.y - hs - 2);
      });
    });
    api.later(ARM, (a) => {
      const done = new Set();
      const beams = dirs.map((an) => [cx + Math.cos(an) * 340, cy + Math.sin(an) * 340]);
      for (const [x2, y2] of beams) {
        for (const n of a.enemies) {
          if (!n.alive || done.has(n)) continue;
          if (CX.util.distSeg(n.x, n.y, cx, cy, x2, y2) < n.r + 4) {
            done.add(n);
            a.hit(w, n, 5, n.x, n.y, { isReact: true });
          }
        }
      }
      if (e.alive && !done.has(e)) a.hit(w, e, 4, e.x, e.y, { isReact: true });
      a.shake(1.6);
      CX.mark(a, cx, cy, 0.5, (c, k) => {
        const f = 1 - k;
        const flash = k < 0.12 ? 1 - k / 0.12 : 0;
        c.globalCompositeOperation = 'lighter';
        c.lineCap = 'round';
        for (const [x2, y2] of beams) {
          const ln = (lw, col) => {
            c.strokeStyle = col;
            c.lineWidth = lw;
            c.beginPath();
            c.moveTo(cx, cy);
            c.lineTo(x2, y2);
            c.stroke();
          };
          ln(12 + flash * 8, ga(0.12 * f + 0.18 * flash));
          ln(3 + flash * 2, ga(0.95 * f));
          ln(1.1, `rgba(240,255,245,${f})`);
        }
        const rg = c.createRadialGradient(cx, cy, 0, cx, cy, 22);
        rg.addColorStop(0, `rgba(240,255,245,${f})`);
        rg.addColorStop(0.4, ga(0.5 * f));
        rg.addColorStop(1, ga(0));
        c.fillStyle = rg;
        c.beginPath();
        c.arc(cx, cy, 22, 0, TAU);
        c.fill();
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = f;
        c.font = `8.5px ${MONO}`;
        c.textAlign = 'left';
        c.textBaseline = 'top';
        c.fillStyle = A;
        c.fillText(`SPLIT x${beams.length} // PIERCE`, cx + 12, cy + 10);
      });
    });
  }

  // 전향 무리 · 강타 (군견): 맞은 적의 IFF 를 아군으로 바꾸고 → 경로점을 찍어 → 제 무리를 차례로 들이받게 한다
  function reactTurn(api, e, w) {
    let u = e.alive && e.hp > 0 ? e : null;
    if (!u) {
      let bd = 100 * 100;
      for (const n of api.enemies) {
        if (!n.alive || n === e) continue;
        const d = (n.x - e.x) ** 2 + (n.y - e.y) ** 2;
        if (d < bd) (bd = d), (u = n);
      }
    }
    const start = { x: u ? u.x : e.x, y: u ? u.y : e.y };
    // 경로: 가까운 적을 차례로 (최대 3)
    const route = [];
    let px = start.x;
    let py = start.y;
    const used = new Set([u, e]);
    for (let i = 0; i < 3; i++) {
      let best = null;
      let bd = 120 * 120;
      for (const n of api.enemies) {
        if (!n.alive || used.has(n)) continue;
        const d = (n.x - px) ** 2 + (n.y - py) ** 2;
        if (d < bd) (bd = d), (best = n);
      }
      if (!best) break;
      used.add(best);
      route.push(best);
      px = best.x;
      py = best.y;
    }
    if (!route.length) route.push({ x: start.x + rnd(-40, 40), y: start.y - 46, ghost: true });
    const LEAP = 0.26;
    const PLOT = 0.56;
    const LEG = 0.17;
    const code = tgtNo();
    const mx = w.x;
    const my = w.y - 22;
    api.add({
      x: start.x,
      y: start.y,
      z: 1,
      noTrail: true,
      done: 0,
      from: null,
      bitten: false,
      dog: { x: mx, y: my, vx: 0, vy: -1, age: 0, hist: [], k9: 3 },
      update(dt, a) {
        const t = this.age - PLOT;
        if (t < 0) {
          if (u && u.alive) {
            this.x = u.x;
            this.y = u.y;
          }
          // 군견이 먼저 뛰어올라 물어 묶는다
          const d = this.dog;
          const q = ease(Math.min(1, this.age / LEAP));
          const px = d.x;
          const py = d.y;
          d.x = lerp(mx, this.x, q);
          d.y = lerp(my, this.y + 6, q) - Math.sin(Math.PI * q) * 26;
          d.vx = (d.x - px) / Math.max(dt, 1e-4);
          d.vy = (d.y - py) / Math.max(dt, 1e-4);
          d.age = this.age;
          if (!this.bitten && this.age >= LEAP) {
            this.bitten = true;
            bite(a, null, { x: this.x, y: this.y });
            a.shake(1.2);
          }
          return true;
        }
        if (!this.from) this.from = { x: this.x, y: this.y };
        const i = Math.min(route.length, Math.floor(t / LEG));
        while (this.done < i) {
          const n = route[this.done];
          impact(a, w, n);
          this.from = { x: n.x, y: n.y };
          this.done++;
        }
        if (i >= route.length) {
          if (u && u.alive) a.hit(w, u, 8, u.x, u.y, { isReact: true, big: true });
          impact(a, w, null, this.x, this.y, true);
          return false;
        }
        const n = route[i];
        const q = ease((t - i * LEG) / LEG);
        this.x = lerp(this.from.x, n.x, q);
        this.y = lerp(this.from.y, n.y, q);
        if (u && u.alive) {
          u.x = this.x;
          u.y = this.y;
        }
        return this.age < 2.5;
      },
      draw(c) {
        const t = this.age;
        const x = this.x;
        const y = this.y;
        // 뛰어드는 군견
        if (t < LEAP + 0.06) {
          c.save();
          c.globalAlpha = t > LEAP ? 1 - (t - LEAP) / 0.06 : 1;
          drawDog(c, this.dog);
          c.restore();
        }
        // 경로점 (호박 점선 + 번호 칸)
        const shown = Math.min(route.length, Math.max(0, Math.floor((t - LEAP) / ((PLOT - LEAP) / (route.length + 1)))));
        c.setLineDash([3, 3]);
        c.strokeStyle = aa(0.75);
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x, y);
        for (let i = this.done; i < shown; i++) c.lineTo(route[i].x, route[i].y);
        c.stroke();
        c.setLineDash([]);
        c.font = `8px ${MONO}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        for (let i = this.done; i < shown; i++) {
          const n = route[i];
          c.fillStyle = 'rgba(7,17,12,0.9)';
          c.fillRect(n.x + 9, n.y - 17, 10, 10);
          c.strokeStyle = A;
          c.strokeRect(n.x + 9.5, n.y - 16.5, 9, 9);
          c.fillStyle = A;
          c.fillText(String(i + 1), n.x + 14, n.y - 11.5);
        }
        // 돌진 자취 (녹색 굵은 빛)
        const h = this.hist;
        if (t > PLOT && h.length >= 4) {
          c.globalCompositeOperation = 'lighter';
          c.lineCap = 'round';
          c.strokeStyle = ga(0.25);
          c.lineWidth = 9;
          c.beginPath();
          c.moveTo(h[0], h[1]);
          for (let i = 2; i < h.length; i += 2) c.lineTo(h[i], h[i + 1]);
          c.stroke();
          c.strokeStyle = ga(0.8);
          c.lineWidth = 1.6;
          c.stroke();
          c.globalCompositeOperation = 'source-over';
        }
        // 아군 IFF 고리 (빨강 → 녹색으로 바뀜)
        const flip = t > LEAP;
        const r = (u ? u.r : 11) + 6;
        c.strokeStyle = flip ? G : '#FF4D6D';
        c.lineWidth = 1.6;
        c.setLineDash([4, 3]);
        c.lineDashOffset = -t * 30;
        c.beginPath();
        c.arc(x, y, r, 0, TAU);
        c.stroke();
        c.setLineDash([]);
        if (!u) {
          c.fillStyle = ga(0.25);
          c.beginPath();
          c.arc(x, y, 7, 0, TAU);
          c.fill();
        }
        // IFF 마름모 + 꼬리표 (오른쪽 아래: 반응 글씨 띠와 겹치지 않게)
        const bx = x + r * 0.75;
        const by = y + r * 0.75;
        c.fillStyle = flip ? G : '#FF4D6D';
        c.beginPath();
        c.moveTo(bx, by - 4);
        c.lineTo(bx + 4, by);
        c.lineTo(bx, by + 4);
        c.lineTo(bx - 4, by);
        c.closePath();
        c.fill();
        codeTag(c, bx + 7, by + 1, flip ? `${code} IFF>FRIENDLY` : `${code} IFF HOSTILE`, flip ? G : A, 7.5, Math.floor(t * 70));
      },
    });
  }
  function impact(api, w, n, x0, y0, last) {
    const x = n ? n.x : x0;
    const y = n ? n.y : y0;
    if (n && n.alive) api.hit(w, n, 6, n.x, n.y, { isReact: true, push: 14 });
    api.shake(last ? 3 : 2);
    CX.mark(api, x, y, 0.42, (c, k) => {
      const q = ease(k);
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(240,255,245,${0.9 * (1 - k)})`;
      c.lineWidth = 2.5 * (1 - k) + 0.5;
      c.beginPath();
      c.arc(x, y, 8 + q * (last ? 34 : 22), 0, TAU);
      c.stroke();
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1 - k;
      c.strokeStyle = A;
      c.lineWidth = 1.8;
      const hs = 12 + q * (last ? 22 : 12);
      bracket(c, x, y, hs, hs, 5);
      if (last) {
        c.font = `9px ${MONO}`;
        c.textAlign = 'center';
        c.textBaseline = 'top';
        c.fillStyle = A;
        c.fillText('IMPACT // CONFIRMED', x, y + hs + 4);
      }
    });
  }

  // 맞는 무늬: 꼬리표를 한 적에 너무 자주 달지 않게
  const lastTag = new WeakMap();

  CX.world('ops', {
    name: '관제 전선',
    short: '관제',
    desc: '녹색 예광선 · 조준 브래킷 · 코드 꼬리표. 소총은 잠그고 3연발, 레이저는 충전해 줄을 꿰뚫고, 군견은 IFF 를 달고 달려가 문다.',
    colors: { main: G, soft: '#14301F' },
    fonts: ['Share Tech Mono', 'Noto Sans KR'],

    box(c, x, y, w, h, t) {
      c.drawImage(boxSprite(), x, y, w, h);
      // 레이더 쓸기
      const cx = x + w / 2;
      const cy = y + h / 2;
      const R = w * 0.62;
      const an = (t || 0) * 2.2;
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = ga(0.07);
      c.beginPath();
      c.moveTo(cx, cy);
      c.arc(cx, cy, R, an - 0.7, an);
      c.closePath();
      c.fill();
      c.strokeStyle = ga(0.35);
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(an) * R, cy + Math.sin(an) * R);
      c.stroke();
      // 쓸기가 지나가면 밝아지는 점 하나
      const bd = (((an - Math.atan2(-9, 9)) % TAU) + TAU) % TAU;
      const bl = Math.max(0, 1 - bd / 2.2);
      c.fillStyle = aa(0.25 + bl * 0.7);
      c.fillRect(cx + 8.5, cy - 9.5, 1.8, 1.8);
    },

    crest(c, x, y, r) {
      const cx = x + r;
      const cy = y + r;
      c.fillStyle = DK;
      c.beginPath();
      c.arc(cx, cy, r * 0.95, 0, TAU);
      c.fill();
      c.strokeStyle = G;
      c.lineWidth = 1;
      c.stroke();
      c.lineWidth = 1.1;
      bracket(c, cx, cy, r * 0.5, r * 0.5, r * 0.3);
      c.fillStyle = A;
      c.beginPath();
      c.arc(cx, cy, r * 0.17, 0, TAU);
      c.fill();
    },

    icon(c, id, x, y, s) {
      if (id === 'arm_rifle' || id === 'arm_laser' || id === 'arm_dog') {
        c.drawImage(iconSprite(id, s < 22), x - s / 2, y - s / 2, s, s);
        return;
      }
      c.strokeStyle = G;
      c.lineWidth = 1.4;
      bracket(c, x, y, s * 0.36, s * 0.36, s * 0.14);
      c.font = `700 ${Math.round(s * 0.34)}px ${KR}`;
      c.fillStyle = G;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText((CX.data.weapons[id] || { name: '?' }).name.slice(0, 1), x, y + 1);
    },

    fire(api, w, tg) {
      if (w.id === 'arm_rifle') return fireRifle(api, w, tg);
      if (w.id === 'arm_laser') return fireLaser(api, w, tg);
      if (w.id === 'arm_dog') return fireDog(api, w, tg);
      return CX.worlds.base.fire(api, w, tg);
    },

    // 보조 궤적 층: 움직이는 머리엔 추적 레티클 + 지나온 점 기록, 광선엔 훑는 스캔 막대, 장판엔 레이더 쓸기
    trail(c, e, t) {
      c.lineWidth = 1;
      if (e.x1 != null && e.x2 != null) {
        const dx = e.x - e.x1;
        const dy = e.y - e.y1;
        const L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L;
        const ny = dx / L;
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = ga(0.85);
        c.lineWidth = 1.2;
        c.beginPath();
        for (let i = 0; i < 2; i++) {
          const q = (e.age * 3.4 + i * 0.5) % 1;
          const bx = e.x1 + dx * q;
          const by = e.y1 + dy * q;
          c.moveTo(bx - nx * 7, by - ny * 7);
          c.lineTo(bx + nx * 7, by + ny * 7);
        }
        c.stroke();
        c.globalCompositeOperation = 'source-over';
        c.strokeStyle = G;
        bracket(c, e.x, e.y, 11, 11, 4);
        c.fillStyle = A;
        c.fillRect(e.x - 1, e.y - 1, 2, 2);
        return;
      }
      const sp = Math.abs(e.vx || 0) + Math.abs(e.vy || 0);
      if (sp < 4 && (e.r || 0) >= 16) {
        const r = e.r;
        const an = t * 3 + e.x * 0.05;
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
          c.strokeStyle = ga(0.5 * (1 - i / 4));
          c.beginPath();
          c.moveTo(e.x, e.y);
          c.lineTo(e.x + Math.cos(an - i * 0.13) * r, e.y + Math.sin(an - i * 0.13) * r);
          c.stroke();
        }
        c.globalCompositeOperation = 'source-over';
        c.setLineDash([2, 4]);
        c.strokeStyle = ga(0.4);
        c.beginPath();
        c.arc(e.x, e.y, r * 1.04, 0, TAU);
        c.stroke();
        c.setLineDash([]);
        c.strokeStyle = ga(0.7);
        c.beginPath();
        for (let i = 0; i < 4; i++) {
          const a2 = (i * TAU) / 4;
          c.moveTo(e.x + Math.cos(a2) * r * 0.92, e.y + Math.sin(a2) * r * 0.92);
          c.lineTo(e.x + Math.cos(a2) * r * 1.14, e.y + Math.sin(a2) * r * 1.14);
        }
        c.stroke();
        c.font = `7px ${MONO}`;
        c.textAlign = 'left';
        c.textBaseline = 'bottom';
        c.fillStyle = aa(0.9);
        c.fillText('AO-SCAN', e.x + r * 0.72, e.y - r * 0.72);
        return;
      }
      // 움직이는 것: 지나온 점 기록 (작은 네모) + 점선 + 머리 레티클
      const h = e.hist;
      const n = h.length;
      const s = clamp((e.r || 4) + 8, 11, 20) + Math.sin(t * 9 + e.x * 0.07) * 1.2;
      if (n >= 6) {
        c.strokeStyle = ga(0.45);
        c.setLineDash([2, 3]);
        c.beginPath();
        c.moveTo(h[0], h[1]);
        for (let i = 2; i < n; i += 2) c.lineTo(h[i], h[i + 1]);
        c.stroke();
        c.setLineDash([]);
        // 스캔 사다리: 지나온 길을 가로지르는 짧은 녹색 줄 (오래된 쪽이 좁고 옅다) + 점 기록 네모
        c.beginPath();
        for (let i = 0; i < n - 4; i += 6) {
          const dx = h[i + 2] - h[i];
          const dy = h[i + 3] - h[i + 1];
          const L = Math.hypot(dx, dy);
          if (L < 0.3) continue;
          const half = 2 + (5 * i) / n;
          c.moveTo(h[i] - (dy / L) * half, h[i + 1] + (dx / L) * half);
          c.lineTo(h[i] + (dy / L) * half, h[i + 1] - (dx / L) * half);
        }
        c.strokeStyle = ga(0.6);
        c.stroke();
        for (let i = 0; i < n - 4; i += 6) {
          c.strokeStyle = ga(0.3 + (0.6 * i) / n);
          c.strokeRect(h[i] - 1.8, h[i + 1] - 1.8, 3.6, 3.6);
        }
      }
      c.strokeStyle = ga(0.95);
      c.lineWidth = 1.2;
      bracket(c, e.x, e.y, s, s, 4);
      c.fillStyle = A;
      c.fillRect(e.x + s + 1, e.y - s - 2, 2.2, 2.2);
      if ((e.r || 0) >= 8) {
        c.font = `7px ${MONO}`;
        c.textAlign = 'left';
        c.textBaseline = 'bottom';
        c.fillText('TRK', e.x + s + 4, e.y - s + 1);
      }
    },

    hit(api, x, y, w, asSub, e) {
      if (asSub) {
        const code = hex();
        CX.mark(api, x, y, 0.32, (c, k) => {
          const q = ease(k / 0.25);
          const hs = lerp(14, 8, q);
          c.globalAlpha = k > 0.7 ? (((k * 40) | 0) % 2) * 0.8 : 1;
          c.strokeStyle = G;
          c.lineWidth = 1.2;
          bracket(c, x, y, hs, hs, 3);
          c.font = `7px ${MONO}`;
          c.textAlign = 'left';
          c.textBaseline = 'bottom';
          c.fillStyle = A;
          c.fillText(code, x + hs + 2, y - hs + 1);
        });
        return;
      }
      const now = api.t;
      const showTag = !e || !lastTag.has(e) || now - lastTag.get(e) > 0.35;
      if (e && showTag) lastTag.set(e, now);
      const kia = e && e.hp <= 0;
      const text = (kia ? 'KIA ' : 'HIT ') + hex();
      CX.mark(api, x, y, 0.46, (c, k) => {
        const q = ease(k / 0.16);
        const hs = lerp(18, 11, q);
        // 끝에서 깜빡이며 꺼짐
        if (k > 0.72 && ((k * 50) | 0) % 2) return;
        // 녹색 빛
        if (k < 0.3) {
          c.globalCompositeOperation = 'lighter';
          c.fillStyle = ga(0.3 * (1 - k / 0.3));
          c.beginPath();
          c.arc(x, y, 11, 0, TAU);
          c.fill();
          c.globalCompositeOperation = 'source-over';
        }
        c.strokeStyle = A;
        c.lineWidth = 1.8;
        bracket(c, x, y, hs, hs, 5);
        c.strokeStyle = G;
        c.lineWidth = 1.1;
        c.beginPath();
        c.moveTo(x, y - hs - 5);
        c.lineTo(x, y - hs - 1);
        c.moveTo(x, y + hs + 1);
        c.lineTo(x, y + hs + 5);
        c.moveTo(x - hs - 5, y);
        c.lineTo(x - hs - 1, y);
        c.moveTo(x + hs + 1, y);
        c.lineTo(x + hs + 5, y);
        c.stroke();
        if (k < 0.35) {
          const d = 4 * (1 - k / 0.35) + 1.5;
          c.strokeStyle = '#EFFFF5';
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(x, y - d);
          c.lineTo(x + d, y);
          c.lineTo(x, y + d);
          c.lineTo(x - d, y);
          c.closePath();
          c.stroke();
        }
        if (showTag) {
          c.strokeStyle = A;
          c.lineWidth = 0.8;
          c.beginPath();
          c.moveTo(x + hs, y - hs);
          c.lineTo(x + hs + 7, y - hs - 7);
          c.lineTo(x + hs + 10, y - hs - 7);
          c.stroke();
          codeTag(c, x + hs + 10, y - hs - 7, text, kia ? G : A, 7.5, Math.floor(k * 60));
        }
      });
    },

    react(api, e, w) {
      if (w.sub === 'arm_rifle') return reactBarrage(api, e, w);
      if (w.sub === 'arm_laser') return reactPrism(api, e, w);
      return reactTurn(api, e, w);
    },

    // 반응 글씨: 모노 로그 띠가 왼쪽에서 펼쳐지고 → 반응 이름이 타자 치듯 → "성공" 도장 → CRT 처럼 접혀 꺼짐
    label(c, text, x, y, age, life) {
      text = String(text);
      const parts = text.split(' · ');
      const l1 = parts[0];
      const l2 = parts.length > 1 ? '· ' + parts.slice(1).join(' · ') : '';
      const kind = /난사/.test(text) ? 0 : /광선/.test(text) ? 1 : /전향|무리/.test(text) ? 2 : 3;
      const code = ['AR-12', 'LZ-03', 'K9-02', 'RXN'][kind];
      const steps = ['> 지정 → 집중 → 제압', '> 조준 → 분광 → 관통', '> 묶임 → 전향 → 충돌', '> 잠금 → 발사 → 확인'][kind];
      let hsh = 0;
      for (let i = 0; i < text.length; i++) hsh = (hsh * 31 + text.charCodeAt(i)) >>> 0;
      const clock = `${String(10 + (hsh % 12)).padStart(2, '0')}:${String((hsh >>> 4) % 60).padStart(2, '0')}:${String((hsh >>> 10) % 60).padStart(2, '0')}`;
      const head = `OPS-LOG ${clock} // RXN`;

      c.font = `9.5px ${MONO}`;
      const wh = c.measureText(head).width + c.measureText(code).width + 30;
      c.font = `900 21px ${KR}`;
      const w1 = c.measureText(l1).width;
      const w2 = l2 ? c.measureText(l2).width : 0;
      const STAMP = 50;
      const bw = Math.round(Math.min(300, Math.max(176, wh, w1 + 30, w2 + STAMP + 34)));
      const bh = l2 ? 92 : 72;
      x = clamp(x, bw / 2 + 6, W - bw / 2 - 6);
      // 가운데 (x,y). 자리는 공통이 적에서 떨어뜨려 준다 — 판 안에만 붙잡아 둔다
      const x0 = x - bw / 2;
      const y0 = clamp(y - bh / 2, 92, 446 - bh - 6);
      y = y0 + bh / 2;

      const inK = ease(age / 0.16);
      const outK = clamp((age - (life - 0.3)) / 0.3, 0, 1);
      const T0 = 0.16;
      const CHR = 0.036;
      const n1 = l1.length;
      const n2 = l2.length;
      const typed = Math.max(0, Math.floor((age - T0) / CHR));
      const typeEnd = T0 + (n1 + n2) * CHR;
      const tStamp = typeEnd + 0.08;
      const sq = age - tStamp;

      let jx = 0;
      let jy = 0;
      if (sq > 0 && sq < 0.1) {
        jx = rnd(-2, 2);
        jy = rnd(-1.5, 1.5);
      }
      c.translate(x + jx, y + jy);
      if (outK > 0) {
        c.scale(1 + outK * 0.08, Math.max(0.03, 1 - outK * 1.3));
        c.globalAlpha = outK > 0.7 ? (1 - outK) / 0.3 : 1;
      }
      c.translate(-x, -y);

      c.save();
      c.beginPath();
      c.rect(x0 - 6, y0 - 6, (bw + 12) * inK, bh + 12);
      c.clip();
      // 띠
      c.shadowColor = 'rgba(255,181,71,0.4)';
      c.shadowBlur = 16;
      const g = c.createLinearGradient(x0, 0, x0 + bw, 0);
      g.addColorStop(0, 'rgba(44,31,9,0.96)');
      g.addColorStop(1, 'rgba(7,17,12,0.95)');
      c.fillStyle = g;
      c.fillRect(x0, y0, bw, bh);
      c.shadowBlur = 0;
      c.fillStyle = ga(0.045);
      for (let yy = y0 + 2; yy < y0 + bh; yy += 3) c.fillRect(x0, yy, bw, 1);
      // 훑는 밝은 줄 (들어올 때)
      if (age < 0.5) {
        c.fillStyle = ga(0.12 * (1 - age / 0.5));
        c.fillRect(x0, y0 + ((age * 260) % bh), bw, 3);
      }
      c.strokeStyle = A;
      c.lineWidth = 1;
      c.strokeRect(x0 + 0.5, y0 + 0.5, bw - 1, bh - 1);
      c.fillStyle = A;
      c.fillRect(x0, y0, 3.5, bh);
      // 머리줄
      c.textAlign = 'left';
      c.textBaseline = 'top';
      c.font = `9.5px ${MONO}`;
      c.fillStyle = A;
      c.fillText(head, x0 + 12, y0 + 7);
      c.fillStyle = '#8FD9AC';
      c.textAlign = 'right';
      c.fillText(code, x0 + bw - 8, y0 + 7);
      c.textAlign = 'left';
      // 반응 이름 (타자)
      c.font = `900 21px ${KR}`;
      c.shadowColor = 'rgba(255,181,71,0.45)';
      c.shadowBlur = 10;
      const s1 = l1.slice(0, Math.min(n1, typed));
      const s2 = l2.slice(0, clamp(typed - n1, 0, n2));
      c.fillStyle = '#FFF6E6';
      c.fillText(s1, x0 + 12, y0 + 22);
      if (l2) {
        c.fillStyle = A;
        c.fillText(s2, x0 + 12, y0 + 47);
      }
      c.shadowBlur = 0;
      // 커서
      if (age < typeEnd + 0.5 && ((age * 6) | 0) % 2 === 0) {
        const onL2 = l2 && typed > n1;
        const cxp = x0 + 12 + c.measureText(onL2 ? s2 : s1).width + 2;
        c.fillStyle = A;
        c.fillRect(cxp, y0 + (onL2 ? 50 : 25), 8, 19);
      }
      // 꼬리줄 (단계)
      if (age > typeEnd) {
        const ns = Math.floor((age - typeEnd) / 0.025);
        c.font = `9.5px ${MONO}`;
        c.fillStyle = '#8FD9AC';
        c.fillText(steps.slice(0, ns), x0 + 12, y0 + bh - 17);
      }
      c.restore();

      // "성공" 도장
      if (sq > 0) {
        const pop = 1 + 1.1 * (1 - ease(sq / 0.13));
        const sx = x0 + bw - STAMP / 2 - 10;
        const sy = l2 ? y0 + 58 : y0 + 34;
        c.save();
        c.translate(sx, sy);
        c.rotate(-7 * DEG);
        c.scale(pop, pop);
        c.globalAlpha *= Math.min(1, sq / 0.05);
        c.fillStyle = 'rgba(7,17,12,0.7)';
        c.fillRect(-STAMP / 2, -14, STAMP, 28);
        c.strokeStyle = G;
        c.lineWidth = 2;
        c.strokeRect(-STAMP / 2, -14, STAMP, 28);
        c.strokeStyle = ga(0.55);
        c.lineWidth = 0.8;
        c.strokeRect(-STAMP / 2 + 3, -11, STAMP - 6, 22);
        c.font = `900 15px ${KR}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = G;
        c.fillText('성공', 0, 1);
        c.restore();
        if (sq < 0.25) {
          c.save();
          c.globalCompositeOperation = 'lighter';
          c.strokeStyle = ga(0.6 * (1 - sq / 0.25));
          c.lineWidth = 2;
          c.strokeRect(sx - STAMP / 2 - sq * 40, sy - 14 - sq * 24, STAMP + sq * 80, 28 + sq * 48);
          c.restore();
        }
      }
    },
  });
})();
