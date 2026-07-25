import { describe, expect, it } from "vitest";

import { classifySignUpResult } from "@/lib/auth/signup-result";
import type { User, Session } from "@supabase/supabase-js";

// 테스트에 필요한 최소 필드만 채운 더미 팩토리.
// (User/Session은 필드가 많아 매 테스트에서 전부 채우면 가독성이 떨어진다.)
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2024-01-01T00:00:00Z",
    identities: [
      {
        identity_id: "22222222-2222-2222-2222-222222222222",
        id: "11111111-1111-1111-1111-111111111111",
        user_id: "11111111-1111-1111-1111-111111111111",
        identity_data: { email: "example@email.com" },
        provider: "email",
        created_at: "2024-01-01T00:00:00Z",
        last_sign_in_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ],
    ...overrides,
  } as User;
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    access_token: "token",
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: makeUser(),
    ...overrides,
  } as Session;
}

describe("classifySignUpResult", () => {
  it("session이 있으면 즉시 로그인됨으로 판정한다", () => {
    const result = classifySignUpResult({
      user: makeUser(),
      session: makeSession(),
    });
    expect(result).toBe("signed-in");
  });

  it("session이 없고 user.identities가 빈 배열이면 이미 가입된 이메일로 판정한다", () => {
    const result = classifySignUpResult({
      user: makeUser({ identities: [] }),
      session: null,
    });
    expect(result).toBe("already-registered");
  });

  it("session이 없고 user.identities가 값이 있으면 인증 메일 발송됨으로 판정한다", () => {
    const result = classifySignUpResult({
      user: makeUser(),
      session: null,
    });
    expect(result).toBe("confirmation-sent");
  });

  it("user가 null이면 인증 메일 발송됨으로 판정한다 (엣지케이스: 예외적 응답을 오류로 취급하지 않는다)", () => {
    const result = classifySignUpResult({
      user: null,
      session: null,
    });
    expect(result).toBe("confirmation-sent");
  });

  it("user는 있고 identities가 undefined면 인증 메일 발송됨으로 판정한다 (엣지케이스)", () => {
    const result = classifySignUpResult({
      user: makeUser({ identities: undefined }),
      session: null,
    });
    expect(result).toBe("confirmation-sent");
  });

  it("session이 있으면 identities가 비어있어도 즉시 로그인됨이 우선한다", () => {
    // session 존재는 실제로 인증된 상태이므로, 다른 필드보다 우선 판정되어야 한다.
    const result = classifySignUpResult({
      user: makeUser({ identities: [] }),
      session: makeSession(),
    });
    expect(result).toBe("signed-in");
  });

  it("user와 session이 모두 null이면 인증 메일 발송됨으로 판정한다 (엣지케이스)", () => {
    const result = classifySignUpResult({ user: null, session: null });
    expect(result).toBe("confirmation-sent");
  });
});
