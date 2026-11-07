# 무기 개수 × BM 회의 (2026-11-07)

유저 요청: "로봇합체처럼 유치한 건 하지 말자. 무기 개수가 엄청 많다는 걸 잘 써먹을 수 있고, BM 으로도 잘 써먹을 수 있는 아이디어 없을까? 회의 돌려봐."

진행: 리서치 1명(비슷한 게임의 수집·BM 사례, 한국 확률형 규제) → 제안 4명(코어 게임 디자이너, 플레이어 대변인, BM·라이브옵스 기획자, 마케팅·UA) 각 4안 → 심사 3명(재미, 돈, 위험·제작 부담 각 1~5점) → 종합.

> ⚠ 회의는 "적이 죽으면 저절로 터짐"을 도파민 모드에서 빼기 전에 돌았다. 아래 "던진 적이 터지면서 연쇄가 번진다" 같은 장면은 지금 규칙에선 나오지 않는다.
> 지금 코드에는 판 끝 '마지막 일제 사격'이 없다. 안 1·2 의 그 장면은 새로 만들 것이다.


## 종합

전체 방향은 세 가지입니다. 판 안에서는 "내 무기 전부가 내 손가락 하나에 반응하는" 순간을 만듭니다. 판 밖에서는 모은 무기가 진열장에 쌓입니다. 상점에서는 새 무기 묶음을 확정형으로 팝니다. 성능, 확률, 판 안 힘은 팔지 않습니다.

---

### 1. 최종 추천 3안

#### 안 1. 일제 사격: 내 무기 전부를 한 점에 (판 안)
가져온 안: designer-1 긁기, player-1 총공세, ua-1·bm-3 피날레

**한 줄.** 일제 사격 게이지가 차면 받침 줄을 긁습니다. 전장의 한 점에서 손을 떼면, 긁고 지나간 무기 전부가 그 점으로 한 번씩 쏟아집니다. 판이 끝날 때는 같은 장면이 '마지막 일제 사격'으로 저절로 나옵니다.

**판 안에서 개수를 쓰는 법**
- 무기가 5개가 되면 열립니다. 게이지는 시간과 처치로 차고, 약 60초에 한 번꼴입니다. 1회분만 모아 둘 수 있습니다.
- 긁힌 무기는 평소 공격을 한 번만 합니다. 새 배율은 없습니다. 위력은 무기 수에서만 나오고, 무기끼리는 서로 영향을 주지 않습니다(트리거 연결이 아님).
- 긁은 무기는 그 뒤 자기 쿨다운을 처음부터 다시 돕니다. 그래서 "전부 긁을까, 왼쪽 벽 총 7자루만 긁을까"가 실제 판단이 됩니다. 다 써 버리면 잠깐 화력이 빕니다.
- 갈래마다 그 점에 닿는 방식이 다릅니다. 총·포탑은 겨누고, 마법은 그 점에 떨어지고, 소환수는 그 점으로 달려갑니다. 손공격과 강화는 빠집니다.
- 무기 하나를 지날 때마다 '철컥' 소리와 진동이 한 번씩 옵니다. 무기가 20개면 손가락 밑에서 20번 옵니다. 피해 숫자는 띄우지 않습니다.

**"와" 장면.** 보스가 방어선 앞까지 왔습니다. 받침 줄을 끝에서 끝까지 긁으면 무기 18개에 차례로 불이 켜지고 진동이 18번 옵니다. 보스 위에서 손을 떼면 0.3초 슬로모가 걸립니다. 양쪽 벽의 총 11자루가 한 점으로 고개를 돌리고, 공룡이 달려들고, 운석이 떨어집니다. 그리고 한 박자 뒤에 같이 꽂힙니다. 판 끝에는 LIFE가 0이 되는 순간 같은 장면이 받침 줄 전체로 한 번 더 나옵니다.

**BM (연출만 팝니다)**
- 일제 사격 연출: 신호(나팔·신호탄·확성기) 2,200원, 장전음 팩(서부 리볼버·SF·8비트) 2,200원, 컷인 3,300원
- 받침 줄 스킨 5,500원(군함 갑판·문방구 진열장·편의점 선반). 판 내내 보이는 자리라 노출이 가장 큽니다.
- 마지막 일제 사격 마무리 폭발 4,400원(불꽃놀이·응원봉 파도 등)
- 보상형 광고: 판당 1회 '즉시 충전'(기존 판당 광고 2회 한도 안에서). 일일 도전에는 없습니다.
- 무과금: 기본 연출, 그리고 도감 레벨 보상(안 2)으로 연출 몇 개를 받습니다. 소과금: 받침 줄 스킨 하나. 고래: 연출 전부와 시즌 한정 연출(안 2 패스·안 3 묶음과 함께)
- 일제 사격의 모양을 바꾸는 '지휘관'은 팔지 않습니다. 사실상 성능 상품이기 때문입니다. 만들게 되면 플레이 보상으로만 줍니다.

