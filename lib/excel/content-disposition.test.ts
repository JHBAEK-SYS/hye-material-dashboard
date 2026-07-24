import { describe, expect, it } from "vitest";

import { contentDisposition } from "@/lib/excel/content-disposition";

describe("contentDisposition", () => {
  it("반환 문자열의 모든 문자가 코드포인트 255 이하이다 (ByteString 변환 가능해야 함)", () => {
    const header = contentDisposition("materials_20260724.xlsx", "자재마스터_20260724.xlsx");
    const allLatin1 = [...header].every((c) => c.codePointAt(0)! <= 255);
    expect(allLatin1).toBe(true);
  });

  it("한글 파일명 입력 시 filename*=UTF-8'' 부분이 퍼센트 인코딩되어 포함된다", () => {
    const header = contentDisposition("materials_20260724.xlsx", "자재마스터_20260724.xlsx");
    expect(header).toContain(
      `filename*=UTF-8''${encodeURIComponent("자재마스터_20260724.xlsx")}`
    );
  });

  it("ASCII fallback(filename=\"...\") 부분에는 비ASCII 문자가 없다", () => {
    const header = contentDisposition("materials_20260724.xlsx", "자재마스터_20260724.xlsx");
    const match = header.match(/filename="([^"]*)"/);
    expect(match).not.toBeNull();
    const fallback = match![1];
    expect([...fallback].every((c) => c.codePointAt(0)! <= 127)).toBe(true);
  });

  it("ASCII fallback에 큰따옴표나 개행이 들어오면 안전하게 제거/치환된다 (헤더 인젝션 방지)", () => {
    const malicious = 'evil";x=1\r\nInjected: header';
    const header = contentDisposition(malicious, "무해한파일.xlsx");
    expect(header).not.toContain("\r");
    expect(header).not.toContain("\n");

    const match = header.match(/filename="([^"]*)"/);
    expect(match).not.toBeNull();
    const fallback = match![1];
    expect(fallback).not.toContain('"');
  });

  it("정상적인 ASCII 파일명은 그대로 fallback에 사용된다", () => {
    const header = contentDisposition("issues_20260724.xlsx", "출고기록_20260724.xlsx");
    expect(header).toContain('filename="issues_20260724.xlsx"');
  });

  it("전체 형식이 attachment; filename=\"...\"; filename*=UTF-8''... 이다", () => {
    const header = contentDisposition("orders_20260724.xlsx", "도급발주_20260724.xlsx");
    expect(header.startsWith('attachment; filename="orders_20260724.xlsx"; filename*=UTF-8\'\'')).toBe(
      true
    );
  });
});
