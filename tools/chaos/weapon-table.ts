// 도파민 모드 무기 표(마크다운) 뽑기: npx tsx tools/chaos/weapon-table.ts
import { WEAPONS, CATEGORY_LABEL, hasRange } from '../../src/data/chaos';
const cats = ['hand', 'gun', 'turret', 'summon', 'magic', 'passive'] as const;
const lines: string[] = [];
for (const c of cats) {
  const list = WEAPONS.filter((w) => w.cat === c);
  lines.push(`### ${CATEGORY_LABEL[c]} (${list.length})`, '');
  if (c === 'passive') {
    lines.push('| 이름 | 하는 일 (레벨마다) |', '| --- | --- |');
    for (const w of list) lines.push(`| ${w.emoji} ${w.name} | ${w.desc} |`);
  } else {
    const rng = hasRange(c);
    lines.push(`| 이름 | 하는 일 | 쿨다운 |${rng ? ' 사거리 |' : ''} Lv2 | Lv3 | Lv4 | Lv5 |`, `| --- | --- | --- |${rng ? ' --- |' : ''} --- | --- | --- | --- |`);
    for (const w of list) lines.push(`| ${w.emoji} ${w.name}${w.starter ? ' ★' : ''} | ${w.desc} | ${w.cd || '-'}초 |${rng ? ` ${w.p.range ?? 280} |` : ''} ${w.up.map((u) => u.label).join(' | ')} |`);
  }
  lines.push('');
}
console.log(lines.join('\n'));