**위험과 막는 법**
- 입력 겹침: 손공격 탭, 무기를 눌러 사거리 보기, 과충전 꾹 누르기와 겹칩니다(`src/sim/World.ts`의 `onPress`). 받침 줄에서 시작해 옆으로 일정 거리 넘게 끌 때만 긁기로 인정합니다. 짧게 누르면 지금처럼 사거리 보기입니다. 전장 쪽 입력은 건드리지 않습니다.
- '기다렸다 긁기'만 반복될 위험: 게이지는 1회분만 모이게 하고, 긁은 무기는 쿨다운을 처음부터 돌게 합니다. 양쪽에서 동시에 오는 웨이브를 넣어 일부만 긁는 쪽이 이득인 상황을 만듭니다.
- 프레임 저하: 꽂히는 시점을 0.05초씩 흩고, 일제 사격 중에는 효과 개수에 상한을 둡니다.
- 질림: 불 켜지는 점호는 첫 1회만 길게 하고 그 뒤로는 0.4초로 줄입니다. 마지막 일제 사격은 기록을 깬 판에서만 길게 보여 주고, 나머지는 건너뛰기를 기본으로 둡니다.
- 무기 5~8개일 때 초라함: 카메라가 무기 하나하나를 크게 비춥니다.

**최소 버전 (1~2주)**
- 1주차, 버튼형: 화면 아래 '일제 사격' 버튼을 누른 채 끌어서 전장의 한 점에서 떼면, 가진 무기 전부가 그 점 근처 적을 노려 한 번씩 쏩니다. `src/sim/chaos.ts`의 `fire(spec)`(518행)을 무기마다 한 번씩 부르고, `pickTarget`에 '이 점에서 가까운 적' 모드를 하나 더합니다. 소환수는 그 점 근처에서 나오게만 합니다.
- 2주차: 받침 줄 긁기 선택, 철컥 소리(`src/feedback/Sfx.ts`)·진동(`Haptics.ts`)·슬로모(`SlowMo.ts`), 판 끝 자동 마지막 일제 사격을 붙입니다.
- 확인할 것: 저사양 폰에서 무기 20개로 일제 사격할 때 프레임. 그리고 `tools/autoplay.ts`에 "게이지가 차면 적이 가장 몰린 곳에 쏜다"는 규칙을 넣고 엔드리스 생존 시간이 얼마나 느는지 봅니다.

---

#### 안 2. 무기고 도감: 한 판에 칸이 여러 개 차는 진열장 (판 밖)
가져온 안: bm-1, player-2, bm-3 숙련 황금, ua-1 결산

**한 줄.** 무기 121종과 융합 15종이 136칸 진열장이 됩니다. 무기마다 별이 4개 있고, 별의 합이 '무기고 레벨'입니다. 판에 나오는 무기 풀은 잠그지 않습니다.

**판 안에서 개수를 쓰는 법**
- 한 판에 10~20종을 쓰니 판이 끝날 때마다 칸이 여러 개 한꺼번에 찹니다. 무기 칸이 6개인 서바이버류와는 진척 속도가 다릅니다.
- 별 4개:
  - ① 써 봄
  - ② 한 판에 5레벨
  - ③ 숙련: 이 무기로 누적 처치 N(무기마다 N을 따로 맞춤)
  - ④ 금별: 시작 무기나 첫 레벨 업에서 이 무기를 잡고 엔드리스 5분 생존. 약한 무기는 웨이브 조건으로 맞춥니다.
- ④가 안 쓰던 무기를 한 판의 주인공으로 만듭니다(발라트로 골드 스티커 방식). 시작 3장 카드에 '금별 없음' 딱지를 붙입니다.
- 융합 15칸은 '???' 실루엣으로 두고 재료 하나만 힌트로 보여 줍니다.
- 별은 돈으로 살 수 없고, 별에는 스탯이 없습니다.
- 첫 판 풀을 30~40종으로 줄이자는 안이 회의에서 나왔지만, 그러면 첫 판부터 정체성이 깎이므로 하지 않습니다. 신규 유저가 헷갈리는 문제는 'NEW' 딱지와 한 줄 설명으로 풉니다.

**"와" 장면.** 마지막 일제 사격이 끝나면 받침 줄의 무기 14개가 하나씩 진열장 칸으로 날아가 박힙니다. 별이 '띵 띵' 떨어지고 '새 무기 5종 · 별 +11 · 무기고 Lv 37 → 48'이 뜹니다. 금별을 딴 무기는 황금으로 바뀌어 칸에 들어갑니다. 융합 '???' 칸이 처음 열릴 때는 따로 연출이 나옵니다.

**BM**
- 컬렉션 패스(5주 시즌): 무료 트랙, 유료 9,900원, 프리미엄 19,000원(10레벨 스킵 + 한정 받침 줄 스킨)
  - 경험치: 이번 시즌에 새로 딴 별 + 주간 '지정 무기 10종 중 아무거나 3종 쓰기' + 일일 도전
  - 유료 트랙 보상: 안 1 연출, 받침 줄 스킨, 칭호, 그 시즌 테마 팩 1개(안 3)
