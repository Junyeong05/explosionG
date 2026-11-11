import { ARMS, ATTACK_CATEGORIES, CATEGORY_COLOR, CATEGORY_LABEL } from '../../../src/data/chaos';
import { HELPER, inputFor, samplesV2, type InputPattern } from '../../../src/data/combineV2';
import { BECOME, DELIVERY, V3, rulesV3 } from '../../../src/data/combineV3';
import { SAMPLE, type AttackCat } from '../../../src/data/links';
import { discovered, mount, type Page, type Scene, type Section } from '../runtime';
import { RESULTS } from './combine3-results';

/**
 * 합성 210 v3 "융합" 미리보기 (src/data/combineV3.ts 문장, src/sim/fusion.ts 의 act3 · content3 동작).
 * 짝마다 따로 짠 동작이 없다: A 가 작용하는 순간마다 그 자리에서 그것이 B 가 된다 (몸 15 × 성질 15).
 * 카드마다 대표 무기 둘을 3레벨로 합쳐 실제 게임 코드로 돌린다. 손이 든 짝은 그 입력을 자동으로 누른다.
 */
const CATS = ATTACK_CATEGORIES as readonly AttackCat[];
const L = (c: AttackCat) => CATEGORY_LABEL[c];
const rules = rulesV3();

const INPUT_LABEL: Record<InputPattern, string> = {
  tap: '자동 입력: 앞 적을 0.45초마다 탭',
  hold: '자동 입력: 꾹 누르기 1.4초',
  link: '자동 입력: 두 곳을 이어 탭',
  tri: '자동 입력: 세 곳을 이어 탭',
  path: '자동 입력: 네 곳을 차례로 탭',
  beat: '자동 입력: 0.6초 박자로 탭',
  mash: '자동 입력: 같은 곳 연타 다섯',
};

const ratios = Object.values(RESULTS).map((r) => r[0]).sort((a, b) => a - b);
const median = ratios[Math.floor(ratios.length / 2)] ?? 0;
const above = ratios.filter((r) => r >= 1).length;

const table: string[][] = [['갈래', 'A 일 때: 몸 (언제·어디서 작용하나)', 'B 일 때: 성질 (그것이 무엇이 되나)', '대표 무기']];
for (const c of CATS) table.push([L(c), DELIVERY[c], BECOME[c], ARMS[SAMPLE[c]].name]);

const g = SAMPLE.gun;
const s = SAMPLE.summon;
const t = SAMPLE.trap;
const tu = SAMPLE.turret;
const h = SAMPLE.hand;
const sw = SAMPLE.swarm;
const r = SAMPLE.ray;

const deep: Scene[] = [
  { title: '함정 + (총 + 소환수)', tag: '유저 예', weapons: [t, g, s], fuse: [[g, s], [t, g]], fuse3: true, desc: '덫이 밟히면 그 자리에 총구가 서서 난사하고(덫 포탑), 그 총탄이 맞는 곳마다 짐승이 된다(짐승탄). 함정 → 총 → 소환수.', code: 'trap>(gun>summon)' },
  { title: '총 + (함정 + 소환수)', tag: '깊이 2', weapons: [g, t, s], fuse: [[t, s], [g, t]], fuse3: true, desc: '총탄이 맞은 자리에 덫으로 박히고(지뢰 살포총), 그 덫이 밟히면 짐승이 뛰쳐나온다(매복).', code: 'gun>(trap>summon)' },
  { title: '소환수 + (함정 + 총)', tag: '깊이 2', weapons: [s, t, g], fuse: [[t, g], [s, t]], fuse3: true, desc: '짐승이 무는 자리마다 덫을 남기고, 그 덫이 밟히면 총구가 선다.', code: 'summon>(trap>gun)' },
  { title: '손 + (총 + 포격)', tag: '손이 몸', weapons: [h, g, tu], fuse: [[g, tu], [h, g]], fuse3: true, input: 'link', desc: '두 탭을 이은 선을 따라 총구가 서고, 그 총탄이 날아가며 포물선 포탄으로 바뀐다.', code: 'hand>(gun>turret)' },
  { title: '떼 + (광선 + 소환수)', tag: '깊이 2', weapons: [sw, r, s], fuse: [[r, s], [sw, r]], fuse3: true, desc: '구름이 덮은 적마다 줄기로 이어지고, 그 줄기가 지지는 동안 짐승이 달라붙는다.', code: 'swarm>(ray>summon)' },
];

// v2 (두 무기가 같이 발동) 와 v3 (융합) 를 같은 무기로 나란히
const cmp: Scene[] = [
  { title: '총 + 함정 · v2', tag: '보관본', weapons: [g, t], fuse: [[g, t]], desc: 'v2: 총은 그대로 쏘고, 빗나간 탄이 지뢰로 남는다. 총 + 지뢰 둘이 다 보인다.', code: 'v2 gun>trap' },
  { title: '총 + 함정 · v3', tag: '융합', weapons: [g, t], fuse: [[g, t]], fuse3: true, desc: 'v3: 총탄이 맞는 순간 그 자리에 덫으로 박힌다. 따로 쏘는 덫은 없고, 총탄의 피해는 반만 남는다.', code: 'v3 gun>trap' },
  { title: '함정 + 총 · v2', tag: '보관본', weapons: [t, g], fuse: [[t, g]], desc: 'v2: 함정이 터질 때 전방향 총탄 열두 발. 총은 제자리에서도 쏜다.', code: 'v2 trap>gun' },
  { title: '함정 + 총 · v3', tag: '융합', weapons: [t, g], fuse: [[t, g]], fuse3: true, desc: 'v3: 덫이 밟히면 그 자리에 총구가 서서 근처를 난사한다(덫 포탑). 총 자리는 적이 방어선 가까이 올 때만 지킨다.', code: 'v3 trap>gun' },
];

