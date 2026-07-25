import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 재고 일괄 조정(실사) 화면이 Server Action(previewBulkAdjust)으로 실사
      // 결과 .xlsx 파일을 직접 업로드한다. Next.js 16의 Server Action 요청 본문
      // 기본 상한은 1MB인데(node_modules/next/dist/docs/01-app/02-guides/
      // server-actions.md 참고), 자재 수가 많은(문서상 최대 ~2,000행) 엑셀은
      // 서식/메타데이터를 포함해 1MB를 넘을 수 있어 여유 있게 상향한다.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
