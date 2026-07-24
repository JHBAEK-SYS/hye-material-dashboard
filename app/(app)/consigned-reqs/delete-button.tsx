"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { deleteConsignedReq } from "@/app/(app)/consigned-reqs/actions";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/form-state";

function Btn() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      disabled={pending}
      className="text-destructive hover:text-destructive"
      aria-label="삭제"
    >
      {pending ? "…" : "🗑 삭제"}
    </Button>
  );
}

export function DeleteButton({ id, label }: { id: number; label: string }) {
  const [state, formAction] = useActionState(
    deleteConsignedReq,
    initialFormState
  );
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`사급청구 '${label}' 를 삭제할까요?`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Btn />
      {state.error ? (
        <span className="ml-1 text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}
