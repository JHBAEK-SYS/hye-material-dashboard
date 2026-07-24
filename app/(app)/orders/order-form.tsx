"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { createPurchaseOrder } from "@/app/(app)/orders/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState } from "@/lib/form-state";

type Line = { key: number; mdg_code: string; qty: string };

function SubmitButton({ canEdit }: { canEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={!canEdit || pending}>
      {pending ? "등록 중…" : "발주 등록"}
    </Button>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/** 엑셀/텍스트 붙여넣기 파싱: 한 줄당 "MDG코드 [탭/공백/쉼표] 수량" */
function parseBulk(text: string): { mdg_code: string; qty: string }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split(/[\s,]+/).filter(Boolean);
      return { mdg_code: parts[0] ?? "", qty: parts[1] ?? "" };
    })
    .filter((p) => p.mdg_code);
}

export function OrderForm({ canEdit }: { canEdit: boolean }) {
  const [state, formAction] = useActionState(
    createPurchaseOrder,
    initialFormState
  );
  const formRef = useRef<HTMLFormElement>(null);
  const nextKey = useRef(1);
  const [lines, setLines] = useState<Line[]>([
    { key: 0, mdg_code: "", qty: "" },
  ]);
  const [bulk, setBulk] = useState("");
  const [applied, setApplied] = useState<number | null>(null);

  useEffect(() => {
    if (state.message) {
      formRef.current?.reset();
      setLines([{ key: nextKey.current++, mdg_code: "", qty: "" }]);
      setBulk("");
      setApplied(null);
    }
  }, [state.message]);

  const addLine = () =>
    setLines((ls) => [
      ...ls,
      { key: nextKey.current++, mdg_code: "", qty: "" },
    ]);
  const removeLine = (key: number) =>
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  const setLine = (key: number, field: "mdg_code" | "qty", value: string) =>
    setLines((ls) =>
      ls.map((l) => (l.key === key ? { ...l, [field]: value } : l))
    );

  const applyRows = (rows: { mdg_code: string; qty: string }[]) => {
    if (rows.length === 0) return;
    setLines(rows.map((r) => ({ key: nextKey.current++, ...r })));
    setApplied(rows.length);
  };

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      {!canEdit ? (
        <p className="text-sm text-muted-foreground">
          조회 전용 계정입니다. 수정 권한이 없습니다.
        </p>
      ) : null}
      {/* 발주 헤더 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po_no">발주번호 *</Label>
          <Input
            id="po_no"
            name="po_no"
            placeholder="PO-2026-0001"
            required
            disabled={!canEdit}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="order_date">발주일 *</Label>
          <Input
            id="order_date"
            name="order_date"
            type="date"
            defaultValue={today()}
            required
            disabled={!canEdit}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vendor">거래처 *</Label>
          <Input
            id="vendor"
            name="vendor"
            placeholder="공급업체명"
            required
            disabled={!canEdit}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="remark">비고</Label>
          <Input id="remark" name="remark" placeholder="선택" disabled={!canEdit} />
        </div>
      </div>

      {/* 엑셀 붙여넣기 */}
      <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
        <Label htmlFor="bulk">
          엑셀 붙여넣기{" "}
          <span className="font-normal text-muted-foreground">
            (열 순서: MDG코드 · 수량 / 줄바꿈으로 여러 건)
          </span>
        </Label>
        <Textarea
          id="bulk"
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (text && /[\n\t,]/.test(text)) {
              e.preventDefault();
              setBulk(text);
              applyRows(parseBulk(text));
            }
          }}
          rows={3}
          placeholder={"엑셀에서 MDG코드·수량 두 열을 복사해 붙여넣으세요.\n예)\n536691\t3\n537161\t5"}
          className="font-mono text-xs"
          disabled={!canEdit}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyRows(parseBulk(bulk))}
            disabled={!canEdit || !bulk.trim()}
          >
            붙여넣은 내용 적용
          </Button>
          {applied !== null ? (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              ✓ {applied}건이 아래 품목에 채워졌습니다.
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              붙여넣으면 아래 품목이 자동으로 채워집니다.
            </span>
          )}
        </div>
      </div>

      {/* 품목 (복수) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            품목 (MDG코드) · {lines.length}건
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLine}
            disabled={!canEdit}
          >
            + 품목 추가
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {lines.map((l) => (
            <div key={l.key} className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">MDG코드 *</Label>
                <Input
                  name="mdg_code"
                  value={l.mdg_code}
                  onChange={(e) => setLine(l.key, "mdg_code", e.target.value)}
                  placeholder="예: 536691"
                  aria-label="MDG코드"
                  disabled={!canEdit}
                />
              </div>
              <div className="flex w-32 flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">수량 *</Label>
                <Input
                  name="qty"
                  type="number"
                  min={1}
                  step="any"
                  value={l.qty}
                  onChange={(e) => setLine(l.key, "qty", e.target.value)}
                  aria-label="발주수량"
                  disabled={!canEdit}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeLine(l.key)}
                disabled={!canEdit || lines.length === 1}
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
        <SubmitButton canEdit={canEdit} />
      </div>
    </form>
  );
}
