import { ARMS, ATTACK_CATEGORIES, CATEGORY_LABEL } from '../../../src/data/chaos';
import { HELPER, OBJECT, V2, VERB, inputFor, rulesV2, samplesV2, type InputPattern } from '../../../src/data/combineV2';
import { SAMPLE, type AttackCat } from '../../../src/data/links';
import { discovered, mount, type Page, type Scene, type Section } from '../runtime';
import { CATEGORY_COLOR } from '../../../src/data/chaos';
import { RESULTS } from './combine2-results';

/**
 * 합성 210 v2 미리보기: A 의 몸 × B 의 동사 (src/data/combineV2.ts 문장, src/sim/fusion.ts 동작).
 * 카드마다 대표 무기 둘을 3레벨로 합쳐 실제 게임 코드로 돌린다. 손이 든 짝은 그 입력을 자동으로 누른다.
 */
const CATS = ATTACK_CATEGORIES as readonly AttackCat[];
const L = (c: AttackCat) => CATEGORY_LABEL[c];
const rules = rulesV2();

const INPUT_LABEL: Record<InputPattern, string> = {
  tap: '자동 입력: 앞 적을 0.45초마다 탭',
  hold: '자동 입력: 꾹 누르기 1.4초',
  link: '자동 입력: 두 곳을 이어 탭',
  tri: '자동 입력: 세 곳 탭 (삼각형)',
  path: '자동 입력: 네 곳을 차례로 탭',
  beat: '자동 입력: 0.6초 박자로 탭',
  mash: '자동 입력: 같은 곳 연타 다섯',
};

const ratios = Object.values(RESULTS).map((r) => r[0]).sort((a, b) => a - b);
const median = ratios[Math.floor(ratios.length / 2)] ?? 0;
const above = ratios.filter((r) => r >= 1).length;

const principle: string[][] = [['갈래', 'A 일 때: 몸 (무엇을 내보내나)', 'B 일 때: 동사 (어떻게 바꾸나)', '대표 무기']];
for (const c of CATS) principle.push([L(c), OBJECT[c], VERB[c], ARMS[SAMPLE[c]].name]);

const g = SAMPLE.gun;
const s = SAMPLE.summon;
const t = SAMPLE.trap;
const r = SAMPLE.ray;
const sw = SAMPLE.swarm;
const mg = 'arm_m_timestop';
const deep: Scene[] = [
  { title: '함정 + (총 + 소환수)', tag: '유저 예', weapons: [t, g, s], fuse: [[g, s], [t, g]], desc: '함정이 터질 때 전방향 총탄 열두 발(산탄 지뢰). 그 총탄이 전향탄이라 쓰러진 적이 아군으로 일어난다.', code: 'trap>(gun>summon)' },
  { title: '(총 + 소환수) + 함정', tag: '둘을 실음', weapons: [g, s, t], fuse: [[g, s], [g, t]], desc: '총탄이 전향탄이면서 불발 지뢰. 쓰러뜨린 적은 아군으로, 빗나간 탄은 지뢰로.', code: 'gun>summon, gun>trap' },
  { title: '소환수 + (함정 + 총)', tag: '깊이 2', weapons: [s, t, g], fuse: [[t, g], [s, t]], desc: '소환수가 맡은 적 앞에 함정을 깔고(공병), 그 함정이 밟히면 전방향 총탄(산탄 지뢰).', code: 'summon>(trap>gun)' },
  { title: '떼 + (광선 + 주문)', tag: '깊이 2', weapons: [sw, r, mg], fuse: [[r, mg], [sw, r]], desc: '구름이 덮은 적들이 줄로 이어져 함께 지져지고(약점 표적), 그 줄기에 주문이 붙는다(주문 집속).', code: 'swarm>(ray>magic)' },
];