- 황금 외형: 금별을 따면 그 무기의 '숙련 황금'을 무료로 줍니다. 돈으로 사는 '갈래 황금 세트'(예: 총 29종 33,000원)는 테두리를 달리해서 숙련 황금의 가치를 지킵니다. 외형은 색과 광택을 입히는 방식으로 싸게 만듭니다.
- 무기고 레벨 보상(10레벨마다): 꾸밈, 그리고 '시작 무기 다시 뽑기 +1' 같은 작은 편의. 상점에서는 팔지 않습니다.
- 무과금: 별, 레벨, 숙련 황금을 전부 플레이로 얻습니다. 진척 속도는 과금 유저와 같습니다. 소과금: 9,900원 패스. 고래: 프리미엄 패스 + 갈래 황금 세트
- 전부 확정형이라 확률 표시 대상이 아닐 가능성이 높습니다(추측, 출시 전 법률 검토 필요).

**위험과 막는 법**
- 별을 다 따면 패스가 멈춤: 주간 지정 무기 미션을 두고, 안 3의 새 팩이 칸을 계속 늘립니다.
- 노가다 느낌: 한 판에 별이 여러 개 같이 찍히도록 조건을 짜고, 진행도를 %로 보여 줍니다.
- ④가 약한 무기에는 고문이 됨: autoplay로 무기별 '시작 무기 생존 시간'을 재서 조건을 맞춥니다.
- 지정 무기를 강요받는 느낌: 10종 중 3종만 쓰면 되게 합니다. 별 따기에는 재화가 들지 않게 합니다. 클래시 로얄이 컬렉션 레벨을 바꾼 직후 '골드 부족' 불만이 쏟아진 사례를 참고합니다.
- 저장: 지금은 localStorage에 저장합니다(`src/meta/storage.ts`). 기기를 바꾸면 도감이 날아가니, 결제를 붙이기 전에 계정과 클라우드 저장이 있어야 합니다.

**최소 버전 (1~2주)**
- 저장 데이터에 무기별 기록(써 봄, 최고 레벨, 누적 처치, 금별)을 더합니다(`src/meta/save.ts`).
- 도감 화면: 136칸 이모지 그리드, 별, 갈래별 탭, 무기고 레벨 숫자
- 결산 연출: 무기가 칸으로 날아가고 별이 떨어짐
- 시작 3장에 '금별 없음' 딱지
- 패스, 결제, 서버는 아직 붙이지 않습니다. autoplay로 ③과 ④ 조건 수치를 잡습니다.

---

#### 안 3. 테마 무기 팩 + 이번 주 손님 (상점 콘텐츠)
가져온 안: bm-2, player-4, ua-3, designer-4(같은 팩끼리 융합)

**한 줄.** 새 무기 6~8종과 같은 팩 안 융합 1종을 팩으로 묶어 확정형으로 팝니다. 매주 팩 하나를 '손님'으로 모두에게 무료로 엽니다. 기존 121종은 계속 전부 무료입니다.

**판 안에서 개수를 쓰는 법**
- 산 팩의 무기는 레벨 업 풀에 섞여서 다음 판부터 바로 보입니다. 팩은 한 판의 무기 개수가 아니라 종류를 넓힙니다.
- 팩 무기는 '옆그레이드'입니다. 세기는 기본 풀 평균에 맞춥니다. 더 세서가 아니라 새로워서 삽니다.
- 풀 스위치: 산 팩을 켜고 끌 수 있습니다(슈퍼 오토 펫 커스텀 팩 방식). 풀이 희석되는 게 싫으면 끄면 됩니다.
- 팩 융합은 같은 팩 무기끼리만 짝을 짓습니다. 지금도 재료가 잘 안 모여 FUSE_LEVEL을 2로 내린 상태라, 풀이 커질수록 다른 팩끼리의 짝은 거의 안 나옵니다.
- 같은 팩 무기가 3종 이상 깔리면 팩 전용 등장 연출만 나옵니다(예: 할머니 셋이 같이 손을 흔듦). 수치 보너스는 없습니다.
- 손님: 그 주 팩의 무기가 금테 카드로 판마다 1~2번 뜹니다. 손님 무기로 딴 별은 도감에 남습니다.

**"와" 장면.** 월요일 첫 판, 레벨 업에 금테 카드 '손님 👵 시골 할머니: 소쿠리로 폭발형 적을 퍼 담아 던짐'이 뜹니다. 던진 적이 터지면서 연쇄가 번집니다. 결산에 '손님 무기 처치 1,240 · MVP 👵'와 팩의 나머지 무기 실루엣이 뜹니다. 팩을 사면 다음 판 시작 3장에 경운기가 나옵니다.

**BM**
- 팩 4,400원(영구 소유). 시즌 묶음 14,000원(그 시즌 팩 + 팩 전용 받침 줄 스킨 + 일제 사격 신호). 출시 첫 주 할인
- 안 2의 유료 패스에 그 시즌 팩을 넣습니다.
- 무과금: 손님 주간에 써 보고, 플레이 재화(무기고 코인) 3~4주분 또는 도감 별 60개마다 팩 1개를 무료로 엽니다. 소과금: 마음에 든 팩 하나. 고래: 전 팩 + 묶음
- 일일 도전과 랭킹은 기본 풀로 고정합니다.
- 마케팅: 팩 하나가 숏폼 광고 한 편이 되고, 휴면 유저에게 보내는 '새 손님 도착' 푸시가 됩니다.
- 확률 요소는 없습니다.

