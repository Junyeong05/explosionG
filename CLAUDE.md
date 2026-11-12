# 연쇄 폭발 (explosionG) — 에이전트 메모

구조는 [`README.md`](README.md)·[`docs/architecture.md`](docs/architecture.md), 기획은 [`docs/design/`](docs/design/).

## 포털 보고 (portalShare)

이 프로젝트의 현황은 [Junyeong05/portalShare](https://github.com/Junyeong05/portalShare)에서 관리한다. 포털의 id는 `explosion-g`.

**언제 보고하나**
- 사용자가 "포털 업데이트해줘"라고 할 때
- 의미 있는 단위가 끝났을 때: 기능 완성, PR 머지, 출시/배포, 새 블로커 발생, 사용자 결정이 필요해졌을 때
- 사소한 수정(오타, 리팩터 일부)은 보고하지 않는다

**어떻게**
1. portalShare를 클론 (세션에 없으면 추가)
2. portalShare의 `CLAUDE.md` 규칙대로 `projects/explosion-g/status.json` 갱신 + `log.md` 맨 위에 항목 추가
   - 화면이 바뀌었으면 `screens/` 스크린샷 갱신, 설명할 거리가 있으면 `docs/`에 정리 문서 추가
3. `node scripts/build.mjs --check` 통과 확인 → `status(explosion-g): ...` 로 커밋 → push

## 연출 미리보기 HTML (11-09 유저 요청)

"앞으로는 뭔가 구현하면 어떤 식으로 연출되고 어떤 식으로 싸우는지 HTML로 정리해서 주면 된다."
"연출적인 걸 게임에 안 들어가고 여기(앱 대화창)서 작게라도 바로 체크할 수 있었으면 하는 것."
기능·무기·규칙·연출을 만들면 **실제로 도는 화면을 HTML 한 파일로** 만들어 **앱 대화창에 페이지로 띄운다** ("여기다가 뜨게": Artifact 로 올림. 파일 전송이 아니라).
새 연출은 게임에 넣기 전에 이 HTML로 먼저 보여 주고, 괜찮다고 하면 게임에 넣는다.

- 장면 정의: `tools/showcase/pages/<이름>.ts` — 카드마다 무기·레벨·설명 (`Scene`, `tools/showcase/runtime.ts`)
- 만들기: `npm run showcase -- <이름>` → `docs/showcase/<이름>.html` (그대로 여는 완전한 HTML, 저장소에 남김) + `dist-showcase/<이름>.html` (Artifact 로 올리는 판: doctype·head·body 없이 내용만)
- 띄우기: Artifact 도구로 `dist-showcase/<이름>.html` 을 publish (`npm run build` 가 dist/ 를 비우므로 dist 밖에 둔다). 같은 페이지를 고치면 아래 주소로 다시 올려 주소를 유지한다 (다른 세션에서는 `url` 로)
- 카드 = 캔버스(실제 게임 화면이 반복 재생) + 제목·꼬리표 + 무기 + "어떻게 싸우나" 한두 문장. 위에 목차와 속도(1×·0.5×·0.25×)
- 브라우저(Playwright)로 열어 오류 없이 도는지, 폰 너비(390px)에서 가로 스크롤이 없는지 보고 나서 파일을 보낸다
- 페이지 주소
  - `categories` (갈래 15개): https://claude.ai/artifact/HT8y53kpe6NNSaMiPXjcBM
  - `links` (실어 나르기 210, 처음 설계): https://claude.ai/artifact/1xUzTwMAgk5wDjt1B2Gnrb
  - `combine` (합성 210 v1 보관본: 실제로 도는 210가지 + 공통 규칙): https://claude.ai/artifact/AtSVCwsWaX3ELXV5LjcLe7
  - `combine2` (합성 210 v2: 합치면 새 무기, 210 카드 + 겹친 합성 + 손 입력 자동): https://claude.ai/artifact/VMhpAbmPPryyLMV5MV8XjU
  - `combine-live` (합성 실전: 무기 12개 판에서 합성 0·3·5 비교): https://claude.ai/artifact/Fx7y4R4tgo7vwktwW8vPz6
  - `combine3` (합성 210 v3 융합: 공통 규칙 하나, 210 카드 + v2·v3 비교 + 겹친 합성 + 도감): https://claude.ai/artifact/962LuJnT3FAXLZaNgU4nzV
  - `ceil` (합성 천장 후보 여섯: 짝마다 v3 와 새 동작 나란히): https://claude.ai/artifact/96ZCmgRZQVbverTXw4mPEW
