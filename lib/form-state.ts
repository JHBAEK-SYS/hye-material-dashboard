// Server Action 폼 공통 상태. ("use server" 파일은 async 함수만 export 가능하므로 분리)

export type FormState = {
  error: string | null;
  message: string | null;
};

export const initialFormState: FormState = { error: null, message: null };
