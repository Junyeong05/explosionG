import { ARMS, ATTACK_CATEGORIES, CATEGORY_COLOR, CATEGORY_LABEL } from '../../../src/data/chaos';
import { CEIL, CEIL_KEYS } from '../../../src/data/combineCeil';
import { HELPER, inputFor, samplesV2 } from '../../../src/data/combineV2';
import { CAT4, ST_LABEL, V4, rulesV4, type Kind4 } from '../../../src/data/combineV4';
import type { AttackCat } from '../../../src/data/links';
import { DEEP4 } from './combine4-deep';
import { discovered, mount, type Page, type Scene, type Section } from '../runtime';
import { CEIL_RESULTS } from './ceil-results';
import { RESULTS } from './combine4-results';
import { DEEP4_RESULTS } from './combine4-deep-results';

/**
 * 합성 v4 "상태 반응" 샘플 (src/data/combineV4.ts, src/sim/fusion.ts 의 act4 · fire4).
 * 짝마다 짠 동작 없이 갈래 15줄(남기는 상태 · 노리는 상태 · 모양)과 공통 규칙만으로 210·2+2·깊은 조합이 다 돈다.
 */
const CATS = ATTACK_CATEGORIES as readonly AttackCat[];
const L = (c: AttackCat) => CATEGORY_LABEL[c];
const rules = rulesV4();
const byKey = new Map(rules.map((r) => [r.key, r] as const));

const ratios = Object.values(RESULTS).map((r) => r[0]).sort((a, b) => a - b);
const median = ratios[Math.floor(ratios.length / 2)] ?? 0;
const above = ratios.filter((r) => r >= 1).length;
const kinds: Record<Kind4, number> = { 반응: 0, 모양: 0, 무리: 0, 보통: 0 };
const kindMed: Record<string, number[]> = {};
for (const r of rules) {
  kinds[r.kind]++;
  (kindMed[r.kind] ??= []).push(RESULTS[r.key]?.[0] ?? 0);
}
const med = (l: number[]) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)] ?? 0;

const table: string[][] = [['갈래', '남기는 상태 (A 일 때)', '노리는 상태 (B 일 때)', '모양 · 놓는가']];
for (const c of CATS) {
  const d = CAT4[c];
  table.push([L(c), d.leaves ? `${ST_LABEL[d.leaves]} · ${d.give}` : `없음 · ${d.give}`, `${ST_LABEL[d.seeks]} · ${d.need}`, `${d.shape === 'ring' ? '고리' : d.shape === 'line' ? '줄' : '점'}${d.place ? ' · 놓음' : ''}`]);
}

const vs: Scene[] = [];
for (const k of CEIL_KEYS) {
  const c = CEIL[k]!;
  const [a, b] = k.split('>') as [AttackCat, AttackCat];
  const [A, B] = samplesV2(a, b);
  const r = byKey.get(k)!;
  const cr = CEIL_RESULTS[k];
  const v4 = RESULTS[k];
  vs.push(
    { title: `${L(a)} + ${L(b)} · 손으로 짠 천장`, tag: c.name, weapons: [A, B], fuse: [[A, B]], fuse3: true, ceil: true, desc: `${c.move}.`, extra: cr ? [`따로 대비 처치 ×${cr[1].toFixed(2)}`] : [], code: `ceil ${k}` },
    { title: `${L(a)} + ${L(b)} · 공통 규칙 v4`, tag: `${r.name} · ${r.kind}`, weapons: [A, B], fuse: [[A, B]], fuse4: true, desc: r.text, extra: v4 ? [`따로 대비 처치 ×${v4[0].toFixed(2)}`] : [], code: `v4 ${k}` },
  );
}

const deep: Scene[] = DEEP4.map((d) => {
  const r = DEEP4_RESULTS[d.code];
  return { title: d.title, tag: d.tag, weapons: d.weapons, fuse: d.fuse, fuse4: true, input: d.input, desc: d.desc, extra: r ? [`네 무기를 따로 가진 판 대비 처치 ×${r[0].toFixed(2)}`] : [], code: `v4 ${d.code}` };
});

