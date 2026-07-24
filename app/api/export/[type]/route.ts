import ExcelJS from "exceljs";
import { type NextRequest, NextResponse } from "next/server";

import { contentDisposition } from "@/lib/excel/content-disposition";
import {
  consignedReqsSheet,
  issuesSheet,
  materialsSheet,
  parseExportType,
  purchaseOrdersSheet,
  type SheetSpec,
} from "@/lib/excel/sheets";
import { createClient } from "@/lib/supabase/server";
import {
  getAllConsignedReqsForExport,
  getAllIssuesForExport,
  getAllMaterialsForExport,
  getAllPurchaseOrdersForExport,
} from "@/lib/supabase/queries";
import { STOCK_STATUSES, type StockStatus } from "@/types/database";

// exceljs 는 Buffer 등 Node.js API 에 의존하므로 Edge 런타임이 아닌
// Node.js 런타임에서 실행되어야 한다.
export const runtime = "nodejs";

/** 화면별 다운로드 파일명(한글) */
const FILE_LABELS: Record<string, string> = {
  materials: "자재마스터",
  orders: "도급발주",
  "consigned-reqs": "사급청구",
  issues: "출고기록",
};

/** 화면별 다운로드 파일명(ASCII, 구형 브라우저용 Content-Disposition fallback) */
const FILE_LABELS_ASCII: Record<string, string> = {
  materials: "materials",
  orders: "purchase-orders",
  "consigned-reqs": "consigned-reqs",
  issues: "issues",
};

function todayStamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** SheetSpec -> exceljs 워크북 버퍼로 직렬화 (헤더 굵게, 열 너비, 첫 행 고정) */
async function buildWorkbookBuffer(spec: SheetSpec): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(spec.sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = spec.columns.map((col) => ({
    header: col.header,
    width: col.width ?? 14,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };

  for (const row of spec.rows) {
    sheet.addRow(row);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const exportType = parseExportType(type);
  if (!exportType) {
    return NextResponse.json(
      { error: `유효하지 않은 export 유형입니다: ${type}` },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q") ?? undefined;

  try {
    let spec: SheetSpec;

    switch (exportType) {
      case "materials": {
        const statusParam = searchParams.get("status") ?? undefined;
        const status = STOCK_STATUSES.includes(statusParam as StockStatus)
          ? (statusParam as StockStatus)
          : undefined;
        const activeOnly = searchParams.get("active") === "1";
        const rows = await getAllMaterialsForExport({
          search: q,
          status,
          activeOnly,
        });
        spec = materialsSheet(rows);
        break;
      }
      case "orders": {
        const openOnly = searchParams.get("open") === "1";
        const rows = await getAllPurchaseOrdersForExport({
          search: q,
          openOnly,
        });
        spec = purchaseOrdersSheet(rows);
        break;
      }
      case "consigned-reqs": {
        const openOnly = searchParams.get("open") === "1";
        const rows = await getAllConsignedReqsForExport({
          search: q,
          openOnly,
        });
        spec = consignedReqsSheet(rows);
        break;
      }
      case "issues": {
        const rows = await getAllIssuesForExport({ search: q });
        spec = issuesSheet(rows);
        break;
      }
    }

    const buffer = await buildWorkbookBuffer(spec);
    const stamp = todayStamp();
    const filename = `${FILE_LABELS[exportType]}_${stamp}.xlsx`;
    const asciiFilename = `${FILE_LABELS_ASCII[exportType]}_${stamp}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": contentDisposition(asciiFilename, filename),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: `엑셀 생성 실패: ${message}` },
      { status: 500 }
    );
  }
}
