import { ARMS, ATTACK_CATEGORIES, CATEGORY_LABEL } from '../../../src/data/chaos';
import { inputFor, samplesV2 } from '../../../src/data/combineV2';
import { CAT4, TRAITS, TRAIT_TEXT, TRAIT_WORD, V5, fuseName, josa, reactName, traitOf } from '../../../src/data/combineV4';
import type { AttackCat } from '../../../src/data/links';
import { GROUPS, groupPairs } from '../../carry/v5groups';
import { mount, type Page, type Scene, type Section } from '../runtime';
import { V5ROWS } from './fuse5-results';
import { GROUP5 } from './fuse5-groups';
import { LOCK5 } from './lock5-results';

/**
 * 합성 v5 (src/data/combineV4.ts V5 · traitOf · fuseName, src/sim/fusion.ts trait5 · charge5 · tick4 한 몸).
 * 11-13 유저: "두 무기가 동시에 발사되는 느낌이지 않은지, 굳이 합쳐야 할 필요성, 새 무기를 얻은 느낌,
 * 종류가 엄청 많으니 매번 새로운 경험이 되게 — 갈래 안에서도 무기가 5·6개씩"
 */
const CATS = ATTACK_CATEGORIES as readonly AttackCat[];
const L = (c: AttackCat) => CATEGORY_LABEL[c];
const N = (id: string) => ARMS[id]?.name ?? id;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const sumW = (f: (r: (typeof V5ROWS)[number]) => number, w: (r: (typeof V5ROWS)[number]) => number) =>
  V5ROWS.reduce((a, r) => a + f(r) * w(r), 0) / Math.max(1, V5ROWS.reduce((a, r) => a + w(r), 0));

/** 갈래 A 가 "작용하는" 순간 (카드 설명) */
const MOMENT: Record<AttackCat, string> = {
  hand: '탭할 때',
  gun: '총알이 맞을 때',
  turret: '포탄이 터질 때',
  summon: '짐승이 물 때',
  magic: '주문이 걸릴 때',
  trap: '함정이 밟힐 때',
  air: '폭격이 떨어질 때',
  charge: '돌격이 들이받을 때',
  sound: '음파가 퍼질 때',
  spinner: '회전체가 벨 때',
  field: '장판이 깔릴 때',
  ray: '광선이 지질 때',
  throw: '던진 것이 떨어질 때',
  swarm: '떼가 달라붙을 때',
  spirit: '정령이 쏠 때',
};

const fuseCard = (A: string, B: string, extra: string[], code: string, opt: Partial<Scene> = {}): Scene => {
  const a = ARMS[A].cat as AttackCat;
  const b = ARMS[B].cat as AttackCat;
  const t = traitOf(B);
  return {
    title: fuseName(A, B),
    tag: `합성 · ${reactName(B)}`,
    weapons: [A, B],
    fuse: [[A, B]],
    fuse4: true,
    v5: true,
    input: inputFor(a, b) ?? undefined,
    desc: `${N(A)} + ${N(B)}. ${josa(N(A), '이', '가')} ${MOMENT[a].replace(/ 때$/, '')} 때마다 그 자리에서 ${josa(N(B), '이', '가')} 나간다 (따로 쏘지 않는다). ${CAT4[b].drama}: ${CAT4[b].dramaText}${t ? `, 그리고 ${TRAIT_WORD[t]} (${TRAIT_TEXT[t]})` : ''}.`,
    extra,
    code,
    ...opt,
  };
};

