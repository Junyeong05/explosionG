// 실어 나르기 210가지 표(마크다운) 뽑기: npx tsx tools/carry/doc.ts > docs/design/carry-links-210.md
import { ATTACK_CATEGORIES, CATEGORY_LABEL, type ArmCategory } from '../../src/data/chaos';
import { LINK_PIECES, allLinks } from '../../src/data/links';

const CATS = ATTACK_CATEGORIES as readonly Exclude<ArmCategory, 'passive'>[];
const links = allLinks();
const out: string[] = [];
out.push('# 실어 나르기 210가지 (2026-11-09)', '');
out.push('`npx tsx tools/carry/doc.ts` 로 `src/data/links.ts` 에서 뽑은 표. 손으로 고치지 말고 데이터를 고친다.');
out.push('연결 A → B = A가 나를 때(언제·어디서) × B가 실릴 때(무엇이). 이름 붙은 것은 대표 조합(조각을 그냥 이은 것보다 낫게 다시 쓴 것).');
out.push('미리보기 페이지: https://claude.ai/artifact/1xUzTwMAgk5wDjt1B2Gnrb', '');
out.push('## 조각 30개', '', '| 갈래 | 하는 일 | 나를 때 (A) | 실릴 때 (B) |', '| --- | --- | --- | --- |');
for (const c of CATS) { const P = LINK_PIECES[c]; out.push(`| ${CATEGORY_LABEL[c]} | ${P.role} | ${P.carry} | ${P.payload} |`); }
out.push('', `## 대표 조합 ${links.filter((l) => l.name).length}가지`, '', '| 연결 | 이름 | 무슨 일 | 연출 |', '| --- | --- | --- | --- |');
for (const l of links.filter((x) => x.name)) out.push(`| ${l.title} | ${l.name} | ${l.text} | ${l.fx} |`);
for (const a of CATS) {
  out.push('', `## ${CATEGORY_LABEL[a]}이 나를 때 (14)`, '', `> ${LINK_PIECES[a].carry} · ${LINK_PIECES[a].carryFx}`, '', '| 연결 | 무슨 일 | 연출 | 쓰임 |', '| --- | --- | --- | --- |');
  for (const l of links.filter((x) => x.from === a)) out.push(`| ${l.title}${l.name ? ` **${l.name}**` : ''} | ${l.text} | ${l.fx} | ${l.use} |`);
}
console.log(out.join('\n'));
