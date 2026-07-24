import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteMaterialButton } from "@/app/(app)/materials/[id]/delete-material-button";
import { EditForm } from "@/app/(app)/materials/[id]/edit-form";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCanEdit } from "@/lib/auth/editor";
import { getMaterialById } from "@/lib/supabase/queries";

function num(v: number | null): string {
  return (v ?? 0).toLocaleString("ko-KR");
}

function dateStr(v: string | null): string {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("ko-KR");
}

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const detail = await getMaterialById(numericId);
  if (!detail) notFound();

  const { material, stock } = detail;
  const canEdit = await getCanEdit();

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: "MDG코드", value: material.mdg_code ?? "-" },
    { label: "KEY", value: material.key ?? "-" },
    { label: "기초재고", value: num(material.opening_stock) },
    { label: "입고 누계", value: num(stock?.in_total ?? null) },
    { label: "출고 누계", value: num(stock?.out_total ?? null) },
    { label: "현재고", value: num(stock?.current_stock ?? null) },
    {
      label: "상태",
      value: <StatusBadge status={stock?.status ?? null} />,
    },
    { label: "등록일", value: dateStr(material.created_at) },
    { label: "수정일", value: dateStr(material.updated_at) },
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {material.material_name ?? "(이름 없음)"}
            </h1>
            <StatusBadge status={stock?.status ?? null} />
          </div>
          <p className="text-sm text-muted-foreground">
            {material.mdg_code ?? "-"} · {material.part_no ?? "-"} ·{" "}
            {material.manufacturer ?? "-"}
          </p>
        </div>
        <Link
          href="/materials"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          ← 목록
        </Link>
      </div>

      {/* 읽기 전용 재고 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">재고 정보</CardTitle>
          <CardDescription>
            v_stock_status 기준 · 재고 수치는 자동 계산되어 편집할 수 없습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label} className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">{f.label}</dt>
                <dd className="text-sm font-medium tabular-nums">{f.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* 편집 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">자재 정보 편집</CardTitle>
          <CardDescription>
            마스터 속성을 수정합니다. (MDG코드·재고 수치는 변경 불가)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditForm material={material} canEdit={canEdit} />
        </CardContent>
      </Card>

      {/* 위험 구역: 삭제 */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">위험 구역</CardTitle>
          <CardDescription>
            전표(발주/출고/사급청구)가 참조 중인 자재는 삭제할 수 없습니다. 그런
            경우 위 편집에서 &apos;활성 자재&apos;를 꺼서 비활성 처리하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteMaterialButton
            id={material.id}
            label={material.mdg_code ?? String(material.id)}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