// 같은 갈래, 다른 무기
const same: Section[] = GROUPS.map(([a, b]) => ({
  id: `same-${a}-${b}`,
  title: `${L(a)} + ${L(b)}: 무기만 바꿔 넷`,
  lead: `같은 갈래 짝인데 ${L(a)} 무기·${L(b)} 무기를 바꿨다. 이름은 두 무기 이름에서, 반응 뒤 성질은 ${L(b)} 무기에서 나온다 (${L(b)} 무기 ${Object.values(ARMS).filter((w) => w.cat === b && !w.fusion).length}개의 성질: ${[...new Set(Object.values(ARMS).filter((w) => w.cat === b && !w.fusion).map((w) => traitOf(w.id)).filter(Boolean))].map((x) => TRAIT_WORD[x!]).join('·')}).`,
  scenes: groupPairs(a, b).map(([A, B]) => {
    const r = GROUP5[`${A}>${B}`];
    return fuseCard(A, B, r ? [`따로 대비 처치 ×${r.ratio.toFixed(2)} · B 가운데 극적 반응 ${pct(r.react)} · 18초 두 판 공명 ${r.res}번`] : [], `v5 ${A}>${B}`);
  }),
}));

// v4 에서 B 가 따로 많이 나가던 짝: v4 극적 vs v5
const vsKeys = [...V5ROWS]
  .filter((r) => r.over5 < 0.15 && !r.key.startsWith('hand>'))
  .sort((p, q) => q.over4 - p.over4)
  .slice(0, 4);
const vs: Scene[] = [];
for (const r of vsKeys) {
  const [a, b] = r.key.split('>') as [AttackCat, AttackCat];
  const [A, B] = samplesV2(a, b);
  const input = inputFor(a, b) ?? undefined;
  vs.push({
    title: `${L(a)} + ${L(b)} · v4`,
    tag: `B 가 따로 ${pct(r.over4)}`,
    weapons: [A, B],
    fuse: [[A, B]],
    fuse4: true,
    drama: true,
    input,
    desc: `${josa(N(A), '이', '가')} 뜸하게 작용하면 ${josa(N(B), '은', '는')} 모였다가 제 자리에서 따로 쏜다 (넘침). 두 무기가 같이 쏘는 것처럼 보인다.`,
    extra: [`따로 대비 처치 ×${r.r4.toFixed(2)} · 놓침 ${r.leaks4}`],
    code: `v4 ${r.key}`,
  });
  vs.push(
    fuseCard(A, B, [`따로 대비 처치 ×${r.r5.toFixed(2)} · B 가 따로 ${pct(r.over5)} · 놓침 ${r.leaks5}`], `v5 ${r.key}`, {
      title: `${L(a)} + ${L(b)} · v5 ${fuseName(A, B)}`,
      desc: `가득 차면 ${josa(N(B), '이', '가')} 따로 쏘지 않고 ${josa(N(A), '을', '를')} 당겨 더 자주 작용하게 한다. ${josa(N(B), '은', '는')} 늘 ${N(A)}의 순간에, 그 자리에서. 방어선 바로 앞에 적이 있을 때만 따로 지킨다.`,
    }),
  );
}

// 공명이 잘 보이는 짝
const resKeys = [...V5ROWS].sort((p, q) => q.res5 - p.res5 || q.r5 - p.r5).slice(0, 3);
const res: Scene[] = resKeys.map((r) => {
  const [a, b] = r.key.split('>') as [AttackCat, AttackCat];
  const [A, B] = samplesV2(a, b);
  return fuseCard(A, B, [`18초 두 판 공명 ${r.res5}번 · 따로 대비 처치 ×${r.r5.toFixed(2)}`], `v5 공명 ${r.key}`, {
    seconds: 30,
    wide: true,
    desc: `합친 무기 둘레 고리가 반응마다 찬다 (반응 아닌 B 는 ⅓). 다 차면 "${fuseName(A, B)} 공명!" ${V5.resSec}초 동안 ${josa(N(A), '이', '가')} 두 배로 빨라지고, 맞히는 족족 ${CAT4[b].drama} (${CAT4[b].dramaText}). 끝나면 ${V5.resRest}초 쉰다.`,
  });
});

