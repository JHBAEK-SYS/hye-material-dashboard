"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updatePassword } from "@/app/auth/update-password/actions";
import { initialFormState } from "@/lib/form-state";
import { Button, buttonVariants } from "@/components/ui/button";
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
      비밀번호 변경
    </Button>
  );
}

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState(updatePassword, initialFormState);

  if (state.message) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">비밀번호 변경 완료</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p
            className="whitespace-pre-line text-sm font-medium text-emerald-700 dark:text-emerald-400"
            role="status"
          >
            {state.message}
          </p>
          <Link href="/dashboard" className={buttonVariants({ className: "w-full" })}>
            대시보드로 이동
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">새 비밀번호 설정</CardTitle>
        <CardDescription>
          새로 사용할 비밀번호를 입력하세요. (최소 6자)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">새 비밀번호</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>

          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
