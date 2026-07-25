"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { createMaterial } from "@/app/(app)/materials/actions";
import { ReadOnlyNotice } from "@/components/read-only-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState } from "@/lib/form-state";

function SubmitButton({ canEdit }: { canEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={!canEdit || pending}>
      {pending ? "등록 중…" : "자재 등록"}
    </Button>
  );
}

export function MaterialForm({ canEdit }: { canEdit: boolean }) {
  const [state, formAction] = useActionState(createMaterial, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      formRef.current?.reset();
    }
  }, [state.message]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      {!canEdit ? <ReadOnlyNotice /> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mdg_code">MDG코드 *</Label>
          <Input
            id="mdg_code"
            name="mdg_code"
            placeholder="예: 536691"
            required
            disabled={!canEdit}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="key">KEY</Label>
          <Input id="key" name="key" disabled={!canEdit} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="material_name">자재명</Label>
          <Input id="material_name" name="material_name" disabled={!canEdit} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="part_no">Part No</Label>
          <Input id="part_no" name="part_no" disabled={!canEdit} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="size">규격</Label>
          <Input id="size" name="size" disabled={!canEdit} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unit">단위</Label>
          <Input id="unit" name="unit" disabled={!canEdit} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manufacturer">제조사</Label>
          <Input id="manufacturer" name="manufacturer" disabled={!canEdit} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="safety_stock">안전재고</Label>
          <Input
            id="safety_stock"
            name="safety_stock"
            type="number"
            min={0}
            defaultValue={0}
            disabled={!canEdit}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="opening_stock">기초재고</Label>
          <Input
            id="opening_stock"
            name="opening_stock"
            type="number"
            min={0}
            defaultValue={0}
            disabled={!canEdit}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="remark">비고</Label>
        <Textarea
          id="remark"
          name="remark"
          placeholder="메모 · 대체품 · 발주 참고사항 등"
          disabled={!canEdit}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked
          className="size-4"
          disabled={!canEdit}
        />
        활성 자재
      </label>

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
        <SubmitButton canEdit={canEdit} />
      </div>
    </form>
  );
}