// 성질 표
const traitCount = new Map<string, number>();
for (const w of Object.values(ARMS)) {
  if (w.cat === 'passive' || w.fusion) continue;
  const t = traitOf(w.id);
  if (t) traitCount.set(t, (traitCount.get(t) ?? 0) + 1);
}
const traitTable: string[][] = [['성질', '반응에 더해지는 것', '무기 수', '예']];
for (const t of TRAITS) {
  const ex = Object.values(ARMS)
    .filter((w) => w.cat !== 'passive' && !w.fusion && traitOf(w.id) === t)
    .slice(0, 3)
    .map((w) => w.name);
  traitTable.push([TRAIT_WORD[t], TRAIT_TEXT[t], String(traitCount.get(t) ?? 0), ex.join(', ')]);
}
const catTable: string[][] = [['B 갈래', '무기', '반응 이름 가짓수', '성질']];
for (const c of CATS) {
  const ws = Object.values(ARMS).filter((w) => w.cat === c && !w.fusion);
  const by = new Map<string, number>();
  for (const w of ws) {
    const t = traitOf(w.id);
    if (t) by.set(TRAIT_WORD[t], (by.get(TRAIT_WORD[t]) ?? 0) + 1);
  }
  catTable.push([L(c), String(ws.length), String(new Set(ws.map((w) => reactName(w.id))).size), [...by].sort((p, q) => q[1] - p[1]).map(([k, n]) => `${k} ${n}`).join(' · ')]);
}