**위험과 막는 법**
- 제작 부담: 격주로 6~8종은 빠듯합니다. 시즌(5주)마다 1팩을 내고, 출시 때 3~4팩을 준비해 손님 주간을 돌립니다. 무기는 기존 행동 틀(kind)을 다시 쓰고 이모지·이름·수치만 바꿉니다. 새 kind가 필요한 무기는 팩당 1개까지로 합니다.
- P2W: autoplay로 팩을 켰을 때와 껐을 때의 엔드리스 생존 시간을 비교합니다. 차이가 나면 내지 않습니다.
- 손님 주간이 끝난 뒤의 박탈감: 딴 별은 남기고, 코인으로 여는 길을 바로 보여 줍니다.
- 유치함: 유저가 거대 로봇을 유치하다고 본 것과 같은 선입니다. 소재는 엉뚱해도 동작과 연출은 진지하게 갑니다. 할머니는 귀엽게가 아니라 무심하고 세게 그립니다. 어린이 만화 톤은 피합니다.
- 매출 상한: 한국에서 확정형은 뽑기보다 유저당 매출이 얕습니다(추측). 상한은 안 2의 갈래 세트와 프리미엄 패스가 받치고, 뽑기는 쓰지 않습니다.

**최소 버전 (1~2주)**
- `src/data/chaos.ts`의 WeaponSpec에 `pack` 태그를 더합니다.
- 시험 팩 1개를 만듭니다(예: 할머니 군단 6종 + 팩 융합 1종). 기존 kind(walker, lob, drop, zoneAt 등)만 씁니다.
- 설정에 풀 스위치를 넣고, '손님' 플래그를 켜면 금테 카드가 판마다 1~2번 뜨게 합니다.
- autoplay로 팩을 켰을 때와 껐을 때 각 10판씩 생존 시간, 융합 등장 횟수, 무기 수를 비교합니다.
- 결제는 붙이지 않습니다.

---

### 2. 셋이 맞물리는 흐름

판 안에서는 레벨 업으로 무기를 모읍니다. 위기 때마다 받침 줄을 긁어 일제 사격으로 쓰고, 판이 끝나면 마지막 일제 사격이 저절로 나옵니다(안 1). 그 무기들이 곧바로 진열장 칸으로 날아가 별이 차고 무기고 레벨이 오릅니다(안 2). 빈 칸, '???' 융합 실루엣, 손님 무기의 나머지 실루엣이 다음 판과 새 팩을 가리킵니다(안 3). 상점은 세 자리에서만 돈을 받습니다. 판마다 보이는 일제 사격과 받침 줄 연출(안 1), 컬렉션 패스와 황금 세트(안 2), 새 팩(안 3)입니다. 새 팩은 도감 칸을 늘려 패스 경험치를 다시 돌리고, 팩 묶음에 든 연출은 다시 안 1의 화면에 보입니다. 판 안의 힘은 무기 개수에서만 나오고, 개수는 플레이로만 늡니다. 성능을 파는 상품은 없습니다.

---

### 3. 회의에서 나왔지만 버리는 것

| 안 | 버리는 이유 |
|---|---|
| bm-4·ua-4 보급 투하 (3장 다 받기, 월정액 보급 5개) | 판 힘을 돈으로 사는 P2W입니다. 3장 중 1장 고르기 판단을 없애고 개수를 숫자로 부풀리기만 합니다. 무작위 지급이 유료 혜택에 섞이면 확률형으로 해석될 위험도 있습니다. |
| ua-2 무기 60개 오프닝 뒤 빼앗기 | 줬다가 빼앗는 구조라 반감이 큽니다. 해금제로 바꿔야 해서 손대는 범위도 넓습니다. |
| bm-1·player-2 첫 판 풀 30~40종으로 줄이기 | '무기 왕창'이라는 첫인상을 깎습니다. 도감은 풀을 잠그지 않고 기록만 합니다. |
| ua-3 기존 121종을 무료 70종 + 유료로 쪼개기 | "원래 있던 걸 잠근다"는 반발이 바로 옵니다. 새 팩만 팝니다. |
| designer-1의 유료 지휘관 | 일제 사격의 모양을 바꾸면 사실상 성능 상품입니다. 만들면 플레이 보상으로만 줍니다. |
| designer-3 포획 | 손맛은 좋습니다. 하지만 무기마다 적 버전을 만들어야 하는 큰 제작이고, 과충전 입력과 겹치며, 잡는 동안 연쇄가 끊깁니다. 나중에 시즌 이벤트 후보로 보류합니다. |
| designer-2 진지 짓기 | 무기가 20개를 넘으면 배치가 노동이 됩니다. 세로 화면에서 전장을 먹고, 난이도 곡선도 다시 맞춰야 합니다. |
| designer-4 레벨 업 전면을 보급 상자로 교체 | 무기가 25~40개가 되면 프레임이 떨어지고 코어 흐름이 바뀝니다. '같은 팩끼리 융합 짝'만 안 3에 가져왔습니다. |
| player-3 세트 5개면 무대가 바뀜 | 작은 받침대에서는 차이가 잘 안 보이고, 29종 세트 그림 비용이 큽니다. "외형은 받침 줄·피날레처럼 넓은 면적에 몰아라"는 원칙만 가져왔습니다. |
| 뽑기형 외형 상자, 확률 강화, 확률 융합 | 2024년 3월부터 확률 정보 표시가 의무이고, 2025년 8월부터 고의로 어기면 손해액의 3배까지 배상합니다. 확정형만으로도 구조가 성립합니다. |
| 선호 무기 가중치·시작 무기 지명권 판매 | 판 힘에 약하게 영향을 줍니다. 쓴다면 플레이 보상으로만 줍니다. |
| ua-1 Canvas 영상 녹화(MediaRecorder) | iOS 웹뷰에서 불안정합니다. 마지막 장면 스크린샷 카드로 시작합니다. |

