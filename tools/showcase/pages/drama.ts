import { ATTACK_CATEGORIES, CATEGORY_LABEL } from '../../../src/data/chaos';
import { CEIL_KEYS } from '../../../src/data/combineCeil';
import { HELPER, inputFor, samplesV2 } from '../../../src/data/combineV2';
import { CAT4, ST_LABEL, V4D, josa, rulesV4 } from '../../../src/data/combineV4';
import type { AttackCat } from '../../../src/data/links';
import { mount, type Page, type Scene, type Section } from '../runtime';
import { RESULTS as R4 } from './combine4-results';
import { DEEP4 } from './combine4-deep';
import { DEEP4D_RESULTS } from './combine4d-deep-results';
import { RESULTS as R4D } from './combine4d-results';
import { WAVE_NOTE } from './drama-wave';
import { FUN } from './fun-results';

/**
 * 합성 극적 반응 (v4 + Fusion.drama, src/data/combineV4.ts 의 CAT4.drama · V4D, src/sim/fusion.ts 의 drama4 · rope4).
 * 짝이 아니라 갈래마다 극적 반응 하나: B 가 노리던 상태의 적을 만나면 그 갈래의 큰 한 방이 터지고 그 자리에 이름이 뜬다.
 */
const CATS = ATTACK_CATEGORIES as readonly AttackCat[];
const SEEK_PHRASE = { hold: '묶인 적', mark: '표식 적', weak: '약해진 적', crowd: '몰린 적' } as const;
const L = (c: AttackCat) => CATEGORY_LABEL[c];
const rules = rulesV4();
const byKey = new Map(rules.map((r) => [r.key, r] as const));
const ratios = Object.values(R4D).map((r) => r[0]).sort((a, b) => a - b);
const median = ratios[Math.floor(ratios.length / 2)] ?? 0;
const above = ratios.filter((r) => r >= 1).length;
const r4 = Object.values(R4).map((r) => r[0]).sort((a, b) => a - b);
const median4 = r4[Math.floor(r4.length / 2)] ?? 0;

const table: string[][] = [['B 갈래', '노리는 상태', '극적 반응', '무엇이 터지나']];
for (const c of CATS) table.push([L(c), ST_LABEL[CAT4[c].seeks], CAT4[c].drama, CAT4[c].dramaText]);

/** 갈래별 극적 반응을 잘 보여 주는 A (그 상태를 남기거나 자주 만드는 갈래) */
const SHOW: Record<AttackCat, AttackCat> = {
  hand: 'summon',
  gun: 'throw',
  turret: 'summon',
  summon: 'trap',
  magic: 'gun',
  trap: 'summon',
  air: 'trap',
  charge: 'trap',
  sound: 'gun',
  spinner: 'trap',
  field: 'summon',
  ray: 'summon',
  throw: 'gun',
  swarm: 'turret',
  spirit: 'swarm',
};

const card = (a: AttackCat, b: AttackCat, drama: boolean, title?: string): Scene => {
  const r = byKey.get(`${a}>${b}`)!;
  const [A, B] = samplesV2(a, b);
  const help = HELPER[a];
  const input = inputFor(a, b);
  const res = (drama ? R4D : R4)[r.key];
  return {
    title: title ?? `${r.title}${drama ? '' : ' · v4'}`,
    tag: drama ? CAT4[b].drama : r.name,
    weapons: help ? [A, B, help] : [A, B],
    fuse: [[A, B]],
    fuse4: true,
    drama,
    input: input ?? undefined,
    desc: drama ? `${josa(L(b), '이', '가')} ${SEEK_PHRASE[CAT4[b].seeks]}을 만나면: ${CAT4[b].dramaText}. ${CAT4[a].leaves ? `${josa(L(a), '은', '는')} 맞힌 적에 ${ST_LABEL[CAT4[a].leaves!]}을 남긴다.` : ''}` : r.text,
    extra: res ? [`따로 대비 처치 ×${res[0].toFixed(2)}`] : [],
    code: `${drama ? 'drama' : 'v4'} ${r.key}`,
  };
};

const vs: Scene[] = [];
for (const k of CEIL_KEYS) {
  const [a, b] = k.split('>') as [AttackCat, AttackCat];
  vs.push(card(a, b, false, `${L(a)} + ${L(b)} · v4`), card(a, b, true, `${L(a)} + ${L(b)} · 극적`));
}

const deep: Scene[] = DEEP4.map((d) => {
  const r = DEEP4D_RESULTS[d.code];
  return { title: d.title, tag: `${d.tag} · 극적`, weapons: d.weapons, fuse: d.fuse, fuse4: true, drama: true, input: d.input, desc: d.desc, extra: r ? [`네 무기를 따로 가진 판 대비 처치 ×${r[0].toFixed(2)}`] : [], code: `drama ${d.code}` };
});

