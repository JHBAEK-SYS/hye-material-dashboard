"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { authenticate } from "@/app/login/actions";
import { initialAuthState } from "@/app/login/auth-state";
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

function SubmitButton({
  intent,
  variant = "default",
  children,
}: {
  intent: "login" | "signup";
  variant?: "default" | "outline";
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      name="intent"
      value={intent}
      variant={variant}
      disabled={pending}
      className="w-full"
    >
      {children}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(authenticate, initialAuthState);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">자재 대시보드 로그인</CardTitle>
        <CardDescription>
          구매팀 계정 이메일과 비밀번호를 입력하세요.
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
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">비밀번호</Label>
              <Link
                href="/login/forgot-password"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                비밀번호를 잊으셨나요?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
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
              className="whitespace-pre-line text-sm text-muted-foreground"
              role="status"
            >
              {state.message}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 pt-1">
            <SubmitButton intent="login">로그인</SubmitButton>
            <SubmitButton intent="signup" variant="outline">
              회원가입
            </SubmitButton>
            <p className="text-xs text-muted-foreground">
              처음이신가요? 이메일과 비밀번호를 입력한 뒤 회원가입을 누르면
              인증 메일이 발송됩니다.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
