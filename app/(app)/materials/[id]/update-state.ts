// "use server" 파일은 async 함수만 export 가능하므로 상태 타입/초기값은 분리.

export type UpdateState = {
  error: string | null;
  message: string | null;
};

export const initialUpdateState: UpdateState = { error: null, message: null };
