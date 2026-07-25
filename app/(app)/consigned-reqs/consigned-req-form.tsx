"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { createConsignedReq } from "@/app/(app)/consigned-reqs/actions";
import { ReadOnlyNotice } from "@/components/read-only-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseBulk } from "@/lib/consigned-reqs/parse-bulk";
import { initialFormState } from "@/lib/form-state";

type Line = { key: number; mdg_code: string; qty: string; bl_no: string };

function SubmitButton({ canEdit }: { canEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={!canEdit || pending}>
      {pending ? "등록 중…" : "사급청구 등록"}
    </Button>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export function ConsignedReqForm({ canEdit }: { canEdit: boolean }) {
  const [state, formAction] = useActionState(
    createConsignedReq,
    initialFormState
  );
  const formRef = useRef<HTMLFormElement>(null);
  const nextKey = useRef(1);
  const [lines, setLines] = useState<Line[]>([
    { key: 0, mdg_code: "", qty: "", bl_no: "" },
  ]);
  const [bulk, setBulk] = useState("");
  const [applied, setApplied] = useState<number | null>(null);

  useEffect(() => {
    if (state.message) {
      formRef.current?.reset();
      setLines([{ key: nextKey.current++, mdg_code: "", qty: "", bl_no: "" }]);
      setBulk("");
      setApplied(null);
    }
  }, [state.message]);

  const addLine = () =>
    setLines((ls) => [
      ...ls,
      { key: nextKey.current++, mdg_code: "", qty: "", bl_no: "" },
    ]);
  const removeLine = (key: number) =>
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  const setLine = (
    key: number,
    field: "mdg_code" | "qty" | "bl_no",
    value: string
  ) =>
    setLines((ls) =>
      ls.map((l) => (l.key === key ? { ...l, [field]: value } : l))
    );

  const applyRows = (
    rows: { mdg_code: string; qty: string; bl_no: string }[]
  ) => {
    if (rows.length === 0) return;
    setLines(rows.map((r) => ({ key: nextKey.current++, ...r })));
    setApplied(rows.length);
  };

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      {!canEdit ? <ReadOnlyNotice /> : null}
      {/* 사급청구 헤더 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sg_no">사급청구번호 *</Label>
          <Input
            id="sg_no"
            name="sg_no"
            placeholder="SG-2026-0001"
            required
            disabled={!canEdit}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="request_date">요청일 *</Label>
          <Input
            id="request_date"
            name="request_date"
            type="date"
            defaultValue={today()}
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
            (열 순서: MDG코드 · 수량 · B/L NO(선택) / 줄바꿈으로 여러 건)
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
          placeholder={
            "엑셀에서 MDG코드·수량·B/L NO(선택) 열을 복사해 붙여넣으세요.\n예)\n536691\t3\tBL-2026-001\n537161\t5"
          }
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
            <div key={l.key} className="flex flex-wrap items-end gap-2">
              <div className="flex min-w-40 flex-1 flex-col gap-1.5">
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
                <Label className="text-xs text-muted-foreground">요청수량 *</Label>
                <Input
                  name="qty"
                  type="number"
                  min={1}
                  step="any"
                  value={l.qty}
                  onChange={(e) => setLine(l.key, "qty", e.target.value)}
                  aria-label="요청수량"
                  disabled={!canEdit}
                />
              </div>
              <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  B/L NO
                </Label>
                <Input
                  name="bl_no"
                  value={l.bl_no}
                  onChange={(e) => setLine(l.key, "bl_no", e.target.value)}
                  placeholder="선택 · 선적 후 입력 가능"
                  aria-label="B/L NO"
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