/** 재밌을 조합 (tools/carry/fun.ts 가 반응 수 × 처치 비율로 고름): 무엇이 일어나는지 표에서 문장으로 */
const funDesc = (kind: string, cats: AttackCat[]): string => {
  const [a, b, c] = cats;
  const st = (x: AttackCat) => (CAT4[x].leaves ? ST_LABEL[CAT4[x].leaves!] : '');
  const dr = (x: AttackCat) => `${CAT4[x].drama} (${CAT4[x].dramaText})`;
  if (kind === '둘') return `${CAT4[a].leaves ? `${josa(L(a), '이', '가')} 맞힌 적에 ${st(a)}을 남기면 ` : `${josa(L(a), '이', '가')} 작용한 둘레 `}${SEEK_PHRASE[CAT4[b].seeks]}에게 ${dr(b)}.`;
  if (kind === '한 몸에 둘') return `${josa(L(a), '이', '가')} 남긴 ${CAT4[a].leaves ? st(a) : '자리'}에 둘이 함께: ${dr(b)}, 그리고 ${dr(c)}.`;
  return `${josa(L(a), '이', '가')} ${st(a)}을 남기면 ${CAT4[b].drama}, ${josa(L(b), '이', '가')} 남긴 ${st(b)}에 다시 ${CAT4[c].drama}. 반응이 반응을 부른다 (${CAT4[c].dramaText}).`;
};
const fun: Scene[] = FUN.map((f) => ({
  title: f.title,
  tag: `${f.kind} · ${f.cats.slice(1).map((x) => CAT4[x].drama).join(' → ')}`,
  weapons: f.weapons,
  fuse: f.fuse,
  fuse4: true,
  drama: true,
  input: (f.input as Scene['input']) ?? undefined,
  desc: funDesc(f.kind, f.cats),
  extra: [`극적 반응 ${f.reacts}번 (18초 두 판) · 따로 가진 판 대비 처치 ×${f.ratio.toFixed(2)}`],
  code: `fun ${f.cats.join(f.kind === '사슬' ? '>' : f.kind === '한 몸에 둘' ? '+' : '>')}`,
}));

const sections: Section[] = [
  {
    id: 'fun',
    title: '재밌는 조합',
    lead: '둘 · 한 몸에 둘 · 사슬(A→B→C) 을 다 돌려 보고, 극적 반응이 자주 터지면서 따로 가진 것보다 센 것을 골랐다 (점수 = 반응 수 × 처치 비율, 같은 몸·같은 짝은 겹치지 않게). 설명은 갈래 표에서 나온다.',
    scenes: fun,
  },
  {
    id: 'rule',
    title: '극적 반응',
    lead: '짝이 아니라 갈래마다 큰 한 방 하나. B 가 노리던 상태(묶임·표식·약점·무리)의 적을 만나면 그 갈래의 극적 반응이 터지고, 그 자리에 이름이 뜬다. 갈래마다 하나라 210짝·2+2·깊은 조합 어디서나 같은 이름이 같은 식으로 터진다.',
    table,
    list: [
      `세기는 크게: 반응 배율 ×${V4D.react}, B 에너지 ×${V4D.gain} (v4 는 ×2 · ×1.5). 대신 웨이브 체력 상승치로 받는다 (아래 "웨이브")`,
      '함정이 몸이면 밟은 적 뒤로 줄지어 오던 적도 함께 묶인다 (올가미 줄, 노란 줄). 묶인 적이 많아져 묶임을 노리는 포격·공중·돌격·회전체·장판·광선·소환수·함정이 줄줄이 터진다',
      'A 는 원래대로, B 는 모였다가 A 의 순간에 (v4 그대로). 반응이 아니면 v4 와 같다',
      `측정 (대표 무기 3레벨, 18초 두 판, 같은 두 무기를 따로 가진 판 대비): 처치 가운데값 ×${median.toFixed(2)} (v4 ×${median4.toFixed(2)}), ${above}/210 이 따로보다 많이`,
    ],
    scenes: [],
  },
  { id: 'wave', title: '웨이브', lead: WAVE_NOTE.lead, list: WAVE_NOTE.list, scenes: [] },
  {
    id: 'show',
    title: '갈래별 극적 반응 15',
    lead: '각 B 갈래의 극적 반응이 잘 보이는 짝 하나씩 (그 상태를 남기는 A 와). 카드 이름표 = 반응 이름.',
    scenes: CATS.map((b) => card(SHOW[b], b, true, `${CAT4[b].drama} (${L(SHOW[b])} + ${L(b)})`)),
  },
  { id: 'vs', title: 'v4 vs 극적', lead: '어제 v4 샘플과 같은 여섯 짝. 왼쪽 v4, 오른쪽 극적 반응.', scenes: vs },
  { id: 'deep', title: '2+2 · 깊은 조합', lead: '같은 넷을 극적 반응으로. 반응이 줄줄이 이어진다.', scenes: deep },
];

for (const a of CATS) {
  sections.push({
    id: `a-${a}`,
    title: `${L(a)} +`,
    lead: `${L(a)}: 남기는 상태 ${CAT4[a].leaves ? ST_LABEL[CAT4[a].leaves!] : '없음'}`,
    compact: true,
    scenes: CATS.filter((b) => b !== a).map((b) => card(a, b, true)),
  });
}

const page: Page = {
  name: '합성 극적 반응',
  title: '합성 극적 반응: 갈래마다 큰 한 방',
  lead: '공통 규칙(v4) 위에 갈래마다 극적 반응 하나. 노리던 상태를 만나면 "낙뢰 포격!" "올가미 돌파!" 처럼 그 자리에서 크게 터진다. 세진 만큼은 웨이브 체력 상승치로 받는다. 카드는 모두 실제 게임 코드로 돈다.',
  notes: ['반응이 약하거나 어색한 갈래는 이름(예: 낙뢰 포격)으로 알려 주면 그 갈래 한 줄을 고친다. 그러면 그 갈래가 B 로 든 모든 짝이 같이 바뀐다.', 'v4 샘플 · v3 · 천장 후보 페이지는 그대로 보관.'],
  sections,
};

mount(page);
