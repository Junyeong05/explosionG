import { ARCHETYPE_LABEL, RARITY_LABEL, getAugment } from '../data/augments';
import { CHAPTERS, getChapter, newEnemiesIn } from '../data/chapters';
import { ENEMIES } from '../data/enemies';
import { UPGRADES, type UpgradeId } from '../data/upgrades';
import { canBuy, isChapterUnlocked, upgradeCost, upgradeLevel } from '../meta/progression';
import type { SaveData } from '../meta/save';
import type { Offer, RunSummary } from '../sim/types';
import { h } from './dom';

/**
 * 화면 = 데이터 + 콜백을 받아 DOM 을 돌려주는 함수. 상태는 App 이 가진다.
 * 기획서 "화면 흐름" 탭이 정해지면 여기에 화면을 추가한다 (상점, 기폭 장치, 시즌 패스 ...).
 */

const OFFER_TITLE: Record<Offer['kind'], string> = {
  level: '레벨 업',
  boss: '보스 처치 보상',
  start: '선행 증강',
};

const RESULT_TITLE = {
  victory: '방어 성공',
  defeat: '방어선 붕괴',
  quit: '작전 중단',
} as const;

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface TitleProps {
  save: SaveData;
  today: string;
  /** 고른 챕터 id */
  chapterId: string;
  onSelectChapter(id: string): void;
  onChapter(): void;
  onEndless(): void;
  onDaily(): void;
  onUpgrades(): void;
  onToggleSound(): void;
  onToggleHaptics(): void;
  onExport(): void;
}

/** 챕터 시작 버튼 아래 한 줄: 웨이브 수 + 이 챕터에서 처음 나오는 적 */
function chapterLine(id: string): string {
  const ch = getChapter(id);
  const fresh = newEnemiesIn(id).map((k) => ENEMIES[k].name);
  return `${ch.waves}웨이브 + 최종 보스 · ${CHAPTERS[0].id === id ? '적' : '새 적'} ${fresh.join('·')}`;
}

export function titleScreen(p: TitleProps): HTMLElement {
  const r = p.save.records;
  const selected = getChapter(p.chapterId);
  return h('div', { class: 'overlay clear' },
    h('div', { class: 'panel' },
      h('h1', { class: 'title', text: '연쇄 폭발' }),
      h('div', { class: 'subtitle', text: 'CHAIN  DETONATION' }),
      h('div', { class: 'records' },
        h('span', null, '부품 ', h('b', { class: 'parts', text: String(p.save.parts) })),
        h('span', null, '최고 웨이브 ', h('b', { text: String(r.bestWave) })),
        h('span', null, '최고 연쇄 ', h('b', { text: String(r.bestChain) })),
      ),
      h('div', { class: 'chapters' },
        ...CHAPTERS.map((c, i) => {
          const open = isChapterUnlocked(p.save, c.id);
          const cleared = (r.chapterClears[c.id] ?? 0) > 0;
          return h('button', {
            class: `chip${c.id === p.chapterId ? ' on' : ''}${cleared ? ' cleared' : ''}`,
            disabled: !open,
            ariaLabel: open ? `${c.name}${cleared ? ' (클리어)' : ''}` : `${c.name}: ${CHAPTERS[i - 1]?.name ?? ''} 클리어 시 열림`,
            onClick: () => p.onSelectChapter(c.id),
            text: `챕터 ${i + 1}`,
          });
        }),
      ),
      h('button', { class: 'btn primary', onClick: p.onChapter }, selected.name, h('small', { text: chapterLine(selected.id) })),
      h('button', { class: 'btn', onClick: p.onEndless }, '엔드리스', h('small', { text: '끝없이' })),
      h('button', { class: 'btn', onClick: p.onDaily }, '일일 도전', h('small', { text: `${p.today} · 영구 강화 미적용` })),
      h('button', { class: 'btn', onClick: p.onUpgrades }, '영구 강화', h('small', { class: 'parts', text: `부품 ${p.save.parts}` })),
      h('div', { class: 'toggles' },
        h('button', { class: `chip${p.save.settings.sound ? ' on' : ''}`, onClick: p.onToggleSound, text: `사운드 ${p.save.settings.sound ? 'ON' : 'OFF'}` }),
        h('button', { class: `chip${p.save.settings.haptics ? ' on' : ''}`, onClick: p.onToggleHaptics, text: `진동 ${p.save.settings.haptics ? 'ON' : 'OFF'}` }),
      ),
      h('div', { class: 'foot' },
        h('button', { class: 'link', onClick: p.onExport, text: `플레이 기록 내보내기 (${p.save.history.length}판)` }),
        h('span', { class: 'ver', text: `proto v3 · ${__BUILD_ID__}` }),
      ),
    ),
  );
}

export interface UpgradeProps {
  save: SaveData;
  onBuy(id: UpgradeId): void;
  onBack(): void;
}

