// 합성 210 v1 규칙표(마크다운) 뽑기: npx tsx tools/carry/rules.ts > docs/design/combine-210-v1.md (보관본. 머리말은 손으로 붙임)
// 규칙은 src/data/links.ts (CARRY × PAYLOAD), 열림 횟수는 tools/carry/check.ts 로 실제로 돌려 잰 값
import { ARMS, ATTACK_CATEGORIES, CATEGORY_LABEL } from '../../src/data/chaos';
import { CARRY, CARRY_NOTE, LINK, PAYLOAD, PAYLOAD_NOTE, SAMPLE, linkRules, type AttackCat } from '../../src/data/links';
import { runCombo } from './check';

const CATS = ATTACK_CATEGORIES as readonly AttackCat[];
const L = (c: AttackCat) => CATEGORY_LABEL[c];
const rules = linkRules();
const out: string[] = [];
out.push('# 합성 210: 규칙 전부 (2026-11-10)', '');
out.push('`npx tsx tools/carry/rules.ts` 로 `src/data/links.ts` 에서 뽑은 표. 손으로 고치지 말고 데이터를 고친다. 동작은 `src/sim/chaos.ts` (attach · carry · payload).');
out.push('미리보기 (210가지가 실제로 도는 카드): docs/showcase/combine.html', '');
out.push('> 기준: 유저 11-10 "15P2 라 210개. 모든 조합을 짜 두는 게 아니라 공통으로 성립하는 규칙만. 지속은 데미지에 비례, 발동 간격은 공격 속도를 따라가게. 광선은 특수하게. 규칙은 유저에게 다 공개하지 않고 직접 찾아가는 맛."', '');
out.push('## 공통 규칙', '');
out.push('- 합친 무기는 앞 갈래(나르는 쪽, A)로 친다. A 가 **나를 때** 그 자리에서 B 가 작게 **열린다**. 짝마다 따로 짠 규칙은 없고, 갈래마다 나를 때 하나·실릴 때 하나(30조각)가 210가지를 만든다.');
out.push(`- 세기 k = A 의 한 방(레벨 포함) ÷ A 갈래 가운데값, ${LINK.kMin} ~ ${LINK.kMax}. 피해 = B 피해 × ${LINK.dmg} × k, 초(지속) = 표의 초 × k, 실린 주문 지속 = 그 주문 지속 × ${LINK.spellDur} × k`);
out.push('- 간격: "몇 번에 한 번"이라 빨리 쏘는 무기일수록 자주 열린다 (공격 속도를 따라감)');
out.push(`- 안전장치: 나르는 무기 하나가 최대 ${LINK.cap}번 몰아서, 초당 ${LINK.rate}번씩 다시 찬다. 화면 물체가 상한의 80% (깊은 것은 55%) 를 넘으면 덜 연다`);
out.push(`- 겹친 합성: B 가 또 무엇을 실었으면 열린 B 도 그것을 나른다. 깊이 ${LINK.maxDepth}까지 (뿌리 0 → 1 → 2), 한 단 깊을 때마다 k × ${LINK.depthMul}`);
out.push('- 여럿을 실으면 나를 때마다 돌아가며 연다. 같은 갈래끼리는 합치지 않는다 (15 × 14 = 210). 실린 무기는 따로 쏘지 않고 자리도 없다');
out.push('- 게임 안에서는 규칙 문장을 보여 주지 않는다 (유저가 직접 찾아가는 맛). 이 문서와 미리보기는 검증용', '');
out.push('| 갈래 | 나를 때 (A, 언제·어디서) | 실릴 때 (B, 무엇이) | 대표 무기 |', '| --- | --- | --- | --- |');
for (const c of CATS) {
  out.push(`| ${L(c)} | ${CARRY[c].when}${CARRY_NOTE[c] ? `. ${CARRY_NOTE[c]}` : ''} | ${PAYLOAD[c]}${PAYLOAD_NOTE[c] ? `. ${PAYLOAD_NOTE[c]}` : ''} | ${ARMS[SAMPLE[c]].name} |`);
}
let zero = 0;
for (const a of CATS) {
  out.push('', `## ${L(a)} → (14)`, '', `> 열림: ${CARRY[a].when}${CARRY_NOTE[a] ? `. ${CARRY_NOTE[a]}` : ''}`, '');
  out.push('| 이름 | 실리는 것 | 대표 무기 | 18초에 열림 |', '| --- | --- | --- | --- |');
  for (const r of rules.filter((x) => x.from === a)) {
    const res = runCombo([r.carrier, r.payload], [[r.carrier, r.payload]], { taps: r.from === 'hand' || r.to === 'hand' });
    if (res.opens === 0) zero++;
    out.push(`| \`${r.key}\` ${r.title}${r.name ? ` **${r.name}**` : ''} | ${r.what}${PAYLOAD_NOTE[r.to] ? ` (${PAYLOAD_NOTE[r.to]})` : ''} | ${ARMS[r.carrier].name} + ${ARMS[r.payload].name} | ${res.opens} |`);
  }
}
out.push('', `열림 수: 미리보기 카드와 같은 조건(대표 무기 3레벨, 적 14마리 유지, 18초, 씨앗 12). 안 열린 짝 ${zero}개.`);
console.log(out.join('\n'));
