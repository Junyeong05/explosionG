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
