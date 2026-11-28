import { ARMS, ATTACK_CATEGORIES, CATEGORY_LABEL } from '../../../src/data/chaos';
import { fuseName, reactName } from '../../../src/data/combineV4';
import type { AttackCat } from '../../../src/data/links';
import { mount, type Page, type Scene, type Section } from '../runtime';

/**
 * 합성 무기 샘플 (11-28 유저: "합성 무기들 샘플 쫙 뽑아 봐. 전체적으로 싹 훑어볼게. 두 개 합성, 세 개 합성, 1+2, 2+1, 3+1, 2+2 이런 거 싹").
 * 지금 게임 규칙 그대로 (합성 v5: 한 몸 · 이름 · 성질 · 공명, Chaos.fuse4). 무기는 씨앗 고정 무작위, 샘플마다 몸(A) 갈래가 다르게.
 * 손공격은 탭이 있어야 해서 뺐다.
 */
const CATS = (ATTACK_CATEGORIES as readonly AttackCat[]).filter((c) => c !== 'hand');
const L = (c: string) => CATEGORY_LABEL[c as AttackCat] ?? c;
const N = (id: string) => ARMS[id]?.name ?? id;

// 씨앗 고정 난수 (mulberry32)
let seed = 20261128;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const pool = (c: AttackCat) => Object.values(ARMS).filter((w) => w.cat === c && !w.fusion).map((w) => w.id);
const used = new Set<string>();
/** 몸 갈래 rootCat 로 시작해 서로 다른 갈래 무기 n 개 (같은 무기는 페이지에서 되도록 한 번만) */
function draw(rootCat: AttackCat, n: number): string[] {
  const cats = [rootCat, ...CATS.filter((c) => c !== rootCat).sort(() => rnd() - 0.5).slice(0, n - 1)];
  return cats.map((c) => {
    const fresh = pool(c).filter((id) => !used.has(id));
    const id = pick(fresh.length ? fresh : pool(c));
    used.add(id);
    return id;
  });
}

/** 합친 순서대로 나무를 그린다: 지뢰밭 [군견 · 불여우 [얼음]] */
function tree(fuse: [string, string][]): { root: string; text: string; kids: Map<string, string[]> } {
  const kids = new Map<string, string[]>();
  const parent = new Map<string, string>();
  for (const [a, b] of fuse) {
    kids.set(a, [...(kids.get(a) ?? []), b]);
    parent.set(b, a);
  }
  let root = fuse[0][0];
  while (parent.has(root)) root = parent.get(root)!;
  const show = (id: string): string => {
    const ks = kids.get(id) ?? [];
    return ks.length ? `${N(id)} [${ks.map(show).join(' · ')}]` : N(id);
  };
  return { root, text: show(root), kids };
}

/** 게임 안 이름 (판 끝 표 · 정보창과 같게: 첫째 짝 이름 + 몇 개 더) */
function gameName(root: string, kids: Map<string, string[]>): string {
  const all: string[] = [];
  const walk = (id: string) => (kids.get(id) ?? []).forEach((k) => (all.push(k), walk(k)));
  walk(root);
  const first = kids.get(root)?.[0];
  return first ? fuseName(root, first) + (all.length > 1 ? ` +${all.length - 1}` : '') : N(root);
}

function card(fuse: [string, string][], shape: string): Scene {
  const { root, text, kids } = tree(fuse);
  const members: string[] = [];
  const walk = (id: string) => (kids.get(id) ?? []).forEach((k) => (members.push(k), walk(k)));
  walk(root);
  const weapons = [root, ...members];
  return {
    title: gameName(root, kids),
    tag: shape,
    weapons,
    fuse,
    fuse4: true,
    v5: true,
    desc: `${text}. 몸은 ${N(root)} (${L(ARMS[root].cat)}) — 이것만 쏘고, 안에 든 무기는 그 자리에서 반응한다.`,
    extra: members.map((m) => `${N(m)} (${L(ARMS[m].cat)}) → ${reactName(m)}`),
    code: fuse.map(([a, b]) => `${a}>${b}`).join(' '),
  };
}

