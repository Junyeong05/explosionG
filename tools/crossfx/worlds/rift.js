// 균열 비전 (rift) · 판타지 마법·유물: 금 룬 고리 · 청록 갈래 번개 · 룬 원 얼음 결정 · 수정 드래곤의 날개 빛 꼬리.
// 판의 적 핵·하늘 균열이 자홍이라 청록·금을 주로 쓰고, 자홍은 번개의 가는 곁가지에만 쓴다.
// 매 프레임 같은 그림(룬 고리·육망 문양·얼음 결정·드래곤 몸·재질·문장·아이콘)은 CX.util.sprite 로 미리 그려 둔다.
(function () {
  const { TAU, rnd, clamp, ease } = CX.util;
  const sprite = CX.util.sprite;
  const CYr = '56,225,255';
  const GDr = '233,196,106';
  const ICEr = '223,250,255';

  // ── 작은 그리기 도우미 ─────────────────────────────────────
  function circ(c, x, y, r) {
    c.beginPath();
    c.arc(x, y, Math.max(0.01, r), 0, TAU);
  }
  function diamond(c, x, y, r) {
    c.beginPath();
    c.moveTo(x, y - r);
    c.lineTo(x + r * 0.7, y);
    c.lineTo(x, y + r);
    c.lineTo(x - r * 0.7, y);
    c.closePath();
  }
  /** 네 갈래 반짝 */
  function star(c, x, y, r) {
    const q = r * 0.2;
    c.beginPath();
    c.moveTo(x, y - r);
    c.lineTo(x + q, y - q);
    c.lineTo(x + r, y);
    c.lineTo(x + q, y + q);
    c.lineTo(x, y + r);
    c.lineTo(x - q, y + q);
    c.lineTo(x - r, y);
    c.lineTo(x - q, y - q);
    c.closePath();
    c.fill();
  }
  function strokePts(c, p) {
    c.beginPath();
    c.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]);
    c.stroke();
  }
  /** 들쭉날쭉한 번개 꺾은선 (양 끝은 고정, 가운데가 가장 흔들림) */
  function boltPts(x1, y1, x2, y2, n, amp) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    const p = [x1, y1];
    for (let i = 1; i < n; i++) {
      const k = i / n;
      const off = (Math.random() * 2 - 1) * amp * Math.sin(Math.PI * k);
      p.push(x1 + dx * k + nx * off, y1 + dy * k + ny * off);
    }
    p.push(x2, y2);
    return p;
  }
  /** 번개 한 줄: 넓은 청록 번짐 + 청록 + 흰 심 (lighter 로 빛) */
  function drawBolt(c, p, a, wide) {
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = `rgba(${CYr},${0.16 * a})`;
    c.lineWidth = wide * 4.4;
    strokePts(c, p);
    c.strokeStyle = `rgba(${CYr},${0.72 * a})`;
    c.lineWidth = wide * 1.5;
    strokePts(c, p);
    c.strokeStyle = `rgba(246,254,255,${a})`;
    c.lineWidth = Math.max(0.8, wide * 0.55);
    strokePts(c, p);
  }
  /** 가늘어지는 리본 (pts: 꼬리→머리 순 [x,y,...]) */
  function ribbon(c, pts, rgb, w0, a0) {
    const n = pts.length >> 1;
    if (n < 2) return;
    c.lineCap = 'round';
    for (let i = 1; i < n; i++) {
      const f = i / (n - 1);
      c.strokeStyle = `rgba(${rgb},${a0 * f * f})`;
      c.lineWidth = 0.5 + w0 * f;
      c.beginPath();
      c.moveTo(pts[2 * i - 2], pts[2 * i - 1]);
      c.lineTo(pts[2 * i], pts[2 * i + 1]);
      c.stroke();
    }
  }

  // ── 미리 그려 두는 그림 ────────────────────────────────────
  // 룬 글자: 단위 칸(0..1) 선분
  const GLYPHS = [
    [[0, 0, 0, 1], [0, 0.15, 0.8, 0], [0, 0.48, 0.8, 0.32]],
    [[0.5, 0, 0.5, 1], [0.5, 0, 0, 0.38], [0.5, 0, 1, 0.38]],
    [[0.5, 0, 0.5, 1], [0.5, 0.5, 0, 0.05], [0.5, 0.5, 1, 0.05]],
    [[0, 0, 0, 1], [0, 0.22, 0.75, 0.5], [0.75, 0.5, 0, 0.78]],
    [[0, 0, 1, 1], [1, 0, 0, 1]],
    [[0, 0, 0, 1], [0, 0, 0.75, 0.25], [0.75, 0.25, 0, 0.5], [0, 0.5, 0.75, 1]],
    [[0.2, 0, 0.8, 0.34], [0.8, 0.34, 0.2, 0.66], [0.2, 0.66, 0.8, 1]],
    [[0, 0, 0, 1], [1, 0, 1, 1], [0, 0, 1, 0.5], [1, 0, 0, 0.5]],
    [[0.5, 0, 1, 0.45], [1, 0.45, 0.5, 0.9], [0.5, 0.9, 0, 0.45], [0, 0.45, 0.5, 0], [0.2, 0.68, 0, 1], [0.8, 0.68, 1, 1]],
  ];
  function glyph(c, g, gw, gh) {
    c.beginPath();
    for (const [x0, y0, x1, y1] of g) {
      c.moveTo((x0 - 0.5) * gw, (y0 - 0.5) * gh);
      c.lineTo((x1 - 0.5) * gw, (y1 - 0.5) * gh);
    }
    c.stroke();
  }

  // 금 룬 고리 (바깥 반지름 46, 100×100)
  let RING = null;
  function ringSpr() {
    if (RING) return RING;
    RING = sprite('rift-ring', 100, 100, (c) => {
      c.translate(50, 50);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.shadowColor = 'rgba(233,196,106,0.9)';
      c.shadowBlur = 7;
      c.strokeStyle = '#F4DC97';
      c.lineWidth = 1.8;
      circ(c, 0, 0, 46);
      c.stroke();
      c.lineWidth = 0.9;
      circ(c, 0, 0, 35.5);
      c.stroke();
      c.lineWidth = 1.2;
      for (let i = 0; i < 12; i++) {
        c.save();
        c.rotate((i / 12) * TAU + 0.13);
        c.translate(0, -40.8);
        glyph(c, GLYPHS[(i * 5) % GLYPHS.length], 4.6, 6.4);
        c.restore();
      }
      c.setLineDash([1.1, 3.1]);
      c.lineWidth = 1.5;
      circ(c, 0, 0, 31);
      c.stroke();
      c.setLineDash([]);
      c.shadowColor = 'rgba(56,225,255,1)';
      c.shadowBlur = 9;
      c.fillStyle = '#8AF2FF';
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        diamond(c, Math.cos(a) * 46, Math.sin(a) * 46, 3.8);
        c.fill();
      }
    });
    return RING;
  }
  /** 룬 고리를 반지름 r 로 */
  function drawRing(c, x, y, r, rot, a) {
    if (a <= 0.01 || r <= 0.5) return;
    const s = r / 46;
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.globalAlpha *= Math.min(1, a);
    c.drawImage(ringSpr(), -50 * s, -50 * s, 100 * s, 100 * s);
    c.restore();
  }

  // 청록 육망 문양 (반지름 34, 80×80)
  let SIG = null;
  function sigilSpr() {
    if (SIG) return SIG;
    SIG = sprite('rift-sigil', 80, 80, (c) => {
      c.translate(40, 40);
      c.lineJoin = 'round';
      c.shadowColor = 'rgba(56,225,255,1)';
      c.shadowBlur = 10;
      c.strokeStyle = 'rgba(130,242,255,0.95)';
      c.lineWidth = 1.3;
      circ(c, 0, 0, 34);
      c.stroke();
      for (let k = 0; k < 2; k++) {
        c.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI / 2 + k * Math.PI + (i * TAU) / 3;
          if (i) c.lineTo(Math.cos(a) * 32, Math.sin(a) * 32);
          else c.moveTo(Math.cos(a) * 32, Math.sin(a) * 32);
        }
        c.closePath();
        c.stroke();
      }
      c.lineWidth = 0.8;
      circ(c, 0, 0, 13.5);
      c.stroke();
      c.fillStyle = '#FFFFFF';
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 6;
        circ(c, Math.cos(a) * 32, Math.sin(a) * 32, 1.5);
        c.fill();
      }
    });
    return SIG;
  }
  function drawSigil(c, x, y, r, rot, a) {
    if (a <= 0.01 || r <= 0.5) return;
    const s = r / 34;
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.globalAlpha *= Math.min(1, a);
    c.drawImage(sigilSpr(), -40 * s, -40 * s, 80 * s, 80 * s);
    c.restore();
  }

  // 얼음 결정 (끝이 위 -y, 10×28)
  let SHARD = null;
  function shardSpr() {
    if (SHARD) return SHARD;
    SHARD = sprite('rift-shard', 10, 28, (c) => {
      c.translate(5, 14);
      const g = c.createLinearGradient(0, -13, 0, 13);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(0.45, '#9FF3FF');
      g.addColorStop(1, '#1E8FB8');
      c.beginPath();
      c.moveTo(0, -13);
      c.lineTo(3.4, -4.5);
      c.lineTo(2.6, 9);
      c.lineTo(0, 13);
      c.lineTo(-2.6, 9);
      c.lineTo(-3.4, -4.5);
      c.closePath();
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = '#EFFFFF';
      c.lineWidth = 0.6;
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.85)';
      c.lineWidth = 0.5;
      c.beginPath();
      c.moveTo(0, -13);
      c.lineTo(0.8, 12);
      c.moveTo(-3.4, -4.5);
      c.lineTo(0.4, -2);
      c.lineTo(3.4, -4.5);
      c.stroke();
    });
    return SHARD;
  }
  /** 얼음 결정 (ang = 끝이 향하는 방향) */
  function drawShard(c, x, y, ang, s, a) {
    c.save();
    c.translate(x, y);
    c.rotate(ang + Math.PI / 2);
    c.globalAlpha *= a;
    c.drawImage(shardSpr(), -5 * s, -14 * s, 10 * s, 28 * s);
    c.restore();
  }

  // 수정 드래곤 몸 (머리가 +x, 46×22, 가슴이 원점 (17,11))
  let DRB = null;
  function dragonSpr() {
    if (DRB) return DRB;
    DRB = sprite('rift-dragon', 46, 22, (c) => {
      c.translate(17, 11);
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.strokeStyle = '#E9C46A';
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(17, -3.6);
      c.lineTo(9, -8.8);
      c.moveTo(17, 3.6);
      c.lineTo(9, 8.8);
      c.moveTo(15, -3.2);
      c.lineTo(11.5, -6.2);
      c.moveTo(15, 3.2);
      c.lineTo(11.5, 6.2);
      c.stroke();
      const g = c.createLinearGradient(-14, -6, 14, 6);
      g.addColorStop(0, '#46C3EC');
      g.addColorStop(0.55, '#1F5C9A');
      g.addColorStop(1, '#122451');
      const body = new Path2D('M-15,0 L-6,-5.6 L4,-5.2 L9,-2.6 L14,-2.2 L14,2.2 L9,2.6 L4,5.2 L-6,5.6 Z');
      c.fillStyle = g;
      c.fill(body);
      c.fillStyle = 'rgba(223,250,255,0.55)';
      c.beginPath();
      c.moveTo(-6, -5.6);
      c.lineTo(4, -5.2);
      c.lineTo(0, 0);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(159,243,255,0.18)';
      c.beginPath();
      c.moveTo(4, -5.2);
      c.lineTo(9, -2.6);
      c.lineTo(0, 0);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(233,196,106,0.55)';
      c.lineWidth = 0.45;
      c.beginPath();
      c.moveTo(-15, 0);
      c.lineTo(14, 0);
      c.moveTo(-6, -5.6);
      c.lineTo(0, 0);
      c.lineTo(-6, 5.6);
      c.moveTo(4, -5.2);
      c.lineTo(0, 0);
      c.lineTo(4, 5.2);
      c.stroke();
      c.strokeStyle = '#E9C46A';
      c.lineWidth = 0.9;
      c.stroke(body);
      const head = new Path2D('M13,-3.6 L18.5,-4.8 L23.5,-2.2 L27.5,0 L23.5,2.2 L18.5,4.8 L13,3.6 Z');
      c.fillStyle = g;
      c.fill(head);
      c.fillStyle = 'rgba(159,243,255,0.42)';
      c.beginPath();
      c.moveTo(18.5, -4.8);
      c.lineTo(23.5, -2.2);
      c.lineTo(19, 0);
      c.closePath();
      c.fill();
      c.stroke(head);
      c.shadowColor = '#38E1FF';
      c.shadowBlur = 8;
      c.fillStyle = '#8AF6FF';
      diamond(c, 20, -2.4, 1.4);
      c.fill();
      diamond(c, 20, 2.4, 1.4);
      c.fill();
      c.shadowBlur = 0;
      c.fillStyle = '#F4DC97';
      for (const sx of [-10, -4.5, 1, 6.5]) {
        diamond(c, sx, 0, 1.3);
        c.fill();
      }
    });
    return DRB;
  }
  // 날개 (가슴 기준, side ±1, sp 펼침 0..1)
  const WING = [[3, 4.5], [-1, 4.5, 12], [-8, 4.5, 24], [-9.5, 4.5, 15.5], [-14, 4.5, 17], [-13.5, 4.5, 8.5], [-18, 4.5, 6.5], [-7, 4]];
  function wingPt(i, sp, side) {
    const p = WING[i];
    return [p[0], side * (p[1] + (p[2] || 0) * sp)];
  }
  /** 꼬리 (pts: 몸 뒤 → 끝) */
  function drawTail(c, pts, w0) {
    const n = pts.length >> 1;
    if (n < 2) return;
    c.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < n; i++) {
        const wd = w0 * (1 - (i - 1) / (n - 1)) + 0.6;
        c.strokeStyle = pass ? '#1F5C9A' : 'rgba(233,196,106,0.9)';
        c.lineWidth = pass ? wd : wd + 1.5;
        c.beginPath();
        c.moveTo(pts[2 * i - 2], pts[2 * i - 1]);
        c.lineTo(pts[2 * i], pts[2 * i + 1]);
        c.stroke();
      }
    }
    c.fillStyle = '#F4DC97';
    diamond(c, pts[2 * n - 2], pts[2 * n - 1], w0 * 0.55 + 1.2);
    c.fill();
  }
  /** 드래곤 한 마리. tail: 세계 좌표 꼬리 점 (없으면 몸 뒤로 곧게 그린다) */
  function drawDragon(c, x, y, dir, S, flap, tail, a, t) {
    const sp = 0.38 + 0.62 * (0.5 + 0.5 * flap);
    c.save();
    c.globalAlpha *= a;
    if (tail) drawTail(c, tail, 3.8 * S);
    c.translate(x, y);
    c.rotate(dir);
    c.scale(S, S);
    if (!tail) {
      const tp = [-13, 0];
      for (let i = 1; i <= 6; i++) tp.push(-13 - i * 5.5, Math.sin(i * 0.9 - t * 9) * i * 0.7);
      drawTail(c, tp, 3.8);
    }
    for (const side of [-1, 1]) {
      c.beginPath();
      for (let i = 0; i < WING.length; i++) {
        const [px, py] = wingPt(i, sp, side);
        if (i) c.lineTo(px, py);
        else c.moveTo(px, py);
      }
      c.closePath();
      c.fillStyle = 'rgba(120,236,255,0.42)';
      c.fill();
      const wr = wingPt(1, sp, side);
      c.strokeStyle = 'rgba(233,196,106,0.75)';
      c.lineWidth = 0.7;
      c.beginPath();
      for (const j of [3, 5, 6]) {
        const q = wingPt(j, sp, side);
        c.moveTo(wr[0], wr[1]);
        c.lineTo(q[0], q[1]);
      }
      c.stroke();
      const s0 = wingPt(0, sp, side);
      const tp = wingPt(2, sp, side);
      c.strokeStyle = '#F4DC97';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(s0[0], s0[1]);
      c.lineTo(wr[0], wr[1]);
      c.lineTo(tp[0], tp[1]);
      c.stroke();
    }
    c.drawImage(dragonSpr(), -17, -11, 46, 22);
    c.restore();
  }
  /** 날개 끝 세계 좌표 (빛 꼬리 기록용) */
  function wingTip(x, y, dir, S, flap, side) {
    const sp = 0.38 + 0.62 * (0.5 + 0.5 * flap);
    const [lx, ly] = wingPt(2, sp, side);
    const cs = Math.cos(dir);
    const sn = Math.sin(dir);
    return [x + (cs * lx - sn * ly) * S, y + (sn * lx + cs * ly) * S];
  }

  // ── 아이콘 (±20 칸, 디자인 시안 그림을 옮김) ──────────────────
  const PATH = {};
  function path(k, d) {
    return PATH[k] || (PATH[k] = new Path2D(d));
  }
  function icWizard(c, small) {
    if (small) {
      // 작은 칸: 금 룬 원 + 굵은 번개
      c.strokeStyle = '#E9C46A';
      c.lineWidth = 1.8;
      circ(c, 0, 0, 16);
      c.stroke();
      const rg = c.createRadialGradient(0, 0, 0, 0, 0, 15);
      rg.addColorStop(0, 'rgba(56,225,255,0.55)');
      rg.addColorStop(1, 'rgba(56,225,255,0)');
      c.fillStyle = rg;
      circ(c, 0, 0, 15);
      c.fill();
      const b = path('wzS', 'M4,-17 L-8,2 L-1,2 L-5,17 L9,-4 L1.5,-4 L7,-17 Z');
      c.fillStyle = '#F6FCFF';
      c.strokeStyle = '#38E1FF';
      c.lineWidth = 1.6;
      c.stroke(b);
      c.fill(b);
      return;
    }
    c.save();
    c.scale(0.88, 0.88);
    c.translate(-2.5, 4.5);
    const rg = c.createRadialGradient(13, -15, 0, 13, -15, 10);
    rg.addColorStop(0, 'rgba(56,225,255,0.7)');
    rg.addColorStop(1, 'rgba(56,225,255,0)');
    c.fillStyle = rg;
    circ(c, 13, -15, 10);
    c.fill();
    const g = c.createLinearGradient(0, -24, 0, 15);
    g.addColorStop(0, '#8562E0');
    g.addColorStop(1, '#2A1A5C');
    const robe = path('wzRobe', 'M0,-14 C-5,-14 -7,-9 -7,-5 L-11,15 L11,15 L7,-5 C7,-9 5,-14 0,-14 Z');
    const hat = path('wzHat', 'M-6.2,-9 C-5,-14 -4,-18 -7,-24 C-1,-20 4,-15 6.2,-9 Z');
    c.fillStyle = g;
    c.strokeStyle = '#D2BEFF';
    c.lineWidth = 1.1;
    c.fill(robe);
    c.stroke(robe);
    c.fill(hat);
    c.stroke(hat);
    c.strokeStyle = '#E9C46A';
    c.lineWidth = 0.9;
    c.stroke(path('wzTrim', 'M0,-2 L0,15 M-7,-5 C-3,-3 3,-3 7,-5 M-6,-9.5 C-2,-8 2,-8 6,-9.5'));
    c.fillStyle = '#0B0816';
    c.beginPath();
    c.ellipse(0, -6.5, 3.4, 3.8, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#5FF0FF';
    circ(c, -1.3, -6.8, 0.85);
    c.fill();
    circ(c, 1.3, -6.8, 0.85);
    c.fill();
    c.strokeStyle = '#E9C46A';
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(8, 15);
    c.lineTo(13, -14);
    c.stroke();
    c.fillStyle = '#DFFAFF';
    c.strokeStyle = '#38E1FF';
    c.lineWidth = 1;
    circ(c, 13, -15, 2.6);
    c.fill();
    c.stroke();
    c.shadowColor = '#38E1FF';
    c.shadowBlur = 6;
    c.strokeStyle = '#E6FCFF';
    c.lineWidth = 1.5;
    c.stroke(path('wzB1', 'M14.6,-17.4 L18,-21 L16.2,-21.6 L20.6,-26.6'));
    c.strokeStyle = '#38E1FF';
    c.lineWidth = 1.1;
    c.stroke(path('wzB2', 'M11.5,-17.5 L9.4,-20.8 L11,-21.3 L8.6,-25'));
    c.restore();
  }
  function icIce(c, small) {
    const rg = c.createRadialGradient(0, 0, 0, 0, 0, 14);
    rg.addColorStop(0, 'rgba(56,225,255,0.5)');
    rg.addColorStop(1, 'rgba(56,225,255,0)');
    c.fillStyle = rg;
    circ(c, 0, 0, 14);
    c.fill();
    if (!small) {
      c.strokeStyle = 'rgba(56,225,255,0.75)';
      c.lineWidth = 0.9;
      c.stroke(path('icArc', 'M-19,-6 A20,20 0 0 1 8,-18 M19,6 A20,20 0 0 1 -8,18'));
    } else {
      c.strokeStyle = '#E9C46A';
      c.lineWidth = 1.6;
      circ(c, 0, 0, 18);
      c.stroke();
    }
    const petal = path('icPetal', 'M0,-17 L2.8,-6 L0,-3 L-2.8,-6 Z');
    const g = c.createLinearGradient(0, -17, 0, -3);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.5, '#9FF3FF');
    g.addColorStop(1, '#1E8FB8');
    for (let i = 0; i < 6; i++) {
      c.save();
      c.rotate((i * TAU) / 6);
      if (small) c.scale(1.15, 1.08);
      c.fillStyle = g;
      c.fill(petal);
      c.strokeStyle = small ? '#E9FDFF' : '#DFFAFF';
      c.lineWidth = small ? 1.1 : 0.6;
      c.stroke(petal);
      if (!small) {
        c.strokeStyle = 'rgba(223,250,255,0.8)';
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(0, -11);
        c.lineTo(3.6, -13.5);
        c.moveTo(0, -11);
        c.lineTo(-3.6, -13.5);
        c.stroke();
      }
      c.restore();
    }
    c.fillStyle = '#FFFFFF';
    c.fill(path('icHex', 'M-3,0 L-1.5,-2.6 L1.5,-2.6 L3,0 L1.5,2.6 L-1.5,2.6 Z'));
    if (!small) {
      c.fillStyle = '#9FF3FF';
      c.fill(path('icFlk', 'M-14,-14 L-12,-11 L-15,-10 Z M15,13 L13,16 L12,12 Z M16,-12 L17,-9 L14,-10 Z'));
    }
  }
  function icDragon(c, small) {
    if (small) {
      // 작은 칸: 금 테 안에 뿔 달린 드래곤 머리 옆모습
      const rg = c.createRadialGradient(0, 0, 0, 0, 0, 17);
      rg.addColorStop(0, 'rgba(56,225,255,0.45)');
      rg.addColorStop(1, 'rgba(56,225,255,0)');
      c.fillStyle = rg;
      circ(c, 0, 0, 17);
      c.fill();
      const hd = path('drHeadS', 'M-15,13 L-12,0 L-8,-8 L-16,-17 L-3,-11 L6,-10 L17,-5 L18.5,-0.5 L8,1.5 L16,6.5 L4,8.5 L-3,16 Z');
      const g = c.createLinearGradient(-15, -17, 18, 16);
      g.addColorStop(0, '#FFF0C2');
      g.addColorStop(0.5, '#E9C46A');
      g.addColorStop(1, '#8A6420');
      c.fillStyle = g;
      c.fill(hd);
      c.strokeStyle = '#1A0B33';
      c.lineWidth = 1.6;
      c.stroke(hd);
      c.fillStyle = '#38E1FF';
      diamond(c, 3, -5.5, 2.6);
      c.fill();
      return;
    }
    c.save();
    c.scale(small ? 0.95 : 0.86, small ? 0.95 : 0.86);
    c.translate(-5, 1);
    c.shadowColor = '#38E1FF';
    c.shadowBlur = small ? 4 : 7;
    c.fillStyle = 'rgba(159,243,255,0.9)';
    c.fill(path('drBreath', 'M18,-14 C22,-17 27,-15 29,-12 C25,-12 22,-11 20,-9 Z'));
    c.shadowBlur = 0;
    const wing = path('drWing', 'M-3,-6 L-6,-23 L-10,-16 L-15,-20 L-16,-11 L-21,-11 L-11,-2 Z');
    c.fillStyle = 'rgba(110,232,255,0.38)';
    c.fill(wing);
    c.strokeStyle = '#E9C46A';
    c.lineWidth = small ? 1.6 : 1.1;
    c.stroke(wing);
    if (!small) {
      c.lineWidth = 0.6;
      c.stroke(path('drBone', 'M-6,-23 L-11,-2 M-15,-20 L-11,-2 M-21,-11 L-11,-2'));
    }
    const g = c.createLinearGradient(-14, -14, 18, 14);
    g.addColorStop(0, '#46C3EC');
    g.addColorStop(0.5, '#1F5C9A');
    g.addColorStop(1, '#122451');
    const body = path('drBody', 'M-14,14 L-11,3 L-6,-4 L0,-9 L8,-13 L18,-14 L14,-10 L20,-8 L12,-5 L6,-1 L4,7 L-2,14 Z');
    c.fillStyle = g;
    c.fill(body);
    c.fillStyle = 'rgba(223,250,255,0.45)';
    c.fill(path('drFacet', 'M0,-9 L8,-13 L6,-1 L-6,-4 Z'));
    c.strokeStyle = '#E9C46A';
    c.lineWidth = small ? 1.7 : 1.1;
    c.stroke(body);
    if (!small) {
      c.lineWidth = 0.6;
      c.globalAlpha = 0.75;
      c.stroke(path('drLines', 'M-11,3 L-6,6 L-8,9 M-6,-4 L-2,0 M-4,8 L1,5'));
      c.globalAlpha = 1;
    }
    c.fillStyle = '#E9C46A';
    c.fill(path('drHorn', 'M8,-13 L3,-20 L11,-14 Z M-14,14 L-17,8 L-12,9 Z M-6,14 L-7,19 L-3,15 Z'));
    c.fillStyle = '#7FF4FF';
    c.fill(path('drEye', 'M3,-9 L7.5,-10.5 L5,-7.6 Z'));
    c.restore();
  }
  const ICONS = { arm_wizard: icWizard, arm_icestorm: icIce, arm_dragon: icDragon };

  // ── 맞는 무늬 ──────────────────────────────────────────────
  /** 메인: 금 룬 고리가 펼쳐지고 수정이 깨져 튄다. 무기마다 파편 색만 다르다 */
  function hitMain(api, x, y, w) {
    const id = w && w.world === 'rift' ? w.id : '';
    const ice = id === 'arm_icestorm';
    const drag = id === 'arm_dragon';
    const rot = rnd(0, TAU);
    const N = ice ? 5 : 4;
    const sh = [];
    for (let i = 0; i < N; i++) sh.push({ a: rot + (i / N) * TAU + rnd(-0.35, 0.35), d: rnd(13, 22), s: rnd(2.3, 3.6), r: rnd(0, TAU), col: ice ? (i % 2 ? '#FFFFFF' : '#9FF3FF') : drag ? (i % 2 ? '#F4DC97' : '#9FF3FF') : i === 0 ? '#FF7AC8' : '#7FEFFF' });
    const cr = [];
    for (let i = 0; i < 3; i++) cr.push([rot + i * 2.09 + rnd(-0.3, 0.3), rnd(9, 15), rnd(-0.6, 0.6)]);
    const life = ice ? 0.34 : 0.42;
    CX.mark(api, x, y, life, (c, k) => {
      c.globalCompositeOperation = 'lighter';
      const q = 1 - k;
      if (k < 0.3) {
        const f = 1 - k / 0.3;
        c.fillStyle = `rgba(${ICEr},${0.75 * f})`;
        circ(c, x, y, 2 + 7 * f);
        c.fill();
      }
      drawRing(c, x, y, (ice ? 6 : 8) + ease(k) * (ice ? 9 : 12), rot + k * 1.6, q * 1.15);
      // 수정 금
      const m = Math.min(1, k * 6);
      c.strokeStyle = `rgba(${CYr},${0.95 * q})`;
      c.lineWidth = 1.2;
      c.lineJoin = 'round';
      c.beginPath();
      for (const [a, L, b] of cr) {
        const mx = x + Math.cos(a) * L * 0.5 * m;
        const my = y + Math.sin(a) * L * 0.5 * m;
        c.moveTo(x, y);
        c.lineTo(mx, my);
        c.lineTo(mx + Math.cos(a + b) * L * 0.5 * m, my + Math.sin(a + b) * L * 0.5 * m);
      }
      c.stroke();
      // 파편
      for (const s of sh) {
        const d = 3 + ease(k) * s.d;
        const px = x + Math.cos(s.a) * d;
        const py = y + Math.sin(s.a) * d;
        const z = s.s * (1 - k * 0.5);
        const rr = s.r + k * 5;
        c.fillStyle = s.col;
        c.globalAlpha = q;
        c.beginPath();
        c.moveTo(px + Math.cos(rr) * z, py + Math.sin(rr) * z);
        c.lineTo(px + Math.cos(rr + 2.4) * z * 0.6, py + Math.sin(rr + 2.4) * z * 0.6);
        c.lineTo(px + Math.cos(rr + 3.9) * z * 0.7, py + Math.sin(rr + 3.9) * z * 0.7);
        c.closePath();
        c.fill();
      }
    });
  }
  /** 보조: 작은 금 룬 고리 + 청록 수정 가시 셋 */
  function hitSub(api, x, y, w) {
    const rot = rnd(0, TAU);
    const sub = w && w.sub;
    CX.mark(api, x, y, 0.32, (c, k) => {
      c.globalCompositeOperation = 'lighter';
      const q = 1 - k;
      drawRing(c, x, y, 5 + ease(k) * 9, rot + k * 2, q * 0.95);
      c.strokeStyle = `rgba(${sub === 'arm_dragon' ? GDr : CYr},${0.9 * q})`;
      c.lineWidth = 1.1;
      c.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = rot + i * 2.09;
        const r0 = 4 + k * 8;
        const r1 = r0 + 5;
        c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
        c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
      }
      c.stroke();
      if (k < 0.35) {
        c.fillStyle = `rgba(${ICEr},${0.8 * (1 - k / 0.35)})`;
        star(c, x, y, 7 * (1 - k / 0.35) + 2);
      }
    });
  }

  // ── 번개 효과 (술사 · 반응 공용) ──────────────────────────────
  function jag(s) {
    const x1 = s.a.x;
    const y1 = s.a.y;
    const x2 = s.b.x;
    const y2 = s.b.y;
    const L = Math.hypot(x2 - x1, y2 - y1) || 1;
    const n = clamp(Math.round(L / 11), 3, 18);
    const amp = clamp(L * 0.09, 3, 15) * (s.amp || 1);
    s.pts = boltPts(x1, y1, x2, y2, n, amp);
    const i = 1 + Math.floor(Math.random() * (n - 1));
    const fx = s.pts[2 * i];
    const fy = s.pts[2 * i + 1];
    const ang = Math.atan2(y2 - y1, x2 - x1) + (Math.random() < 0.5 ? -1 : 1) * rnd(0.5, 1.05);
    const fl = rnd(10, 20) * (s.wide > 2.5 ? 1.7 : 1);
    s.fork = boltPts(fx, fy, fx + Math.cos(ang) * fl, fy + Math.sin(ang) * fl, 3, 3);
  }
  /**
   * segs: [{a:{x,y,e?}, b:{x,y,e}, at, dmg, wide, amp?}] — at 초에 b 를 맞힌다. 같은 점 객체를 이어 쓰면 적을 따라간다.
   * o: {life, react}
   */
  function bolts(api, w, segs, o) {
    const fx = {
      x: segs[0].b.x,
      y: segs[0].b.y,
      vx: 0,
      vy: 0,
      z: 1,
      life: o.life,
      noTrail: !!o.react,
      jt: 0,
      head: segs[0],
      update(dt, a) {
        for (const s of segs) {
          if (s.a.e && s.a.e.alive) (s.a.x = s.a.e.x), (s.a.y = s.a.e.y);
          if (s.b.e && s.b.e.alive) (s.b.x = s.b.e.x), (s.b.y = s.b.e.y);
          if (!s.on && this.age >= s.at) {
            s.on = true;
            s.t0 = this.age;
            this.head = s;
            if (s.b.e) a.hit(w, s.b.e, s.dmg, s.b.x, s.b.y, o.react ? { isReact: true } : null);
            jag(s);
          }
        }
        this.jt -= dt;
        if (this.jt <= 0) {
          this.jt = 0.05;
          for (const s of segs) if (s.on) jag(s);
        }
        const px = this.x;
        const py = this.y;
        this.x = this.head.b.x;
        this.y = this.head.b.y;
        this.vx = (this.x - px) / Math.max(dt, 1e-4);
        this.vy = (this.y - py) / Math.max(dt, 1e-4);
      },
      draw(c) {
        c.globalCompositeOperation = 'lighter';
        const h = this.life * 0.5;
        const fade = this.age < h ? 1 : Math.max(0, 1 - (this.age - h) / h);
        for (const s of segs) {
          if (!s.on || !s.pts) continue;
          const since = this.age - s.t0;
          const fl = since < 0.06 ? 1 : 0.72 + 0.28 * Math.sin(this.age * 95 + s.at * 37);
          drawBolt(c, s.pts, fl * fade, s.wide);
          if (s.fork) {
            c.strokeStyle = `rgba(255,110,196,${0.85 * fade})`;
            c.lineWidth = s.wide > 2.5 ? 1.6 : 1.1;
            strokePts(c, s.fork);
            c.strokeStyle = `rgba(255,236,250,${0.7 * fade})`;
            c.lineWidth = 0.5;
            strokePts(c, s.fork);
          }
          if (since < 0.22) {
            const q = since / 0.22;
            const rg = s.wide > 2.5 ? 26 : 13;
            c.fillStyle = `rgba(${CYr},${0.35 * (1 - q)})`;
            circ(c, s.b.x, s.b.y, rg * (0.5 + q));
            c.fill();
            c.fillStyle = `rgba(${ICEr},${0.9 * (1 - q)})`;
            star(c, s.b.x, s.b.y, rg * 0.7 * (1 - q * 0.6));
          }
        }
      },
    };
    return api.add(fx, w);
  }

  // ── 세 무기 ────────────────────────────────────────────────
  /** 뇌전 술사: 유물함 위에 룬 고리가 모이고 → 청록 갈래 번개가 적에서 적으로 튄다 */
  function fireWizard(api, w, tg) {
    const ox = w.x;
    const oy = w.y - 44;
    CX.mark(api, ox, oy, 0.62, (c, k) => {
      c.globalCompositeOperation = 'lighter';
      const t = k * 0.62;
      const kin = ease(t / 0.2);
      const out = t > 0.28 ? (t - 0.28) / 0.34 : 0;
      drawRing(c, ox, oy, 6 + 11 * kin, t * 5, 1 - out);
      drawSigil(c, ox, oy, 4 + 7 * kin, -t * 7, (1 - out) * 0.9);
      if (t < 0.22) {
        const r = 28 * (1 - t / 0.22) + 2;
        c.fillStyle = `rgba(${CYr},0.95)`;
        for (let i = 0; i < 6; i++) {
          const a = i * 1.047 + t * 7;
          diamond(c, ox + Math.cos(a) * r, oy + Math.sin(a) * r, 2);
          c.fill();
        }
      } else if (t < 0.36) {
        const q = (t - 0.22) / 0.14;
        c.fillStyle = `rgba(${ICEr},${0.9 * (1 - q)})`;
        star(c, ox, oy, 6 + 12 * q);
      }
    });
    api.later(0.21, (a) => {
      const t0 = tg.alive ? tg : a.target('front');
      if (!t0) return;
      const chain = [t0];
      let cur = t0;
      const jumps = Math.random() < 0.6 ? 2 : 3;
      for (let j = 0; j < jumps; j++) {
        let best = null;
        let bd = 1e9;
        for (const n of a.near(cur.x, cur.y, 100)) {
          if (chain.includes(n)) continue;
          const d = (n.x - cur.x) ** 2 + (n.y - cur.y) ** 2;
          if (d < bd) (bd = d), (best = n);
        }
        if (!best) break;
        chain.push(best);
        cur = best;
      }
      const nodes = chain.map((e) => ({ x: e.x, y: e.y, e }));
      const segs = nodes.map((nd, i) => ({ a: i ? nodes[i - 1] : { x: ox, y: oy }, b: nd, at: i * 0.075, dmg: i ? 3 : 4, wide: i ? 1.8 : 2.4 }));
      bolts(a, w, segs, { life: 0.3 + nodes.length * 0.075 });
    });
    return 1.45;
  }

  /** 얼음 폭풍: 목표 자리에 룬 원이 그려지고 → 하늘의 작은 룬 문에서 얼음 결정이 비스듬히 쏟아진다 (느려짐) */
  function fireIce(api, w, tg) {
    const cx = clamp(tg.x, 34, 326);
    const cy = clamp(tg.y + tg.sp * 0.8, 70, 410);
    const R = 42;
    const life = 2.1;
    const gx = cx - 44;
    const gy = Math.max(100, cy - 150);
    api.add(
      {
        x: cx,
        y: cy,
        vx: 0,
        vy: 0,
        r: R,
        z: -1,
        life,
        update(dt, a) {
          if (this.age > 0.3 && this.age < life - 0.3) for (const e of a.near(cx, cy, R)) e.slow = Math.max(e.slow, 0.25);
        },
        draw(c) {
          const t = this.age;
          const kin = ease(t / 0.35);
          const a = t > life - 0.45 ? Math.max(0, (life - t) / 0.45) : 1;
          c.globalCompositeOperation = 'lighter';
          const g = c.createRadialGradient(cx, cy, 0, cx, cy, R);
          g.addColorStop(0, `rgba(${CYr},${0.2 * a * kin})`);
          g.addColorStop(0.7, `rgba(${CYr},${0.08 * a * kin})`);
          g.addColorStop(1, `rgba(${CYr},0)`);
          c.fillStyle = g;
          circ(c, cx, cy, R);
          c.fill();
          // 그어지는 금 원
          if (kin < 1) {
            const e0 = -Math.PI / 2;
            const e1 = e0 + TAU * kin;
            c.strokeStyle = `rgba(${GDr},0.95)`;
            c.lineWidth = 2;
            c.beginPath();
            c.arc(cx, cy, R, e0, e1);
            c.stroke();
            c.fillStyle = `rgba(${ICEr},0.95)`;
            star(c, cx + Math.cos(e1) * R, cy + Math.sin(e1) * R, 5);
          }
          drawRing(c, cx, cy, R, t * 0.5, a * (kin * kin) * 0.95);
          drawSigil(c, cx, cy, R * 0.68, -t * 0.8, a * kin * 0.85);
          // 가장자리 서리 결정 여섯
          const grow = clamp((t - 0.3) / 0.5, 0, 1);
          if (grow > 0) {
            for (let i = 0; i < 6; i++) {
              const an = (i / 6) * TAU + 0.26;
              drawShard(c, cx + Math.cos(an) * (R + 1), cy + Math.sin(an) * (R + 1), an, 0.45 * ease(grow), a * 0.95);
            }
          }
        },
      },
      w,
    );
    // 하늘의 룬 문 (결정이 나오는 곳)
    CX.mark(api, gx, gy, 1.7, (c, k) => {
      const t = k * 1.7;
      const a = t < 0.2 ? t / 0.2 : t > 1.35 ? Math.max(0, (1.7 - t) / 0.35) : 1;
      c.globalCompositeOperation = 'lighter';
      c.save();
      c.translate(gx, gy);
      c.scale(1, 0.34);
      drawRing(c, 0, 0, 26, t * 1.4, a * 0.9);
      drawSigil(c, 0, 0, 18, -t * 2, a * 0.8);
      c.restore();
      c.strokeStyle = `rgba(${CYr},${0.35 * a})`;
      c.lineWidth = 1;
      c.beginPath();
      for (let i = 0; i < 3; i++) {
        const ph = t * 3 + i * 2.1;
        c.moveTo(gx - 30 + i * 6, gy + 6 + i * 3);
        c.quadraticCurveTo(gx + Math.sin(ph) * 10, gy + 14 + i * 4, gx + 30 - i * 6, gy + 6 + i * 3);
      }
      c.stroke();
    });
    const N = 11;
    for (let i = 0; i < N; i++) api.later(0.32 + i * 0.1 + rnd(0, 0.05), (a) => iceShard(a, w, cx, cy, R, gx, gy));
    return 2.7;
  }
  function iceShard(api, w, cx, cy, R, gx, gy) {
    let lx;
    let ly;
    const ins = api.near(cx, cy, R);
    if (ins.length && Math.random() < 0.65) {
      const e = ins[Math.floor(Math.random() * ins.length)];
      lx = e.x + rnd(-4, 4);
      ly = e.y + e.sp * 0.12 + rnd(-3, 3);
    } else {
      const an = rnd(0, TAU);
      const d = Math.sqrt(Math.random()) * R * 0.9;
      lx = cx + Math.cos(an) * d;
      ly = cy + Math.sin(an) * d;
    }
    const sx = gx + rnd(-18, 18);
    const sy = gy + rnd(-3, 3);
    const dur = 0.24;
    const ang = Math.atan2(ly - sy, lx - sx);
    const s = {
      x: sx,
      y: sy,
      vx: 0,
      vy: 0,
      z: 1,
      update(dt, a) {
        const k = Math.min(1, this.age / dur);
        const px = this.x;
        const py = this.y;
        this.x = sx + (lx - sx) * k;
        this.y = sy + (ly - sy) * k;
        this.vx = (this.x - px) / Math.max(dt, 1e-4);
        this.vy = (this.y - py) / Math.max(dt, 1e-4);
        if (k >= 1) {
          const hs = a.near(lx, ly, 12);
          for (const e of hs) a.hit(w, e, 2, lx, ly, { slow: 1.4 });
          if (!hs.length) frostPuff(a, lx, ly);
          return false;
        }
        return true;
      },
      draw(c) {
        c.globalCompositeOperation = 'lighter';
        const tx = this.x - Math.cos(ang) * 26;
        const ty = this.y - Math.sin(ang) * 26;
        const g = c.createLinearGradient(tx, ty, this.x, this.y);
        g.addColorStop(0, `rgba(${CYr},0)`);
        g.addColorStop(1, `rgba(${CYr},0.7)`);
        c.strokeStyle = g;
        c.lineWidth = 2.2;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(tx, ty);
        c.lineTo(this.x, this.y);
        c.stroke();
        c.globalCompositeOperation = 'source-over';
        drawShard(c, this.x, this.y, ang, 0.82, 1);
      },
    };
    api.add(s, w);
  }
  function frostPuff(api, x, y) {
    const r0 = rnd(0, TAU);
    CX.mark(api, x, y, 0.3, (c, k) => {
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(${ICEr},${0.7 * (1 - k)})`;
      c.lineWidth = 1;
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = r0 + (i * TAU) / 6;
        c.moveTo(x + Math.cos(a) * 2, y + Math.sin(a) * 2);
        c.lineTo(x + Math.cos(a) * (4 + k * 8), y + Math.sin(a) * (4 + k * 8));
      }
      c.stroke();
    });
  }

  /** 드래곤: 유물함 위 소환 룬 → 수정 드래곤이 날개 빛 꼬리를 끌며 줄을 꿰뚫고 날아간다 */
  function fireDragon(api, w, tg) {
    const sx = w.x;
    const sy = w.y - 28;
    const tx = tg.x;
    const ty = tg.y + tg.sp * 0.3;
    let dx = tx - sx;
    let dy = ty - sy;
    const L = Math.hypot(dx, dy) || 1;
    dx /= L;
    dy /= L;
    const SP = 320;
    const S = 1.08;
    CX.mark(api, sx, sy, 0.45, (c, k) => {
      c.globalCompositeOperation = 'lighter';
      drawRing(c, sx, sy, 8 + ease(k) * 20, k * 3, 1 - k);
      if (k < 0.35) {
        c.fillStyle = `rgba(${ICEr},${0.9 * (1 - k / 0.35)})`;
        star(c, sx, sy, 14 * (1 - k / 0.35) + 3);
      }
    });
    const d = {
      x: sx,
      y: sy,
      vx: dx * SP,
      vy: dy * SP,
      dir: Math.atan2(dy, dx),
      z: 1,
      bx: sx,
      by: sy,
      flap: 0,
      hitSet: new Set(),
      tipL: [],
      tipR: [],
      tail: [],
      update(dt, a) {
        this.bx += dx * SP * dt;
        this.by += dy * SP * dt;
        const wob = Math.sin(this.age * 7) * 7 * Math.min(1, this.age * 3);
        const px = this.x;
        const py = this.y;
        this.x = this.bx - dy * wob;
        this.y = this.by + dx * wob;
        if (dt > 0) {
          this.vx = (this.x - px) / dt;
          this.vy = (this.y - py) / dt;
          this.dir = Math.atan2(this.vy, this.vx);
        }
        this.flap = Math.sin(this.age * 15);
        const cs = Math.cos(this.dir);
        const sn = Math.sin(this.dir);
        const rx = this.x - cs * 13 * S;
        const ry = this.y - sn * 13 * S;
        const tl = this.tail;
        // 꼬리: 몸 뒤 점을 5px 간격으로 남김 (몸쪽이 앞)
        if (!tl.length || Math.hypot(tl[0] - rx, tl[1] - ry) > 5) {
          tl.unshift(rx, ry);
          if (tl.length > 14) tl.length = 14;
        } else {
          tl[0] = rx;
          tl[1] = ry;
        }
        for (const [arr, side] of [
          [this.tipL, -1],
          [this.tipR, 1],
        ]) {
          const p = wingTip(this.x, this.y, this.dir, S, this.flap, side);
          arr.push(p[0], p[1]);
          if (arr.length > 36) arr.splice(0, 2);
        }
        for (const e of a.near(this.x, this.y, 13)) {
          if (this.hitSet.has(e)) continue;
          this.hitSet.add(e);
          a.hit(w, e, 4, e.x, e.y, { push: 12 });
        }
        return this.y > -60 && this.x > -60 && this.x < 420 && this.age < 3;
      },
      draw(c) {
        const a0 = Math.min(1, this.age / 0.12);
        c.globalCompositeOperation = 'lighter';
        ribbon(c, this.tipL, CYr, 3.2, 0.75 * a0);
        ribbon(c, this.tipR, CYr, 3.2, 0.75 * a0);
        ribbon(c, this.tipL, ICEr, 1, 0.8 * a0);
        ribbon(c, this.tipR, ICEr, 1, 0.8 * a0);
        // 빛 꼬리에 금 반짝
        const n = this.tipL.length >> 1;
        c.fillStyle = `rgba(${GDr},0.95)`;
        for (let i = 2; i < n - 1; i += 4) {
          const arr = i % 8 < 4 ? this.tipL : this.tipR;
          const tw = 0.5 + 0.5 * Math.sin(this.age * 22 + i);
          star(c, arr[2 * i], arr[2 * i + 1], (1 + 2.4 * tw) * (i / n));
        }
        c.globalCompositeOperation = 'source-over';
        drawDragon(c, this.x, this.y, this.dir, S, this.flap, this.tail.length >= 6 ? this.tail : null, a0, this.age);
      },
    };
    api.add(d, w);
    return 2.3;
  }

  // ── 반응 (보조 세계 = 균열 비전의 큰 한 방) ─────────────────────
  /** 갈래 광선 · 강타: 하늘 균열에서 굵은 번개가 내리꽂히고, 맞은 적에서 둘레로 갈래 번개가 한꺼번에 뻗는다 */
  function reactBolt(api, e, w) {
    const ex = e.x;
    const ey = e.y;
    const E = { x: ex, y: ey, e };
    CX.mark(api, ex, ey, 0.8, (c, k) => {
      const x = E.x;
      const y = E.y;
      const t = k * 0.8;
      c.globalCompositeOperation = 'lighter';
      const kin = ease(t / 0.22);
      const a = t < 0.22 ? kin : Math.max(0, 1 - (t - 0.22) / 0.58);
      drawRing(c, x, y, 46 - 20 * kin + (t > 0.22 ? (t - 0.22) * 40 : 0), t * 2.5, a);
      drawSigil(c, x, y, (46 - 20 * kin) * 0.66, -t * 3, a * 0.9);
    });
    api.later(0.2, (a) => {
      const sky = { x: clamp(E.x + rnd(-26, 26), 16, 344), y: 24 };
      const others = a
        .near(E.x, E.y, 125)
        .filter((n) => n !== e)
        .sort((p, q) => (p.x - E.x) ** 2 + (p.y - E.y) ** 2 - ((q.x - E.x) ** 2 + (q.y - E.y) ** 2))
        .slice(0, 5);
      const segs = [{ a: sky, b: E, at: 0, dmg: 8, wide: 3.6, amp: 1.15 }];
      others.forEach((n, i) => segs.push({ a: E, b: { x: n.x, y: n.y, e: n }, at: 0.07 + i * 0.035, dmg: 4, wide: 1.9 }));
      bolts(a, w, segs, { life: 0.62, react: true });
      a.shake(4);
    });
  }

  /** 주문 폭발 · 얼음: 큰 룬 원이 그어져 적을 붙잡고 → 얼음 가시가 사방으로 터진다 (크게 느려짐) */
  function reactFrost(api, e, w) {
    const cx = e.x;
    const cy = e.y;
    const R = 66;
    const sp = [];
    for (let i = 0; i < 14; i++) sp.push({ a: (i / 14) * TAU + rnd(-0.12, 0.12), d: rnd(0.75, 1.15), s: rnd(0.9, 1.5) });
    api.add({
      x: cx,
      y: cy,
      z: 1,
      life: 1.05,
      noTrail: true,
      boom: false,
      update(dt, a) {
        if (this.age < 0.42) for (const n of a.near(cx, cy, R)) n.slow = Math.max(n.slow, 0.6);
        if (!this.boom && this.age >= 0.42) {
          this.boom = true;
          for (const n of a.near(cx, cy, R + 4)) a.hit(w, n, 7, n.x, n.y, { isReact: true, slow: 2.4 });
          a.shake(3.5);
        }
      },
      draw(c) {
        const t = this.age;
        c.globalCompositeOperation = 'lighter';
        if (t < 0.42) {
          const kin = ease(t / 0.32);
          const g = c.createRadialGradient(cx, cy, 0, cx, cy, R);
          g.addColorStop(0, `rgba(${CYr},${0.22 * kin})`);
          g.addColorStop(1, `rgba(${CYr},0)`);
          c.fillStyle = g;
          circ(c, cx, cy, R);
          c.fill();
          const e1 = -Math.PI / 2 + TAU * kin;
          c.strokeStyle = `rgba(${GDr},0.95)`;
          c.lineWidth = 2.2;
          c.beginPath();
          c.arc(cx, cy, R, -Math.PI / 2, e1);
          c.stroke();
          if (kin < 1) {
            c.fillStyle = `rgba(${ICEr},1)`;
            star(c, cx + Math.cos(e1) * R, cy + Math.sin(e1) * R, 7);
          }
          drawRing(c, cx, cy, R, t * 1.2, kin * kin);
          drawSigil(c, cx, cy, R * 0.7, -t * 2.4, kin);
          // 모이는 서리
          for (let i = 0; i < 6; i++) {
            const an = (i / 6) * TAU - Math.PI / 2 - t * 2.4;
            drawShard(c, cx + Math.cos(an) * R * 0.7, cy + Math.sin(an) * R * 0.7, an + Math.PI, 0.5 + 0.4 * kin, kin);
          }
          return;
        }
        const k = (t - 0.42) / 0.63;
        const q = 1 - k;
        if (k < 0.35) {
          const f = 1 - k / 0.35;
          const g = c.createRadialGradient(cx, cy, 0, cx, cy, R * 1.1);
          g.addColorStop(0, `rgba(255,255,255,${0.85 * f})`);
          g.addColorStop(0.45, `rgba(${CYr},${0.4 * f})`);
          g.addColorStop(1, `rgba(${CYr},0)`);
          c.fillStyle = g;
          circ(c, cx, cy, R * 1.1);
          c.fill();
        }
        c.strokeStyle = `rgba(${ICEr},${0.9 * q})`;
        c.lineWidth = 3 * q + 0.6;
        circ(c, cx, cy, R * (0.3 + ease(k) * 1.0));
        c.stroke();
        c.strokeStyle = `rgba(${CYr},${0.35 * q})`;
        c.lineWidth = 9 * q;
        c.stroke();
        drawRing(c, cx, cy, R * (1 + k * 0.25), t * 1.2, q * 0.9);
        c.globalCompositeOperation = 'source-over';
        for (const s of sp) {
          const d = (10 + ease(k * 1.4) * R * 1.05) * s.d;
          drawShard(c, cx + Math.cos(s.a) * d, cy + Math.sin(s.a) * d, s.a, s.s * (1 - k * 0.35), Math.min(1, q * 1.6));
        }
      },
    });
  }

  /** 올가미 돌파 · 강타: 금 룬 올가미가 둘레 적을 조여 끌어모으고 → 큰 수정 드래곤이 하늘에서 내리꽂아 꿰뚫는다 */
  function reactDragon(api, e, w) {
    const cx0 = e.x;
    const cy0 = e.y;
    const bound = [e].concat(
      api
        .near(cx0, cy0, 86)
        .filter((n) => n !== e)
        .sort((p, q) => (p.x - cx0) ** 2 + (p.y - cy0) ** 2 - ((q.x - cx0) ** 2 + (q.y - cy0) ** 2))
        .slice(0, 3),
    );
    const last = bound.map((n) => ({ x: n.x, y: n.y, r: n.r }));
    const side = cx0 < 180 ? -1 : 1;
    const T0 = 0.4;
    const DUR = 0.36;
    const fx = {
      x: cx0,
      y: cy0,
      z: 1,
      life: 1.2,
      noTrail: true,
      cx: cx0,
      cy: cy0,
      struck: false,
      p0: null,
      p1: null,
      update(dt, a) {
        if (e.alive) (this.cx = e.x), (this.cy = e.y);
        bound.forEach((n, i) => {
          if (n.alive) (last[i].x = n.x), (last[i].y = n.y);
        });
        if (this.age < T0 + 0.25) {
          for (let i = 1; i < bound.length; i++) {
            const n = bound[i];
            if (!n.alive) continue;
            const ddx = this.cx - n.x;
            const ddy = this.cy - n.y;
            const dd = Math.hypot(ddx, ddy);
            if (dd > 24) {
              const m = Math.min(1, dt * 3.4);
              n.x += ddx * m;
              n.y += ddy * m;
            }
            n.slow = Math.max(n.slow, 0.4);
          }
        }
        if (!this.p0 && this.age >= T0) {
          // 하늘에서 균열 쪽 대각선으로 내리꽂아 가운데를 지나간다
          this.p0 = { x: this.cx - 150 * side, y: this.cy - 250 };
          this.p1 = { x: this.cx + 66 * side, y: this.cy + 110 };
        }
        if (this.p0 && !this.struck && this.age >= T0 + DUR * 0.7) {
          this.struck = true;
          for (const n of bound) a.hit(w, n, 8, n.x, n.y, { isReact: true, push: 10 });
          for (const n of a.near(this.cx, this.cy, 34)) if (!bound.includes(n)) a.hit(w, n, 5, n.x, n.y, { isReact: true });
          a.shake(5);
        }
      },
      draw(c) {
        const t = this.age;
        const cx = this.cx;
        const cy = this.cy;
        c.globalCompositeOperation = 'lighter';
        // 올가미: 금 룬 고리가 적마다 조이고, 가운데와 금 사슬로 이어진다
        const la = t < T0 + DUR * 0.7 ? Math.min(1, t / 0.12) : Math.max(0, 1 - (t - T0 - DUR * 0.7) / 0.25);
        if (la > 0) {
          const tight = ease(t / 0.3);
          last.forEach((n, i) => {
            const r = 30 - (30 - (n.r + 5)) * tight;
            drawRing(c, n.x, n.y, r, t * (i % 2 ? -3 : 3), la);
            if (i) {
              c.strokeStyle = `rgba(${GDr},${0.85 * la})`;
              c.lineWidth = 1.6;
              c.setLineDash([4, 3]);
              c.lineDashOffset = -t * 40;
              c.beginPath();
              c.moveTo(cx, cy);
              c.lineTo(n.x, n.y);
              c.stroke();
              c.setLineDash([]);
            }
          });
          c.fillStyle = `rgba(${CYr},${0.9 * la})`;
          diamond(c, cx, cy, 4);
          c.fill();
        }
        // 드래곤 강하
        if (this.p0 && t < T0 + DUR + 0.2) {
          const k = (t - T0) / DUR;
          const kk = Math.min(1, k);
          const dx = this.p1.x - this.p0.x;
          const dy = this.p1.y - this.p0.y;
          const hx = this.p0.x + dx * kk;
          const hy = this.p0.y + dy * kk;
          const dir = Math.atan2(dy, dx);
          const S = 1.9;
          const a = k > 1 ? Math.max(0, 1 - (k - 1) / (0.2 / DUR)) : Math.min(1, k * 4);
          const L = Math.hypot(dx, dy);
          const ux = dx / L;
          const uy = dy / L;
          // 날개 빛 꼬리 (곧은 강하라 몸 뒤로 계산)
          for (const sd of [-1, 1]) {
            const pts = [];
            for (let i = 12; i >= 0; i--) {
              const back = i * 12 * Math.min(1, k * 1.6);
              const span = (20 + Math.sin(t * 15 - i * 0.6) * 9) * S;
              pts.push(hx - ux * (back + 14 * S) - uy * span * sd, hy - uy * (back + 14 * S) + ux * span * sd);
            }
            ribbon(c, pts, CYr, 6, 0.6 * a);
            ribbon(c, pts, ICEr, 1.6, 0.8 * a);
          }
          const g = c.createRadialGradient(hx, hy, 0, hx, hy, 46);
          g.addColorStop(0, `rgba(${CYr},${0.35 * a})`);
          g.addColorStop(1, `rgba(${CYr},0)`);
          c.fillStyle = g;
          circ(c, hx, hy, 46);
          c.fill();
          c.globalCompositeOperation = 'source-over';
          drawDragon(c, hx, hy, dir, S, Math.sin(t * 15), null, a * 0.95, t);
          c.globalCompositeOperation = 'lighter';
        }
        // 꿰뚫는 순간: 금 고리 + 수정 깨짐
        const sT = T0 + DUR * 0.7;
        if (t >= sT) {
          const k = Math.min(1, (t - sT) / 0.5);
          const q = 1 - k;
          if (k < 0.3) {
            c.fillStyle = `rgba(255,255,255,${0.8 * (1 - k / 0.3)})`;
            circ(c, cx, cy, 30 * (1 - k / 0.3) + 6);
            c.fill();
          }
          drawRing(c, cx, cy, 20 + ease(k) * 46, t * 2, q);
          c.strokeStyle = `rgba(${CYr},${0.9 * q})`;
          c.lineWidth = 1.4;
          c.beginPath();
          for (let i = 0; i < 7; i++) {
            const an = i * 0.9 + 0.3;
            const r1 = 10 + ease(k) * 40;
            c.moveTo(cx + Math.cos(an) * 6, cy + Math.sin(an) * 6);
            c.lineTo(cx + Math.cos(an + 0.15) * r1 * 0.6, cy + Math.sin(an + 0.15) * r1 * 0.6);
            c.lineTo(cx + Math.cos(an - 0.1) * r1, cy + Math.sin(an - 0.1) * r1);
          }
          c.stroke();
        }
      },
    };
    api.add(fx, w);
  }

  // ── 보조 궤적 층 ───────────────────────────────────────────
  /** 날아가는 머리: 청록·금 두 가닥 빛 리본이 머리를 감아 꼬이며 따라온다 + 반짝 */
  function trailMoving(c, e, t, sub) {
    const h = e.hist;
    const n = h.length >> 1;
    for (let s = 0; s < 2; s++) {
      const rgb = s ? GDr : CYr;
      let px = null;
      let py = 0;
      for (let i = 0; i < n; i++) {
        const j = Math.min(n - 1, i + 1);
        const k0 = Math.max(0, i - 1);
        let dx = h[2 * j] - h[2 * k0];
        let dy = h[2 * j + 1] - h[2 * k0 + 1];
        const L = Math.hypot(dx, dy) || 1;
        dx /= L;
        dy /= L;
        const f = i / (n - 1);
        const off = Math.sin(i * 0.95 - t * 10 + s * Math.PI) * (2 + 4 * f);
        const qx = h[2 * i] - dy * off;
        const qy = h[2 * i + 1] + dx * off;
        if (px != null) {
          c.strokeStyle = `rgba(${rgb},${0.9 * f})`;
          c.lineWidth = 0.6 + 2 * f;
          c.beginPath();
          c.moveTo(px, py);
          c.lineTo(qx, qy);
          c.stroke();
        }
        px = qx;
        py = qy;
      }
    }
    // 반짝 둘 (자취를 따라 흘러감)
    for (let m = 0; m < 2; m++) {
      const u = (t * 2.6 + m * 0.5 + (e.age || 0)) % 1;
      const i = Math.floor((1 - u) * (n - 1));
      const tw = Math.sin(u * Math.PI);
      c.fillStyle = m ? `rgba(${ICEr},${0.95 * tw})` : `rgba(${GDr},${0.95 * tw})`;
      star(c, h[2 * i] + (m ? 3 : -3), h[2 * i + 1], 1.2 + 2.6 * tw);
    }
    subAccent(c, e.x, e.y, h, n, t, sub, e.vx || 0, e.vy || 0);
  }
  /** 멈춘 것 (장판 가운데 · 광선 끝 · 제자리 소환수): 돌고 있는 금 룬 고리 + 도는 청록 빛 */
  function trailStatic(c, e, t, sub) {
    const big = e.r && e.r >= 18;
    const R = big ? e.r * 0.92 : 12;
    drawRing(c, e.x, e.y, R, t * (big ? 0.4 : 1.4), big ? 0.5 : 0.85);
    for (let m = 0; m < 3; m++) {
      const a = t * (big ? 1.2 : 3) + (m * TAU) / 3;
      c.fillStyle = m ? `rgba(${CYr},0.95)` : `rgba(${GDr},0.95)`;
      star(c, e.x + Math.cos(a) * R, e.y + Math.sin(a) * R, 2.6);
    }
    subAccent(c, e.x, e.y, null, 0, t, sub, 0, 0);
  }
  /** 광선 몸: 빛줄기를 청록·금 나선 리본이 감는다 */
  function trailBeam(c, e, t, sub) {
    const life = e.life || 0.35;
    const a = Math.max(0, 1 - (e.age || 0) / life);
    const x1 = e.x1;
    const y1 = e.y1;
    const x2 = e.x2;
    const y2 = e.y2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const L = Math.min(Math.hypot(dx, dy) || 1, 620);
    const ux = dx / (Math.hypot(dx, dy) || 1);
    const uy = dy / (Math.hypot(dx, dy) || 1);
    const n = Math.max(4, Math.round(L / 7));
    for (let s = 0; s < 2; s++) {
      c.strokeStyle = `rgba(${s ? GDr : CYr},${0.85 * a})`;
      c.lineWidth = 1.4;
      c.beginPath();
      for (let i = 0; i <= n; i++) {
        const d = (i / n) * L;
        const off = Math.sin(d * 0.16 - t * 16 + s * Math.PI) * 5;
        const px = x1 + ux * d - uy * off;
        const py = y1 + uy * d + ux * off;
        if (i) c.lineTo(px, py);
        else c.moveTo(px, py);
      }
      c.stroke();
    }
    c.fillStyle = `rgba(${ICEr},${a})`;
    for (let m = 0; m < 4; m++) {
      const d = (((t * 1.7 + m * 0.25) % 1) * L) | 0;
      star(c, x1 + ux * d, y1 + uy * d, 2.4);
    }
    drawRing(c, e.x, e.y, 11, t * 2, a * 0.9);
    subAccent(c, e.x, e.y, null, 0, t, sub, ux, uy);
  }
  /** 보조 무기마다 한 꼬집: 술사 = 파직이는 작은 번개 · 얼음 폭풍 = 서리 결정 · 드래곤 = 금 날개 빛 */
  function subAccent(c, x, y, h, n, t, sub, vx, vy) {
    if (sub === 'arm_wizard') {
      c.strokeStyle = `rgba(${ICEr},0.95)`;
      c.lineWidth = 1;
      for (let m = 0; m < 2; m++) {
        const a = rnd(0, TAU);
        const r = rnd(7, 12);
        strokePts(c, boltPts(x + Math.cos(a) * 3, y + Math.sin(a) * 3, x + Math.cos(a + 0.3) * r, y + Math.sin(a + 0.3) * r, 3, 2.5));
      }
    } else if (sub === 'arm_icestorm') {
      const pts = h && n > 3 ? [Math.floor(n * 0.3), Math.floor(n * 0.65)] : [-1];
      c.strokeStyle = `rgba(${ICEr},0.9)`;
      c.lineWidth = 0.9;
      c.beginPath();
      for (const i of pts) {
        const px = i < 0 ? x + Math.cos(t * 2) * 16 : h[2 * i];
        const py = i < 0 ? y + Math.sin(t * 2) * 16 : h[2 * i + 1];
        const r = 3.2;
        for (let s = 0; s < 3; s++) {
          const a = t * 2 + (s * Math.PI) / 3 + i;
          c.moveTo(px - Math.cos(a) * r, py - Math.sin(a) * r);
          c.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
        }
      }
      c.stroke();
    } else if (sub === 'arm_dragon') {
      const L = Math.hypot(vx, vy) || 1;
      const ux = L > 1e-3 ? vx / L : 0;
      const uy = L > 1e-3 ? vy / L : -1;
      const fl = 0.5 + 0.5 * Math.sin(t * 16);
      c.strokeStyle = `rgba(${GDr},0.95)`;
      c.lineWidth = 1.4;
      c.beginPath();
      for (const sd of [-1, 1]) {
        const wx = -uy * sd;
        const wy = ux * sd;
        const sp = 7 + 5 * fl;
        c.moveTo(x - ux * 2, y - uy * 2);
        c.quadraticCurveTo(x + wx * sp * 0.6 + ux * 2, y + wy * sp * 0.6 + uy * 2, x + wx * sp - ux * 6, y + wy * sp - uy * 6);
      }
      c.stroke();
    }
  }

  // ── 반응 글씨 ──────────────────────────────────────────────
  const LATIN = (t) => (/갈래/.test(t) ? 'FORKED · RAY' : /얼음|주문/.test(t) ? 'FROST · NOVA' : /올가미/.test(t) ? 'LASSO · BREACH' : 'ARC · REACTION');
  function plaque(c, bw, bh) {
    const hw = bw / 2;
    const hh = bh / 2;
    const n = 12;
    c.beginPath();
    c.moveTo(-hw + n, -hh);
    c.lineTo(hw - n, -hh);
    c.lineTo(hw, 0);
    c.lineTo(hw - n, hh);
    c.lineTo(-hw + n, hh);
    c.lineTo(-hw, 0);
    c.closePath();
  }

  CX.world('rift', {
    name: '균열 비전',
    short: '균열',
    desc: '룬 고리에서 청록 갈래 번개 · 목표 위 룬 원에 얼음 결정 · 수정 드래곤의 날개 빛 꼬리. 맞으면 금 룬 고리 + 수정 깨짐.',
    colors: { main: '#38E1FF', soft: '#2A1450' },
    fonts: ['Cinzel', 'Orbit'],

    box(c, x, y, w, h, t) {
      const img = sprite(`rift-box-${Math.round(w)}x${Math.round(h)}`, w, h, (cc, W, H) => {
        cc.fillStyle = '#120826';
        cc.fillRect(0, 0, W, H);
        const g = cc.createRadialGradient(W * 0.4, H * 0.35, 0, W * 0.4, H * 0.35, W * 0.78);
        g.addColorStop(0, '#5A2BA0');
        g.addColorStop(0.55, '#2A1450');
        g.addColorStop(1, '#120826');
        cc.fillStyle = g;
        cc.fillRect(0, 0, W, H);
        const m = cc.createRadialGradient(W * 0.72, H * 0.24, 0, W * 0.72, H * 0.24, W * 0.34);
        m.addColorStop(0, 'rgba(255,63,164,0.16)');
        m.addColorStop(1, 'rgba(255,63,164,0)');
        cc.fillStyle = m;
        cc.fillRect(0, 0, W, H);
        const q = cc.createRadialGradient(W * 0.26, H * 0.8, 0, W * 0.26, H * 0.8, W * 0.36);
        q.addColorStop(0, 'rgba(56,225,255,0.14)');
        q.addColorStop(1, 'rgba(56,225,255,0)');
        cc.fillStyle = q;
        cc.fillRect(0, 0, W, H);
        const cx = W / 2;
        const cy = H / 2;
        const r = W * 0.387;
        cc.strokeStyle = 'rgba(233,196,106,0.75)';
        cc.lineWidth = W * 0.016;
        circ(cc, cx, cy, r);
        cc.stroke();
        cc.globalAlpha = 0.5;
        cc.setLineDash([W * 0.017, W * 0.042]);
        cc.lineWidth = W * 0.027;
        circ(cc, cx, cy, r * 0.875);
        cc.stroke();
        cc.setLineDash([]);
        cc.globalAlpha = 1;
        cc.fillStyle = '#E9C46A';
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU - Math.PI / 2;
          diamond(cc, cx + Math.cos(a) * r, cy + Math.sin(a) * r, W * 0.034);
          cc.fill();
        }
        cc.fillStyle = '#EDE4FF';
        for (const [px, py, pr] of [
          [0.19, 0.29, 0.011],
          [0.81, 0.77, 0.012],
          [0.74, 0.16, 0.009],
          [0.26, 0.81, 0.01],
        ]) {
          circ(cc, W * px, H * py, W * pr);
          cc.fill();
        }
      });
      c.drawImage(img, x, y, w, h);
      // 금 테를 따라 도는 청록 빛 하나 (유물이 살아 있다)
      const a = (t || 0) * 0.9;
      const r = w * 0.387;
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(56,225,255,0.9)';
      circ(c, x + w / 2 + Math.cos(a) * r, y + h / 2 + Math.sin(a) * r, w * 0.03);
      c.fill();
    },

    crest(c, x, y, r) {
      const img = sprite(`rift-crest-${Math.round(r * 4)}`, r * 2, r * 2, (cc) => {
        cc.scale(r / 10, r / 10);
        cc.fillStyle = '#2A1450';
        cc.strokeStyle = '#E9C46A';
        cc.lineWidth = 1.3;
        circ(cc, 10, 10, 9.2);
        cc.fill();
        cc.stroke();
        cc.lineWidth = 0.8;
        cc.setLineDash([1.6, 1.2]);
        circ(cc, 10, 10, 6);
        cc.stroke();
        cc.setLineDash([]);
        cc.fillStyle = '#38E1FF';
        cc.beginPath();
        cc.moveTo(10, 5.6);
        cc.lineTo(12.6, 10);
        cc.lineTo(10, 14.4);
        cc.lineTo(7.4, 10);
        cc.closePath();
        cc.fill();
        cc.fillStyle = '#FFFFFF';
        circ(cc, 10, 10, 1.2);
        cc.fill();
      });
      c.drawImage(img, x, y, r * 2, r * 2);
    },

    icon(c, id, x, y, s) {
      const fn = ICONS[id];
      if (!fn) {
        // 다른 세계 무기: 금 룬 원 + 첫 글자
        drawRing(c, x, y, s * 0.36, 0, 0.9);
        c.font = `${Math.round(s * 0.36)}px "Orbit", "Noto Sans KR", sans-serif`;
        c.fillStyle = '#F4DC97';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText((CX.data.weapons[id] || { name: '?' }).name.slice(0, 1), x, y + 1);
        return;
      }
      const small = s < 22;
      const S = s * 1.3;
      const img = sprite(`rift-ic-${id}-${Math.round(s * 2)}`, S, S, (cc) => {
        cc.translate(S / 2, S / 2);
        cc.scale(s / 40, s / 40);
        cc.lineJoin = 'round';
        cc.lineCap = 'round';
        fn(cc, small);
      });
      c.drawImage(img, x - S / 2, y - S / 2, S, S);
    },

    fire(api, w, tg) {
      const id = w.id;
      if (id === 'arm_wizard' || (!ICONS[id] && w.cat === 'ray')) return fireWizard(api, w, tg);
      if (id === 'arm_dragon' || (!ICONS[id] && (w.cat === 'charge' || w.cat === 'summon'))) return fireDragon(api, w, tg);
      return fireIce(api, w, tg);
    },

    trail(c, e, t, w) {
      const sub = w && w.sub;
      c.globalCompositeOperation = 'lighter';
      if (e.x1 != null && e.x2 != null) return trailBeam(c, e, t, sub);
      const h = e.hist;
      const n = h ? h.length >> 1 : 0;
      const moving = n >= 3 && Math.abs(h[h.length - 2] - h[0]) + Math.abs(h[h.length - 1] - h[1]) > 9;
      if (moving) trailMoving(c, e, t, sub);
      else trailStatic(c, e, t, sub);
    },

    hit(api, x, y, w, asSub) {
      if (asSub) hitSub(api, x, y, w);
      else hitMain(api, x, y, w);
    },

    react(api, e, w) {
      const id = w.sub;
      if (id === 'arm_icestorm') reactFrost(api, e, w);
      else if (id === 'arm_dragon') reactDragon(api, e, w);
      else reactBolt(api, e, w);
    },

    /** 금테 각인판: 가운데서 좌우로 봉인이 풀리듯 열리고 → 빛이 한 번 훑고 → 금 가루로 흩어지며 떠오른다 */
    label(c, text, x, y, age, life) {
      const parts = String(text).split(/\s*·\s*/);
      const l1 = parts[0] || '';
      const l2 = parts.slice(1).join(' · ');
      const kin = ease(age / 0.3);
      const out = clamp((age - (life - 0.4)) / 0.4, 0, 1);
      c.font = '19px "Orbit", "Noto Sans KR", sans-serif';
      const w1 = c.measureText(l1).width;
      c.font = '16px "Orbit", "Noto Sans KR", sans-serif';
      const w2 = l2 ? c.measureText(l2).width + 30 : 0;
      const bw = clamp(Math.max(w1, w2) + 54, 146, 206);
      const bh = l2 ? 66 : 52;
      c.translate(x, y - out * 14);
      c.globalAlpha = 1 - out;
      const sx = 0.06 + 0.94 * kin;
      const sy = 1 - out * 0.25;
      // 판
      c.save();
      c.scale(sx, sy);
      plaque(c, bw, bh);
      const g = c.createLinearGradient(0, -bh / 2, 0, bh / 2);
      g.addColorStop(0, 'rgba(52,26,98,0.9)');
      g.addColorStop(0.5, 'rgba(22,10,44,0.86)');
      g.addColorStop(1, 'rgba(42,20,80,0.9)');
      c.fillStyle = g;
      c.fill();
      const gh = c.createLinearGradient(-bw / 2, 0, bw / 2, 0);
      gh.addColorStop(0, '#8A6420');
      gh.addColorStop(0.5, '#FFF0C2');
      gh.addColorStop(1, '#8A6420');
      c.strokeStyle = gh;
      c.lineWidth = 1.8;
      c.stroke();
      plaque(c, bw - 9, bh - 8);
      c.strokeStyle = 'rgba(233,196,106,0.5)';
      c.lineWidth = 0.6;
      c.stroke();
      c.restore();
      // 양 끝 청록 마름모 (돈다)
      c.save();
      c.shadowColor = '#38E1FF';
      c.shadowBlur = 8;
      c.fillStyle = '#7FEFFF';
      for (const sd of [-1, 1]) {
        const px = (sd * bw * sx) / 2;
        const s = 4.5 * (0.75 + 0.25 * Math.cos(age * 6));
        diamond(c, px, 0, s);
        c.fill();
      }
      c.restore();
      // 글씨: 열리는 판 안쪽으로만 드러남
      c.save();
      c.scale(sx, sy);
      plaque(c, bw, bh);
      c.restore();
      c.save();
      c.clip();
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const ty = l2 ? -3 : 5;
      c.font = '700 7.5px "Cinzel", serif';
      if ('letterSpacing' in c) c.letterSpacing = '2px';
      c.fillStyle = '#E9C46A';
      c.fillText(LATIN(text), 0, l2 ? -22 : -14);
      if ('letterSpacing' in c) c.letterSpacing = '0px';
      c.font = '19px "Orbit", "Noto Sans KR", sans-serif';
      c.fillStyle = '#3A2408';
      c.fillText(l1, 0, ty + 2);
      c.shadowColor = 'rgba(233,196,106,0.75)';
      c.shadowBlur = 10;
      c.fillStyle = '#F6DE98';
      c.fillText(l1, 0, ty);
      if (l2) {
        c.font = '16px "Orbit", "Noto Sans KR", sans-serif';
        c.shadowColor = 'rgba(56,225,255,0.95)';
        c.shadowBlur = 12;
        c.fillStyle = '#FFFFFF';
        c.fillText(l2, 0, 18);
        c.shadowBlur = 0;
        const hw = c.measureText(l2).width / 2 + 11;
        c.fillStyle = '#7FEFFF';
        diamond(c, -hw, 18, 3);
        c.fill();
        diamond(c, hw, 18, 3);
        c.fill();
      }
      c.shadowBlur = 0;
      // 빛 한 번 훑기
      if (age > 0.22 && age < 0.8) {
        const k = (age - 0.22) / 0.58;
        const gx = -bw / 2 - 30 + (bw + 60) * k;
        const sg = c.createLinearGradient(gx - 24, 0, gx + 24, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5, 'rgba(255,250,225,0.32)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = sg;
        c.fillRect(-bw / 2, -bh / 2, bw, bh);
      }
      c.restore();
      // 들어올 때 모서리 반짝 · 나갈 때 금 가루
      c.globalCompositeOperation = 'lighter';
      if (age < 0.45) {
        const q = age / 0.45;
        c.fillStyle = `rgba(255,248,220,${1 - q})`;
        for (const [px, py] of [
          [-bw / 2 + 12, -bh / 2],
          [bw / 2 - 12, bh / 2],
        ])
          star(c, px * sx, py, 3 + 6 * Math.sin(q * Math.PI));
      }
      if (out > 0) {
        c.fillStyle = `rgba(${GDr},${1 - out})`;
        for (let i = 0; i < 10; i++) {
          const px = -bw / 2 + ((i + 0.5) * bw) / 10 + Math.sin(i * 2.3 + out * 6) * 4;
          const py = bh / 2 - out * (16 + ((i * 37) % 10) * 3.4);
          diamond(c, px, py, 1.8);
          c.fill();
        }
      }
    },
  });
})();
