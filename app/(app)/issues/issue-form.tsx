"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { createIssue } from "@/app/(app)/issues/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/form-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "등록 중…" : "출고 등록"}
    </Button>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export function IssueForm() {
  const [state, formAction] = useActionState(createIssue, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state.message]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="req_no">청구번호 *</Label>
          <Input id="req_no" name="req_no" placeholder="REQ-2026-0001" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="issue_date">출고일 *</Label>
          <Input
            id="issue_date"
            name="issue_date"
            type="date"
            defaultValue={today()}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mdg_code">MDG코드 *</Label>
          <Input id="mdg_code" name="mdg_code" placeholder="예: 536691" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="qty">출고수량 *</Label>
          <Input id="qty" name="qty" type="number" min={1} step="any" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tool_name">장비명</Label>
          <Input id="tool_name" name="tool_name" placeholder="선택" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="staff">담당자</Label>
          <Input id="staff" name="staff" placeholder="선택" />
        </div>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
          {state.message}
        </p>
      ) : null}

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
