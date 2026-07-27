import { describe, expect, it } from "vitest";

import { MIN_PASSWORD_LENGTH, validateNewPassword } from "@/lib/auth/password";

describe("validateNewPassword", () => {
  it("최소 길이 미만이면 에러 메시지를 반환한다", () => {
    const error = validateNewPassword("12345", "12345");
    expect(error).toBe(
      `비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`
    );
  });

  it("최소 길이를 정확히 만족하면 통과한다", () => {
    const error = validateNewPassword("123456", "123456");
    expect(error).toBeNull();
  });

  it("두 입력이 다르면 에러 메시지를 반환한다", () => {
    const error = validateNewPassword("abcdef", "abcdeg");
    expect(error).toBe("비밀번호가 일치하지 않습니다.");
  });

  it("길이 부족과 불일치가 동시에 있으면 길이 오류를 우선한다", () => {
    const error = validateNewPassword("ab", "cd");
    expect(error).toBe(
      `비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`
    );
  });

  it("길이와 일치 조건을 모두 만족하면 null을 반환한다", () => {
    const error = validateNewPassword("longenoughpassword", "longenoughpassword");
    expect(error).toBeNull();
  });
});
