"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateMaterial } from "@/app/(app)/materials/[id]/actions";
import { initialUpdateState } from "@/app/(app)/materials/[id]/update-state";
import { ReadOnlyNotice } from "@/components/read-only-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MaterialRow } from "@/types/database";

function SaveButton({ canEdit }: { canEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={!canEdit || pending}>
      {pending ? "저장 중…" : "저장"}
    </Button>
  );
}

export function EditForm({
  material,
  canEdit,
}: {
  material: MaterialRow;
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(
    updateMaterial,
    initialUpdateState
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={material.id} />

      {!canEdit ? <ReadOnlyNotice /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="material_name">자재명</Label>
          <Input
            id="material_name"
            name="material_name"
            defaultValue={material.material_name ?? ""}
            disabled={!canEdit}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="part_no">Part No</Label>
          <Input
            id="part_no"
            name="part_no"
            defaultValue={material.part_no ?? ""}
            disabled={!canEdit}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="size">규격</Label>
          <Input
            id="size"
            name="size"
            defaultValue={material.size ?? ""}
            disabled={!canEdit}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unit">단위</Label>
          <Input
            id="unit"
            name="unit"
            defaultValue={material.unit ?? ""}
            disabled={!canEdit}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manufacturer">제조사</Label>
          <Input
            id="manufacturer"
            name="manufacturer"
            defaultValue={material.manufacturer ?? ""}
            disabled={!canEdit}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="safety_stock">안전재고</Label>
          <Input
            id="safety_stock"
            name="safety_stock"
            type="number"
            min={0}
            defaultValue={material.safety_stock ?? 0}
            disabled={!canEdit}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="remark">비고</Label>
        <Textarea
          id="remark"
          name="remark"
          defaultValue={material.remark ?? ""}
          placeholder="메모 · 대체품 · 발주 참고사항 등"
          disabled={!canEdit}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={material.is_active}
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
        <SaveButton canEdit={canEdit} />
      </div>
    </form>
  );
}