---

### 4. 결정이 필요한 질문

1. **일제 사격 입력은 어디까지 갈까요?** 하나는 '버튼 누르고 끌어서 떼기'입니다. 1주면 되고 전부 출격만 합니다. 다른 하나는 '받침 줄 긁기'입니다. 2주가 들고 일부만 고를 수 있습니다. 그리고 긁은 무기의 쿨다운을 처음부터 돌게 해서 '화력 공백'이라는 대가를 둘지, 아니면 공짜로 한 발 더 쏘는 걸로 둘지도 정해야 합니다.
2. **판매 경계를 이렇게 그을까요?** 기존 121종은 전부 무료로 두고 새 팩만 팝니다. 판 밖 영구 강화 재화인 '부품'은 상점과 유료 패스 어디에도 넣지 않습니다. 부품을 팔면 매출은 깊어지지만 P2W 선을 넘습니다.
3. **신규 유저의 첫 판 풀은 어떻게 할까요?** 121종을 처음부터 다 열어 둘지(정체성 우선), 처음 몇 판만 줄였다가 빠르게 풀지(이해 우선) 정해야 합니다.


## 제안 16안 점수 (재미 · 돈 · 위험 낮음, 각 5점)

| 순위 | 안 | 낸 사람 | 재미 | 돈 | 위험 낮음 | 합 | 제작 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 총공세 버튼: 가진 무기 전부 한 번에 출격 | 플레이어 대변인 (캐주얼+코어) | 4 | 2 | 5 | 11 | M |
| 2 | 일제 사격 지휘 (긁어서 쏘기) | 코어 게임 디자이너 | 5 | 3 | 2 | 10 | M |
| 3 | 보급 상자 (무기가 '분대'로 옴) | 코어 게임 디자이너 | 3 | 4 | 3 | 10 | S |
| 4 | 테마 무기 팩 + 주간 난장 순환 | BM·라이브옵스 기획자 | 2 | 5 | 3 | 10 | M |
| 5 | 피날레 숏폼: 판 끝 일제 사격을 8초 세로 클립으로 | 마케팅·UA 담당 | 3 | 2 | 5 | 10 | M |
| 6 | 테마 무기 팩 + 이번 주 손님 무기 | 플레이어 대변인 (캐주얼+코어) | 2 | 5 | 3 | 10 | M |
| 7 | 무기고 도감: 136칸 진열장과 무기고 레벨 | BM·라이브옵스 기획자 | 2 | 4 | 3 | 9 | M |
| 8 | 피날레 일제사격 + 진열대 꾸밈 | BM·라이브옵스 기획자 | 2 | 3 | 4 | 9 | M |
| 9 | 진지 짓기 (무기 자리를 내가 정함) | 코어 게임 디자이너 | 3 | 3 | 2 | 8 | M |
| 10 | 포획 (쳐들어온 놈이 내 무기가 됨) | 코어 게임 디자이너 | 3 | 4 | 1 | 8 | L |
| 11 | 테마 무기 팩을 광고 시리즈로, 주간 '이번 주 손님' 무료 체험 | 마케팅·UA 담당 | 2 | 4 | 2 | 8 | M |
| 12 | 발견형 도감: 무기 풀이 도감과 함께 넓어진다 | 플레이어 대변인 (캐주얼+코어) | 2 | 3 | 3 | 8 | M |
| 13 | 받침 줄 테마 세트: 같은 세트가 많이 깔릴수록 무대가 바뀐다 | 플레이어 대변인 (캐주얼+코어) | 2 | 3 | 3 | 8 | L |
| 14 | 보급 투하: 레벨 업 3장 전부 받기 | BM·라이브옵스 기획자 | 2 | 3 | 2 | 7 | S |
| 15 | 첫 3분 '무기 60개 맛보기' 오프닝, 그다음 되찾기 | 마케팅·UA 담당 | 3 | 2 | 2 | 7 | M |
| 16 | 보급 투하: 무기를 한 번에 왕창 받는 순간 (판 안 광고 + 월정액) | 마케팅·UA 담당 | 2 | - | 1 | 3 | S |

## 리서치에서 본 게임

- **운빨존많겜 (Lucky Defense, 111%)**: 판 안 무작위 소환·합성(운) + 판 밖 신화 영웅 해금 수집 + 신화별 전용 보물(유물) + 패스  
  출처: https://sensortower.com/blog/state-of-mobile-games-in-korea-2024 ; https://www.gamigion.com/lucky-defense-scaled-to-300k-a-day/ ; https://apps.apple.com/us/app/lucky-defense/id6482291732 ; https://ghidbase.github.io/lucky-defense-guides/pages/unlock-order.html ; https://grindnstrat.com/lucky-defense-mythic-stone-farm-guide ; https://news.bizwatch.co.kr/article/mobile/2024/09/13/0032
