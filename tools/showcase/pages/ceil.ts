import { ARMS, CATEGORY_LABEL } from '../../../src/data/chaos';
import { CEIL, CEIL_KEYS } from '../../../src/data/combineCeil';
import { samplesV2 } from '../../../src/data/combineV2';
import { rulesV3 } from '../../../src/data/combineV3';
import type { AttackCat } from '../../../src/data/links';
import { mount, type Page, type Scene, type Section } from '../runtime';
import { CEIL_RESULTS } from './ceil-results';

/**
 * 합성 "천장" 후보 여섯 (src/data/combineCeil.ts, src/sim/fusion.ts 의 ceil3).
 * 리서치 보고서 "게임 무기 합성 규칙 사례" 의 제안: 210 전부는 v3 공통 규칙(바닥), 맞물리는 20~30짝만 손으로 짠 새 동작(천장).
 * 짝마다 지금 v3 와 천장 후보를 같은 무기·같은 판으로 나란히 돌린다.
 */
const L = (c: AttackCat) => CATEGORY_LABEL[c];
const v3 = new Map(rulesV3().map((r) => [r.key, r] as const));

const table: string[][] = [['짝', '천장 후보', '채우는 빈틈', '처치 (따로 대비) v3 → 천장']];
for (const k of CEIL_KEYS) {
  const c = CEIL[k]!;
  const [a, b] = k.split('>') as [AttackCat, AttackCat];
  const r = CEIL_RESULTS[k];
  table.push([`${L(a)} + ${L(b)}`, c.name, c.gap, r ? `×${r[0].toFixed(2)} → ×${r[1].toFixed(2)}` : '']);
}

const sections: Section[] = [
  {
    id: 'idea',
    title: '무엇을 보나',
    lead: '리서치 결론: 확 좋아지는 합성은 한쪽이 다른 쪽의 고질적인 빈틈(언제·어디·얼마나 오래·몇 명에게)을 없애고, 그 결과가 새 동작·새 이름으로 보인다. 그래서 210 전부를 같은 무게로 만들지 않고, 맞물리는 짝만 손으로 짠 "천장" 으로 만든다. 여기 여섯이 첫 후보다.',
    table,
    list: [
      '짝마다 카드 둘: 왼쪽 = 지금 v3 (A 가 작용하는 자리에서 그것이 B 가 됨), 오른쪽 = 천장 후보. 같은 무기·같은 레벨(3)·같은 적',
      '함정 + 소환수·돌격·회전체: 유저가 "소환 위치만 바뀌었다" 고 한 세 짝을 빈틈 기준으로 다시 짰다',
      '소환수 + 포격·총 + 주문·음파 + 장판: 빈틈 표에서 맞물리는 다른 갈래 짝',
      '처치 비율은 같은 두 무기를 따로 가진 판 대비 (18초 두 판). 리서치대로 처치 수만으로는 "확 좋아짐" 이 안 재진다: 화면에서 무엇이 풀리는지를 본다',
      '맨 위 "기준" 카드는 유저가 좋다고 한 v3 함정 + 주문',
    ],
    scenes: [],
  },
  {
    id: 'ref',
    title: '기준',
    lead: '유저가 "원할 때 못 쓰던 주문이 적이 밟으면 나간다" 고 한 짝 (v3 그대로). 덫이 주문의 빈틈(때·자리)을 채운다.',
    scenes: (() => {
      const [A, B] = samplesV2('trap', 'magic');
      const r = v3.get('trap>magic')!;
      return [{ title: '함정 + 주문 · v3', tag: r.name, weapons: [A, B], fuse: [[A, B]], fuse3: true, desc: r.trait + '.', code: 'v3 trap>magic' } satisfies Scene];
    })(),
  },
];

for (const k of CEIL_KEYS) {
  const c = CEIL[k]!;
  const [a, b] = k.split('>') as [AttackCat, AttackCat];
  const [A, B] = samplesV2(a, b);
  const r = CEIL_RESULTS[k];
  const old = v3.get(k)!;
  const w = `${ARMS[A].name} + ${ARMS[B].name}`;
  sections.push({
    id: `c-${a}-${b}`,
    title: `${L(a)} + ${L(b)}: ${c.name}`,
    lead: `채우는 빈틈: ${c.gap}`,
    scenes: [
      {
        title: `${L(a)} + ${L(b)} · 지금 v3`,
        tag: old.name,
        weapons: [A, B],
        fuse: [[A, B]],
        fuse3: true,
        desc: `${c.before}.`,
        extra: r ? [`따로 가진 판 대비 처치 ×${r[0].toFixed(2)}`] : [],
        code: `v3 ${k}`,
      },
      {
        title: `${L(a)} + ${L(b)} · 천장 후보`,
        tag: c.name,
        weapons: [A, B],
        fuse: [[A, B]],
        fuse3: true,
        ceil: true,
        desc: `${c.move}.`,
        extra: r ? [`따로 가진 판 대비 처치 ×${r[1].toFixed(2)} (v3 ×${r[0].toFixed(2)})`, `무기: ${w}`] : [`무기: ${w}`],
        code: `ceil ${k}`,
      },
    ],
  });
}

const page: Page = {
  name: '합성 천장 후보',
  title: '합성 천장 후보 여섯',
  lead: '210짝을 다 같은 무게로 두지 않고, 서로의 빈틈을 채우는 짝만 손으로 짠 새 동작으로. 짝마다 지금 v3 와 천장 후보를 같은 판에서 나란히 돌린다. 카드는 모두 실제 게임 코드로 돈다.',
  notes: [
    '어색하거나 좋은 카드는 맨 아래 이름(예: ceil trap>charge)으로 알려 주면 그 짝만 고친다. 카드를 누르면 처음부터. 맨 위 숫자 "합성 N" 은 그 동작을 해낸 횟수.',
    '괜찮은 것만 게임에 넣는다. v3 (합성 210 v3) 와 v2 페이지는 그대로 보관.',
  ],
  sections,
};

mount(page);
