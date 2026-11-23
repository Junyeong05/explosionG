// 쪽 짜기: 한 판 · 세계 여섯 · 합성 · 섞어 보기. ?only=<세계> 면 그 세계 확인용 (세계 카드 + 그 세계가 든 합성 + 다른 세계와 짝)
(function () {
  const D = CX.data;
  const ORDER = ['ops', 'steel', 'sumi', 'rift', 'comic', 'bio'];
  const FUSIONS = [
    ['arm_cannon', 'arm_su_fox'],
    ['arm_rifle', 'arm_wizard'],
    ['arm_rifle', 'arm_s_megaphone'],
    ['arm_tr_mines', 'arm_dog'],
    ['arm_dragon', 'arm_sl_ghost'],
    ['arm_laser', 'arm_sw_mosquito'],
    ['arm_su_fox', 'arm_th_pan'],
    ['arm_icestorm', 'arm_acid'],
    ['arm_cannon', 'arm_saw'],
  ];
  const BOARD = [['arm_rifle'], ['arm_cannon'], ['arm_saw'], ['arm_tr_mines', 'arm_dog'], ['arm_su_fox'], ['arm_s_megaphone'], ['arm_icestorm'], ['arm_sw_mosquito']];
  const only = (/[?&]only=(\w+)/.exec(location.search) || [])[1] || null;

  const wn = (k) => CX.wo(k).name;
  const col = (k) => (CX.wo(k).colors || {}).main || '#CFC6E8';
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]);

  function card(title, dotWorld, tags, extra, wide) {
    const c = el('div', 'card' + (wide ? ' wide' : ''));
    const cv = el('canvas');
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', title + ' 연출');
    c.appendChild(cv);
    const h = el('h3', null, (dotWorld ? `<span class="dot" style="color:${col(dotWorld)};background:${col(dotWorld)}"></span>` : '') + esc(title));
    c.appendChild(h);
    if (tags && tags.length) {
      const t = el('div', 'tags');
      for (const [txt, cls] of tags) t.appendChild(el('span', 'tag ' + (cls || ''), esc(txt)));
      c.appendChild(t);
    }
    for (const x of extra || []) c.appendChild(x);
    return { card: c, cv };
  }

  // ── 한 판 ──
  function board() {
    const ws = BOARD.map(([a, b]) => CX.weapon(a, b));
    const { card: c, cv } = card('한 판 · 여섯 세계 무기 여덟', null, ws.map((w) => [`${w.name} · ${CX.wo(w.world).short}${w.sub ? ' + ' + CX.wo(w.subWorld).short : ''}`, w.sub ? 'main' : '']), [el('p', null, '왼쪽부터 돌격소총 · 대포 · 회전톱 · 군견 지뢰밭 · 불여우 · 확성기 · 얼음 폭풍 · 모기 떼.')], true);
    document.getElementById('boardSlot').appendChild(c);
    CX.mount(cv, { density: 15, compact: true, phases: [{ mounts: ws, dur: 999, title: '한 판', note: '적 · 연쇄 · 숫자는 공통, 무기만 세계마다' }] });
  }

  // ── 세계 여섯 ──
  function worldCard(k) {
    const ids = D.sample[k];
    const ws = ids.map((id) => CX.weapon(id));
    const wo = CX.wo(k);
    const phases = ws.map((w, i) => ({ mounts: ws, active: [i], dur: 4.2, title: w.name, note: `${wo.short} · ${w.catLabel} · 한 무기씩` }));
    phases.push({ mounts: ws, dur: 6, title: '셋 함께', note: `${wo.name} · ${ws.map((w) => w.catLabel).join(' · ')}` });
    const { card: c, cv } = card(wo.name + (wo.missing ? ' (아직 기본 그림)' : ''), k, ws.map((w) => [`${w.name} · ${w.catLabel}`]), [el('p', null, esc(wo.desc || ''))]);
    document.getElementById('worldGrid').appendChild(c);
    CX.mount(cv, { density: 11, phases });
  }

  // ── 합성 ──
  function fuseCard(a, b, grid) {
    const m = CX.weapon(a);
    const f = CX.weapon(a, b);
    const same = f.world === f.subWorld;
    const phases = [
      { mounts: [m], dur: 3.6, title: '메인만: ' + m.name, note: `${wn(m.world)} · ${m.catLabel}` },
      { mounts: [f], dur: 7.5, intro: true, title: '합성: ' + f.name, note: `몸 ${m.name} (${CX.wo(f.world).short}) + 연출 ${f.subName} (${CX.wo(f.subWorld).short})` },
    ];
    const tags = [
      [`메인 ${m.name} · ${wn(f.world)}`, 'main'],
      [`보조 ${f.subName} · ${wn(f.subWorld)}`, 'sub'],
    ];
    const extra = [el('div', 'react', '반응: ' + esc(f.react || '')), el('p', null, same ? `같은 세계끼리 = 세계 공명: ${esc(wn(f.world))} 재질이 한층 진해진다.` : `몸·쏘는 법은 ${esc(wn(f.world))}, 궤적·맞는 무늬·반응 글씨는 ${esc(wn(f.subWorld))}.`)];
    const { card: c, cv } = card(f.name + (same ? ' · 세계 공명' : ''), f.world, tags, extra);
    (grid || document.getElementById('fuseGrid')).appendChild(c);
    CX.mount(cv, { density: 10, phases });
  }

  // ── 섞어 보기 ──
  let mixScene = null;
  function mix() {
    const sm = document.getElementById('mixMain');
    const ss = document.getElementById('mixSub');
    for (const sel of [sm, ss]) {
      for (const k of ORDER) {
        const g = el('optgroup');
        g.label = wn(k);
        for (const id of D.sample[k]) {
          const o = el('option', null, esc(`${D.weapons[id].name} (${D.weapons[id].catLabel})`));
          o.value = id;
          g.appendChild(o);
        }
        sel.appendChild(g);
      }
    }
    sm.value = 'arm_saw';
    ss.value = 'arm_sl_ghost';
    const run = () => {
      const a = sm.value;
      const b = ss.value;
      const info = document.getElementById('mixInfo');
      const cv = document.getElementById('mixCanvas');
      if (mixScene) CX.unmount(mixScene);
      mixScene = null;
      for (const o of ss.options) o.disabled = o.value === a || D.weapons[o.value].cat === D.weapons[a].cat;
      if (a === b || D.weapons[a].cat === D.weapons[b].cat) {
        info.innerHTML = `<div class="warn">같은 갈래(${esc(D.weapons[a].catLabel)})끼리는 합성되지 않는다. 다른 갈래의 보조를 골라 보자.</div>`;
        mixScene = CX.mount(cv, { density: 10, phases: [{ mounts: [CX.weapon(a)], dur: 999, title: '메인만: ' + D.weapons[a].name }] });
        return;
      }
      const f = CX.weapon(a, b);
      info.innerHTML = `<div class="big">${esc(f.name)}</div>
        <div class="tags"><span class="tag main">메인 ${esc(D.weapons[a].name)} · ${esc(wn(f.world))} · ${esc(f.catLabel)}</span><span class="tag sub">보조 ${esc(f.subName)} · ${esc(wn(f.subWorld))} · ${esc(f.subCat)}</span></div>
        <div class="react">반응: ${esc(f.react)}</div>
        <p style="margin:0;color:var(--muted)">${f.world === f.subWorld ? '같은 세계끼리 = 세계 공명.' : `몸은 ${esc(wn(f.world))}, 얹히는 맛은 ${esc(wn(f.subWorld))}.`} 메인만 3.6초 → 합친 뒤 7.5초를 되풀이한다.</p>`;
      const m = CX.weapon(a);
      mixScene = CX.mount(cv, {
        density: 10,
        phases: [
          { mounts: [m], dur: 3.6, title: '메인만: ' + m.name },
          { mounts: [f], dur: 7.5, intro: true, title: '합성: ' + f.name, note: f.react },
        ],
      });
    };
    sm.addEventListener('change', run);
    ss.addEventListener('change', run);
    run();
  }

  // ── 속도 ──
  function speed() {
    const box = document.getElementById('speed');
    box.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      CX.speed = Number(b.dataset.s);
      for (const x of box.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    });
  }

  function devPairs(k) {
    // 그 세계가 메인일 때 · 보조일 때, 다른 세계 다섯과 하나씩
    const grid = document.getElementById('fuseGrid');
    for (const o of ORDER) {
      if (o === k) continue;
      const pick = (A, B) => {
        for (const a of D.sample[A]) for (const b of D.sample[B]) if (D.weapons[a].cat !== D.weapons[b].cat) return [a, b];
        return null;
      };
      const p1 = pick(k, o);
      const p2 = pick(o, k);
      if (p1) fuseCard(p1[0], p1[1], grid);
      if (p2) fuseCard(p2[0], p2[1], grid);
    }
  }

  function boot() {
    speed();
    board();
    for (const k of ORDER) if (!only || only === k) worldCard(k);
    for (const [a, b] of FUSIONS) {
      if (only && D.weapons[a].world !== only && D.weapons[b].world !== only) continue;
      fuseCard(a, b);
    }
    if (only) devPairs(only);
    mix();
    CX.start();
  }

  // 글꼴을 불러온 뒤 시작 (캔버스 글씨가 제 글꼴로). 2.5초 넘으면 그냥 시작
  const fams = new Set(['Noto Sans KR', 'Cinzel', 'Orbit']);
  for (const k of Object.keys(CX.worlds)) for (const f of CX.worlds[k].fonts || []) fams.add(f);
  const loads = [...fams].map((f) => (document.fonts && document.fonts.load ? document.fonts.load(`700 20px "${f}"`).catch(() => null) : null));
  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    boot();
  };
  Promise.all(loads).then(go);
  setTimeout(go, 2500);
})();
