/**
 * 기본 수치. 기획서 v0.1 "인게임 코어 루프" 표의 프로토 v2 값을 옮겼다.
 * ⚠ 표시는 기획서에 값이 없어서 임시로 넣은 것 → 수치·밸런스 탭 값으로 교체할 것.
 *
 * 좌표계: 논리 해상도 360 × 640 (세로 9:16). 렌더러가 화면에 맞춰 확대한다.
 */

/** sim 고정 스텝 (초). 결정론을 위해 sim 은 항상 이 값으로만 진행한다. */
export const FIXED_DT = 1 / 60;

export const BALANCE = {
  field: {
    width: 360,
    height: 640,
    /** 적이 나타나는 y (화면 위 바깥) */
    spawnY: -20,
    /** 방어선 y. 적 중심이 이 선을 넘으면 LIFE 감소 */
    defenseLineY: 560,
  },

  /**
   * 모으는 탭 (플레이 피드백으로 프로토 v2 의 "충전 3칸"을 대체).
   * 게이지 하나가 계속 차오르고, 탭하면 게이지를 전부 써서 터진다. 많이 모을수록 크게 터진다.
   * 축을 나눈다 (플레이 피드백: 게이지와 피해 증강이 둘 다 "피해"라 겹친다):
   *   게이지 → 크기와 연쇄 단계.  반경 = R × (radiusAt0 + (radiusAt1 - radiusAt0) × 게이지)
   *                              연쇄 단계 = chainDepthAt 중 넘긴 개수 (100% 미만이면 연쇄 없음)
   *   화력   → 피해.            피해 = D × damage (게이지와 무관, D 는 피해 증강·배율로 큼)
   */
  tap: {
    /** ⚠ 탭 폭발 기준 반경 R */
    radius: 60,
    /** ⚠ 탭 폭발 기준 피해 D */
    damage: 14,
    /**
     * ⚠ 탭 폭발은 가장자리로 갈수록 약하다: 중심 100% → 가장자리 이 비율 (거리에 비례).
     * 원 안의 적이 다 한 방에 죽지 않게 하고, 무리 한가운데를 노릴 이유를 만든다.
     */
    edgeDamageMul: 0.5,
    gauge: {
      /** ⚠ 0 → 100% 까지 걸리는 시간 (초) */
      fillSec: 3,
      /** ⚠ 이보다 적으면 헛탭 */
      minFire: 0.15,
      /**
       * ⚠ 게이지 0%·100% 일 때 반경 배율 (100% 를 넘으면 같은 직선으로 계속 커짐).
       * 꽉 채워도 반경 60 (플레이 피드백: 초반부터 너무 컸다, 이전 84). 더 크게는 "폭발 반경" 증강으로.
       */
      radiusAt0: 0.4,
      radiusAt1: 1,
      /** ⚠ 탭 피해 배율 (게이지와 무관) */
      damage: 1.8,
      /**
       * ⚠ 게이지가 이만큼 넘으면 연쇄 단계 +1. 100% 1단계, 130%(과충전) 2단계, 200%·250%(초신성) 3·4단계.
       * 연쇄 단계 = 한 탭에서 폭발이 몇 번 이어지나. 1단계 = 탭으로 죽은 적만 터지고, 그 폭발로 죽은 적은 안 터짐.
       * 과충전 2단계를 140% 에 두면 폭주(150%)와 너무 가까워 욕심낼 가치가 없었다 (봇: 142% 55% 대 100% 56%).
       */
      chainDepthAt: [1, 1.3, 2, 2.5],
    },
    /** 치명타 배율 (치명타 증강 획득 전에는 확률 0) */
    critMultiplier: 2,
  },

  chain: {
    /** 연쇄 폭발 반경 46 */
    radius: 46,
    /**
     * 이월 피해 (플레이 피드백으로 기획서의 "연쇄 피해 = D × 60%"를 대체):
     * 적이 죽을 때 체력을 넘긴 피해(넘친 피해) × carry 가 연쇄 폭발 피해가 된다.
     * 폭발형·보스는 여기에 자기 폭약(deathBlast.charge × D × 연쇄 배율)을 더한다.
     * 매 단계 체력만큼 깎이므로 연쇄는 저절로 약해지다 끊긴다. 크게 쏠수록 멀리 간다.
     */
    carry: 1,
    /** 연쇄 폭발 피해가 이보다 작으면 터지지 않는다 (연쇄 끝) */
    minDamage: 1,
    /** 지뢰·번개처럼 탭이 아닌 것으로 시작한 연쇄의 단계 (탭은 게이지로 정함) */
    otherStartDepth: 1,
    /** 연쇄 배율: 한 연쇄 안에서 처치 1회마다 이후 폭발형·보스의 자기 폭약 +5% (넘친 피해에는 안 곱함) */
    multiplierPerKill: 0.05,
    /** ⚠ 처치 → 다음 폭발까지 지연. 0 이면 한 프레임에 다 터져서 "번지는" 느낌이 안 난다 */
    delaySec: 0.07,
    /**
     * ⚠ 연쇄 환급: 한 연쇄(탭 폭발 직접 처치 포함)에서 이 수만큼 처치할 때마다 게이지 +refundGauge.
     * 크게 모아 많이 잡은 탭이 다음 탭을 벌어온다.
     */
    refundEveryKills: 8,
    refundGauge: 0.25,
  },

  /**
   * 피해 배율 (곱연산). 판 안에서 쌓여 모든 피해에 곱해진다. HUD 에 ×1.32 처럼 보인다.
   * 덧셈 강화(고폭 화약 +10%)와 달리 곱으로 쌓여서 후반 체력 증가를 따라잡는 축.
   */
  mult: {
    /** ⚠ 중간 보스를 잡을 때마다 × */
    bossKill: 1.1,
    /** ⚠ 판 동안 쌓이는 배율(보스·연쇄 공명) 상한 */
    runMax: 4,
  },

  life: {
    start: 5,
    /** 일반 적 -1, 보스 -3 은 적 정의(leak)에 있음 */
  },

  wave: {
    /** 18초마다 웨이브 +1 */
    durationSec: 18,
    /**
     * ⚠ HP(w) = 10 × 1.15^(w-1). 기획서는 8 × 1.16^(w-1).
     * 시작값 10: 8 이면 꽉 채운 탭이 원 안의 적을 오래 한 방에 잡아서 성장하는 맛이 없었다 (한때 13,
     * 연쇄를 1단계로 묶은 뒤 10 으로 내림).
     * 증가율: 한때 1.22 (난이도 상승률을 높이자) → 레벨업·고등급 증강을 줄여 플레이어가 약해진 뒤 1.15.
     * 챕터별 배율은 chapters.ts 의 hpMul.
     */
    hpBase: 10,
    hpGrowth: 1.15,
    /**
     * ⚠ 무리 스폰: 적이 한 마리씩이 아니라 무리로 내려온다 (프로토 v2 는 한 마리씩, 간격 max(0.28, 1.1 - 0.07w)초).
     * 무리 간격(w) = max(min, base - perWave × w) 초, 무리 크기(w) = min(max, base + perWave × w) ± 1
     */
    packIntervalBase: 3,
    packIntervalPerWave: 0.1,
    packIntervalMin: 1.3,
    packSizeBase: 6,
    packSizePerWave: 0.6,
    packSizeMax: 18,
    /**
     * 무리 중심에서 구성원까지 최대 거리 (packSpreadRefSize 마리 기준). 더 큰 무리는 √(크기/기준) 배로 넓어져서
     * 구성원끼리 겹치지 않는다. 구성원 간격은 연쇄가 닿는 거리(46 + 적 반지름) 안쪽.
     */
    packSpread: 44,
    packSpreadRefSize: 5,
  },

  enemy: {
    /**
     * ⚠ 보스를 뺀 모든 적의 하강 속도 배율. enemies.ts 의 speed 는 프로토 v2 값 그대로 두고 여기서 줄인다.
     * 플레이 피드백: 적을 많이, 느리게 내려야 모였을 때 한 번에 터뜨리는 맛이 산다.
     */
    speedMul: 0.6,
  },

  xp: {
    /**
     * ⚠ 다음 레벨까지 필요 경험치 = base + perLevel × (레벨 - 1).
     * 플레이 피드백: 레벨업이 너무 잦다 (16.6초마다, 판당 17레벨). 판당 10~11레벨(약 30초마다)을 목표로 올림.
     */
    base: 8,
    perLevel: 24,
  },

  reward: {
    /** 판 종료 부품 = 웨이브 × 4 + 처치 / 6 */
    partsPerWave: 4,
    killsPerPart: 6,
  },

  augment: {
    offerCount: 3,
    /** 노말 : 레어 : 에픽 = 60 : 30 : 10. 프리즘은 보스 처치 보상에서만 */
    rarityWeights: { normal: 75, rare: 21, epic: 4 },
    /** ⚠ 이 레벨 전에는 에픽이 선택지에 안 나온다 (보스 보상·진화는 예외) */
    epicFromLevel: 5,
    /** 진화 조건을 갖추면 선택지에 75% 확률로 등장 */
    evolutionChance: 0.75,
    /** 프리즘은 판당 최대 1개 */
    maxPrismPerRun: 1,
    /** ⚠ 레벨업 선택창은 연쇄가 끝난 뒤 연다. 단, 이 시간 이상 기다리면 그냥 연다 */
    offerMaxWaitSec: 2,
  },

  prism: {
    supernova: {
      /** ⚠ 초신성(과충전): 게이지 상한 */
      gaugeMax: 2.5,
      /** ⚠ 100% 를 넘긴 뒤 차는 속도 배율 */
      overfillRate: 0.5,
    },
    infiniteChain: {
      /** ⚠ 연쇄 중 무료 탭은 게이지를 쓰지 않고 최소 이 크기로 터진다 */
      freeTapPower: 0.5,
    },
  },

  /** 실험 규칙 수치 (sim/types.ts RULE_IDS). 전부 ⚠ 임시 */
  /** 도파민 모드 (data/chaos.ts). 피해는 전부 D(지금 탭 피해 기준값) 배율이라 증강을 따라 커진다 */
  chaos: {
    /**
     * ⚠ 난입·설치물이 워낙 세서 적 체력에 배율 = enemyHpMul + enemyHpPerWave × (웨이브-1).
     * 처음부터 ×4~5 로 두면 설치물이 깔리기 전 초반에 봇이 25% 만 깼다 (판마다 들쭉날쭉).
     * 초반엔 한 방에 쓸리고, 설치물이 쌓이는 후반에 단단해지게.
     */
    enemyHpMul: 1.5,
    enemyHpPerWave: 0.28,
    /** ⚠ 무리가 이 배 간격으로 내려온다 (작을수록 더 많이) */
    packIntervalMul: 0.6,
    /** 첫 난입까지 (초). 8초·20초 간격은 첫 1분에 난입이 두 번뿐이라 심심했다. 난입 간격 = max(min, base - perWave × (웨이브-1)) / (1 + 네잎클로버 0.3 × 중첩) */
    firstEventSec: 4,
    intervalBase: 14,
    intervalPerWave: 0.7,
    intervalMin: 5,
    /** 이 웨이브부터 가끔 두 개가 한꺼번에 */
    doubleFromWave: 9,
    doubleChance: 0.35,
    /** 동시에 있는 난입 물체 상한 (게이트 곱하기로 폭주하지 않게) */
    maxActors: 140,
    /** 피버: 처치마다 열기 +1, 열기는 heatHalfSec 마다 반으로. threshold 넘으면 feverSec 동안 피버 */
    heatHalfSec: 1.8,
    feverThreshold: 40,
    feverSec: 8,
    feverCooldownSec: 20,
    /** 피버 중 탭 피해·반경 배율, 게이지 차는 속도 배율 */
    feverDamage: 2,
    feverRadius: 1.3,
    feverGauge: 3,
    /** 황금 쿠키: 탭 판정 반경, 떠 있는 시간, 버프 시간, 프렌지 피해 배율 */
    cookieRadius: 36,
    cookieSec: 7,
    frenzySec: 10,
    frenzyDamage: 3,
    clickFrenzySec: 8,
    /** 잭팟: 777(화면 전체 핵) 확률, 같은 그림 셋(그 난입 두 번) 확률 */
    jackpot777: 0.12,
    jackpotTriple: 0.35,
  },
  experiment: {
    overcharge: {
      /** 게이지 상한. 100% 에서 꾹 누르고 있으면 여기까지 차고, 떼면 그 크기로 쏜다 */
      max: 1.5,
      /** 100% 를 넘으면 차는 속도가 1 → 1 + accel 배로 점점 빨라진다 (마지막 구간일수록 순식간) */
      accel: 2,
      /** 상한에 닿으면 폭주: 게이지 0, 이 시간 동안 쏠 수 없음 */
      overheatSec: 1,
    },
    combo: {
      /** 마지막 처치 뒤 이 시간 안에 또 잡으면 콤보가 이어진다 (1초는 너무 안 끊겨서 0.6) */
      windowSec: 0.6,
      /** 콤보 처치 1마다 탭 피해·폭발형 자기 폭약 + (넘친 피해에는 안 곱함) */
      perKill: 0.03,
      maxMult: 3,
    },
    paint: {
      /** 불씨 붙은 적이 죽을 때 터지는 모양 (폭발형과 같음) */
      blast: { radiusMul: 1.8, charge: 1.2 },
      /**
       * 불씨 붓 반경: 손끝이 움직이며 지나간 길만 칠한다. 폭발 원 전체로 칠했더니 끌지 않고 누르고만
       * 있어도 원 안이 다 불씨가 돼서 끌기가 의미 없었다 (봇: 안 끔 55% 대 끔 57%). 누른 자리만 칠해도
       * 공짜 강화가 돼서 (안 끔 50% 대 끔 44%) 움직일 때만 칠한다.
       */
      brush: 20,
    },
    pairs: {
      /** 동시에 살아 있는 짝 수 상한 (색 수와 같음) */
      maxActive: 3,
      /**
       * 짝은 이만큼 이상 떨어진 폭발형끼리만 (가장 먼 쪽과). 바로 다음 무리끼리 맺었더니
       * 평균 104px, 150px 넘는 짝 폭발이 20% 뿐이라 "멀리서 같이 터짐" 느낌이 약했다.
       */
      minDistance: 160,
    },
    pile: {
      /** 칸 너비·블록 높이 (360 / 30 = 12칸). 24×22·15칸은 블록이 흩어져 더미가 3칸 넘게 안 자랐다 */
      colWidth: 30,
      blockH: 26,
      /** 한 칸에 이만큼 쌓이면 끝 (방어선 위 26 × 9 = 234) */
      maxRows: 9,
      /** 블록이 무너질 때 옆 블록까지 닿는 반경 (가로 30·세로 26·대각선까지) */
      blastRadius: 30,
      /** 블록 폭발이 블록 아닌 적에게 주는 자기 폭약 (D 배율) */
      blastCharge: 0.6,
      /** 연쇄 단계 1마다 블록이 몇 칸까지 줄줄이 무너지나 (100% 3칸, 130% 6칸) */
      stepsPerDepth: 3,
      /** 아래 블록이 사라지면 위 블록이 떨어지는 속도 (px/s) */
      fallSpeed: 420,
      /**
       * ⚠ 이 규칙에선 넘어와도 바로 지지 않으므로 적 체력에 이 배율 (더미가 실제로 쌓이게).
       * 1 이면 봇 클리어율 95% · 더미 최고 3칸, 3 이면 10% (챕터 2). 2 에서 약 40% · 더미 6칸.
       */
      enemyHpMul: 2,
    },
    // ─── 11-07 실험 묶음 (가볍게 해보고 고르기용. 수치는 대충 잡음) ───
    freeze: {
      /** 100% 미만으로 쏘면 피해 없이 이만큼 얼린다 (초). 반경은 같은 게이지 탭의 이 배 */
      sec: 3,
      radiusMul: 1.2,
      /** 언 적이 받는 피해 배율, 죽을 때 깨지며 터지는 모양 */
      damageTakenMul: 2.5,
      shatter: { radiusMul: 1.1, charge: 0.6 },
    },
    burn: {
      /** 탭에 맞고 산 적에 불이 붙는다: 지속 (초), 초당 피해 (D 배율), 옆으로 번지는 간격 (초)·거리 */
      sec: 3,
      dps: 0.35,
      spreadEvery: 0.5,
      spreadGap: 8,
    },
    scorch: {
      /** 탭 자리에 남는 불바다: 반경 = 탭 반경 × radiusMul, 시간 = base + perPower × 게이지, 초당 피해 (D 배율) */
      radiusMul: 0.8,
      base: 1,
      perPower: 3,
      dps: 0.4,
    },
    knockback: {
      /** 탭이 미는 세기 (px/s, 게이지 100% 기준). 연쇄 폭발은 chainMul 배. 초당 감속 */
      tap: 300,
      chainMul: 0.4,
      damping: 4,
    },
    magnet: {
      /** 폭발형이 이 거리 안의 적을 초당 이만큼 끌어당긴다 */
      range: 90,
      pull: 30,
    },
    beat: {
      /** 박자 간격 (초, 100bpm), 박자에 맞았다고 보는 오차 (초) */
      period: 0.6,
      window: 0.1,
      /** 박자에 맞으면 피해·반경 배율, 연쇄 단계 +1. 엇박이면 피해 배율 */
      onDamage: 2,
      onRadius: 1.15,
      offDamage: 0.8,
    },
    colors: {
      /** 색 수, 같은 색·다른 색 피해 배율 (탭과 그 연쇄 전부) */
      count: 3,
      same: 1.8,
      other: 0.55,
    },
    core: {
      /** 지킬 중심 (화면 가운데보다 조금 위), 반경. 적은 화면 가장자리 바로 바깥(spawnMargin)에서 출발 */
      x: 180,
      y: 300,
      radius: 26,
      spawnMargin: 40,
      /** 출발 방향의 아래쪽 성분 상한 (sin). 0.45 = 수평에서 아래로 약 27° 까지만 */
      maxBelow: 0.45,
      /** 위에서 내려올 때보다 가는 길이 짧아서 (평균 약 250px 대 580px) 적 속도를 줄인다 */
      speedMul: 0.5,
    },
    launcher: {
      /** 발사대 위치 (화면 아래 가운데)와 탄속 (px/s) */
      x: 180,
      y: 600,
      speed: 650,
    },
    mines: {
      /** 탭 = 지뢰 심기. 반경·피해는 같은 게이지 탭의 배율, 적이 이 거리 안에 오면 터짐, 최대 개수, 수명 */
      radiusMul: 1.1,
      damageMul: 1.3,
      trigger: 18,
      max: 6,
      ttl: 12,
    },
    seeds: {
      /** 100% 미만 탭 = 씨앗 심기 (게이지 cost 소모). 폭발에 닿으면 같은 단계로 터져서 연쇄를 잇는다 */
      cost: 0.3,
      max: 6,
      ttl: 10,
      radius: 46,
      charge: 1,
    },
    row: {
      /** 탭이 화면 가로 전체 띠로 터진다. 띠 반높이 = base + perPower × 게이지, 피해 배율 */
      base: 6,
      perPower: 16,
      damageMul: 0.8,
    },
    bouncer: {
      /** 폭발형이 터지면 위로 불덩이가 튀어나가 벽에 튕기다 적에 닿으면 터진다 */
      speed: 320,
      ttl: 2.5,
      radius: 40,
      charge: 0.8,
      max: 12,
    },
    ripen: {
      /** 폭발형은 화면에 들어온 뒤 시간이 갈수록 크게 터진다: 반경 배율 from → to (fullSec 동안) */
      fullSec: 10,
      from: 0.5,
      to: 2,
    },
    sweet: {
      /** 위아래로 오가는 명당 띠 (높이, 범위, 왕복 주기). 띠 안에서 쏜 탭은 피해 배율·연쇄 단계 +1 */
      height: 56,
      top: 120,
      bottom: 500,
      period: 6,
      damageMul: 2,
    },
    stopTime: {
      /** 누르고 있지 않으면 시간이 이 배로 흐른다 (거의 멈춤) */
      idleScale: 0.04,
    },
    inflate: {
      /** 맞고 산 적은 부푼다: 반경 배율 (최대 횟수), 죽을 때 부푼 횟수 × 이만큼 터짐 */
      grow: 1.18,
      max: 6,
      radiusPer: 0.35,
      chargePer: 0.2,
    },
    fog: {
      /** 방어선 위 이만큼 + 폭발 자리만 보인다 (폭발 자리는 holdSec 동안) */
      clear: 150,
      holdSec: 1.5,
    },
    echo: {
      /** 탭 폭발이 이 시간 뒤 같은 자리에서 한 번 더 (피해 배율) */
      delay: 0.9,
      damageMul: 0.7,
    },
    wind: {
      /** 바람: 좌우로 미는 속도 (px/s)와 방향이 바뀌는 주기 (초) */
      speed: 45,
      period: 8,
    },
    golden: {
      /** 적이 황금일 확률. 연쇄로 잡으면 즉시 레벨 업 + 게이지 가득, 탭으로 직접 잡으면 그냥 적 */
      chance: 0.03,
    },
    brink: {
      /** 방어선 위 이 거리 안에서 잡으면 벼랑 끝 처치 */
      zone: 120,
      /**
       * 벼랑 끝 처치 1마다 게이지 + (100% 까지만).
       * 봇 시험에서 6%·15%·25% 모두 "일부러 끌어내리는 욕심"이 손해였다 → 탈락 후보, 체감 확인용으로만 남김
       */
      refundPerKill: 0.25,
    },
  },

  /** 성능 상한. 넘치면 새로 만들지 않는다 (기획서: 후반 동시 폭발 수백 개) */
  limits: {
    /** ⚠ 화면 안 적 상한. 무리가 들어갈 자리가 없으면 다음 무리는 자리가 날 때까지 미룬다 (버리지 않음) */
    maxEnemies: 240,
    maxExplosions: 900,
    maxZones: 64,
    maxMines: 24,
  },

  fx: {
    /** ⚠ 30연쇄 이상이면 0.3초 슬로모션 + 화면 가장자리 발광 (기획서 20. 무리 스폰 후 20연쇄가 판당 20번 넘게 나와서 올림) */
    slowmoChain: 30,
    slowmoSec: 0.3,
    slowmoScale: 0.3,
  },
} as const;

export function enemyHp(wave: number): number {
  const w = BALANCE.wave;
  return w.hpBase * Math.pow(w.hpGrowth, wave - 1);
}

export function packInterval(wave: number): number {
  const w = BALANCE.wave;
  return Math.max(w.packIntervalMin, w.packIntervalBase - w.packIntervalPerWave * wave);
}

/** 무리 크기의 기준값. 실제 크기는 여기에 ±1 (World 가 spawnRng 로 정함) */
export function packSize(wave: number): number {
  const w = BALANCE.wave;
  return Math.min(w.packSizeMax, Math.round(w.packSizeBase + w.packSizePerWave * wave));
}

export function xpToNext(level: number): number {
  return BALANCE.xp.base + BALANCE.xp.perLevel * (level - 1);
}

export function runReward(wave: number, kills: number): number {
  const r = BALANCE.reward;
  return wave * r.partsPerWave + Math.floor(kills / r.killsPerPart);
}