- **랜덤 다이스 (Random Dice, 111%) / 랜덤 다이스 2**: 수십 종 중 5개로 덱 편성 + 주사위 등급 수집 + 판 밖 클래스 업 + 판 안 합성 시 무작위 변신  
  출처: https://www.diandian.com/en/news/K62Fr6rLzfihMzH8EAp2 ; https://www.baijing.cn/article/56420 ; https://random-dice.fandom.com/wiki/Dice_Menu ; https://admob.google.co.in/home/resources/one-hundred-eleven-percent-grows-ecpms-twenty-eight-percent-admob-platform-bidding/
- **러쉬 로얄 (Rush Royale, IT Territory / MY.GAMES)**: 5장 덱 + 카드마다 레벨 구간별 '재능(talent)' 2택 분기 + 진영 코어로 승급 + 기간 한정 전설 유닛 이벤트  
  출처: https://en.wikipedia.org/wiki/Rush_Royale ; https://www.pocketgamer.biz/rush-royale-surpasses-500m-in-lifetime-revenue/ ; https://www.pocketgamer.com/rush-royale/83-million-installs-festival-of-talents/ ; https://about.my.games/news/244 ; https://apps.apple.com/us/app/id1526121033
- **클래시 로얄 (Clash Royale, Supercell)**: 카드 수집 + 카드 '진화(Evolution)'로 기존 카드 재판매 + 패스 로얄 + 2026년 5월부터 계정 레벨을 '컬렉션 레벨'로 교체 + 새 모드(머지 택틱스)  
  출처: https://www.pocketgamer.biz/as-a-resurgent-clash-royale-peaks-does-supercell-need-a-radical-change-in-strategy-for-new-games ; https://www.pocketgamer.biz/clash-royale-hits-post-pandemic-record-of-38m-daily-revenue-with-new-mode-merge-tactics ; https://liquidandgrit.com/?p=13349 ; https://www.pocketgamer.com/clash-royale/progression-update/ ; https://gamingonphone.com/news/clash-royale-may-2026-update-to-bring-collection-levels-mastery-rework-and-progression-overhaul/ ; https://trophycoach.com/guides/collection-levels-guide-may-2026
- **마블 스냅 (Marvel Snap, Second Dinner) - 후보 외 추가**: 카드 외형 업그레이드 = 계정 '컬렉션 레벨' = 새 카드 획득 트랙. 변형(variant) 아트를 대량으로 판매  
  출처: https://www.deconstructoroffun.com/blog/2022/11/24/marvel-snap-the-one-deconstruction-to-rule-them-all ; https://snap.fan/news/is-marvel-snap-too-aggressive-with-monetization/ ; https://www.pocketgamer.biz/comment-and-opinion/80204/is-marvel-snaps-laid-back-monetization-working/ ; https://danielfriedman.substack.com/p/a-comprehensive-guide-to-the-marvel ; https://acc.mobilematters.gg/gaming/marvel-snap-card-levels-explained-cost-collection-level-cosmetics
- **Survivor.io (Habby)**: 판 안 스킬 선택 + 무기 진화(무기 + 정해진 패시브 짝) / 판 밖 장비 합성(같은 것 3개) + 수집품 세트 보너스 + 테크 파츠 + 패스 3종 분리 + 성장 기금 + 잦은 기간 이벤트  
  출처: https://www.globalgamesforum.com/news/how-survivor.io-continues-to-pull-in-5-million-a-month-three-years-later ; https://wnhub.io/news/finance/item-43301 ; https://apps.apple.com/au/app/survivor-io/id1528941310 ; https://lr.in.psf.lt/r/Survivorio/comments/1ilmn16/collectibles_guide ; https://gamesfuze.com/guides/survivor-io-tech-parts-guide/ ; https://progameguides.com/survivor-io/how-to-get-weapons-evolutions-in-survivor-io/
- **궁수의 전설 2 (Archero 2, Habby) + 궁수의 전설 1**: 장비 상자 + 소원(Wish) + 챕터·일·주·월 팩 + 기간 한정 무기 스킨·영웅 스킨 + 계정 전체 '재능 카드' 뽑기 + 유물. 1편: 무기 스킨이 컬렉션 레벨을 올림  
  출처: https://someselectedstories.substack.com/p/tiny-teardown-archero-2-habby-games ; https://apps.apple.com/app/id6502820653 ; https://apps.apple.com/us/app/-/id1453651052 ; https://appgoblin.info/apps/com.xq.archeroii ; https://wnhub.io/zh/news/other/item-46839
- **카피바라 고 (Capybara Go, Habby)**: 텍스트형 자동 로그라이트 + 장비·상자 포인트 + 배틀패스 + 여러 '기금(fund)' 무료/유료 2트랙 + IAP·광고 혼합 + 초저가 첫 결제  
  출처: https://thinkingdata.io/?p=3488 ; https://www.pocketgamer.biz/habbys-capybara-go-surpasses-100m-in-gross-player-spending ; https://www.asiae.co.kr/en/article/2024102916542151173 ; https://resources.youcloud.com/agg/en/guide_en/1789/ ; https://mechanics-playbook-next.pages.dev/case-studies/capybara-go/
