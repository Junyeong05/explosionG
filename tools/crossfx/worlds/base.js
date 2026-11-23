// 기본 세계 (참고용 · 빠진 함수의 대체). 세계 모듈은 이 모양을 따른다: CX.world('<key>', { ... })
// 좌표: 판은 360×540 논리 좌표, 방어선 y=446, 무기 자리 가운데 y=492 (CX.size). ctx 는 이미 그 좌표로 맞춰져 있다.
// 그리기 함수는 ctx 를 save/restore 안에서 받는다 (상태를 되돌릴 필요 없음).
(function () {
  const { TAU, rnd } = CX.util;

  CX.world('base', {
    name: '기본',
    short: '기본',
    /** 카드에 쓰는 한 줄: 이 세계 무기는 어떻게 보이나 */
    desc: '세계 모듈이 없을 때 쓰는 흰 선 그림',
    /** 쪽에서 쓰는 색 (꼬리표·제목 점) */
    colors: { main: '#CFC6E8', soft: '#3A3150' },
    /** 캔버스 글씨에 쓰는 글꼴 (쪽이 미리 불러온다) */
    fonts: [],

    /** 유물함 안쪽 재질 (x,y 왼쪽 위, w×h). 틀·테는 공통이 그린다 */
    box(c, x, y, w, h) {
      c.fillStyle = '#2A2340';
      c.fillRect(x, y, w, h);
    },

    /** 세계 문장 (유물함 왼쪽 위 작은 표시, (x,y) 왼쪽 위, r 반지름) */
    crest(c, x, y, r) {
      c.fillStyle = '#CFC6E8';
      c.beginPath();
      c.arc(x + r, y + r, r * 0.7, 0, TAU);
      c.fill();
    },

    /** 무기 아이콘 (가운데 x,y, 크기 s). id 는 'arm_...' */
    icon(c, id, x, y, s) {
      c.strokeStyle = '#FFFFFF';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(x, y, s * 0.3, 0, TAU);
      c.stroke();
      c.font = `700 ${Math.round(s * 0.34)}px "Noto Sans KR", sans-serif`;
      c.fillStyle = '#FFFFFF';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText((CX.data.weapons[id] || { name: '?' }).name.slice(0, 1), x, y + 1);
    },

    /**
     * 메인으로 쏘기: 효과를 만들고 쿨다운(초)을 돌려준다. w.x,w.y 가 무기 자리, tg 는 노릴 적.
     * 도우미: CX.shoot(투사체) · CX.beam(광선) · CX.zone(장판) · CX.runner(달려가는 것) · CX.mark(잠깐 장식) · api.add(직접 만든 효과)
     * api.later(초, fn) 예약 · api.target(mode,x,y) · api.near(x,y,r) · api.shake(n) · CX.util.sprite(key,w,h,draw) 미리 그려 두기
     * 맞힘은 반드시 api.hit(w, e, 피해, x, y, {push, slow}) 로 (그래야 맞는 무늬·보조 층·반응·연쇄가 붙는다).
     * 직접 만든 효과는 머리 위치 x,y (와 vx,vy)를 내놓으면 합친 무기일 때 보조 세계 궤적 층이 그 자리에 얹힌다.
     * 피해 기준: 적 체력 일반 6 · 장갑 15 · 돌격 4. 한 번에 2~6, 큰 한 방 8~10.
     */
    fire(api, w, tg) {
      const cat = w.cat;
      if (cat === 'gun') {
        // 연발은 api.later 로 (setTimeout 금지: 속도·멈춤을 안 따른다)
        for (let i = 0; i < 3; i++) api.later(i * 0.08, (a) => tg.alive && CX.shoot(a, w, tg, { speed: 520, dmg: 2, r: 3, spread: 8, life: 1.4 }));
        return 0.9;
      }
      if (cat === 'ray') {
        CX.beam(api, w, tg, { dmg: 5, dur: 0.3 });
        return 1.3;
      }
      if (cat === 'summon' || cat === 'charge') {
        CX.runner(api, w, tg, { speed: cat === 'charge' ? 260 : 170, dmg: 4, n: 3, line: cat === 'charge' });
        return 2.4;
      }
      if (cat === 'turret' || cat === 'throw') {
        CX.shoot(api, w, tg, { speed: 260, dmg: 5, r: 5, arc: 70, splash: 30 });
        return 1.5;
      }
      if (cat === 'spinner') {
        CX.shoot(api, w, tg, { speed: 300, dmg: 3, r: 9, pierce: 4, life: 2 });
        return 1.8;
      }
      if (cat === 'trap' || cat === 'field' || cat === 'magic' || cat === 'air') {
        CX.zone(api, w, tg.x, tg.y + 20, { r: 38, dur: 2.2, tick: 0.45, dmg: 2 });
        return 2.6;
      }
      // 음파·손공격·떼·정령: 맞은 자리 둘레를 한 번에
      CX.mark(api, tg.x, tg.y, 0.4, (c, k) => {
        c.strokeStyle = `rgba(255,255,255,${1 - k})`;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(tg.x, tg.y, 10 + k * 34, 0, TAU);
        c.stroke();
      });
      for (const e of api.near(tg.x, tg.y, 34)) api.hit(w, e, 3, e.x, e.y);
      return 1.4;
    },

    /** (선택) 무기마다 매 틱 (오래 남는 드론·지뢰 같은 것). w.mem 에 상태를 둔다 */
    tick: null,

    /**
     * 보조 세계 궤적 층: 합친 무기의 메인 효과 머리(e.x,e.y, e.vx,e.vy, e.age, e.hist=[x0,y0,x1,y1,...] 최근 자취) 위에 얹는다.
     * 메인 그림을 가리지 말고 "덧입힌다": 꼬리·오라·문양. 가볍게 (한 프레임에 효과 수십 개가 부른다).
     */
    trail(c, e) {
      c.strokeStyle = 'rgba(255,255,255,0.5)';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(e.x, e.y, 7, 0, TAU);
      c.stroke();
    },

    /**
     * 맞는 순간 무늬. asSub=false 면 메인(이 세계 무기가 쏜 것), true 면 보조 층(다른 세계 몸에 이 세계 맛을 얹음: 작고 가볍게).
     * 보통 CX.mark(api, x, y, 수명, (ctx, k) => ...) 로 잠깐 그린다. e 는 맞은 적(없을 수 있음)
     */
    hit(api, x, y, w, asSub) {
      CX.mark(api, x, y, 0.25, (c, k) => {
        c.strokeStyle = `rgba(255,255,255,${(asSub ? 0.5 : 0.9) * (1 - k)})`;
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(x, y, 4 + k * 10, 0, TAU);
        c.stroke();
      });
    },

    /**
     * 반응 (보조 세계의 큰 한 방): 합친 무기가 세 번 맞힐 때마다 (2.6초에 한 번까지). e 는 방금 맞은 적.
     * 피해는 api.hit(w, 적, 피해, x, y, { isReact: true }) 로 (isReact 가 없으면 반응이 또 반응을 부른다).
     * 반응 이름은 공통이 label() 로 띄우니 여기서는 그림만.
     */
    react(api, e, w) {
      CX.mark(api, e.x, e.y, 0.6, (c, k) => {
        c.strokeStyle = `rgba(255,255,255,${1 - k})`;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(e.x, e.y, 10 + k * 60, 0, TAU);
        c.stroke();
      });
      for (const n of api.near(e.x, e.y, 60)) api.hit(w, n, 6, n.x, n.y, { isReact: true });
    },

    /** 반응 이름 글씨 (가운데 x,y). age 0→life. 들어오고·머물고·사라지는 움직임까지 이 세계 말투로 */
    label(c, text, x, y, age, life) {
      const a = age < 0.15 ? age / 0.15 : age > life - 0.3 ? (life - age) / 0.3 : 1;
      c.globalAlpha = Math.max(0, a);
      c.font = '800 20px "Noto Sans KR", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const tw = c.measureText(text).width;
      c.fillStyle = 'rgba(10,6,20,0.85)';
      c.fillRect(x - tw / 2 - 12, y - 17, tw + 24, 34);
      c.fillStyle = '#FFFFFF';
      c.fillText(text, x, y);
    },
  });
  void rnd;
})();
