/// <reference types="vite/client" />

/** vite.config.ts 의 define 에서 주입: 빌드 시각 + 커밋 (테스터 피드백에 어느 빌드인지 붙이기 위함) */
declare const __BUILD_ID__: string;