// 공통 규칙이 밋밋하거나 약한 짝 (측정 아래쪽)
const flatKeys = ['charge>spinner', 'ray>field', 'hand>gun', 'swarm>magic'];
const flat: Scene[] = flatKeys.map((k) => {
  const r = byKey.get(k)!;
  const [A, B] = samplesV2(r.from, r.to);
  const input = inputFor(r.from, r.to);
  const res = RESULTS[k];
  return { title: `${r.title} · v4`, tag: `${r.name} · ${r.kind}`, weapons: [A, B], fuse: [[A, B]], fuse4: true, input: input ?? undefined, desc: r.text, extra: res ? [`따로 대비 처치 ×${res[0].toFixed(2)}`] : [], code: `v4 ${k}` };
});

const sections: Section[] = [
  {
    id: 'rule',
    title: '공통 규칙',
    lead: '짝마다 짠 동작이 없다. 갈래마다 아래 한 줄(남기는 상태 · 노리는 상태 · 모양)만 정하고, 규칙 넷이 210짝과 2+2·깊은 조합을 다 만든다.',
    table,
    list: [
      'A 는 원래대로 다 한다. A 가 작용하는 순간(맞음·밟힘·물기·고리·착탄…) 맞은 적에 A 의 상태가 남는다: 묶임(실제로 멈춤) · 표식 · 약점(받는 피해 증가). 무리는 적이 몰려 있으면 그 상태',
      `1. 노린다: 그 순간 합쳐 둔 B 가 근처(${V4.reach})에서 제가 노리는 상태의 적을 친다. 넓게 치는 B 는 그 상태 가운데 가장 몰린 곳`,
      `2. 반응: 노리던 상태의 적에게 B 는 ×${V4.react}. 멈춘 적이면 포탄·낙하는 예고 없이 바로, 소환수는 묶인 적을 돌려세운다(끝나면 터짐)`,
      `3. 모은다: B 는 따로 쏘지 않고 제 쿨다운만큼 에너지가 차서(×${V4.gain}) A 의 순간에 나간다. 드문 A 면 모였다가 여러 발로, 놓는 B 는 A 의 고리·줄을 따라`,
      '4. 넘침: A 가 오래 쉬어 가득 차면 B 는 제 자리(방어선)에서 한 번. 힘을 버리지 않는다',
      'B 가 낸 것은 B 의 것이라, B 에 C 를 합쳤으면 같은 규칙이 한 번 더 (2+2, 깊이 3)',
      `짝 분류 (표에서 나옴): 반응 ${kinds['반응']} (A 가 남기는 상태를 B 가 노림) · 모양 ${kinds['모양']} · 무리 ${kinds['무리']} · 보통 ${kinds['보통']}. 처치 가운데값 반응 ×${med(kindMed['반응'] ?? []).toFixed(2)} · 모양 ×${med(kindMed['모양'] ?? []).toFixed(2)} · 무리 ×${med(kindMed['무리'] ?? []).toFixed(2)} · 보통 ×${med(kindMed['보통'] ?? []).toFixed(2)}`,
      `측정 (대표 무기 3레벨, 18초 두 판, 같은 두 무기를 따로 가진 판 대비): 처치 가운데값 ×${median.toFixed(2)}, ${above}/210 이 따로보다 많이 잡는다. 카드마다 그 값`,
      '선 하나: A 의 자리에서 B 가 노린 적으로 짧은 선(A 색)이 그어지고, 노리던 상태면 그 상태 색 고리가 뜬다 (묶임 노랑 · 표식 빨강 · 약점 연두 · 무리 주황)',
    ],
    scenes: [],
  },
  { id: 'vs', title: '손으로 짠 것 vs 공통 규칙', lead: '어제 만든 천장 후보 여섯을, 짝마다 짠 코드 없이 공통 규칙만으로 돌린 것과 나란히. 왼쪽 = 손으로 짠 천장, 오른쪽 = v4 규칙만.', scenes: vs },
  { id: 'deep', title: '2+2 · 깊은 조합', lead: '넷을 한 무기로. 짝마다 따로 짠 것 없이 같은 규칙이 상태를 따라 이어진다. 처치는 네 무기를 따로 가진 판 대비.', scenes: deep },
  { id: 'flat', title: '밋밋한 짝', lead: '공통 규칙이 약하게 나온 짝 (측정 아래쪽). 놓는 B 가 돌격·광선의 긴 줄을 따라 흩어지면 얇아지고, 서로 주고받는 상태가 없으면 그냥 같이 도는 것에 가깝다.', scenes: flat },
  {
    id: 'book',
    title: '도감',
    lead: '이름도 표에서 나온다 (A 의 앞말 + B 의 뒷말). 카드가 도는 만큼 칸이 채워진다. 줄 = A, 칸 = B. 칸 왼쪽 색: 반응이면 노란 줄.',
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
            if (byKey.get(`${a}>${b}`)?.kind === '반응') td.style.borderLeft = '3px solid #ffe08a';
            cells.set(`${a}>${b}`, td);
          }
          tr.append(td);
        }
        tb.append(tr);
      }
      wrap.append(tb);
      host.append(wrap);
      const paint = () => {
        for (const k of discovered) {
          const td = cells.get(k);
          if (!td || td.dataset.found) continue;
          td.dataset.found = '1';
          td.textContent = byKey.get(k)?.name ?? k;
          td.style.opacity = '1';
          td.style.fontWeight = '700';
          if (byKey.get(k)?.kind !== '반응') td.style.borderLeft = `3px solid ${CATEGORY_COLOR[k.split('>')[1] as AttackCat]}`;
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
  const d = CAT4[a];
  sections.push({
    id: `a-${a}`,
    title: `${L(a)} +`,
    lead: `${L(a)}: 남기는 상태 ${d.leaves ? ST_LABEL[d.leaves] : '없음'} · 모양 ${d.shape === 'ring' ? '고리' : d.shape === 'line' ? '줄' : '점'}`,
    compact: true,
    scenes: rules
      .filter((x) => x.from === a)
      .map((x) => {
        const [A, B] = samplesV2(x.from, x.to);
        const input = inputFor(x.from, x.to);
        const res = RESULTS[x.key];
        const help = HELPER[x.from];
        const extra: string[] = [];
        if (help) extra.push(`도움: ${ARMS[help].name} (주문은 피해가 적어서)`);
        if (res) extra.push(`따로 대비 처치 ×${res[0].toFixed(2)}`);
        return {
          title: x.title,
          tag: `${x.name} · ${x.kind}`,
          weapons: help ? [A, B, help] : [A, B],
          fuse: [[A, B]] as [string, string][],
          fuse4: true,
          input: input ?? undefined,
          desc: x.text,
          extra,
          code: `v4 ${x.key}`,
        };
      }),
  });
}

const page: Page = {
  name: '합성 v4 샘플',
  title: '합성 v4: 상태 반응 샘플',
  lead: '짝마다 짠 연출 없이 공통 규칙 하나로: A 는 그대로 하면서 적에 상태(묶임·표식·약점)를 남기고, 합쳐 둔 B 는 모였다가 A 의 순간에 제가 노리는 상태의 적을 친다. 같은 규칙이 2+2 와 깊은 조합에도 그대로. 카드는 모두 실제 게임 코드로 돈다.',
  notes: [
    '맨 위 "손으로 짠 것 vs 공통 규칙" 이 핵심 비교. 좋은·어색한 카드는 맨 아래 이름(예: v4 trap>charge)으로 알려 주면 그 갈래 줄을 고친다 (짝이 아니라 갈래를 고치면 그 갈래가 든 모든 짝이 바뀐다).',
    'v3 · 천장 후보 · v2 페이지는 그대로 보관.',
  ],
  sections,
};

mount(page);
