import { describe, expect, it } from "vitest";

import {
  activeOnlyParam,
  parseActiveOnly,
} from "@/lib/materials/active-filter";

describe("parseActiveOnly", () => {
  it("파라미터가 없으면(첫 접속·초기화) 기본값으로 활성만 켠다", () => {
    expect(parseActiveOnly(undefined)).toBe(true);
  });

  it("체크 해제 시 전송되는 '0' 이면 끈다", () => {
    // hidden active=0 만 전송된 경우. 이걸 놓치면 체크를 해제해도
    // 파라미터가 없는 것과 구분되지 않아 해제가 먹지 않는다.
    expect(parseActiveOnly("0")).toBe(false);
  });

  it("체크 시 전송되는 ['0','1'] 이면 마지막 값을 읽어 켠다", () => {
    // hidden 이 먼저, 체크박스가 나중에 전송되므로 마지막이 "1" 이다.
    expect(parseActiveOnly(["0", "1"])).toBe(true);
  });

  it("'1' 단독(수동으로 만든 URL)도 켠 것으로 본다", () => {
    expect(parseActiveOnly("1")).toBe(true);
  });

  it("배열 순서가 뒤집혀도 마지막 값을 따른다", () => {
    expect(parseActiveOnly(["1", "0"])).toBe(false);
  });

  it("알 수 없는 값은 끈 것으로 본다", () => {
    expect(parseActiveOnly("yes")).toBe(false);
    expect(parseActiveOnly("")).toBe(false);
  });
});

describe("activeOnlyParam", () => {
  it("꺼진 상태를 링크에 유지하려면 '0' 을 명시한다", () => {
    // 생략하면 다음 페이지에서 기본값(켜짐)으로 되돌아가 버린다.
    expect(activeOnlyParam(false)).toBe("0");
  });

  it("켜진 상태는 '1'", () => {
    expect(activeOnlyParam(true)).toBe("1");
  });

  it("왕복(링크로 내보낸 값을 다시 파싱)해도 상태가 유지된다", () => {
    for (const state of [true, false]) {
      expect(parseActiveOnly(activeOnlyParam(state))).toBe(state);
    }
  });
});