- **버섯커 키우기 (Legend of Mushroom, 4399 / Joy Net)**: 방치형 + 스킬·동료(펫) 조각 뽑기 + 유물(동상이 특정 스킬과 상호작용) + 배틀패스 + 길드·농장 약탈 같은 사회 요소  
  출처: https://deconstructoroffun.com/blog/2024/4/15/the-magic-of-legend-of-mushroom ; https://sensortower.com/blog/state-of-mobile-games-in-apac-2024-report ; https://sensortower.com/ja/blog/legend-of-mushroom-achieved-100m-dollars-in-japan ; https://automaton-media.com/en/news/legend-of-mushrooms-massive-japanese-release-makes-8-5-million-in-one-week/ ; https://mobi.gg/en/tips/legend-of-mushroom-relics/
- **뱀파이어 서바이버 (Vampire Survivors, poncle)**: 유료 판매 + 싼 DLC로 무기·캐릭터 대량 추가 + 무기 진화 조합 + 컬렉션(도감) 칸 채우기와 비밀 해금 + 모바일은 무료에 선택 광고만  
  출처: https://steampulse.org/game/1794680 ; https://ascii.jp/elem/000/004/229/4229675/ ; https://www.pulse.bot/gaming/news/next-vampire-survivors-dlc-expansion-is-legacy-of-the-bloodmoon-b902162b-ed89-49ca-843c-5c6ec9bfe42a/ ; https://www.pocketgamer.biz/vampire-survivors-surprise-launches-to-mobile/ ; https://mobilegamer.biz/vampire-survivors-mobile-hits-3m-downloads/ ; https://www.pcgamer.com/vampire-survivors-studio-says-it-couldnt-find-a-non-predatory-mobile-developer-so-it-did-the-job-itself
- **브로테이토 (Brotato, Blobfish)**: 캐릭터 × 무기 조합 + DLC(캐릭터·무기 추가) + 모바일 유료판 4.99달러와 무료판(광고 + '포테이토 코인' IAP) 병행 + 도감 추가  
  출처: https://toucharcade.com/2023/03/28/top-down-roguelite-shooter-brotato-is-out-now-on-ios-and-android-as-a-premium-release/ ; https://apps.apple.com/us/app/brotato/id6445884925 ; https://www.pcgamesn.com/brotato/coop-update-dlc ; https://steamdb.info/app/2868390/info ; https://toucharcade.com/2023/05/10/brotato-new-update-mobile-encyclopedia-achievements-not-unlocking-fix-20-minutes-till-dawn-pew-pew-bundle-price-discount-iphone-ipad-android
- **발라트로 (Balatro, LocalThunk / Playstack)**: 조커 150종 수집 화면 + 판마다 5칸 조커 조합 + 조커별 '골드 스티커'(최고 난이도에서 그 조커를 들고 클리어) + 유료 판매 + 애플 아케이드  
  출처: https://mobilesyrup.com/2025/01/21/balatro-5-million-copies-sold-update/ ; https://www.indie-games.eu/balatro-generates-4-4-million-in-mobile-revenue/ ; https://www.pocketgamer.biz/card-roguelike-balatro-is-coming-to-ios-and-android-this-month ; https://dotesports.com/indies/news/how-to-get-all-trophies-and-achievements-in-balatro ; https://insider-gaming.com/balatro-trophy-guide-all-achievements-trophies/ ; https://playday.one/2024/12/11/balatro-wins-apple-arcade-game-of-the-year/
- **블룬스 TD 6 (Bloons TD 6, Ninja Kiwi)**: 유료 판매(6.99달러) + 원숭이 머니 IAP + 영웅 구매, 영웅 스킨·목소리 + 타워별 3갈래 업그레이드 + 파라곤 해금 + 몽키 날리지 + 이벤트 재화(트로피) 꾸밈 상점  
  출처: https://en.wikipedia.org/wiki/Bloons_TD_6 ; https://bloons.fandom.com/wiki/Monkey_Money_(BTD6) ; https://www.bloonswiki.com/Shop_(BTD6) ; https://apps.apple.com/US/app/id1118115766
- **슈퍼 오토 펫 (Super Auto Pets, Team Wood Games)**: 무료 기본 팩 + 유료 확장 팩(펫 묶음 = 규칙 세트) + 주간 순환 팩(모든 팩을 섞어 무료 체험) + 커스텀 팩(산 펫만 사용)  
  출처: https://gamermatters.com/super-auto-pets-adds-golden-pack-expansion-easy-mode/ ; https://www.pocketgamer.com/super-auto-pets/how-to-get-new-pets ; https://superautopets.wiki.gg/wiki/Star_Pack ; https://apps.apple.com/app/id1597449908 ; https://www.games-genie.com/games/super-auto-pets
- **전략적 팀 전투 (TFT, Riot)**: 플레이는 공평 + 판매는 순수 외형: 꼬마 전설이 알 뽑기, 미니 챔피언 직접 구매, 아레나(전장) 스킨, 붐(Booms, 마무리 연출), 이벤트 패스. 세트 교체마다 챔피언 풀 전면 교체(일반 지식)  
  출처: https://wiki.leagueoflegends.com/en-us/TFT:Little_Legend ; https://support-teamfighttactics.riotgames.com/hc/en-us/articles/360044586954-Little-Legends-Loot ; https://upcomer.com/here-is-a-look-at-the-new-lunar-revel-cosmetics-coming-to-tft/ ; https://dotesports.com/tft/news/riot-celebrates-tft-set-6s-success-offers-discounted-chibi-champions-ranked-rewards-and-more
