import { ARMS, ATTACK_CATEGORIES, CATEGORY_LABEL } from '../../../src/data/chaos';
import { CARRY, CARRY_NOTE, LINK, PAYLOAD, PAYLOAD_NOTE, SAMPLE, linkRules, type AttackCat } from '../../../src/data/links';
import { mount, type Page, type Scene, type Section } from '../runtime';

/**
 * 합성 210 검증 페이지: 210가지를 실제 게임 코드로 하나씩 돌린다 (갈래 둘, 대표 무기 3레벨).
 * 규칙은 src/data/links.ts (CARRY × PAYLOAD), 동작은 src/sim/chaos.ts (attach·carry·payload)
 */
const CATS = ATTACK_CATEGORIES as readonly AttackCat[];
const rules = linkRules();
const L = (c: AttackCat) => CATEGORY_LABEL[c];

const ruleTable: string[][] = [['갈래', '나를 때 (언제·어디서 열리나)', '실릴 때 (무엇이 열리나)', '대표 무기']];
for (const c of CATS) {
  const notes = [CARRY_NOTE[c], PAYLOAD_NOTE[c]].filter(Boolean).join(' / ');
  ruleTable.push([L(c), CARRY[c].when, PAYLOAD[c] + (notes ? ` — ${notes}` : ''), ARMS[SAMPLE[c]].name]);
}

const g = SAMPLE.gun;
const s = SAMPLE.summon;
const t = SAMPLE.trap;
const deep: Scene[] = [
  {
    title: '총 + 소환수',
    tag: '깊이 1',
    weapons: [g, s],
    attach: [[g, s]],
    desc: '총이 다섯 발 맞힐 때마다 그 자리에서 소환수가 나와 아직 아무도 안 맡은 적을 맡는다. 합친 무기는 총으로 친다.',
    code: 'gun>summon',
  },
  {
    title: '함정 + (총 + 소환수)',
    tag: '깊이 2',
    weapons: [t, g, s],
    attach: [[g, s], [t, g]],
    desc: '함정이 밟히면 그 자리에 작은 총구가 2초 서서 쏘고, 그 총도 다섯 발마다 소환수를 낸다. 안쪽은 한 단 깊어서 세기 ×0.6.',
    code: 'trap>(gun>summon)',
  },
  {
    title: '(총 + 소환수) + 함정',
    tag: '깊이 1 · 둘을 실음',
    weapons: [g, s, t],
    attach: [[g, s], [g, t]],
    desc: '총이 소환수와 함정을 둘 다 싣는다. 다섯 발마다 돌아가며 소환수 → 함정 → 소환수 … 이 열린다.',
    code: 'gun>summon, gun>trap',
  },
];

const sections: Section[] = [
  {
    id: 'rules',
    title: '공통 규칙',
    lead: '갈래마다 "나를 때" 하나와 "실릴 때" 하나, 30조각이 210가지를 만든다. 짝마다 따로 짠 규칙은 없다.',
    table: ruleTable,
    list: [
      `세기 k: 나르는 무기의 한 방(레벨 포함)이 같은 갈래 가운데값의 몇 배인가 (${LINK.kMin} ~ ${LINK.kMax}). 한 방이 센 무기일수록 실린 것도 세고 오래 간다`,
      `피해: 실린 무기 피해 × ${LINK.dmg} × k. 초(지속): 위 표의 초 × k. 실린 주문은 그 주문 지속 × ${LINK.spellDur} × k`,
      '간격: "몇 번에 한 번"이라 빨리 쏘는 무기일수록 자주 열린다 (공격 속도를 따라감)',
      `안전장치: 나르는 무기 하나가 최대 ${LINK.cap}번 몰아서, 초당 ${LINK.rate}번씩 다시 찬다. 화면 물체가 많으면 덜 연다`,
      `겹친 합성: 실린 무기가 또 무엇을 실었으면 열린 것도 그것을 나른다. 깊이 ${LINK.maxDepth}까지, 한 단 깊을 때마다 세기 ×${LINK.depthMul}`,
      '여럿을 실으면 나를 때마다 돌아가며 연다. 같은 갈래끼리는 합치지 않는다 (15 × 14 = 210)',
      '열리는 순간: 나르는 갈래 색 고리가 조여 들고, 실린 갈래 색 고리가 퍼진다',
    ],
    scenes: [],
  },
  {
    id: 'deep',
    title: '겹친 합성',
    lead: '합친 무기를 또 합친다. 뿌리(맨 앞) 갈래로 치고, 어느 깊이든 같은 규칙.',
    scenes: deep,
  },
];

for (const a of CATS) {
  const mine = rules.filter((r) => r.from === a);
  sections.push({
    id: `c-${a}`,
    title: `${L(a)} →`,
    lead: `열림: ${CARRY[a].when}.${CARRY_NOTE[a] ? ` ${CARRY_NOTE[a]}.` : ''}`,
    compact: true,
    scenes: mine.map((r) => ({
      title: r.title,
      tag: r.name ?? undefined,
      weapons: [r.carrier, r.payload],
      attach: [[r.carrier, r.payload]],
      taps: r.from === 'hand' || r.to === 'hand',
      desc: `→ ${r.what}.`,
      extra: PAYLOAD_NOTE[r.to] ? [PAYLOAD_NOTE[r.to]!] : undefined,
      code: r.key,
    })),
  });
}

const page: Page = {
  name: '합성 210',
  title: '합성 210: 갈래 둘을 합치면',
  lead: '합친 무기는 앞 갈래(나르는 쪽)로 친다. 앞 갈래가 나를 때마다 그 자리에서 뒤 갈래가 작게 열린다. 카드는 모두 실제 게임 코드로 돈다 (대표 무기 3레벨).',
  notes: [
    '게임 안에서는 이 규칙 문장을 보여 주지 않는다. 유저가 합쳐 보며 직접 찾아가는 맛. 이 페이지는 검증용이다.',
    '어색한 카드는 카드 맨 아래 이름(예: gun>summon)으로 알려 주면 그 규칙만 고친다. 카드를 누르면 처음부터.',
  ],
  sections,
};

mount(page);
