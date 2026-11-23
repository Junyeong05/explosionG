// 균열 크로스오버 연출 미리보기의 무기 표: 실제 게임 이름·갈래 + 짝마다 합친 이름·반응 이름 (실제 fuseName·reactName)
// npx tsx tools/crossfx/gen-data.ts → tools/crossfx/data.js
import { writeFileSync } from 'node:fs';
import { ARMS, CATEGORY_LABEL } from '../../src/data/chaos';
import { fuseName, reactName } from '../../src/data/combineV4';

/** 세계마다 견본 무기 셋 (서로 다른 갈래). 세계는 무기마다 하나 (docs/design/concept-art/worlds.json 과 같음) */
export const SAMPLE: Record<string, string[]> = {
  ops: ['arm_rifle', 'arm_laser', 'arm_dog'],
  steel: ['arm_cannon', 'arm_saw', 'arm_tr_mines'],
  sumi: ['arm_su_fox', 'arm_sl_ghost', 'arm_s_janggu'],
  rift: ['arm_wizard', 'arm_icestorm', 'arm_dragon'],
  comic: ['arm_s_megaphone', 'arm_punch', 'arm_th_pan'],
  bio: ['arm_sw_mosquito', 'arm_f_swamp', 'arm_acid'],
};

const weapons: Record<string, { name: string; cat: string; catLabel: string; world: string }> = {};
for (const [world, ids] of Object.entries(SAMPLE)) {
  for (const id of ids) {
    const w = ARMS[id];
    if (!w) throw new Error('없는 무기 ' + id);
    weapons[id] = { name: w.name, cat: w.cat, catLabel: CATEGORY_LABEL[w.cat as keyof typeof CATEGORY_LABEL], world };
  }
}
const fuse: Record<string, { name: string; react: string }> = {};
for (const a of Object.keys(weapons)) {
  for (const b of Object.keys(weapons)) {
    if (a === b || weapons[a].cat === weapons[b].cat) continue;
    fuse[`${a}+${b}`] = { name: fuseName(a, b), react: reactName(b) };
  }
}
const out = `// 자동 생성: npx tsx tools/crossfx/gen-data.ts (고치지 말 것)\nwindow.CX = window.CX || {};\nCX.data = ${JSON.stringify({ sample: SAMPLE, weapons, fuse })};\n`;
writeFileSync('tools/crossfx/data.js', out);
console.log('weapons', Object.keys(weapons).length, 'pairs', Object.keys(fuse).length);
