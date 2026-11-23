// 강철 공방 (steel): 디젤펑크 기계·포. 리벳 강판 · 놋쇠 · 쇳물 주황 · 짧게 끊는 연기.
//   대포   = 유물함 위로 놋쇠 포신이 나와 반동 → 쇳덩이 포탄이 연기를 끌며 포물선 (땅 그림자) → 쇳불꽃 · 연기 고리 · 그을음
//   회전톱 = 톱니 원반이 날아가 적에 박혀 갈아내고(불꽃 분수) 다음 적으로 튕긴다, 다 쓰면 유물함으로 돌아온다
//   지뢰밭 = 놋쇠 지뢰를 적 앞길에 던져 깐다 → 빨간 등이 깜빡 (적이 다가오면 빨라짐) → 밟히면 튀어 올라 터지고 옆 지뢰도 유폭
// 보조일 때: 궤적 = 연기 뭉치 + 쇳물 줄 + 불티 / 맞는 무늬 = 작은 쇳불꽃 / 반응 = 낙뢰 포격 · 톱니 올가미 · 덫 사슬 / 글씨 = 리벳 금속판 음각
(function () {
  const { TAU, rnd, clamp, ease } = CX.util;
  const spr = CX.util.sprite;
  const BOX = CX.size.BOX;
  const LINE_Y = CX.size.LINE_Y;
  // 지뢰밭 아이콘: 지뢰 둘 자리 (x, y, 크기) 와 아이콘 칸에 맞추는 확대
  const MI = [
    [15, 19, 0.74],
    [28, 32, 1.12],
  ];
  const MI_C = [23.5, 26.5];
  const MI_S = 1.24;
  // 지뢰 그림 확대 (24×16 그림 → 30×20)
  const MS = 1.25;

  // ── 미리 그려 두는 그림 ───────────────────────────────────────
  function radial(c, w, h, stops) {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    for (const [o, col] of stops) g.addColorStop(o, col);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }
  const S = {
    // 쇳불 빛 (lighter 로 얹음)
    glow: () =>
      spr('steel:glow', 32, 32, (c, w, h) =>
        radial(c, w, h, [
          [0, 'rgba(255,244,220,1)'],
          [0.22, 'rgba(255,190,110,0.85)'],
          [0.55, 'rgba(255,106,19,0.32)'],
          [1, 'rgba(255,106,19,0)'],
        ]),
      ),
    // 쇳물 불덩이 (가운데 흰 → 주황)
    hot: () =>
      spr('steel:hot', 32, 32, (c, w, h) =>
        radial(c, w, h, [
          [0, 'rgba(255,246,226,1)'],
          [0.25, 'rgba(255,214,150,0.95)'],
          [0.6, 'rgba(255,140,48,0.75)'],
          [0.85, 'rgba(255,106,19,0.3)'],
          [1, 'rgba(255,106,19,0)'],
        ]),
      ),
    red: () =>
      spr('steel:red', 16, 16, (c, w, h) =>
        radial(c, w, h, [
          [0, 'rgba(255,230,210,1)'],
          [0.3, 'rgba(255,60,30,0.85)'],
          [1, 'rgba(255,30,10,0)'],
        ]),
      ),
    // 연기 한 뭉치 (회색, 어두운 판 위에서 옅은 안개로 읽힌다)
    smoke: () =>
      spr('steel:smoke', 32, 32, (c, w, h) =>
        radial(c, w, h, [
          [0, 'rgba(222,216,206,0.95)'],
          [0.45, 'rgba(176,170,160,0.6)'],
          [1, 'rgba(130,126,120,0)'],
        ]),
      ),
    // 그을음 (땅에 남는 자국)
    scorch: () =>
      spr('steel:scorch', 48, 30, (c, w, h) => {
        c.save();
        c.translate(w / 2, h / 2);
        c.scale(1, h / w);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, w / 2);
        g.addColorStop(0, 'rgba(8,6,6,0.9)');
        g.addColorStop(0.5, 'rgba(20,14,12,0.55)');
        g.addColorStop(1, 'rgba(20,14,12,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(0, 0, w / 2, 0, TAU);
        c.fill();
        // 짧게 갈라진 금 몇 줄
        c.strokeStyle = 'rgba(0,0,0,0.45)';
        c.lineWidth = 0.9;
        c.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + 0.4;
          const r0 = 6 + (i % 2) * 2;
          c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
          c.lineTo(Math.cos(a + 0.18) * (r0 + 4), Math.sin(a + 0.18) * (r0 + 4));
          c.lineTo(Math.cos(a - 0.05) * (r0 + 7), Math.sin(a - 0.05) * (r0 + 7));
        }
        c.stroke();
        // 식어 가는 쇳물 점
        c.fillStyle = 'rgba(255,120,40,0.5)';
        for (let i = 0; i < 3; i++) {
          const a = i * 2.2 + 0.6;
          c.beginPath();
          c.arc(Math.cos(a) * 4, Math.sin(a) * 4, 0.8, 0, TAU);
          c.fill();
        }
        c.restore();
      }),
    // 쇳덩이 포탄
    shell: () =>
      spr('steel:shell', 14, 14, (c) => {
        const g = c.createRadialGradient(5, 5, 0.5, 7, 7, 6.5);
        g.addColorStop(0, '#E6E8EB');
        g.addColorStop(0.35, '#7E848C');
        g.addColorStop(1, '#141518');
        c.fillStyle = g;
        c.beginPath();
        c.arc(7, 7, 6, 0, TAU);
        c.fill();
        c.strokeStyle = '#0B0C0E';
        c.lineWidth = 0.8;
        c.stroke();
        // 주물 이음매
        c.strokeStyle = 'rgba(201,162,77,0.8)';
        c.lineWidth = 0.9;
        c.beginPath();
        c.arc(7, 7, 4.2, 0.4, 2.2);
        c.stroke();
      }),
    // 포신 (밑동이 아래, 포구가 위)
    barrel: () =>
      spr('steel:barrel', 14, 30, (c) => {
        const g = c.createLinearGradient(0, 0, 14, 0);
        g.addColorStop(0, '#3A2508');
        g.addColorStop(0.35, '#B88A3E');
        g.addColorStop(0.5, '#F2D48A');
        g.addColorStop(0.72, '#8C6224');
        g.addColorStop(1, '#2A1A08');
        c.fillStyle = g;
        c.strokeStyle = '#1A0F04';
        c.lineWidth = 0.9;
        c.beginPath();
        c.moveTo(1.4, 30);
        c.lineTo(3, 4);
        c.lineTo(11, 4);
        c.lineTo(12.6, 30);
        c.closePath();
        c.fill();
        c.stroke();
        for (const [y, hgt] of [
          [19, 2.4],
          [10, 2],
        ]) {
          c.fillRect(1.6, y, 10.8, hgt);
          c.strokeRect(1.6, y, 10.8, hgt);
        }
        c.fillRect(1.2, 1, 11.6, 4);
        c.strokeRect(1.2, 1, 11.6, 4);
        c.fillStyle = '#080504';
        c.beginPath();
        c.ellipse(7, 2.2, 3.4, 1.2, 0, 0, TAU);
        c.fill();
        c.fillStyle = 'rgba(58,42,10,0.9)';
        for (const x of [4, 10]) {
          c.beginPath();
          c.arc(x, 20.2, 0.7, 0, TAU);
          c.fill();
        }
      }),
    // 톱니 원반 (아이콘·투사체 같이 씀)
    saw: () =>
      spr('steel:saw', 48, 48, (c) => {
        c.translate(24, 24);
        const N = 18;
        const step = TAU / N;
        c.beginPath();
        for (let i = 0; i < N; i++) {
          const a = i * step;
          c.lineTo(Math.cos(a) * 16.6, Math.sin(a) * 16.6);
          c.lineTo(Math.cos(a + step * 0.78) * 21.5, Math.sin(a + step * 0.78) * 21.5);
          c.lineTo(Math.cos(a + step * 0.92) * 17.2, Math.sin(a + step * 0.92) * 17.2);
        }
        c.closePath();
        const g = c.createLinearGradient(-21, -10, 21, 10);
        g.addColorStop(0, '#4A4F56');
        g.addColorStop(0.3, '#A4AAB2');
        g.addColorStop(0.46, '#F0F2F4');
        g.addColorStop(0.62, '#8A9098');
        g.addColorStop(1, '#3A3E44');
        c.fillStyle = g;
        c.fill();
        c.strokeStyle = '#17181B';
        c.lineWidth = 1;
        c.stroke();
        // 날 끝 빛 (어두운 판에서 톱니가 읽히게)
        c.strokeStyle = 'rgba(240,242,244,0.55)';
        c.lineWidth = 0.8;
        c.beginPath();
        c.arc(0, 0, 18.6, 0, TAU);
        c.stroke();
        c.strokeStyle = 'rgba(23,24,27,0.5)';
        c.lineWidth = 0.7;
        c.beginPath();
        c.arc(0, 0, 13.5, 0, TAU);
        c.stroke();
        // 팽창 홈 셋
        c.strokeStyle = '#17181B';
        c.lineWidth = 2.6;
        c.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.arc(0, 0, 9.5, (i * TAU) / 3, (i * TAU) / 3 + 0.8);
          c.stroke();
        }
        // 놋쇠 축
        const b = c.createLinearGradient(-6, -6, 6, 6);
        b.addColorStop(0, '#F2D48A');
        b.addColorStop(0.5, '#C9A24D');
        b.addColorStop(1, '#6E5016');
        c.fillStyle = b;
        c.beginPath();
        c.arc(0, 0, 6, 0, TAU);
        c.fill();
        c.strokeStyle = '#3A2A0A';
        c.lineWidth = 0.8;
        c.stroke();
        c.fillStyle = '#2B2E33';
        c.beginPath();
        for (let i = 0; i < 6; i++) c.lineTo(Math.cos((i * TAU) / 6) * 2.8, Math.sin((i * TAU) / 6) * 2.8);
        c.closePath();
        c.fill();
      }),
    // 지뢰 한 개 (가운데 (12,8), 신관 등 자리 (12,2.4))
    mine: () => spr('steel:mine', 24, 16, (c) => drawMineBody(c, 12, 8, 1)),
    mines: () =>
      spr('steel:mines', 48, 48, (c) => {
        c.translate(24, 24);
        c.scale(MI_S, MI_S);
        c.translate(-MI_C[0], -MI_C[1]);
        c.strokeStyle = '#C9A24D';
        c.lineWidth = 1.1;
        c.setLineDash([2.2, 1.6]);
        c.beginPath();
        c.moveTo(15, 18);
        c.quadraticCurveTo(26, 14, 31, 30);
        c.stroke();
        c.setLineDash([]);
        for (const [x, y, s] of MI) drawMineBody(c, x, y, s);
      }),
    cannon: () =>
      spr('steel:cannon', 48, 48, (c) => {
        c.translate(24, 24);
        c.scale(1.13, 1.13);
        c.translate(-23, -27);
        // 포가 꼬리 (강철)
        const st = c.createLinearGradient(0, 24, 0, 44);
        st.addColorStop(0, '#C6CBD1');
        st.addColorStop(0.5, '#6C7178');
        st.addColorStop(1, '#25272B');
        c.fillStyle = st;
        c.strokeStyle = '#0B0C0E';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(19, 27);
        c.lineTo(25, 31);
        c.lineTo(9, 43);
        c.lineTo(3.5, 41);
        c.closePath();
        c.fill();
        c.stroke();
        // 포신 (놋쇠·청동), 오른쪽 위로
        c.save();
        c.translate(21, 29);
        c.rotate(-0.66);
        const g = c.createLinearGradient(0, -6, 0, 6);
        g.addColorStop(0, '#3A2508');
        g.addColorStop(0.3, '#E8C378');
        g.addColorStop(0.55, '#B88A3E');
        g.addColorStop(1, '#2A1A08');
        c.fillStyle = g;
        c.strokeStyle = '#1A0F04';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(-9, -5.6);
        c.lineTo(19, -3.8);
        c.lineTo(19, 3.8);
        c.lineTo(-9, 5.6);
        c.closePath();
        c.fill();
        c.stroke();
        for (const x of [-3, 7]) {
          c.fillRect(x, -5.4, 2.4, 10.8);
          c.strokeRect(x, -5.4, 2.4, 10.8);
        }
        c.fillRect(17.5, -5, 4, 10);
        c.strokeRect(17.5, -5, 4, 10);
        c.beginPath();
        c.arc(-10.5, 0, 3, 0, TAU);
        c.fill();
        c.stroke();
        c.fillStyle = '#080504';
        c.beginPath();
        c.ellipse(21.6, 0, 1.3, 3, 0, 0, TAU);
        c.fill();
        c.fillStyle = 'rgba(255,106,19,0.85)';
        c.beginPath();
        c.ellipse(21.8, 0, 0.6, 1.6, 0, 0, TAU);
        c.fill();
        c.restore();
        // 바퀴 (놋쇠 테 · 강철 살)
        c.save();
        c.translate(21, 32);
        c.strokeStyle = '#0B0C0E';
        c.lineWidth = 4.6;
        c.beginPath();
        c.arc(0, 0, 10, 0, TAU);
        c.stroke();
        c.strokeStyle = '#C9A24D';
        c.lineWidth = 2.8;
        c.stroke();
        c.strokeStyle = '#F2D48A';
        c.lineWidth = 0.7;
        c.beginPath();
        c.arc(0, 0, 10.6, -2.6, -1.2);
        c.stroke();
        c.strokeStyle = '#2B2E33';
        c.lineWidth = 1.6;
        c.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + 0.2;
          c.moveTo(Math.cos(a) * 2.4, Math.sin(a) * 2.4);
          c.lineTo(Math.cos(a) * 8.6, Math.sin(a) * 8.6);
        }
        c.stroke();
        c.fillStyle = '#C9A24D';
        c.strokeStyle = '#3A2A0A';
        c.lineWidth = 0.8;
        c.beginPath();
        c.arc(0, 0, 3, 0, TAU);
        c.fill();
        c.stroke();
        c.restore();
      }),
    crest: () =>
      spr('steel:crest', 20, 20, (c) => {
        c.fillStyle = '#2B2E33';
        c.strokeStyle = '#C9A24D';
        c.lineWidth = 1.2;
        c.beginPath();
        c.arc(10, 10, 9.2, 0, TAU);
        c.fill();
        c.stroke();
        c.translate(10, 10);
        c.fillStyle = '#C9A24D';
        c.beginPath();
        const N = 9;
        for (let i = 0; i < N; i++) {
          const a = (i / N) * TAU;
          const s = TAU / N;
          c.lineTo(Math.cos(a - s * 0.22) * 5.2, Math.sin(a - s * 0.22) * 5.2);
          c.lineTo(Math.cos(a - s * 0.14) * 7.3, Math.sin(a - s * 0.14) * 7.3);
          c.lineTo(Math.cos(a + s * 0.14) * 7.3, Math.sin(a + s * 0.14) * 7.3);
          c.lineTo(Math.cos(a + s * 0.22) * 5.2, Math.sin(a + s * 0.22) * 5.2);
        }
        c.closePath();
        c.fill();
        c.fillStyle = '#2B2E33';
        c.beginPath();
        c.arc(0, 0, 2.3, 0, TAU);
        c.fill();
      }),
  };

  function drawMineBody(c, x, y, s) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    // 옆 띠
    c.fillStyle = '#1F2226';
    c.beginPath();
    c.moveTo(-11, 0);
    c.lineTo(-11, 3);
    c.ellipse(0, 3, 11, 3.8, 0, Math.PI, 0, true);
    c.lineTo(11, 0);
    c.closePath();
    c.fill();
    c.strokeStyle = '#0B0C0E';
    c.lineWidth = 0.6;
    c.stroke();
    // 윗면
    const g = c.createLinearGradient(0, -4, 0, 4);
    g.addColorStop(0, '#D6DADF');
    g.addColorStop(0.45, '#7E848C');
    g.addColorStop(1, '#2B2E33');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(0, 0, 11, 3.9, 0, 0, TAU);
    c.fill();
    c.stroke();
    // 놋쇠 뚜껑 · 신관
    const b = c.createLinearGradient(-5, -2, 5, 2);
    b.addColorStop(0, '#F2D48A');
    b.addColorStop(0.5, '#C9A24D');
    b.addColorStop(1, '#6E5016');
    c.fillStyle = b;
    c.strokeStyle = '#3A2A0A';
    c.lineWidth = 0.5;
    c.beginPath();
    c.ellipse(0, -0.2, 5.2, 1.8, 0, 0, TAU);
    c.fill();
    c.stroke();
    c.fillRect(-1.4, -4.6, 2.8, 4.2);
    c.strokeRect(-1.4, -4.6, 2.8, 4.2);
    // 리벳
    c.fillStyle = '#3A3D42';
    for (const a of [0.5, 2.6, 3.7, 5.8]) {
      c.beginPath();
      c.arc(Math.cos(a) * 8.4, Math.sin(a) * 2.9, 0.65, 0, TAU);
      c.fill();
    }
    // 꺼진 등
    c.fillStyle = '#5A1E0C';
    c.beginPath();
    c.arc(0, -5.6, 1.5, 0, TAU);
    c.fill();
    c.restore();
  }

  // 유물함 안: 리벳 강판 + 놋쇠 명판
  function drawPlate(c, W, H) {
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#5E636B');
    g.addColorStop(0.5, '#3A3E44');
    g.addColorStop(1, '#24272B');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // 헤어라인
    for (let y = 0.5; y < H; y += 1.4) {
      c.fillStyle = `rgba(255,255,255,${0.03 + ((y * 7.3) % 1) * 0.06})`;
      c.fillRect(0, y, W, 0.4);
    }
    // 이음매
    const sy = Math.round(H * 0.3);
    c.fillStyle = '#17191C';
    c.fillRect(0, sy, W, 1);
    c.fillStyle = 'rgba(142,147,154,0.5)';
    c.fillRect(0, sy + 1, W, 0.5);
    // 아래 그을음
    const sg = c.createLinearGradient(0, H * 0.6, 0, H);
    sg.addColorStop(0, 'rgba(10,8,6,0)');
    sg.addColorStop(1, 'rgba(10,8,6,0.45)');
    c.fillStyle = sg;
    c.fillRect(0, H * 0.6, W, H * 0.4);
    // 리벳
    const rr = Math.max(1, W * 0.028);
    for (const [px, py] of [
      [0.38, 0.12],
      [0.62, 0.12],
      [0.1, 0.5],
      [0.9, 0.5],
      [0.1, 0.72],
      [0.9, 0.72],
      [0.1, 0.12],
      [0.9, 0.12],
    ]) {
      const x = px * W;
      const y = py * H;
      const rg = c.createRadialGradient(x - rr * 0.4, y - rr * 0.4, 0, x, y, rr);
      rg.addColorStop(0, '#E6E8EB');
      rg.addColorStop(0.5, '#9A948A');
      rg.addColorStop(1, '#3A3D42');
      c.fillStyle = rg;
      c.beginPath();
      c.arc(x, y, rr, 0, TAU);
      c.fill();
    }
    // 놋쇠 명판
    const bx = W * 0.27;
    const by = H * 0.85;
    const bw = W * 0.46;
    const bh = H * 0.09;
    const b = c.createLinearGradient(bx, by, bx + bw, by + bh);
    b.addColorStop(0, '#F2D48A');
    b.addColorStop(0.5, '#C9A24D');
    b.addColorStop(1, '#6E5016');
    c.fillStyle = b;
    c.fillRect(bx, by, bw, bh);
    c.strokeStyle = '#3A2A0A';
    c.lineWidth = 0.5;
    c.strokeRect(bx, by, bw, bh);
    c.fillStyle = '#3A2A0A';
    c.fillRect(bx + bw * 0.25, by + bh * 0.4, bw * 0.5, 0.5);
  }

  // ── 그리기 도우미 ─────────────────────────────────────────────
  /** 불꽃 줄기 묶음 (vx,vy 쌍). 중력 g, 꼬리 길이(초) tail. 한 path 로 */
  function sparkSet(n, vmin, vmax, up) {
    const a = [];
    for (let i = 0; i < n; i++) {
      const an = rnd(0, TAU);
      const v = rnd(vmin, vmax);
      a.push(Math.cos(an) * v, Math.sin(an) * v - (up || 0) * rnd(0.4, 1));
    }
    return a;
  }
  function drawSparks(c, x, y, arr, t, g, tail) {
    c.beginPath();
    const t0 = Math.max(0, t - tail);
    for (let i = 0; i < arr.length; i += 2) {
      const vx = arr[i];
      const vy = arr[i + 1];
      c.moveTo(x + vx * t0, y + vy * t0 + 0.5 * g * t0 * t0);
      c.lineTo(x + vx * t, y + vy * t + 0.5 * g * t * t);
    }
    c.stroke();
  }
  function chunkSet(n, vmin, vmax) {
    const a = [];
    for (let i = 0; i < n; i++) {
      const an = rnd(0, TAU);
      const v = rnd(vmin, vmax);
      a.push([Math.cos(an) * v, Math.sin(an) * v - 50, rnd(0, TAU), rnd(-14, 14), rnd(1.6, 2.8)]);
    }
    return a;
  }
  function drawChunks(c, x, y, arr, t, brass) {
    c.fillStyle = brass ? '#C9A24D' : '#2B2E33';
    c.strokeStyle = brass ? '#5A3E10' : '#9A948A';
    c.lineWidth = 0.7;
    for (const q of arr) {
      const px = x + q[0] * t;
      const py = y + q[1] * t + 230 * t * t;
      const a = q[2] + q[3] * t;
      const s = q[4];
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      c.beginPath();
      c.moveTo(px + (-s * ca - -s * 0.6 * sa), py + (-s * sa + -s * 0.6 * ca));
      c.lineTo(px + (s * ca - -s * 0.2 * sa), py + (s * sa + -s * 0.2 * ca));
      c.lineTo(px + (-s * 0.2 * ca - s * sa), py + (-s * 0.2 * sa + s * ca));
      c.closePath();
      c.fill();
      c.stroke();
    }
  }
  function puff(c, x, y, r, a) {
    if (a <= 0.004 || r <= 0) return;
    c.globalAlpha = a;
    c.drawImage(S.smoke(), x - r, y - r, r * 2, r * 2);
  }

  /** 쇳불 폭발 한 번 (포탄 · 지뢰 · 반응 공통). R 반경. o: {shake, n, brass, bolt} */
  function blast(api, x, y, R, o) {
    o = o || {};
    const sp = sparkSet(o.n || 12, R * 2.6, R * 7, R * 3);
    const ch = chunkSet(o.brass ? 4 : 5, R * 1.6, R * 4.2);
    const ring = [];
    for (let i = 0; i < 7; i++) ring.push((i / 7) * TAU + rnd(-0.25, 0.25), rnd(0.8, 1.15));
    let bolt = null;
    if (o.bolt) {
      bolt = [];
      let bx = x + rnd(-20, 20);
      for (let i = 0; i <= 7; i++) {
        const k = i / 7;
        bolt.push(i === 7 ? x : bx + rnd(-9, 9), -10 + (y + 10) * k);
        bx += (x - bx) * 0.3;
      }
    }
    CX.mark(
      api,
      x,
      y,
      1.8,
      (c, k) => {
        c.globalAlpha = 0.6 * (1 - k * k);
        c.drawImage(S.scorch(), x - R * 0.95, y - R * 0.6, R * 1.9, R * 1.2);
      },
      -1,
    );
    CX.mark(api, x, y, 0.95, (c, k) => {
      const t = k * 0.95;
      // 연기 고리 (퍼지며 위로 뜬다)
      if (t > 0.04) {
        const f = (t - 0.04) / 0.91;
        const rr = R * (0.4 + ease(f) * 0.8);
        const s = R * (0.34 + f * 0.42);
        for (let i = 0; i < ring.length; i += 2) {
          puff(c, x + Math.cos(ring[i]) * rr * ring[i + 1], y + Math.sin(ring[i]) * rr * ring[i + 1] * 0.7 - f * 12, s, 0.62 * (1 - f));
        }
        puff(c, x, y - f * 24, R * (0.36 + f * 0.46), 0.58 * (1 - f));
      }
      c.globalCompositeOperation = 'lighter';
      if (bolt && t < 0.16) {
        const f = t / 0.16;
        c.globalAlpha = 1 - f;
        c.lineJoin = 'round';
        for (const [lw, col] of [
          [5, 'rgba(255,106,19,0.55)'],
          [1.6, '#FFF3D6'],
        ]) {
          c.strokeStyle = col;
          c.lineWidth = lw;
          c.beginPath();
          for (let i = 0; i < bolt.length; i += 2) (i ? c.lineTo : c.moveTo).call(c, bolt[i], bolt[i + 1]);
          c.stroke();
        }
      }
      // 섬광
      if (t < 0.24) {
        const f = t / 0.24;
        c.globalAlpha = 0.6 * (1 - f);
        const s = R * (0.95 + f * 0.75);
        c.drawImage(S.glow(), x - s, y - s, s * 2, s * 2);
      }
      // 쇳물 불덩이
      if (t < 0.42) {
        const f = t / 0.42;
        c.globalAlpha = 1 - f * f;
        const s = R * 0.56 * (1 - f * 0.35);
        c.drawImage(S.hot(), x - s, y - s, s * 2, s * 2);
        // 불덩이 몽우리 셋 (부풀며 위로)
        const s2 = R * 0.34 * (1 + f * 0.3);
        for (let i = 0; i < 6; i += 2) {
          const bx = x + Math.cos(ring[i]) * R * 0.3 * (0.6 + f);
          const by = y + Math.sin(ring[i]) * R * 0.22 * (0.6 + f) - f * 8;
          c.drawImage(S.hot(), bx - s2, by - s2, s2 * 2, s2 * 2);
        }
      }
      // 충격 고리
      if (t < 0.3) {
        const f = t / 0.3;
        c.globalAlpha = (1 - f) * 0.9;
        c.strokeStyle = '#FFE2B0';
        c.lineWidth = 2.6 * (1 - f) + 0.5;
        c.beginPath();
        c.ellipse(x, y, R * (0.35 + ease(f) * 0.95), R * (0.35 + ease(f) * 0.95) * 0.8, 0, 0, TAU);
        c.stroke();
      }
      // 쇳불꽃 소나기
      if (t < 0.75) {
        c.globalAlpha = 1 - t / 0.75;
        c.strokeStyle = '#FFC46B';
        c.lineWidth = 1.5;
        c.lineCap = 'round';
        drawSparks(c, x, y, sp, t, 380, 0.045);
        c.strokeStyle = '#FF6A13';
        c.lineWidth = 0.9;
        drawSparks(c, x, y, sp, Math.max(0, t - 0.03), 380, 0.06);
      }
      c.globalCompositeOperation = 'source-over';
      if (t < 0.62) {
        c.globalAlpha = 1 - t / 0.62;
        drawChunks(c, x, y, ch, t, o.brass);
      }
    });
    if (o.shake !== 0) api.shake(o.shake || 2);
  }

  // ── 대포 ─────────────────────────────────────────────────────
  const PIV = 14; // 포신 축: 무기 자리 가운데에서 위로
  const BL = 29; // 축 → 포구
  function ensureBarrel(api, w) {
    const m = w.mem;
    if (m.barrel && !m.barrel.dead) return m.barrel;
    if (m.aim == null) m.aim = -Math.PI / 2;
    m.kick = 0;
    m.heat = 0;
    const b = {
      z: 1,
      noTrail: true,
      ang: m.aim,
      update(dt, a) {
        if (a.t - (m.seen == null ? -9 : m.seen) > 0.2 || !a.mounts.includes(w)) return false;
        this.ang += (m.aim - this.ang) * Math.min(1, dt * 10);
        m.kick = Math.max(0, m.kick - dt * 3.6);
        m.heat = Math.max(0, m.heat - dt * 1.4);
        return true;
      },
      draw(c) {
        c.translate(w.x, w.y - PIV);
        c.rotate(this.ang + Math.PI / 2);
        const off = 8 * m.kick * m.kick;
        c.drawImage(S.barrel(), -8, -BL - 3 + off, 16, 34);
        if (m.heat > 0.02) {
          c.globalCompositeOperation = 'lighter';
          c.globalAlpha = m.heat;
          c.drawImage(S.glow(), -8, -BL - 7 + off, 16, 16);
        }
      },
    };
    m.barrel = api.add(b);
    return b;
  }

  function muzzle(api, x, y, ang) {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    CX.mark(api, x, y, 0.6, (c, k) => {
      const t = k * 0.6;
      // 연기 고리: 포구에서 밀려 나가며 넓어지고 위로 뜬다
      const d = 4 + ease(k) * 16;
      const rx = 3 + ease(k) * 9;
      c.globalAlpha = 0.6 * (1 - k);
      c.strokeStyle = '#B9B2A6';
      c.lineWidth = 2.6 * (1 - k) + 0.8;
      c.beginPath();
      c.ellipse(x + ca * d, y + sa * d - k * 8, rx, rx * 0.42, ang + Math.PI / 2, 0, TAU);
      c.stroke();
      puff(c, x + ca * d * 0.6 - 4, y + sa * d * 0.6 - k * 10, 4 + k * 8, 0.6 * (1 - k));
      puff(c, x + ca * d * 0.5 + 5, y + sa * d * 0.5 - k * 14, 3 + k * 7, 0.5 * (1 - k));
      puff(c, x + ca * d, y + sa * d - k * 6, 3 + k * 9, 0.45 * (1 - k));
      if (t < 0.12) {
        const f = t / 0.12;
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 1 - f;
        c.drawImage(S.glow(), x - 13, y - 13, 26, 26);
        c.strokeStyle = '#FFE2B0';
        c.lineWidth = 1.6;
        c.beginPath();
        for (const s of [-0.5, -0.2, 0, 0.2, 0.5]) {
          const l = (s === 0 ? 15 : 9) * (1 - f * 0.4);
          c.moveTo(x + Math.cos(ang + s) * 3, y + Math.sin(ang + s) * 3);
          c.lineTo(x + Math.cos(ang + s) * l, y + Math.sin(ang + s) * l);
        }
        c.stroke();
      }
    });
  }

  function drawShell(c, p) {
    const sm = p.data.sm;
    // 땅 그림자 (위에서 내려다본 포물선이 읽히게)
    const k = clamp(p.age / p.dur, 0, 1);
    const gx = p.sx + (p.tx - p.sx) * k;
    const gy = p.sy + (p.ty - p.sy) * k;
    c.fillStyle = 'rgba(0,0,0,0.4)';
    c.beginPath();
    c.ellipse(gx, gy, 3 + k * 3, 1.4 + k * 1.2, 0, 0, TAU);
    c.fill();
    // 연기 꼬리
    for (const s of sm) {
      const f = (p.age - s.t) / 0.5;
      puff(c, s.x, s.y - f * 7, 4 + f * 12, 0.7 * (1 - f));
    }
    // 쇳물 줄 + 불티
    c.globalCompositeOperation = 'lighter';
    const h = p.hist;
    if (h.length >= 8) {
      c.globalAlpha = 0.8;
      c.strokeStyle = '#FF8A2A';
      c.lineWidth = 2.4;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(h[h.length - 8], h[h.length - 7]);
      c.lineTo(p.x, p.y);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.fillStyle = '#FFC46B';
    for (let i = 0; i < 3; i++) {
      const s = sm[Math.max(0, sm.length - 2 - i * 2)];
      if (s) c.fillRect(s.x + Math.sin(p.age * 40 + i * 2) * 3, s.y + Math.cos(p.age * 33 + i) * 3, 1.3, 1.3);
    }
    c.globalAlpha = 0.85;
    c.drawImage(S.glow(), p.x - 12, p.y - 12, 24, 24);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.drawImage(S.shell(), p.x - 6.5, p.y - 6.5, 13, 13);
  }

  function fireCannon(api, w, tg) {
    const m = w.mem;
    const b = ensureBarrel(api, w);
    const tx = tg.x;
    const ty = tg.y + tg.sp * 0.5;
    const tipY0 = w.y - PIV - BL;
    const d = Math.hypot(tx - w.x, ty - tipY0);
    const arc = 55 + d * 0.2;
    const ang = clamp(Math.atan2(ty - tipY0 - arc * Math.PI * 0.6, tx - w.x), -Math.PI + 0.45, -0.45);
    m.aim = ang;
    b.ang = ang;
    m.kick = 1;
    m.heat = 1;
    const x0 = w.x + Math.cos(ang) * BL;
    const y0 = w.y - PIV + Math.sin(ang) * BL;
    muzzle(api, x0, y0, ang);
    api.shake(0.8);
    const shell = CX.shoot(api, w, tg, {
      x: x0,
      y: y0,
      speed: Math.min(300, d / 0.72),
      arc,
      splash: 34,
      dmg: 5,
      r: 5,
      draw: drawShell,
      data: { sm: [] },
      onLand: (a, p) => blast(a, p.x, p.y, 34, { shake: 2.4 }),
    });
    // 연기 자취는 틱마다 남긴다 (그리기가 건너뛰어져도 끊기지 않게)
    const up = shell.update;
    shell.update = function (dt, a) {
      const r = up.call(this, dt, a);
      const sm = this.data.sm;
      const last = sm[sm.length - 1];
      if (!last || Math.abs(this.x - last.x) + Math.abs(this.y - last.y) > 5) sm.push({ x: this.x, y: this.y, t: this.age });
      while (sm.length && this.age - sm[0].t > 0.5) sm.shift();
      return r;
    };
    return 1.5;
  }

  // ── 회전톱 ───────────────────────────────────────────────────
  function nextSawTarget(a, s) {
    let best = null;
    let bd = 230 * 230;
    for (const e of a.enemies) {
      if (!e.alive || e.y < 30 || e.y > LINE_Y - 8 || e === s.tgt) continue;
      const ht = s.hitT.get(e);
      if (ht != null && a.t - ht < 0.4) continue;
      const d = (e.x - s.x) ** 2 + (e.y - s.y) ** 2;
      if (d < bd) (bd = d), (best = e);
    }
    return best;
  }

  function fireSaw(api, w, tg) {
    const home = { x: w.x, y: w.y - BOX / 2 };
    const s = {
      x: home.x,
      y: home.y,
      vx: (tg.x - home.x) * 0.5,
      vy: -320,
      r: 12,
      rot: rnd(0, TAU),
      spin: 22,
      st: 'fly',
      st0: 0,
      tgt: tg,
      left: 6,
      heat: 0,
      sp: [],
      hitT: new Map(),
      z: 1,
      update(dt, a) {
        this.rot += this.spin * dt;
        this.spin = Math.max(20, this.spin - dt * 40);
        this.heat = Math.max(0, this.heat - dt * 1.4);
        for (const p of this.sp) {
          p.age += dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 520 * dt;
        }
        if (this.sp.length) this.sp = this.sp.filter((p) => p.age < p.life);
        if (this.st !== 'grind' && this.sp.length < 40 && Math.random() < dt * 26) {
          // 날 끝에서 떨어지는 불티 (돌면서 날아가는 게 보이게)
          const an = rnd(0, TAU);
          const v = rnd(70, 150);
          this.sp.push({ x: this.x + Math.cos(an) * 13, y: this.y + Math.sin(an) * 13, vx: -Math.sin(an) * v - this.vx * 0.2, vy: Math.cos(an) * v - this.vy * 0.2, age: 0, life: rnd(0.16, 0.3) });
        }
        if (this.st === 'grind') {
          const e = this.tgt;
          if (e && e.alive) {
            // 적 가장자리에 박혀 갈아낸다
            const dx = this.x - e.x;
            const dy = this.y - e.y;
            const dd = Math.hypot(dx, dy) || 1;
            this.x = e.x + (dx / dd) * (e.r + 6);
            this.y = e.y + (dy / dd) * (e.r + 6);
            if (this.sp.length < 40) {
              const nx = -dx / dd;
              const ny = -dy / dd;
              for (let i = 0; i < 2; i++) {
                const v = rnd(150, 300);
                this.sp.push({ x: this.x + nx * 9, y: this.y + ny * 9, vx: -ny * v + rnd(-50, 50), vy: nx * v - rnd(40, 140), age: 0, life: rnd(0.22, 0.4) });
              }
            }
          }
          if (this.age - this.st0 < 0.13) return true;
          this.left--;
          this.tgt = this.left > 0 ? nextSawTarget(a, this) : null;
          this.st = this.tgt ? 'fly' : 'back';
          const to = this.tgt || home;
          const dx = to.x - this.x;
          const dy = to.y - this.y;
          const dd = Math.hypot(dx, dy) || 1;
          // 튕겨 나가는 첫 힘
          this.vx = (dx / dd) * 460;
          this.vy = (dy / dd) * 460;
          this.spin = 38;
        }
        if (this.st === 'fly') {
          if (!this.tgt || !this.tgt.alive) {
            this.tgt = nextSawTarget(a, this);
            if (!this.tgt) this.st = 'back';
          }
        }
        if (this.st === 'fly') {
          const e = this.tgt;
          const dx = e.x - this.x;
          const dy = e.y - this.y;
          const dd = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, dt * 7);
          this.vx += ((dx / dd) * 360 - this.vx) * k;
          this.vy += ((dy / dd) * 360 - this.vy) * k;
          this.x += this.vx * dt;
          this.y += this.vy * dt;
          if (dd < this.r + e.r) {
            a.hit(w, e, 3, this.x + (dx / dd) * this.r, this.y + (dy / dd) * this.r);
            this.hitT.set(e, a.t);
            this.st = 'grind';
            this.st0 = this.age;
            this.heat = 1;
            this.spin = 44;
          }
        } else if (this.st === 'back') {
          const dx = home.x - this.x;
          const dy = home.y - this.y;
          const dd = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, dt * 6);
          this.vx += ((dx / dd) * 430 - this.vx) * k;
          this.vy += ((dy / dd) * 430 - this.vy) * k;
          this.x += this.vx * dt;
          this.y += this.vy * dt;
          if (dd < 12) {
            catchSaw(a, home.x, home.y);
            return false;
          }
        }
        if (this.x < 12 || this.x > 348) this.vx = -this.vx;
        this.x = clamp(this.x, 10, 350);
        return this.age < 6;
      },
      draw(c) {
        const h = this.hist;
        const img = S.saw();
        // 지나온 줄: 쇠 긁힌 빛 (흰 강철 → 사라짐)
        if (h.length >= 8) {
          const g = c.createLinearGradient(h[0], h[1], this.x, this.y);
          g.addColorStop(0, 'rgba(214,218,223,0)');
          g.addColorStop(1, 'rgba(214,218,223,0.28)');
          c.strokeStyle = g;
          c.lineWidth = 6;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(h[0], h[1]);
          for (let i = 2; i < h.length; i += 4) c.lineTo(h[i], h[i + 1]);
          c.lineTo(this.x, this.y);
          c.stroke();
        }
        c.globalAlpha = 1;
        c.save();
        c.translate(this.x, this.y);
        c.rotate(this.rot);
        c.drawImage(img, -15, -15, 30, 30);
        c.restore();
        // 회전 흐림 테 (두 겹 호)
        c.strokeStyle = 'rgba(240,242,244,0.55)';
        c.lineWidth = 1.4;
        c.beginPath();
        c.arc(this.x, this.y, 16, this.rot, this.rot + 2.2);
        c.moveTo(this.x + Math.cos(this.rot + Math.PI) * 16, this.y + Math.sin(this.rot + Math.PI) * 16);
        c.arc(this.x, this.y, 16, this.rot + Math.PI, this.rot + Math.PI + 2.2);
        c.stroke();
        c.globalCompositeOperation = 'lighter';
        if (this.heat > 0.02) {
          c.globalAlpha = this.heat;
          c.strokeStyle = '#FF6A13';
          c.lineWidth = 2.6;
          c.beginPath();
          c.arc(this.x, this.y, 13.5, 0, TAU);
          c.stroke();
          c.globalAlpha = this.heat * 0.8;
          c.drawImage(S.glow(), this.x - 19, this.y - 19, 38, 38);
        }
        if (this.sp.length) {
          c.globalAlpha = 1;
          c.strokeStyle = '#FFD27A';
          c.lineWidth = 1.3;
          c.lineCap = 'round';
          c.beginPath();
          for (const p of this.sp) {
            c.moveTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
            c.lineTo(p.x, p.y);
          }
          c.stroke();
        }
      },
    };
    api.add(s, w);
    return 2.1;
  }
  function catchSaw(api, x, y) {
    const sp = sparkSet(6, 60, 140, 80);
    CX.mark(api, x, y, 0.3, (c, k) => {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 1 - k;
      c.strokeStyle = '#FFC46B';
      c.lineWidth = 1.2;
      drawSparks(c, x, y, sp, k * 0.3, 300, 0.04);
    });
  }

  // ── 지뢰밭 ───────────────────────────────────────────────────
  function dust(api, x, y) {
    CX.mark(
      api,
      x,
      y,
      0.45,
      (c, k) => {
        puff(c, x - 3 - k * 9, y + 1, 3 + k * 4, 0.45 * (1 - k));
        puff(c, x + 3 + k * 9, y + 1, 3 + k * 4, 0.45 * (1 - k));
      },
      -1,
    );
  }
  function hatch(api, w) {
    const x = w.x;
    const y = w.y - BOX / 2;
    CX.mark(api, x, y, 0.4, (c, k) => {
      puff(c, x + k * 4, y - 4 - k * 12, 3 + k * 6, 0.5 * (1 - k));
    });
  }

  function throwMine(api, w, tx, ty) {
    const m = w.mem;
    const sx = w.x + rnd(-5, 5);
    const sy = w.y - BOX / 2;
    const dist = Math.hypot(tx - sx, ty - sy);
    const dur = 0.36 + dist / 560;
    const H = 28 + dist * 0.16;
    const mine = {
      x: sx,
      y: sy,
      vx: 0,
      vy: 0,
      gx: sx,
      gy: sy,
      lift: 0,
      z: 1,
      st: 'fly',
      st0: 0,
      rot: rnd(0, TAU),
      spin: rnd(7, 11) * (Math.random() < 0.5 ? -1 : 1),
      near: 1e9,
      update(dt, a) {
        const t = this.age;
        if (this.st === 'fly') {
          const k = Math.min(1, t / dur);
          const px = this.x;
          const py = this.y;
          this.gx = sx + (tx - sx) * k;
          this.gy = sy + (ty - sy) * k;
          this.lift = Math.sin(Math.PI * k) * H;
          this.x = this.gx;
          this.y = this.gy - this.lift;
          this.vx = (this.x - px) / Math.max(dt, 1e-4);
          this.vy = (this.y - py) / Math.max(dt, 1e-4);
          this.rot += this.spin * dt;
          if (k >= 1) {
            this.st = 'arm';
            this.st0 = t;
            this.z = -1;
            this.vx = this.vy = 0;
            this.lift = 0;
            dust(a, this.x, this.y);
          }
          return true;
        }
        const lt = t - this.st0;
        if (this.st === 'arm' || this.st === 'live') {
          if (a.t - (m.seen == null ? -9 : m.seen) > 0.5 || t > 9) {
            this.st = 'fizzle';
            this.st0 = t;
            return true;
          }
          if (this.st === 'arm' && lt > 0.3) this.st = 'live';
          let dmin = 1e9;
          for (const e of a.enemies) {
            if (!e.alive) continue;
            const d = Math.hypot(e.x - this.x, e.y - this.y) - e.r;
            if (d < dmin) dmin = d;
          }
          this.near = dmin;
          if (this.st === 'live' && dmin < 6) this.trip();
          return true;
        }
        if (this.st === 'pop') {
          this.lift = Math.sin(Math.min(1, lt / 0.12) * Math.PI * 0.5) * 10;
          if (lt >= 0.12) {
            this.boom(a);
            return false;
          }
          return true;
        }
        if (this.st === 'fizzle') return lt < 0.6;
        return false;
      },
      trip() {
        if (this.st !== 'live' && this.st !== 'arm') return;
        this.st = 'pop';
        this.st0 = this.age;
        this.z = 1;
      },
      boom(a) {
        const R = 30;
        blast(a, this.x, this.y - this.lift, R, { shake: 1.8, n: 10, brass: true });
        const hs = a.near(this.x, this.y, R);
        for (const e of hs) a.hit(w, e, 6, e.x, e.y);
        if (!hs.length && w.sub) CX.wo(w.subWorld).hit(a, this.x, this.y, w, true, null);
        // 옆 지뢰 유폭 (연쇄)
        for (const o of m.mines || []) {
          if (o === this || o.dead || (o.st !== 'live' && o.st !== 'arm')) continue;
          if (Math.hypot(o.x - this.x, o.y - this.y) < 52) a.later(0.05, () => o.trip());
        }
      },
      draw(c, a) {
        const t = this.age;
        const lt = t - this.st0;
        if (this.st === 'fizzle') c.globalAlpha = Math.max(0, 1 - lt / 0.6);
        const img = S.mine();
        if (this.st === 'fly') {
          c.fillStyle = 'rgba(0,0,0,0.35)';
          c.beginPath();
          c.ellipse(this.gx, this.gy + 2, 9, 3, 0, 0, TAU);
          c.fill();
          c.translate(this.x, this.y);
          c.rotate(Math.sin(this.rot) * 0.6);
          c.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(this.rot)));
          c.drawImage(img, -12 * MS, -8 * MS, 24 * MS, 16 * MS);
          return;
        }
        // 땅에 박힌 자리
        c.fillStyle = 'rgba(0,0,0,0.38)';
        c.beginPath();
        c.ellipse(this.x, this.y + 3, 15.5 - this.lift * 0.3, 5.4, 0, 0, TAU);
        c.fill();
        const y = this.y - this.lift;
        c.drawImage(img, this.x - 12 * MS, y - 8 * MS, 24 * MS, 16 * MS);
        // 신관 등: 깔리는 중 호박색 → 무장 빨강 깜빡 (적이 가까울수록 빨리) → 튈 때 흰빛
        let on = 0;
        let col = 'red';
        if (this.st === 'arm') (on = 0.5), (col = 'amber');
        else if (this.st === 'live') {
          const fast = this.near < 44;
          const hz = fast ? 8 : 1.6;
          on = Math.sin((a.t + this.x * 0.01) * hz * TAU) > (fast ? -0.2 : 0.35) ? 1 : 0.15;
        } else if (this.st === 'pop') on = 1.6;
        const lx = this.x;
        const ly = y - 5.6 * MS;
        c.fillStyle = col === 'amber' ? '#FFB547' : on > 0.5 ? '#FF3B1F' : '#6A1E0E';
        c.beginPath();
        c.arc(lx, ly, 2, 0, TAU);
        c.fill();
        if (on > 0.3) {
          c.globalCompositeOperation = 'lighter';
          c.globalAlpha = Math.min(1, on) * (this.st === 'fizzle' ? 0 : 1);
          const s = 9 + (on > 1 ? 7 : 0);
          c.drawImage(on > 1 ? S.glow() : S.red(), lx - s, ly - s, s * 2, s * 2);
          c.globalCompositeOperation = 'source-over';
        }
        // 무장: 적이 다가오면 감지 고리
        if (this.st === 'live' && this.near < 44) {
          c.globalAlpha = 0.45 * (1 - this.near / 44);
          c.strokeStyle = '#FF3B1F';
          c.lineWidth = 1;
          c.setLineDash([3, 3]);
          c.beginPath();
          c.ellipse(this.x, this.y + 1, 22, 8.5, 0, 0, TAU);
          c.stroke();
          c.setLineDash([]);
        }
      },
    };
    m.mines = (m.mines || []).filter((o) => !o.dead);
    m.mines.push(mine);
    api.add(mine, w);
  }

  function fireMines(api, w, tg) {
    const m = w.mem;
    m.mines = (m.mines || []).filter((o) => !o.dead && o.st !== 'fizzle');
    if (m.mines.length >= 7) return 0.6;
    // 무리 앞길에 깐다 (방어선에 바짝 붙은 적이면 그 앞)
    const cl = api.target('cluster') || tg;
    const g = cl.y < LINE_Y - 90 ? cl : tg;
    tg = g;
    const by = clamp(tg.y + tg.sp * 1.6 + rnd(18, 36), 130, 428);
    const gap = rnd(30, 40);
    for (let i = 0; i < 2; i++) {
      const tx = clamp(tg.x + (i - 0.5) * gap + rnd(-6, 6), 16, 344);
      const ty = by + rnd(-12, 12);
      api.later(i * 0.15, (a) => {
        hatch(a, w);
        throwMine(a, w, tx, ty);
      });
    }
    return 1.45;
  }

  // ── 반응 (보조일 때 큰 한 방) ─────────────────────────────────
  function reticle(api, x, y, life) {
    CX.mark(api, x, y, life, (c, k) => {
      const r = 26 - 10 * ease(k);
      c.globalAlpha = Math.min(1, k * 6) * 0.95;
      c.strokeStyle = '#C9A24D';
      c.lineWidth = 1.6;
      c.beginPath();
      c.ellipse(x, y, r, r * 0.8, 0, 0, TAU);
      c.stroke();
      c.strokeStyle = '#FF6A13';
      c.lineWidth = 2;
      c.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + k * 2.2 + 0.785;
        c.moveTo(x + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3) * 0.8);
        c.lineTo(x + Math.cos(a) * (r - 6), y + Math.sin(a) * (r - 6) * 0.8);
      }
      c.stroke();
      if (Math.sin(k * 40) > 0) {
        c.fillStyle = '#FF3B1F';
        c.beginPath();
        c.arc(x, y, 2.2, 0, TAU);
        c.fill();
      }
    });
  }
  function streak(api, x, y, dur) {
    const sx = x + 26;
    CX.mark(api, x, y, dur, (c, k) => {
      const px = sx + (x - sx) * k;
      const py = -16 + (y + 16) * k;
      c.globalCompositeOperation = 'lighter';
      const g = c.createLinearGradient(sx, -16, px, py);
      g.addColorStop(0, 'rgba(255,106,19,0)');
      g.addColorStop(1, 'rgba(255,226,176,0.95)');
      c.strokeStyle = g;
      c.lineWidth = 3;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(sx + (px - sx) * 0.4, -16 + (py + 16) * 0.4);
      c.lineTo(px, py);
      c.stroke();
      c.drawImage(S.glow(), px - 10, py - 10, 20, 20);
      c.globalCompositeOperation = 'source-over';
      c.drawImage(S.shell(), px - 6, py - 6, 12, 12);
    });
  }

  // 낙뢰 포격: 표적 고리가 잡히고 → 하늘에서 쇳덩이가 번개처럼 꽂힌다, 셋~넷 차례로
  function reactBarrage(api, e, w) {
    const pts = [{ x: e.x, y: e.y, e }];
    for (const n of api.near(e.x, e.y, 110)) if (n !== e && pts.length < 4) pts.push({ x: n.x, y: n.y, e: n });
    while (pts.length < 3) pts.push({ x: clamp(e.x + rnd(-70, 70), 24, 336), y: clamp(e.y + rnd(-50, 30), 70, 420) });
    pts.forEach((p, i) => {
      api.later(i * 0.16, (a) => {
        const tx = p.e && p.e.alive ? p.e.x : p.x;
        const ty = (p.e && p.e.alive ? p.e.y : p.y) + (p.e ? p.e.sp * 0.42 : 0);
        reticle(a, tx, ty, 0.44);
        a.later(0.3, (b) => streak(b, tx, ty, 0.12));
        a.later(0.42, (b) => {
          blast(b, tx, ty, 40, { shake: 3.6, n: 14, bolt: true });
          for (const n of b.near(tx, ty, 40)) b.hit(w, n, 8, n.x, n.y, { isReact: true });
        });
      });
    });
  }

  // 톱니 올가미: 톱날 넷이 쇠사슬 고리로 돌며 조여 적을 끌어모으고 → 한가운데로 강타
  function reactSnare(api, e, w) {
    const cx = e.x;
    const cy = e.y;
    const caught = api.near(cx, cy, 74);
    for (const n of caught) n.slow = Math.max(n.slow, 1.3);
    const th0 = rnd(0, TAU);
    const T = 0.58;
    const sp = [];
    let slam = false;
    const ring = (t) => (t < T ? 70 - 54 * ease(t / T) : 16 + (t - T) * 300);
    api.add({
      life: 1.05,
      z: 1,
      noTrail: true,
      update(dt, a) {
        const t = this.age;
        if (t < T) {
          const R = ring(t);
          for (const n of caught) {
            if (!n.alive) continue;
            const dx = n.x - cx;
            const dy = n.y - cy;
            const d = Math.hypot(dx, dy) || 1;
            const want = Math.max(8, R * 0.62);
            if (d > want) {
              const nd = d + (want - d) * Math.min(1, dt * 9);
              n.x = cx + (dx / d) * nd;
              n.y = cy + (dy / d) * nd;
            }
          }
          if (sp.length < 44) {
            const th = th0 + t * 9;
            for (let i = 0; i < 4; i++) {
              const an = th + (i * TAU) / 4;
              const bx = cx + Math.cos(an) * R;
              const by = cy + Math.sin(an) * R * 0.86;
              if (Math.random() < 0.5) sp.push({ x: bx, y: by, vx: -Math.sin(an) * rnd(120, 240), vy: Math.cos(an) * rnd(120, 240) - 60, age: 0 });
            }
          }
        } else if (!slam) {
          slam = true;
          blast(a, cx, cy, 50, { shake: 4.6, n: 18 });
          for (const n of a.near(cx, cy, 50)) a.hit(w, n, 9, n.x, n.y, { isReact: true });
        }
        for (const p of sp) {
          p.age += dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 480 * dt;
        }
        for (let i = sp.length - 1; i >= 0; i--) if (sp[i].age > 0.32) sp.splice(i, 1);
      },
      draw(c) {
        const t = this.age;
        const R = ring(t);
        const th = th0 + t * 9;
        const fade = t < T ? 1 : Math.max(0, 1 - (t - T) / 0.4);
        if (t < T) {
          // 쇠사슬 고리
          c.globalAlpha = Math.min(1, t * 8);
          c.strokeStyle = '#0B0C0E';
          c.lineWidth = 5;
          c.beginPath();
          c.ellipse(cx, cy, R, R * 0.86, 0, 0, TAU);
          c.stroke();
          c.strokeStyle = '#B9B2A6';
          c.lineWidth = 3;
          c.setLineDash([5, 2.5]);
          c.lineDashOffset = -t * 60;
          c.stroke();
          c.setLineDash([]);
          c.strokeStyle = 'rgba(201,162,77,0.8)';
          c.lineWidth = 0.8;
          c.stroke();
        }
        c.globalAlpha = fade;
        const img = S.saw();
        for (let i = 0; i < 4; i++) {
          const an = th + (i * TAU) / 4;
          const bx = cx + Math.cos(an) * R;
          const by = cy + Math.sin(an) * R * 0.86;
          c.save();
          c.translate(bx, by);
          c.rotate(t * 30 + i);
          c.drawImage(img, -13, -13, 26, 26);
          c.restore();
        }
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
          const an = th + (i * TAU) / 4;
          c.globalAlpha = fade * 0.7;
          c.drawImage(S.glow(), cx + Math.cos(an) * R - 12, cy + Math.sin(an) * R * 0.86 - 12, 24, 24);
        }
        if (sp.length) {
          c.globalAlpha = 1;
          c.strokeStyle = '#FFD27A';
          c.lineWidth = 1.3;
          c.lineCap = 'round';
          c.beginPath();
          for (const p of sp) {
            c.moveTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
            c.lineTo(p.x, p.y);
          }
          c.stroke();
        }
      },
    });
  }

  // 덫 사슬: 적 둘레로 지뢰 다섯이 솟고 쇠사슬로 이어진다 → 빨간 등이 빨라지다 사슬 따라 차례로 폭발
  function reactChain(api, e, w) {
    const cx = e.x;
    const cy = e.y;
    const N = 5;
    const R0 = 38;
    const th0 = rnd(0, TAU);
    const pts = [];
    for (let i = 0; i < N; i++) {
      const a = th0 + (i / N) * TAU;
      pts.push({ x: clamp(cx + Math.cos(a) * R0, 14, 346), y: clamp(cy + Math.sin(a) * R0 * 0.8, 40, 438), done: false });
    }
    for (const n of api.near(cx, cy, 60)) n.slow = Math.max(n.slow, 1.5);
    const T0 = 0.66;
    const DT = 0.09;
    pts.forEach((p, i) =>
      api.later(T0 + i * DT, (a) => {
        p.done = true;
        blast(a, p.x, p.y, 30, { shake: 2.4, n: 9, brass: true });
        for (const n of a.near(p.x, p.y, 30)) a.hit(w, n, 5, n.x, n.y, { isReact: true });
      }),
    );
    api.add({
      life: T0 + N * DT + 0.05,
      z: 1,
      noTrail: true,
      update() {},
      draw(c) {
        const t = this.age;
        // 쇠사슬: 지뢰에서 지뢰로 차례로 그어진다 (고리로 닫힘), 터진 쪽은 끊긴다
        const prog = clamp((t - 0.12) / 0.36, 0, 1) * N;
        for (let j = 0; j < N; j++) {
          const f = clamp(prog - j, 0, 1);
          if (f <= 0) continue;
          const p = pts[j];
          const q = pts[(j + 1) % N];
          if (p.done || q.done) continue;
          const ex = p.x + (q.x - p.x) * f;
          const ey = p.y + (q.y - p.y) * f;
          c.globalAlpha = 1;
          c.strokeStyle = '#0B0C0E';
          c.lineWidth = 3.6;
          c.beginPath();
          c.moveTo(p.x, p.y - 3);
          c.lineTo(ex, ey - 3);
          c.stroke();
          c.strokeStyle = '#9A948A';
          c.lineWidth = 2.2;
          c.setLineDash([4, 2.4]);
          c.stroke();
          c.setLineDash([]);
        }
        const img = S.mine();
        const urgent = t > 0.45;
        for (let i = 0; i < N; i++) {
          const p = pts[i];
          if (p.done) continue;
          const s = ease(clamp((t - i * 0.05) / 0.16, 0, 1));
          if (s <= 0) continue;
          c.globalAlpha = 1;
          c.drawImage(img, p.x - 12 * MS * s, p.y - 8 * MS * s - (1 - s) * 6, 24 * MS * s, 16 * MS * s);
          const on = Math.sin(t * (urgent ? 70 : 18) + i) > 0;
          if (on) {
            c.globalCompositeOperation = 'lighter';
            c.drawImage(S.red(), p.x - 9, p.y - 5.6 * MS * s - 9, 18, 18);
            c.globalCompositeOperation = 'source-over';
          }
        }
      },
    });
  }

  // ── 등록 ─────────────────────────────────────────────────────
  CX.world('steel', {
    name: '강철 공방',
    short: '강철',
    desc: '리벳 강판 · 놋쇠 · 쇳물. 포신이 반동하고 포탄은 연기를 끌며 떨어지고, 톱날은 적 사이를 튕기며 불꽃을, 지뢰는 깔렸다가 줄줄이 터진다.',
    colors: { main: '#C9A24D', soft: '#2B2E33' },
    fonts: ['Black Han Sans'],

    box(c, x, y, w, h) {
      const W = Math.round(w);
      const H = Math.round(h);
      c.drawImage(
        spr('steel:box:' + W + 'x' + H, W, H, (g) => drawPlate(g, W, H)),
        x,
        y,
        w,
        h,
      );
    },

    crest(c, x, y, r) {
      c.drawImage(S.crest(), x, y, r * 2, r * 2);
    },

    icon(c, id, x, y, s, t) {
      t = t || 0;
      const k = s / 48;
      if (id === 'arm_cannon') {
        c.drawImage(S.cannon(), x - s / 2, y - s / 2, s, s);
        return;
      }
      if (id === 'arm_saw') {
        c.save();
        c.translate(x, y);
        c.rotate(t * 1.6);
        c.drawImage(S.saw(), -s / 2, -s / 2, s, s);
        c.restore();
        // 달궈진 날 + 불티 (돌지 않는 쪽)
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = '#FF6A13';
        c.lineWidth = Math.max(1, 2.2 * k);
        c.beginPath();
        c.arc(x, y, 20 * k, -1.2, 0.15);
        c.stroke();
        if (s > 22) {
          c.strokeStyle = '#FFC46B';
          c.lineWidth = 1.1;
          c.beginPath();
          for (const [a, l] of [
            [-0.9, 7],
            [-0.5, 9],
            [-0.15, 6],
          ]) {
            const f = (t * 3 + a) % 1;
            c.moveTo(x + Math.cos(a) * (22 + f * 4) * k, y + Math.sin(a) * (22 + f * 4) * k);
            c.lineTo(x + Math.cos(a) * (22 + l + f * 4) * k, y + Math.sin(a) * (22 + l + f * 4) * k);
          }
          c.stroke();
        }
        return;
      }
      if (id === 'arm_tr_mines') {
        c.drawImage(S.mines(), x - s / 2, y - s / 2, s, s);
        // 신관 등 깜빡
        const on = Math.sin(t * 5) > 0;
        c.globalCompositeOperation = 'lighter';
        MI.forEach(([mx, my, sc], ph) => {
          const lx = x + (mx - MI_C[0]) * MI_S * k;
          const ly = y + (my - 5.6 * sc - MI_C[1]) * MI_S * k;
          const lit = ph ? on : !on;
          c.globalAlpha = lit ? 1 : 0.35;
          const r = Math.max(2.5, 8 * k * sc);
          c.drawImage(S.red(), lx - r, ly - r, r * 2, r * 2);
        });
        return;
      }
      // 다른 세계 무기: 놋쇠 테 + 첫 글자
      c.strokeStyle = '#C9A24D';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(x, y, s * 0.32, 0, TAU);
      c.stroke();
      c.font = `${Math.round(s * 0.36)}px "Black Han Sans", "Noto Sans KR", sans-serif`;
      c.fillStyle = '#F2D48A';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText((CX.data.weapons[id] || { name: '?' }).name.slice(0, 1), x, y + 1);
    },

    fire(api, w, tg) {
      const cat = w.cat;
      if (w.id === 'arm_saw' || (w.id !== 'arm_cannon' && cat === 'spinner')) return fireSaw(api, w, tg);
      if (w.id === 'arm_tr_mines' || (w.id !== 'arm_cannon' && (cat === 'trap' || cat === 'field'))) return fireMines(api, w, tg);
      return fireCannon(api, w, tg);
    },

    tick(api, w) {
      w.mem.seen = api.t;
      if (w.id === 'arm_cannon' || (w.cat === 'turret' && w.id !== 'arm_saw' && w.id !== 'arm_tr_mines')) ensureBarrel(api, w);
    },

    // 보조 궤적: 연기 뭉치 + 쇳물 줄 + 불티. 멈춰 있는 것(장판 가운데·광선 끝)에는 피어오르는 연기 + 톱니 테
    trail(c, e, t) {
      const h = e.hist;
      const n = h.length / 2;
      if (n < 2) return;
      const hx = h[h.length - 2];
      const hy = h[h.length - 1];
      const moving = Math.abs(hx - h[0]) + Math.abs(hy - h[1]) > 6;
      const seed = (e.age || 0) * 1.7 + hx * 0.013;
      if (moving) {
        for (let i = 0; i < n - 1; i += 2) {
          const f = (n - 1 - i) / (n - 1); // 0 머리 → 1 꼬리
          if (f < 0.12) continue; // 머리는 비워 둔다 (메인을 가리지 않게)
          puff(c, h[i * 2] + Math.sin(seed * 9 + i) * 1.5, h[i * 2 + 1] - f * 7, 3 + f * 9, 0.5 * (1 - f * 0.75));
        }
        c.globalCompositeOperation = 'lighter';
        const j = Math.max(0, h.length - 14);
        const j2 = Math.max(0, h.length - 6);
        c.globalAlpha = 0.85;
        c.strokeStyle = '#FF8A2A';
        c.lineWidth = 1.6;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(h[j], h[j + 1]);
        c.lineTo(h[j2], h[j2 + 1]);
        c.stroke();
        c.globalAlpha = 1;
        c.fillStyle = '#FFC46B';
        for (let i = 0; i < 3; i++) {
          const q = Math.floor(((seed * 20 + i * 5) % (n - 1) + n - 1) % (n - 1));
          c.fillRect(h[q * 2] + Math.sin(seed * 31 + i) * 4, h[q * 2 + 1] + Math.cos(seed * 27 + i * 2) * 4, 1.4, 1.4);
        }
        c.globalAlpha = 0.45;
        c.drawImage(S.glow(), h[j2] - 7, h[j2 + 1] - 7, 14, 14);
        return;
      }
      // 멈춘 자리: 연기가 피어오르고 불티가 튄다
      const ph = hx * 0.07;
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.9 + i / 3 + ph) % 1;
        puff(c, hx + Math.sin(p * 5 + i * 2) * 5, hy - 6 - p * 26, 3.5 + p * 9, 0.45 * (1 - p) * Math.min(1, p * 6));
      }
      if (e.r >= 18) {
        // 장판 둘레 톱니 테
        c.globalAlpha = 0.4;
        c.strokeStyle = '#C9A24D';
        c.lineWidth = 2;
        c.setLineDash([3, 4]);
        c.lineDashOffset = -t * 12;
        c.beginPath();
        c.arc(hx, hy, e.r * 0.92, 0, TAU);
        c.stroke();
        c.setLineDash([]);
      }
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = '#FFC46B';
      for (let i = 0; i < 3; i++) {
        const p = (t * 1.6 + i * 0.37 + ph) % 1;
        c.globalAlpha = 1 - p;
        c.fillRect(hx + Math.sin(i * 2.1 + ph) * (4 + p * 10), hy - p * 20 + p * p * 14, 1.4, 1.4);
      }
    },

    hit(api, x, y, w, asSub, e) {
      const life = asSub ? 0.32 : 0.46;
      const sp = asSub ? sparkSet(5, 60, 150, 70) : sparkSet(10, 80, 220, 110);
      const ch = asSub ? null : chunkSet(3, 40, 110);
      CX.mark(api, x, y, life, (c, k) => {
        const t = k * life;
        c.globalCompositeOperation = 'lighter';
        // 달궈진 빛 (맞은 적을 따라간다)
        const gx = e && e.alive ? e.x : x;
        const gy = e && e.alive ? e.y : y;
        const gs = (asSub ? 9 : (e ? e.r : 10) * 1.6) * (1 + k * 0.5);
        c.globalAlpha = (1 - k) * (asSub ? 0.6 : 0.95);
        c.drawImage(S.glow(), gx - gs, gy - gs, gs * 2, gs * 2);
        c.globalAlpha = 1 - k;
        c.strokeStyle = '#FFC46B';
        c.lineWidth = asSub ? 1.1 : 1.5;
        c.lineCap = 'round';
        drawSparks(c, x, y, sp, t, 420, 0.04);
        if (!asSub) {
          c.strokeStyle = '#FF6A13';
          c.lineWidth = 0.9;
          drawSparks(c, x, y, sp, Math.max(0, t - 0.025), 420, 0.05);
          c.globalCompositeOperation = 'source-over';
          drawChunks(c, x, y, ch, t, false);
        }
      });
    },

    react(api, e, w) {
      const d = CX.data.weapons[w.sub] || {};
      if (w.sub === 'arm_saw' || d.cat === 'spinner') return reactSnare(api, e, w);
      if (w.sub === 'arm_tr_mines' || d.cat === 'trap') return reactChain(api, e, w);
      return reactBarrage(api, e, w);
    },

    // 반응 글씨: 리벳 박힌 강판에 음각 (앞말) + 달궈진 쇳물판 (뒷말, 옆에 비스듬히 겹침).
    // 위에서 쾅 박히며 흔들리고 불티가 튄다 → 끝에는 왼쪽 리벳 하나에 매달려 기울며 떨어진다
    label(c, text, x, y, age, life) {
      const parts = String(text).split(/\s*·\s*/);
      const t1 = parts[0] || '';
      const t2 = parts.slice(1).join(' ');
      const F = '"Black Han Sans", "Noto Sans KR", sans-serif';
      c.font = `21px ${F}`;
      const w1 = c.measureText(t1).width + 36;
      const h1 = 38;
      c.font = `23px ${F}`;
      const w2 = t2 ? c.measureText(t2 + '!').width + 26 : 0;
      const h2 = 34;
      const T = t2 ? w1 + w2 - 12 : w1;
      const fit = Math.min(1, 292 / T);
      const x1 = -T / 2 + w1 / 2;
      const x2 = T / 2 - w2 / 2;
      const IN = 0.12;
      const IN2 = 0.1;
      const OUT = 0.34;
      const q = age > life - OUT ? clamp((age - (life - OUT)) / OUT, 0, 1) : 0;
      // 흔들림 (박힌 뒤)
      const st = age - IN;
      let sx = 0;
      let sy = 0;
      let rot = 0;
      if (st > 0 && st < 0.34) {
        const d = 1 - st / 0.34;
        sx = Math.sin(st * 95) * 3.4 * d;
        sy = Math.cos(st * 120) * 1.6 * d;
        rot = Math.sin(st * 70) * 0.03 * d;
      }
      const f1 = clamp(age / IN, 0, 1);
      const s1 = 1.55 - 0.55 * f1 * f1;
      const dy1 = -28 * (1 - f1 * f1);
      c.translate(x + sx, y + sy + q * q * 30 - 3);
      c.scale(fit, fit);
      // 끝: 왼쪽 위 리벳에 매달려 기운다
      const px = x1 - w1 / 2 + 6;
      const py = -h1 / 2 + 6;
      c.translate(px, py);
      c.rotate(rot + q * 0.3);
      c.translate(-px, -py);
      const alpha0 = Math.min(1, f1 * 2.5) * (1 - q);
      c.globalAlpha = alpha0;

      // 판 1: 강판 음각
      c.save();
      c.translate(x1, dy1);
      c.scale(s1, s1);
      plate(c, -w1 / 2, -h1 / 2, w1, h1, false);
      c.font = `21px ${F}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.fillText(t1, 0, 2.2);
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.fillText(t1, 0, 0.2);
      c.fillStyle = '#17181B';
      c.fillText(t1, 0, 1.2);
      c.restore();

      // 판 2: 달궈진 쇳물판 (조금 늦게 쾅)
      const a2 = age - IN2;
      if (t2 && a2 > 0) {
        const f2 = clamp(a2 / 0.11, 0, 1);
        const s2 = 1.7 - 0.7 * f2 * f2;
        c.save();
        c.globalAlpha = alpha0 * Math.min(1, f2 * 3);
        c.translate(x2, 7);
        c.rotate(-0.07);
        c.scale(s2, s2);
        plate(c, -w2 / 2, -h2 / 2, w2, h2, true);
        c.font = `23px ${F}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = 'rgba(255,240,210,0.7)';
        c.fillText(t2 + '!', 0, 2.2);
        c.fillStyle = '#1A0A02';
        c.fillText(t2 + '!', 0, 1);
        c.restore();
      }

      // 박히는 순간 불티 (판 아래 모서리에서)
      if (st > 0 && st < 0.3) {
        const k = st / 0.3;
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = (1 - k) * alpha0;
        c.strokeStyle = '#FFC46B';
        c.lineWidth = 1.4;
        c.lineCap = 'round';
        c.beginPath();
        const tt = k * 0.3;
        const t0 = Math.max(0, tt - 0.03);
        for (const [ox, oy, vx, vy] of LSPARK) {
          const bx = ox < 0 ? x1 - w1 / 2 : t2 ? x2 + w2 / 2 : x1 + w1 / 2;
          const by = oy * (ox < 0 ? h1 : h2) * 0.5 + (ox < 0 ? 0 : t2 ? 7 : 0);
          c.moveTo(bx + vx * t0, by + vy * t0 + 300 * t0 * t0);
          c.lineTo(bx + vx * tt, by + vy * tt + 300 * tt * tt);
        }
        c.stroke();
      }
    },
  });

  const LSPARK = [
    [-1, 1, -160, -60],
    [-1, 1, -110, -120],
    [-0.9, 1, -60, -150],
    [1, 1, 160, -70],
    [1, 1, 120, -130],
    [0.9, 1, 70, -160],
    [-1, -0.6, -150, -40],
    [1, -0.6, 150, -30],
  ];

  function plate(c, x, y, w, h, hot) {
    const rr = 3;
    // 아래 그림자 턱
    c.fillStyle = hot ? '#3A1404' : '#0B0C0E';
    CX.util.roundRect(c, x, y + 2.5, w, h, rr);
    c.fill();
    const g = c.createLinearGradient(0, y, 0, y + h);
    if (hot) {
      g.addColorStop(0, '#FFE2B0');
      g.addColorStop(0.45, '#FF9A3D');
      g.addColorStop(1, '#FF6A13');
    } else {
      g.addColorStop(0, '#DADDE2');
      g.addColorStop(0.55, '#9AA0A8');
      g.addColorStop(1, '#7A8088');
    }
    if (hot) {
      c.save();
      c.shadowColor = 'rgba(255,106,19,0.85)';
      c.shadowBlur = 16;
    }
    c.fillStyle = g;
    CX.util.roundRect(c, x, y, w, h, rr);
    c.fill();
    if (hot) c.restore();
    c.strokeStyle = hot ? '#3A1404' : '#0B0C0E';
    c.lineWidth = 1.2;
    c.stroke();
    // 윗 빛줄 · 헤어라인
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.fillRect(x + 2, y + 1.2, w - 4, 0.8);
    if (!hot) {
      c.fillStyle = 'rgba(255,255,255,0.13)';
      for (let i = 1; i < 6; i++) c.fillRect(x + 2, y + (h * i) / 6, w - 4, 0.5);
    }
    // 리벳 넷
    const ri = [
      [x + 6, y + 6],
      [x + w - 6, y + 6],
      [x + 6, y + h - 6],
      [x + w - 6, y + h - 6],
    ];
    for (const [rx, ry] of ri) {
      c.fillStyle = hot ? '#7A2A12' : '#3A3D42';
      c.beginPath();
      c.arc(rx, ry, 2.3, 0, TAU);
      c.fill();
      c.fillStyle = hot ? 'rgba(255,240,210,0.8)' : 'rgba(230,232,235,0.85)';
      c.beginPath();
      c.arc(rx - 0.7, ry - 0.7, 0.9, 0, TAU);
      c.fill();
    }
  }
})();