const sections: Section[] = [
  {
    id: 'rule',
    title: '공통 규칙',
    lead: 'A 가 작용하는 순간마다, 그 자리에서 그것이 B 가 된다. 짝마다 따로 짠 동작은 없다: 아래 표의 몸 열다섯 × 성질 열다섯이 210가지와 겹친 합성 전부를 만든다.',
    table,
    list: [
      '새 무기 하나: B 를 따로 쏘지 않는다. 화면엔 A 가 나르던 것이 그 자리에서 B 로 바뀌는 모습만 (총탄이 덫으로 박히고, 덫이 총구가 되고, 포탄이 짐승이 된다)',
      `A 의 한 방은 ×${V3.keepA} 만 남는다 (그것이 맞히며 바뀌므로). 넓게·드물게 치는 몸(음파·함정 ×0.9, 포격·주문 ×0.85)은 더 남는다: 음파의 밀침, 함정의 터짐이 그 무기다움`,
      `B 가 된 그것의 세기 = B 한 번 × A 한 방의 세기 × ${V3.mul}. 드물게 작용하는 몸(포격·음파·함정)은 크게, 자주 작용하는 몸(광선·떼·정령·소환수)은 작게. 빈도는 A 의 공격 속도를 따른다`,
      `겹친 합성: B 가 된 그것도 B 의 것이라, B 에 C 를 합쳤으면 그것이 작용할 때 C 가 된다 (A → B → C, 깊이 ${V3.maxDepth} 까지)`,
      '방향이 있다: 총 + 함정 (총탄이 덫이 됨) ≠ 함정 + 총 (덫이 총구가 됨)',
      '총탄은 날아가는 동안에도 B 를 닮는다: 포격이면 포물선, 공중이면 솟았다 내리꽂힘, 회전체면 날, 돌격이면 꿰뚫음',
      '손 = 입력: 손이 몸이면 내가 고른 자리 (탭 · 두 탭 잇기 · 꾹 누르기). 손이 성질이면 그 자리에서 기다리다 내가 탭한 곳으로 몰려간다. 손의 탭 공격은 합쳐도 그대로',
      '안에 든 무기 자리는 비지 않는다: 적이 방어선 150 안에 오면 그 자리에서 합친 무기로 느리게 지킨다',
      `측정 (대표 무기 3레벨, 적 14마리 유지, 18초 두 판): 같은 두 무기를 따로 가진 판 대비 처치 가운데값 ×${median.toFixed(2)}, ${above}/210 이 따로보다 많이 잡는다. 카드마다 그 값을 적었다`,
      '게임 안에서는 규칙 문장을 보여 주지 않는다 (직접 찾아가는 맛). 처음 해낸 짝은 이름만 뜬다',
    ],
    scenes: [],
  },
  { id: 'cmp', title: 'v2 와 v3', lead: '같은 두 무기를 v2(합치면 둘이 같이 발동) 와 v3(융합) 로. v3 는 B 가 따로 나오지 않고 A 가 나른 것이 B 가 된다.', scenes: cmp },
  { id: 'deep', title: '겹친 합성', lead: '같은 규칙이 한 번 더: B 가 된 그것이 작용하는 순간 C 가 된다. 유저가 처음 든 예 "함정 + (총 + 소환수)" 가 맨 앞.', scenes: deep },
  {
    id: 'book',
    title: '도감',
    lead: '게임 안에서는 처음 해낸 짝만 이름이 뜬다. 이 페이지의 카드가 도는 만큼 칸이 채워진다. 줄 = 몸(A), 칸 = 성질(B).',
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
      const names = new Map(rules.map((x) => [x.key, x.name] as const));
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
];

for (const a of CATS) {
  sections.push({
    id: `a-${a}`,
    title: `${L(a)} +`,
    lead: `${L(a)}의 몸: ${DELIVERY[a]}, 그것이 …`,
    compact: true,
    scenes: rules
      .filter((x) => x.from === a)
      .map((x) => {
        const [A, B] = samplesV2(x.from, x.to);
        const input = inputFor(x.from, x.to);
        const res = RESULTS[x.key];
        const help = HELPER[x.from];
        const extra: string[] = [`규칙: …${BECOME[x.to]}`];
        if (input) extra.push(INPUT_LABEL[input]);
        if (help) extra.push(`도움: ${ARMS[help].name} (주문은 피해가 적어서)`);
        if (res) extra.push(`따로 가진 판 대비 처치 ×${res[0].toFixed(2)}`);
        return {
          title: x.title,
          tag: x.name,
          weapons: help ? [A, B, help] : [A, B],
          fuse: [[A, B]] as [string, string][],
          fuse3: true,
          input: input ?? undefined,
          desc: `새 성질: ${x.trait}.`,
          extra,
          code: x.key,
        };
      }),
  });
}

const page: Page = {
  name: '합성 210 v3',
  title: '합성 210 v3: 융합',
  lead: '합치면 두 무기가 같이 도는 게 아니라 한 무기가 된다. A 가 작용하는 순간마다 그 자리에서 그것이 B 가 된다: 총탄이 덫으로 박히고, 덫이 총구가 되고, 포탄이 짐승으로 깨어난다. 카드는 모두 실제 게임 코드로 돈다.',
  notes: [
    '어색한 카드는 맨 아래 이름(예: trap>gun)으로 알려 주면 그 짝만 고친다. 카드를 누르면 처음부터. 맨 위 숫자 "합성 N" 은 그것이 B 가 된 횟수.',
    'v2(합치면 새 무기, 둘이 같이 발동) 는 "합성 210 v2" 페이지에, v1 은 "합성 210" 페이지에 그대로 보관.',
  ],
  sections,
};

mount(page);
