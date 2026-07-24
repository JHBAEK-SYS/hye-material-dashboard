import path from "node:path";

import { defineConfig } from "vitest/config";

/**
 * 최소 Vitest 설정. 현재는 순수 함수(lib/**) 테스트만 다루므로
 * jsdom/React 플러그인 없이 node 환경으로 충분합니다.
 * tsconfig의 "@/*" 경로 별칭만 resolve.alias 로 맞춰준다.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