const sections: Section[] = [
  {
    id: 'rule',
    title: '원칙',
    lead: '합친 무기 = A 의 몸 × B 의 동사. B 가 A 옆에 효과를 붙이는 게 아니라, A 가 내보내는 것 자체가 B 처럼 바뀐다.',
    table: principle,
    list: [
      `세기: 합친 무기(A)는 피해 ×${V2.bonusDmg}, 쿨다운 ×${V2.bonusCd} (둘의 힘을 다 받음). B 의 동사 효과는 B 피해 ×${V2.verbMul} (깎지 않고 더). 지속은 A 한 방에 비례`,
      `측정 (대표 무기 3레벨, 18초 두 판): 같은 두 무기를 따로 가진 판 대비 처치 가운데값 ×${median.toFixed(2)}, 210가지 중 ${above}가지가 따로보다 많이 잡는다. 카드마다 그 값을 적었다`,
      '처치로 안 잡히는 쓸모(밀어내기·멈칫·묶기)가 큰 짝은 처치 비율이 낮게 나온다. ×1 아래인 짝은 다음에 손볼 후보',
      '손공격 = 입력이 정체성 (탭·두 탭 잇기·꾹 누르기·연타·박자). 손이 든 카드는 그 입력을 자동으로 누른다. 손은 합쳐도 탭 공격 그대로',
      '주문을 나르는 카드는 주문이 피해를 안 줘서 권총을 도움으로 같이 둔다',
      '게임 안에서는 규칙 문장을 보여 주지 않는다 (직접 찾아가는 맛). 이 페이지는 검증용',
    ],
    scenes: [],
  },
  {
    id: 'book',
    title: '도감',
    lead: '게임 안에서는 처음 해낸 짝만 이름이 뜬다 (규칙 문장은 숨김). 이 페이지의 카드가 도는 만큼 칸이 채워진다: 아래로 내려가며 카드를 보면 "?" 가 이름으로 바뀐다. 줄 = 몸(A), 칸 = 동사(B).',
    scenes: [],
    render(host) {
      const count = document.createElement('p');
      count.className = 'note';
      host.append(count);
      const wrap = document.createElement('div');
      wrap.className = 'matrixwrap';
      const tb = document.createElement('table');
      tb.className = 'matrix';
      const head = document.createElement('tr');
      head.append(document.createElement('th'));
      for (const b of CATS) {
        const th = document.createElement('th');
        th.textContent = L(b);
        head.append(th);
      }
      tb.append(head);
      const cells = new Map<string, HTMLTableCellElement>();
      for (const a of CATS) {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.className = 'rowh';
        th.textContent = L(a);
        tr.append(th);
        for (const b of CATS) {
          const td = document.createElement('td');
          if (a === b) td.textContent = '—';
          else {
            td.textContent = '?';
            td.style.opacity = '0.45';
            cells.set(`${a}>${b}`, td);
          }
          tr.append(td);
        }
        tb.append(tr);
      }
      wrap.append(tb);
      host.append(wrap);
      const names = new Map(rules.map((r) => [r.key, r.name] as const));
      const paint = () => {
        for (const k of discovered) {
          const td = cells.get(k);
          if (!td || td.dataset.found) continue;
          td.dataset.found = '1';
          td.textContent = names.get(k) ?? k;
          td.style.opacity = '1';
          td.style.fontWeight = '700';
          td.style.borderLeft = `3px solid ${CATEGORY_COLOR[k.split('>')[1] as AttackCat]}`;
          td.title = k;
        }
        count.textContent = `발견 ${discovered.size} / 210`;
      };
      paint();
      setInterval(paint, 600);
    },
  },
  { id: 'deep', title: '겹친 합성', lead: '합친 무기를 또 합친다. B 가 낸 것은 B 의 것이라 B 가 합친 것까지 따라간다.', scenes: deep },
];

for (const a of CATS) {
  sections.push({
    id: `a-${a}`,
    title: `${L(a)} +`,
    lead: `${L(a)}의 몸: ${OBJECT[a]}`,
    compact: true,
    scenes: rules
      .filter((x) => x.from === a)
      .map((x) => {
        const [A, B] = samplesV2(x.from, x.to);
        const input = inputFor(x.from, x.to);
        const res = RESULTS[x.key];
        const help = HELPER[x.from];
        const extra: string[] = [];
        if (input) extra.push(INPUT_LABEL[input]);
        if (help) extra.push(`도움: ${ARMS[help].name} (주문은 피해가 없어서)`);
        if (res) extra.push(`따로 가진 판 대비 처치 ×${res[0].toFixed(2)}`);
        return {
          title: x.title,
          tag: x.name,
          weapons: help ? [A, B, help] : [A, B],
          fuse: [[A, B]] as [string, string][],
          input: input ?? undefined,
          desc: x.text,
          extra,
          code: x.key,
        };
      }),
  });
}

const page: Page = {
  name: '합성 210 v2',
  title: '합성 210 v2: 합치면 새 무기',
  lead: 'A 가 내보내는 것 자체가 B 처럼 바뀐다: 빗나간 총탄이 지뢰가 되고, 함정이 터지며 사방으로 쏘고, 소환수가 낙하산으로 내려오고, 돌격이 핀볼처럼 튕긴다. 카드는 모두 실제 게임 코드로 돈다.',
  notes: [
    '어색한 카드는 맨 아래 이름(예: trap>gun)으로 알려 주면 그 규칙만 고친다. 카드를 누르면 처음부터. 맨 위 숫자 "합성 N" 은 규칙이 해낸 횟수.',
    'v1(가끔 작게 열리는 판)은 "합성 210" 페이지에 그대로 보관.',
  ],
  sections,
};

mount(page);