export function upgradeScreen(p: UpgradeProps): HTMLElement {
  return h('div', { class: 'overlay' },
    h('div', { class: 'panel' },
      h('h2', { class: 'heading', text: '영구 강화' }),
      h('div', { class: 'center parts', text: `부품 ${p.save.parts}` }),
      ...UPGRADES.map((u) => {
        const lvl = upgradeLevel(p.save, u.id);
        const cost = upgradeCost(p.save, u.id);
        return h('div', { class: 'upgrade' },
          h('div', null,
            h('div', { class: 'name' }, u.name, h('span', { class: 'lvl', text: ` Lv ${lvl}/${u.maxLevel}` })),
            h('div', { class: 'desc', text: u.desc }),
          ),
          h('button', {
            class: 'btn buy',
            disabled: !canBuy(p.save, u.id),
            onClick: () => p.onBuy(u.id),
            text: cost === null ? 'MAX' : `▲ ${cost}`,
          }),
        );
      }),
      h('button', { class: 'btn', onClick: p.onBack, text: '돌아가기' }),
    ),
  );
}

export interface PickerProps {
  offer: Offer;
  stacks: (id: string) => number;
  rerollsLeft: number;
  onPick(index: number): void;
  onReroll(): void;
}

export function augmentPicker(p: PickerProps): HTMLElement {
  let locked = false;
  const pick = (i: number) => {
    if (locked) return;
    locked = true;
    p.onPick(i);
  };
  return h('div', { class: 'overlay' },
    h('div', { class: 'panel' },
      h('h2', { class: 'heading', text: OFFER_TITLE[p.offer.kind] }),
      h('div', { class: 'cards' },
        ...p.offer.choices.map((id, i) => {
          const def = getAugment(id);
          const n = p.stacks(id);
          const tags = def.archetypes.map((a) => ARCHETYPE_LABEL[a]).join(' · ');
          const level = def.fallback ? '' : n === 0 ? 'NEW' : `Lv ${n} → ${n + 1}`;
          return h('button', { class: 'card', dataset: { rarity: def.rarity }, onClick: () => pick(i) },
            h('div', { class: 'meta' },
              h('span', { text: `${def.evolution ? '진화 · ' : ''}${RARITY_LABEL[def.rarity]}${tags ? ` · ${tags}` : ''}` }),
              h('span', { text: level }),
            ),
            h('div', { class: 'name', text: def.name }),
            h('div', { class: 'desc', text: def.desc }),
          );
        }),
      ),
      h('button', {
        class: 'btn reroll',
        disabled: p.rerollsLeft <= 0,
        onClick: () => !locked && p.onReroll(),
      }, '리롤', h('small', { text: p.rerollsLeft > 0 ? `${p.rerollsLeft}회 남음` : '영구 강화로 획득' })),
    ),
  );
}

export interface PauseProps {
  onResume(): void;
  onQuit(): void;
}

export function pauseScreen(p: PauseProps): HTMLElement {
  return h('div', { class: 'overlay' },
    h('div', { class: 'panel' },
      h('h2', { class: 'heading', text: '일시정지' }),
      h('button', { class: 'btn primary', onClick: p.onResume, text: '계속' }),
      h('button', { class: 'btn', onClick: p.onQuit }, '포기', h('small', { text: '지금까지 보상은 받음' })),
    ),
  );
}

export interface ResultProps {
  summary: RunSummary;
  totalParts: number;
  /** 이번 판으로 새로 열린 챕터 이름 */
  unlocked?: string;
  onRetry(): void;
  onTitle(): void;
}

export function resultScreen(p: ResultProps): HTMLElement {
  const s = p.summary;
  const stat = (k: string, v: string) => [h('dt', { text: k }), h('dd', { text: v })];
  return h('div', { class: 'overlay' },
    h('div', { class: 'panel' },
      h('h2', { class: `heading result-${s.result}`, text: RESULT_TITLE[s.result] }),
      h('dl', { class: 'stats' },
        ...stat('웨이브', String(s.wave)),
        ...stat('처치', String(s.kills)),
        ...stat('최대 연쇄', String(s.maxChain)),
        ...stat('레벨', String(s.level)),
        ...(s.damageMult !== undefined ? stat('피해 배율', `×${s.damageMult.toFixed(2)}`) : []),
        ...stat('시간', fmtTime(s.durationSec)),
        ...stat('획득 부품', `+${s.partsEarned}`),
      ),
      s.picks.length > 0 &&
        h('div', { class: 'picks' }, ...s.picks.map((id) => h('span', { class: 'pick', dataset: { rarity: getAugment(id).rarity }, text: getAugment(id).name }))),
      h('div', { class: 'center parts', text: `보유 부품 ${p.totalParts}` }),
      p.unlocked ? h('div', { class: 'center unlocked', text: `${p.unlocked} 열림` }) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onClick: p.onRetry, text: '다시' }),
        h('button', { class: 'btn', onClick: p.onTitle, text: '타이틀' }),
      ),
    ),
  );
}
