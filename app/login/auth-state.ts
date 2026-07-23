// "use server" 파일은 async 함수만 export 가능하므로,
// 로그인 폼의 상태 타입과 초기값은 이 일반 모듈에 분리합니다.

export type AuthState = {
  error: string | null;
  message: string | null;
};

export const initialAuthState: AuthState = { error: null, message: null };
