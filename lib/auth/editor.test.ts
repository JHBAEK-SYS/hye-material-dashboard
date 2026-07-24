import { describe, expect, it } from "vitest";

import { isEditorEmail } from "@/lib/auth/editor";

describe("isEditorEmail", () => {
  it("정확히 일치하면 true를 반환한다", () => {
    expect(isEditorEmail("a@b.com", ["a@b.com"])).toBe(true);
  });

  it("대소문자가 달라도 true를 반환한다", () => {
    expect(isEditorEmail("A@B.com", ["a@b.com"])).toBe(true);
    expect(isEditorEmail("a@b.com", ["A@B.com"])).toBe(true);
  });

  it("앞뒤 공백이 있어도 true를 반환한다", () => {
    expect(isEditorEmail("  a@b.com  ", ["a@b.com"])).toBe(true);
    expect(isEditorEmail("a@b.com", ["  a@b.com  "])).toBe(true);
  });

  it("email이 null이면 false를 반환한다", () => {
    expect(isEditorEmail(null, ["a@b.com"])).toBe(false);
  });

  it("email이 undefined면 false를 반환한다", () => {
    expect(isEditorEmail(undefined, ["a@b.com"])).toBe(false);
  });

  it("email이 빈 문자열이면 false를 반환한다", () => {
    expect(isEditorEmail("", ["a@b.com"])).toBe(false);
  });

  it("editorEmails가 빈 배열이면 false를 반환한다", () => {
    expect(isEditorEmail("a@b.com", [])).toBe(false);
  });

  it("목록에 없는 이메일이면 false를 반환한다", () => {
    expect(isEditorEmail("c@d.com", ["a@b.com", "b@c.com"])).toBe(false);
  });

  // 회귀 방지: 예전 구현은 DB에서 ilike 로 조회해 이메일 속 `_`/`%` 가
  // 와일드카드로 해석되는 바람에 다른 사람을 편집자로 오판했다.
  it("편집자 이메일의 밑줄을 와일드카드로 취급하지 않는다", () => {
    const editors = ["hong_gd@corp.com"];
    expect(isEditorEmail("hong_gd@corp.com", editors)).toBe(true);
    expect(isEditorEmail("hongXgd@corp.com", editors)).toBe(false);
  });

  it("편집자 이메일의 퍼센트를 와일드카드로 취급하지 않는다", () => {
    const editors = ["a%@corp.com"];
    expect(isEditorEmail("anything@corp.com", editors)).toBe(false);
    expect(isEditorEmail("a%@corp.com", editors)).toBe(true);
  });
});
