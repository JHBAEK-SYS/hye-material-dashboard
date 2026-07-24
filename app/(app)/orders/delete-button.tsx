"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { deletePurchaseOrder } from "@/app/(app)/orders/actions";
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
  const [state, formAction] = useActionState(
    deletePurchaseOrder,
    initialFormState
  );
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`발주 '${label}' 품목을 삭제할까요?`)) {
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
