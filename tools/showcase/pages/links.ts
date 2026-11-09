// 실어 나르기 210가지 설계 페이지 (11-09). 빌드: npm run showcase -- links
// 데이터는 src/data/links.ts (게임에 넣을 때 그대로 읽는다). 아직 구현 전이라 캔버스 없이 표·목록만.
import { ATTACK_CATEGORIES, CATEGORY_COLOR, CATEGORY_LABEL, type ArmCategory } from '../../../src/data/chaos';
import { LINK_PIECES, allLinks, type Link } from '../../../src/data/links';

const PAGE = { name: '실어 나르기 210' };
const CATS = ATTACK_CATEGORIES as readonly Exclude<ArmCategory, 'passive'>[];
const links = allLinks();
const byKey = new Map(links.map((l) => [l.key, l]));

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
function chip(cat: ArmCategory): HTMLElement {
  const s = el('span', 'chip', CATEGORY_LABEL[cat]);
  s.style.setProperty('--c', CATEGORY_COLOR[cat]);
  return s;
}

document.title = PAGE.name;
const main = document.querySelector('main')!;
main.append(
  el('h1', '', PAGE.name),
  el('p', 'lead', '갈래 둘을 잇는 연결. A가 나르고 B가 실린다: "A가 나를 때(언제·어디서)" × "B가 실릴 때(무엇이)". 방향이 있어서 총 → 소환수(총탄이 꽂힌 자리에서 소환수가 튀어나온다)와 소환수 → 총(소환수가 총을 업고 나가 쏜다)은 다르다. 갈래 15개 × 두 조각 = 30조각에서 15 × 14 = 210가지가 나온다.'),
  el('p', 'note', '아직 게임에 들어가기 전 설계다. 판에서는 무기가 4·8·12·16종이 될 때 연결 카드 3장 중 1장을 골라 3~4개가 켜진다. 실리는 무기는 내가 가진 그 갈래 무기가 돌아가며 실린다.'),
);

const top = el('div', 'top');
const nav = el('nav');
for (const [id, t] of [['pieces', '조각 30개'], ['signature', '대표 조합'], ['matrix', '210 한눈에'], ['all', '전체 목록']]) {
  const a = el('a', '', t);
  a.href = `#${id}`;
  nav.append(a);
}
top.append(nav);
main.append(top);

// ── 조각 ──
const h1 = el('h2', '', '조각 30개');
h1.id = 'pieces';
main.append(h1, el('p', 'lead', '갈래마다 하는 일과 두 조각. 연결 문장은 "A의 나를 때 + B의 실릴 때"로 만들어진다.'));
{
  const wrap = el('div', 'tablewrap');
  const tb = el('table');
  const head = el('tr');
  for (const t of ['갈래', '하는 일', '나를 때 (A 자리)', '실릴 때 (B 자리)']) head.append(el('th', '', t));
  tb.append(head);
  for (const c of CATS) {
    const P = LINK_PIECES[c];
    const tr = el('tr');
    const td0 = el('td');
    td0.append(chip(c));
    tr.append(td0, el('td', '', P.role), el('td', '', P.carry), el('td', '', P.payload));
    tb.append(tr);
  }
  wrap.append(tb);
  main.append(wrap);
}

// ── 대표 조합 ──
const h2 = el('h2', '', '대표 조합');
h2.id = 'signature';
main.append(h2, el('p', 'lead', '조각을 그냥 이은 것보다 낫게 다시 쓴 조합. 갈래마다 개성이 섞이는 맛이 가장 잘 드러나는 것들.'));
{
  const grid = el('div', 'linkgrid');
  for (const l of links.filter((x) => x.name)) grid.append(linkCard(l));
  main.append(grid);
}

function linkCard(l: Link): HTMLElement {
  const card = el('div', 'linkcard');
  card.style.setProperty('--a', CATEGORY_COLOR[l.from]);
  card.style.setProperty('--b', CATEGORY_COLOR[l.to]);
  const h = el('div', 'lhead');
  h.append(chip(l.from), el('span', 'arrow', '→'), chip(l.to));
  if (l.name) h.append(el('b', 'lname', l.name));
  card.append(h, el('p', 'ltext', l.text), el('p', 'lfx', `연출: ${l.fx}`), el('p', 'luse', `쓰임: ${l.use}`));
  return card;
}

// ── 210 한눈에 ──
const h3 = el('h2', '', '210 한눈에');
h3.id = 'matrix';
main.append(h3, el('p', 'lead', '줄 = 나르는 쪽(A), 칸 = 실리는 쪽(B). 칸을 누르면 아래에 그 연결이 뜬다. 채운 칸은 대표 조합.'));
{
  const wrap = el('div', 'matrixwrap');
  const tb = el('table', 'matrix');
  const head = el('tr');
  head.append(el('th', 'corner', 'A \\ B'));
  for (const b of CATS) {
    const th = el('th', 'colh');
    th.append(chip(b));
    head.append(th);
  }
  tb.append(head);
  const detail = el('div', 'detail');
  detail.append(el('p', 'lead', '칸을 누르면 여기에 연결이 뜬다.'));
  for (const a of CATS) {
    const tr = el('tr');
    const th = el('th', 'rowh');
    th.append(chip(a));
    tr.append(th);
    for (const b of CATS) {
      const td = el('td', a === b ? 'cell self' : 'cell');
      if (a !== b) {
        const l = byKey.get(`${a}>${b}`)!;
        const btn = el('button', l.name ? 'dot named' : 'dot');
        btn.style.setProperty('--b', CATEGORY_COLOR[b]);
        btn.setAttribute('aria-label', l.title + (l.name ? ` (${l.name})` : ''));
        btn.title = l.title + (l.name ? ` · ${l.name}` : '');
        btn.onclick = () => {
          for (const x of tb.querySelectorAll('.dot.on')) x.classList.remove('on');
          btn.classList.add('on');
          detail.replaceChildren(linkCard(l));
        };
        td.append(btn);
      }
      tr.append(td);
    }
    tb.append(tr);
  }
  wrap.append(tb);
  main.append(wrap, detail);
  // 처음 보이는 상태: 첫 대표 조합을 띄워 둔다
  const first = links.find((l) => l.name)!;
  detail.replaceChildren(linkCard(first));
}

// ── 전체 목록 ──
const h4 = el('h2', '', '전체 목록');
h4.id = 'all';
main.append(h4, el('p', 'lead', '나르는 쪽(A)별로 14가지씩.'));
for (const a of CATS) {
  const d = el('details', 'group');
  const sm = el('summary');
  sm.append(chip(a), ` 이 나를 때 · ${LINK_PIECES[a].carry}`);
  d.append(sm);
  const grid = el('div', 'linkgrid');
  for (const l of links.filter((x) => x.from === a)) grid.append(linkCard(l));
  d.append(grid);
  main.append(d);
}
