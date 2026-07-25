"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { adjustStock } from "@/app/(app)/materials/[id]/actions";
import { initialUpdateState } from "@/app/(app)/materials/[id]/update-state";
import { ReadOnlyNotice } from "@/components/read-only-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeOpeningStockForTarget } from "@/lib/materials/stock-adjust";

function SaveButton({ canEdit }: { canEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={!canEdit || pending}>
      {pending ? "저장 중…" : "재고 조정 저장"}
    </Button>
  );
}

export function StockAdjustForm({
  materialId,
  currentStock,
  openingStock,
  inTotal,
  outTotal,
  canEdit,
}: {
  materialId: number;
  currentStock: number;
  openingStock: number;
  inTotal: number;
  outTotal: number;
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(adjustStock, initialUpdateState);
  const [target, setTarget] = useState("");

  const trimmed = target.trim();
  const targetNum = Number(trimmed);
  const isValidPreview = trimmed !== "" && Number.isFinite(targetNum) && targetNum >= 0;
  const newOpeningStock = isValidPreview
    ? computeOpeningStockForTarget({ target: targetNum, inTotal, outTotal })
    : null;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={materialId} />

      {!canEdit ? <ReadOnlyNotice /> : null}

      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-muted-foreground">현재고</p>
        <p className="text-lg font-semibold tabular-nums">
          {currentStock.toLocaleString("ko-KR")}
        </p>
      </div>

      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor="target">실사 수량 (원하는 현재고)</Label>
        <Input
          id="target"
          name="target"
          type="number"
          min={0}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="예: 125"
          disabled={!canEdit}
        />
      </div>

      {isValidPreview && newOpeningStock !== null ? (
        <div aria-live="polite" className="flex flex-col gap-2 text-sm">
          <p className="rounded-md border bg-muted px-4 py-3">
            저장하면 기초재고가{" "}
            <span className="font-medium tabular-nums">
              {openingStock.toLocaleString("ko-KR")}
            </span>{" "}
            →{" "}
            <span className="font-medium tabular-nums">
              {newOpeningStock.toLocaleString("ko-KR")}
            </span>{" "}
            로 바뀝니다.
          </p>
          {/* 경고는 muted 배경 밖(카드 흰 배경)에 둔다 — muted 위에서는 대비가
              3.94:1 로 기준(4.5:1)에 못 미친다. */}
          {newOpeningStock < 0 ? (
            <p className="font-semibold text-destructive">
              기초재고가 음수가 됩니다. 입출고 전표를 먼저 확인하세요.
            </p>
          ) : null}
        </div>
      ) : null}

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status" aria-live="polite">
          {state.message}
        </p>
      ) : null}

      <div>
        <SaveButton canEdit={canEdit} />
      </div>
    </form>
  );
}
