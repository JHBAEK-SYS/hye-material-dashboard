"use client";

import { useActionState, useEffect, useRef } from "react";
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

  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state.message]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <Label htmlFor="mdg_code">MDG코드 *</Label>
          <Input id="mdg_code" name="mdg_code" placeholder="예: 536691" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="order_qty">발주수량 *</Label>
          <Input
            id="order_qty"
            name="order_qty"
            type="number"
            min={1}
            step="any"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="remark">비고</Label>
          <Input id="remark" name="remark" placeholder="선택" />
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
