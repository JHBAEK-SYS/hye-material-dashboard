"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { deleteMaterial } from "@/app/(app)/materials/actions";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/form-state";

function Btn({ canEdit }: { canEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="sm"
      disabled={!canEdit || pending}
      title={canEdit ? undefined : "수정 권한이 없습니다"}
      className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
    >
      {pending ? "삭제 중…" : "자재 삭제"}
    </Button>
  );
}

export function DeleteMaterialButton({
  id,
  label,
  canEdit,
}: {
  id: number;
  label: string;
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(deleteMaterial, initialFormState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`자재 '${label}' 를 삭제할까요? 되돌릴 수 없습니다.`)) {
          e.preventDefault();
        }
      }}
      className="flex items-center gap-3"
    >
      <input type="hidden" name="id" value={id} />
      <Btn canEdit={canEdit} />
      {state.error ? (
        <span className="text-sm text-destructive" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
