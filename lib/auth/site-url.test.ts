import { describe, expect, it } from "vitest";

import { getSiteUrl } from "@/lib/auth/site-url";

describe("getSiteUrl", () => {
  it("NEXT_PUBLIC_SITE_URL이 있으면 그 값을 그대로 사용한다", () => {
    const url = getSiteUrl({
      NEXT_PUBLIC_SITE_URL: "https://custom.example.com",
      VERCEL_PROJECT_PRODUCTION_URL: "hye-material-dashboard.vercel.app",
    });
    expect(url).toBe("https://custom.example.com");
  });

  it("NEXT_PUBLIC_SITE_URL 끝에 슬래시가 있으면 제거한다", () => {
    const url = getSiteUrl({
      NEXT_PUBLIC_SITE_URL: "https://custom.example.com/",
    });
    expect(url).toBe("https://custom.example.com");
  });

  it("NEXT_PUBLIC_SITE_URL이 없고 VERCEL_PROJECT_PRODUCTION_URL이 있으면 https:// 를 붙여 사용한다", () => {
    const url = getSiteUrl({
      VERCEL_PROJECT_PRODUCTION_URL: "hye-material-dashboard.vercel.app",
    });
    expect(url).toBe("https://hye-material-dashboard.vercel.app");
  });

  it("둘 다 없으면 localhost:3000 을 사용한다", () => {
    const url = getSiteUrl({});
    expect(url).toBe("http://localhost:3000");
  });

  it("빈 문자열은 값이 없는 것으로 취급한다", () => {
    const url = getSiteUrl({
      NEXT_PUBLIC_SITE_URL: "",
      VERCEL_PROJECT_PRODUCTION_URL: "",
    });
    expect(url).toBe("http://localhost:3000");
  });
});