const lows = V5ROWS.filter((r) => r.r5 < 1);
const sections: Section[] = [
  {
    id: 'rule',
    title: 'v5 에서 바뀐 것',
    lead: '네 가지를 보고 고쳤다: 두 무기가 같이 쏘는 느낌인가, 합칠 이유가 있나, 새 무기를 얻은 느낌인가, 무기마다 다른가. 모두 갈래·무기 데이터에서 나오는 공통 규칙이다 (짝마다 손으로 만든 것 없음).',
    list: [
      `한 몸: B 는 따로 쏘지 않는다. 오래 쉬어 모인 힘은 A 를 당겨 더 자주 작용하게 쓴다 (B 가 따로 나간 몫 ${pct(sumW((r) => r.over4, (r) => r.fires4))} → ${pct(sumW((r) => r.over5, (r) => r.fires5))}, 방어선 바로 앞에 적이 있을 때만 따로 지킨다). 합친 무기가 낸 것은 안에 든 무기의 색으로 빛난다`,
      '새 이름: 두 무기 이름에서 (군견 + 지뢰밭 → "군견 지뢰밭", 불여우 + 덫 → "불여우 덫"). 레벨 업 카드·처음 해낼 때 띠·카드 이름표 모두',
      `무기 성질 ${TRAITS.length}가지: B 무기 수치에서 하나 (얼음·화염·사슬·충격·관통·추적·튕김·끌림·폭발 → 없으면 난사·광역·연타·강타). 극적 반응에 크게, 반응이 아닐 때도 작게 실린다. 반응 이름 = 갈래 반응 · 성질 ("전향 무리 · 화염")`,
      `공명: 합친 무기 둘레 고리가 극적 반응 ${V5.resMax}번(보통 B 는 ⅓)으로 차면 ${V5.resSec}초 동안 A 쿨다운 ×${V5.resCd}, 맞히는 족족 극적 반응. 끝나면 ${V5.resRest}초 쉰다`,
      '보통 판에서 합성 카드가 무기 2레벨부터 (3레벨이면 2분 반 동안 한 번도 안 나왔다)',
    ],
    table: [
      ['210짝 (대표 무기 3레벨, 18초 두 판)', 'v4 극적', 'v5'],
      ['따로 가진 판 대비 처치 (가운데값)', `×${med(V5ROWS.map((r) => r.r4)).toFixed(2)}`, `×${med(V5ROWS.map((r) => r.r5)).toFixed(2)}`],
      ['따로보다 약한 짝', String(V5ROWS.filter((r) => r.r4 < 1).length), String(lows.length)],
      ['B 가 따로 나간 몫 (두 무기가 같이 쏘는 느낌)', pct(sumW((r) => r.over4, (r) => r.fires4)), pct(sumW((r) => r.over5, (r) => r.fires5))],
      ['B 가 따로 나간 몫이 절반 넘는 짝', String(V5ROWS.filter((r) => r.over4 > 0.5).length), `${V5ROWS.filter((r) => r.over5 > 0.5).length} (모두 손공격 몸: 탭해야 작용)`],
      ['B 가운데 극적 반응', pct(sumW((r) => r.react4, (r) => r.fires4)), pct(sumW((r) => r.react5, (r) => r.fires5))],
      ['공명이 터진 짝 (18초 안에)', '-', `${V5ROWS.filter((r) => r.res5 > 0).length} / 210`],
      ['방어선에 닿은 적 (210짝 합)', String(V5ROWS.reduce((a, r) => a + r.leaks4, 0)), String(V5ROWS.reduce((a, r) => a + r.leaks5, 0))],
      [`잠금 검사 ${LOCK5.n} 조합 (적 체력 ×40, 30초)`, '0', `${LOCK5.onLocks} (가장 느린 것도 따로의 ${pct(LOCK5.worst[0] ? LOCK5.worst[0].on / Math.max(0.1, LOCK5.worst[0].sep) : 1)})`],
    ],
    scenes: [],
  },
  ...same,
  { id: 'vs', title: 'v4 vs v5: B 가 따로 쏘던 짝', lead: 'v4 에서 B 가 가장 많이 따로 나가던 짝 넷. 왼쪽 v4 (두 무기가 같이 쏘는 것처럼 보임), 오른쪽 v5 (한 몸).', scenes: vs },
  { id: 'res', title: '공명', lead: '18초 안에 공명이 가장 잘 터진 짝 셋 (30초씩 돈다). 합친 무기 둘레 고리를 보면 된다: 반응마다 차고, 다 차면 번쩍이며 이름이 뜬다.', scenes: res },
  {
    id: 'traits',
    title: `무기 성질 ${TRAITS.length}`,
    lead: '무기 수치에 바로 있는 성질(얼음·폭발…)이 먼저 (자폭 병사는 폭발). 그런 게 없으면 갈래 안에서 견줘 난사·광역·연타·강타. 여럿이면 갈래 안에서 드문 것.',
    table: traitTable,
    scenes: [],
  },
  {
    id: 'cats',
    title: '갈래마다 무기가 얼마나 갈리나',
    lead: '반응 이름 가짓수 = 그 갈래를 B 로 넣었을 때 나올 수 있는 반응 이름 수. 이름(무기 짝)은 서로 다른 갈래 무기 짝 10만여 개 가운데 9만여 개가 다르다.',
    table: catTable,
    list: [
      '포격·소환수·함정·투척은 절반 넘게 폭발이라 그 갈래 안에선 반응 이름이 겹친다. 대신 몸(A) 무기마다 작용하는 때와 모양이 다르고, B 무기의 발 수·세기·짐승 모양이 그대로 나온다',
      `따로보다 약한 짝: ${lows.map((r) => r.key).join(', ') || '없음'} (음파 몸: 음파가 적을 밀어내 B 가 맞힐 자리가 흩어진다)`,
    ],
    scenes: [],
  },
];

const page: Page = {
  name: '합성 v5',
  title: '합성 v5: 한 몸 · 새 이름 · 무기 성질 · 공명',
  lead: '같은 갈래 짝이라도 무기가 다르면 이름·반응·싸우는 모양이 달라지게. B 는 따로 쏘지 않고 A 의 순간에만 (한 몸), 합친 무기 이름은 두 무기 이름에서, 반응엔 B 무기의 성질이 실리고, 반응이 쌓이면 공명. 카드는 모두 실제 게임 코드로 돈다 (합친 무기만, 도움 무기 없음).',
  notes: ['어색한 이름·성질은 카드 이름(예: 불여우 덫)으로 알려 주면 그 규칙 한 줄을 고친다. 모든 무기 짝에 같이 반영된다.', '극적 반응 페이지(v4) 는 그대로 보관.'],
  sections,
};

mount(page);