- **포켓몬 TCG 포켓 / 포켓몬 GO (수집 계열)**: 도감과 바인더 채우기 + 팩 뽑기 + 같은 포켓몬의 등급·아트 변형 + 시간 회복형 팩 개봉(일반 지식)  
  출처: https://www.gamesradar.com/games/pokemon/pokemon-tcg-pocket-reportedly-made-usd245-million-more-than-pokemon-go-managed-in-its-first-year ; https://www.pocketgamer.biz/pokmon-tcg-pocket-usurps-pokmon-go-launch-as-it-closes-in-on-1bn-after-six-months ; https://www.pocketgamer.biz/pokemon-day-2026-legendaries-legacies-and-the-latest-opportunities-for-a-107bn-mobile-portfolio
- **종합: '연쇄 폭발' 도파민 모드에 옮길 만한 패턴 (전부 추측, 검증 전)**: ① 무기 도감 + 컬렉션 레벨 ② 무기별 외형 단계(스킨) ③ 판 끝 '일제 폭발' 쇼케이스 꾸밈 ④ 테마 무기 팩 + 주간 무료 순환 ⑤ 무기별 마스터리 스티커 ⑥ 융합 = 판 밖 해금 신화 ⑦ 시작 무기 덱 편성  
  출처: 위 항목들의 출처를 종합한 해석

## 확률형 규제 메모

[한국] (1) 게임산업법 개정안이 2023년 2월 27일 국회를 통과했고, 시행령과 함께 2024년 3월 22일부터 확률형 아이템 정보 표시가 의무화됨. 표시 대상은 캡슐형(열어 봐야 아는 상자), 강화형(확률로 성공·실패), 합성형(합쳐서 더 좋은 것을 얻음) 세 가지. 표시할 곳은 게임 안, 홈페이지, 광고·선전물이고, 광고물에는 '확률형 아이템 포함' 사실을 알려야 함. 새 유형은 문체부 고시로 정할 수 있음. 컴플리트 가챠 금지는 법에 없어서 시행령에 들어가지 않음. 위반 시 시정 권고와 명령이 있고, 과태료 상한은 최대 1,000만 원이라는 보도가 있음. 명령을 따르지 않으면 형사처벌(2년 이하 징역 또는 2,000만 원 이하 벌금)이 있다고 기억하나 이번 검색에서는 확인 못 함(추측). (출처: https://www.ajunews.com/view/20240102104711033 , https://www.newsis.com/view/NISX20230227_0002207244 , https://byline.network/2024/02/19-336) (2) 2025년 8월 1일부터 고의로 표시 의무를 어기면 손해액의 3배 이내 징벌적 손해배상(제33조의2). 고의·과실이 없었다는 입증 책임은 게임사에 있고, 문체부 신고·피해구제 센터의 근거도 생김. (https://news.tf.co.kr/read/economy/2168158.htm , https://www.ddaily.co.kr/page/view/2025010614495495712 , https://www.lawtimes.co.kr/news/articleView.html?idxno=210245) (3) 집행 사례: 시행 직전 그라비티(라그나로크)가 기존 공지와 다른 확률 100건 이상을 고쳤고, 공정위가 허위 표시 의혹을 조사함(https://www.blockmedia.co.kr/archives/494943). 해외 게임사에 국내 대리인을 지정하게 하는 제도도 논의·도입 중(https://www.m-economynews.com/mobile/article.html?no=58564 , 시행일은 확인 필요). [스토어] 애플은 2017년 12월부터 가이드라인 3.1.1로 루트박스 구매 전 아이템 유형별 확률 공개를 요구하고, 구글 플레이도 같은 의무가 있음(https://www.pcgamer.com/apple-now-requires-app-store-games-to-disclose-loot-box-odds/ , https://www.fenwick.com/insights/publications/google-play-now-requires-disclosure-of-loot-box-odds). [우리 게임에 대입(추측)] 판 안 레벨 업 3장 고르기와 시작 무기 3장은 돈이 들지 않는 게임 진행이라 대상이 아닐 가능성이 높음. 하지만 유료 재화(무료 재화와 섞여도)로 ① 무작위 무기나 외형 상자를 팔면 캡슐형, ② 무기 레벨이나 외형을 확률로 강화하면 강화형, ③ 융합에 성공 확률을 붙이면 합성형이 됨. 확정형(패스, 테마 팩, 외형 직접 구매)은 표시 부담이 없음. 운빨존많겜도 앱스토어에 '유료 아이템에 확률형 포함' 고지와 '시뮬레이션 도박' 등급이 붙어 있음. [조사 한계] WebFetch가 gamigion.com, globalgamesforum.com, appquantum.com에서 막혀 원문 대신 검색 요약에 기댐. 원문을 보려면 세션 네트워크 설정에서 이 호스트들을 허용해야 함. 매출 수치는 대부분 Sensor Tower, AppMagic, VGI 같은 제3자 추정치이고 출처마다 차이가 큼.
