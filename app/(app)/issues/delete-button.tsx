"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { deleteIssue } from "@/app/(app)/issues/actions";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/form-state";

function Btn({ canEdit }: { canEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      disabled={!canEdit || pending}
      className="text-destructive hover:text-destructive"
      aria-label="삭제"
      title={canEdit ? undefined : "수정 권한이 없습니다"}
    >
      {pending ? "…" : "🗑 삭제"}
    </Button>
  );
}

export function DeleteButton({
  id,
  label,
  canEdit,
}: {
  id: number;
  label: string;
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(deleteIssue, initialFormState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`출고 '${label}' 를 삭제할까요?`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Btn canEdit={canEdit} />
      {state.error ? (
        <span className="ml-1 text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}