// 구조마다: [제목, 설명, 몇 장, 무기 수, 합치는 순서 (무기 인덱스)]
type Shape = { id: string; title: string; tag: string; lead: string; n: number; size: number; order: [number, number][] };
const SHAPES: Shape[] = [
  { id: 's2', title: '둘 (1+1)', tag: '1+1', lead: '무기 둘 → 한 몸. 몸(앞)이 쏘고, 안에 든 무기(뒤)는 몸이 맞힌 자리에서 제 반응을 낸다.', n: 12, size: 2, order: [[0, 1]] },
  { id: 's21', title: '셋 한 몸 (2+1, 몸에 더함)', tag: '2+1 몸에 더함', lead: '합친 무기 몸에 하나 더. 안에 든 무기 둘이 나란히 반응한다. 지금 카드로 나오는 셋째 합성이 이것.', n: 8, size: 3, order: [[0, 1], [0, 2]] },
  { id: 's21c', title: '셋 사슬 (2+1, 안쪽에)', tag: '2+1 사슬', lead: '안에 든 무기에 또 하나. 셋째는 둘째가 낸 것에 반응한다 (같은 규칙이 한 번 더). 엔진은 되고 카드로는 아직 안 나온다.', n: 6, size: 3, order: [[0, 1], [1, 2]] },
  { id: 's12', title: '1+2 (합친 무기를 통째로)', tag: '1+2', lead: '먼저 둘을 합친 무기를 다른 무기 안에 통째로 넣는다. 안쪽 짝의 반응이 그대로 따라 들어간다. 카드로는 아직 안 나온다.', n: 6, size: 3, order: [[1, 2], [0, 1]] },
  { id: 's31', title: '넷 한 몸 (3+1)', tag: '3+1', lead: '한 몸에 무기 넷. 지금 카드는 셋까지 (자리 실험 규칙에서 넷).', n: 6, size: 4, order: [[0, 1], [0, 2], [0, 3]] },
  { id: 's22', title: '2+2', tag: '2+2', lead: '합친 무기 둘을 다시 합친다. 뒤쪽 합친 무기가 통째로 앞 몸 안에 들어간다. 카드로는 아직 안 나온다.', n: 6, size: 4, order: [[0, 1], [2, 3], [0, 2]] },
  { id: 's4c', title: '넷 사슬 (1+1+1+1 안쪽으로)', tag: '사슬 넷', lead: '안쪽으로 계속: 둘째가 셋째를, 셋째가 넷째를 품는다.', n: 4, size: 4, order: [[0, 1], [1, 2], [2, 3]] },
  { id: 's32', title: '다섯 (3+2)', tag: '3+2', lead: '셋 한 몸에 합친 무기 둘을 통째로. 가장 깊은 예.', n: 4, size: 5, order: [[0, 1], [0, 2], [3, 4], [0, 3]] },
];

let rc = 0;
const sections: Section[] = [
  {
    id: 'read',
    title: '보는 법',
    lead: '모든 카드는 지금 게임 코드 그대로 돈다 (합성 v5, 무기 3레벨, 합친 무기만). 무기는 씨앗 고정 무작위이고, 샘플마다 몸 갈래가 다르다.',
    list: [
      '제목 = 지금 게임에 뜨는 이름. 셋째부터는 "+1 · +2" 로만 붙는다 (아직 단계마다 새 이름이 없다)',
      '설명 첫 줄 = 나무: 몸 [안에 든 무기 · 안에 든 무기 [그 안에 든 무기]]',
      '작은 줄 = 안에 든 무기마다 반응 이름 (갈래 반응 · 그 무기 성질). 화면에 뜨는 이름이 이것',
      '카드 맨 아래 코드 = 알려 줄 때 쓰는 이름 (예: arm_a>arm_b)',
    ],
    table: [
      ['구조', '무엇', '지금 카드로 나오나'],
      ['1+1', '무기 둘 → 한 몸', '나옴'],
      ['2+1 몸에 더함', '합친 무기 몸에 하나 더 (안에 든 무기 둘)', '나옴 (셋까지)'],
      ['2+1 사슬', '안에 든 무기에 또 하나', '엔진만'],
      ['1+2', '합친 무기를 통째로 다른 무기 안에', '엔진만'],
      ['3+1', '한 몸에 넷', '자리 실험에서만'],
      ['2+2', '합친 무기 둘을 다시 합침', '엔진만'],
      ['사슬 넷 · 3+2', '더 깊게', '엔진만'],
    ],
    scenes: [],
  },
  ...SHAPES.map((s) => ({
    id: s.id,
    title: s.title,
    lead: s.lead,
    scenes: Array.from({ length: s.n }, () => {
      const ids = draw(CATS[rc++ % CATS.length], s.size);
      return card(
        s.order.map(([a, b]) => [ids[a], ids[b]] as [string, string]),
        s.tag,
      );
    }),
  })),
];

const page: Page = {
  name: '합성 무기 샘플',
  title: '합성 무기 샘플: 둘 · 셋 · 넷 · 다섯',
  lead: '1+1 · 2+1 · 1+2 · 3+1 · 2+2 · 사슬 · 3+2 를 지금 규칙 그대로 쫙. 훑어보다 걸리는 카드는 맨 아래 코드나 제목으로 알려 주면 된다.',
  notes: ['알고 있는 빈 곳: 셋째부터 이름이 "+1" 로만 붙고, 모습(받침 · 탄)은 몸 무기 그대로다. 짝에 따라 반응이 화면에 잘 안 뜨는 것도 있다.'],
  sections,
};

mount(page);
