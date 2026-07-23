"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { createPurchaseOrder } from "@/app/(app)/orders/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/form-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "등록 중…" : "발주 등록"}
    </Button>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export function OrderForm() {
  const [state, formAction] = useActionState(
    createPurchaseOrder,
    initialFormState
  );
  const formRef = useRef<HTMLFormElement>(null);
  const nextKey = useRef(1);
  const [lines, setLines] = useState<number[]>([0]);

  useEffect(() => {
    if (state.message) {
      formRef.current?.reset();
      setLines([nextKey.current++]);
    }
  }, [state.message]);

  const addLine = () => setLines((ls) => [...ls, nextKey.current++]);
  const removeLine = (k: number) =>
    setLines((ls) => (ls.length > 1 ? ls.filter((x) => x !== k) : ls));

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      {/* 발주 헤더 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po_no">발주번호 *</Label>
          <Input id="po_no" name="po_no" placeholder="PO-2026-0001" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="order_date">발주일 *</Label>
          <Input
            id="order_date"
            name="order_date"
            type="date"
            defaultValue={today()}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vendor">거래처 *</Label>
          <Input id="vendor" name="vendor" placeholder="공급업체명" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="remark">비고</Label>
          <Input id="remark" name="remark" placeholder="선택" />
        </div>
      </div>

      {/* 품목 (복수) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">품목 (MDG코드)</span>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            + 품목 추가
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {lines.map((k) => (
            <div key={k} className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">MDG코드 *</Label>
                <Input
                  name="mdg_code"
                  placeholder="예: 536691"
                  aria-label="MDG코드"
                />
              </div>
              <div className="flex w-32 flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">수량 *</Label>
                <Input
                  name="qty"
                  type="number"
                  min={1}
                  step="any"
                  aria-label="발주수량"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeLine(k)}
                disabled={lines.length === 1}
                aria-label="품목 삭제"
                className="text-muted-foreground"
              >
                ✕
              </Button>
            </div>
          ))}
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
