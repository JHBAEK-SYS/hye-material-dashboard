"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { requestPasswordReset } from "@/app/login/forgot-password/actions";
import { initialFormState } from "@/lib/form-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      재설정 메일 보내기
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    requestPasswordReset,
    initialFormState
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">비밀번호 재설정</CardTitle>
        <CardDescription>
          가입하신 이메일 주소를 입력하면 비밀번호 재설정 링크를 보내드립니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              required
            />
          </div>

          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.message ? (
            <p
              className="whitespace-pre-line text-sm font-medium text-emerald-700 dark:text-emerald-400"
              role="status"
            >
              {state.message}
            </p>
          ) : null}

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
