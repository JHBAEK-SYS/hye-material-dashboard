/**
 * MDG코드 → material_id 해석. 순수 함수 — DB 접근 없이 이미 조회된 후보
 * 배열(candidates, `.in("mdg_code", codes)` 결과)만 다룬다.
 *
 * `materials` 테이블에는 mdg_code 유니크 제약이 없어 같은 mdg_code를 가진
 * 행이 여러 건 존재할 수 있다. 그런 코드를 단순 Map으로 처리하면 나중에
 * 읽힌 행이 앞의 것을 조용히 덮어써 엉뚱한 자재에 수량이 붙는다. 이 모듈은
 * 그 상황을 "모호"로 판정해 명확한 에러로 막는다.
 */

export type MaterialCandidate = {
  id: number;
  mdg_code: string | null;
  part_no: string | null;
  manufacturer: string | null;
  size: string | null;
};

export type ResolveManyResult =
  | { ok: true; idByCode: Map<string, number> }
  | { ok: false; error: string };

const MAX_LISTED_CANDIDATES = 5;

/** 후보 1건의 표기: `part_no · manufacturer`(+ ` · 규격 X`). null/빈문자열은 안내 문구로 대체. */
function formatCandidate(candidate: MaterialCandidate): string {
  const part = candidate.part_no?.trim() || "(Part No 없음)";
  const manufacturer = candidate.manufacturer?.trim() || "(제조사 없음)";
  const size = candidate.size?.trim();
  const base = `${part} · ${manufacturer}`;
  return size ? `${base} · 규격 ${size}` : base;
}

/** 한 코드의 모호 후보 목록을 id 오름차순으로 정렬해 문구로 이어붙인다 (최대 5건, 초과분은 "외 N건"). */
function formatCandidateList(candidates: MaterialCandidate[]): string {
  const sorted = [...candidates].sort((a, b) => a.id - b.id);
  const shown = sorted.slice(0, MAX_LISTED_CANDIDATES);
  const overflow = sorted.length - shown.length;
  const listed = shown.map(formatCandidate).join(" / ");
  return overflow > 0 ? `${listed} 외 ${overflow}건` : listed;
}

/**
 * 코드 목록과 (이미 `.in("mdg_code", codes)`로 조회된) 후보 목록을 받아
 * 코드별 유일 id를 해석한다.
 *
 * - 코드 매칭은 trim 후 정확히 일치(대소문자 변환하지 않음 — 기존 동작 유지).
 * - 후보 0건인 코드가 있으면 "존재하지 않는 MDG코드: ..." (기존 문구 그대로).
 * - 후보 2건 이상인 코드가 있으면 코드별 모호 문구를 개행으로 이어붙인다.
 * - 둘 다 있으면 없음 메시지 먼저, 개행, 그다음 모호 메시지.
 * - 둘 다 없으면 { ok: true, idByCode }.
 */
export function resolveMaterialsForCodes(
  codes: string[],
  candidates: MaterialCandidate[]
): ResolveManyResult {
  const byCode = new Map<string, MaterialCandidate[]>();
  for (const candidate of candidates) {
    const key = (candidate.mdg_code ?? "").trim();
    const list = byCode.get(key);
    if (list) {
      list.push(candidate);
    } else {
      byCode.set(key, [candidate]);
    }
  }

  const missing: string[] = [];
  const ambiguous: { code: string; candidates: MaterialCandidate[] }[] = [];
  const idByCode = new Map<string, number>();

  for (const code of codes) {
    const list = byCode.get(code) ?? [];
    if (list.length === 0) {
      missing.push(code);
    } else if (list.length > 1) {
      ambiguous.push({ code, candidates: list });
    } else {
      idByCode.set(code, list[0].id);
    }
  }

  if (missing.length === 0 && ambiguous.length === 0) {
    return { ok: true, idByCode };
  }

  const messages: string[] = [];
  if (missing.length > 0) {
    messages.push(`존재하지 않는 MDG코드: ${missing.join(", ")}`);
  }
  if (ambiguous.length > 0) {
    const ambiguousMessage = ambiguous
      .map(
        ({ code, candidates: cands }) =>
          `MDG코드 ${code} 은(는) ${cands.length}건이 등록되어 있어 어느 자재인지 정할 수 없습니다: ${formatCandidateList(cands)}`
      )
      .join("\n");
    messages.push(ambiguousMessage);
  }

  return { ok: false, error: messages.join("\n") };
}

export type MaterialLineInput = { mdg_code: string; part_no?: string };

export type ResolveLinesResult =
  | { ok: true; ids: number[] }
  | { ok: false; error: string };

/**
 * 전표의 품목 줄(mdg_code + 선택적 part_no) 목록과 (이미 `.in("mdg_code", codes)`로
 * 조회된) 후보 목록을 받아 줄마다 유일 material_id를 해석한다. 같은 mdg_code라도
 * 줄마다 part_no가 다를 수 있으므로 코드 단위가 아니라 줄 단위로 판정한다.
 *
 * - 후보 0건 → "없음"
 * - 후보 1건 → part_no 유무와 무관하게 그 id 사용
 * - 후보 2건 이상, part_no 없음 → "모호"
 * - 후보 2건 이상, part_no로 좁혀 정확히 1건 → 그 id 사용
 * - 후보 2건 이상, part_no로 좁혀 0건 → "Part No 불일치"
 * - 후보 2건 이상, part_no로 좁혀도 2건 이상 → "모호"
 *
 * 같은 코드가 여러 줄에서 같은 종류의 문제를 내면 코드당 한 번만 메시지에 담는다.
 * 메시지 순서: 없음 → 모호 → Part No 불일치, 개행으로 이어붙인다.
 */
export function resolveMaterialsForLines(
  lines: MaterialLineInput[],
  candidates: MaterialCandidate[]
): ResolveLinesResult {
  const byCode = new Map<string, MaterialCandidate[]>();
  for (const candidate of candidates) {
    const key = (candidate.mdg_code ?? "").trim();
    const list = byCode.get(key);
    if (list) {
      list.push(candidate);
    } else {
      byCode.set(key, [candidate]);
    }
  }

  const ids: number[] = new Array(lines.length);
  let hasError = false;

  const missingCodes: string[] = [];
  const missingSeen = new Set<string>();

  const ambiguous: { code: string; candidates: MaterialCandidate[] }[] = [];
  const ambiguousSeen = new Set<string>();

  const mismatched: { code: string; partNo: string; candidates: MaterialCandidate[] }[] = [];
  const mismatchedSeen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const code = lines[i].mdg_code;
    const list = byCode.get(code) ?? [];

    if (list.length === 0) {
      hasError = true;
      if (!missingSeen.has(code)) {
        missingSeen.add(code);
        missingCodes.push(code);
      }
      continue;
    }

    if (list.length === 1) {
      ids[i] = list[0].id;
      continue;
    }

    const partNo = lines[i].part_no?.trim();
    if (!partNo) {
      hasError = true;
      if (!ambiguousSeen.has(code)) {
        ambiguousSeen.add(code);
        ambiguous.push({ code, candidates: list });
      }
      continue;
    }

    const narrowed = list.filter(
      (c) => (c.part_no ?? "").trim().toLowerCase() === partNo.toLowerCase()
    );

    if (narrowed.length === 1) {
      ids[i] = narrowed[0].id;
      continue;
    }

    if (narrowed.length === 0) {
      hasError = true;
      if (!mismatchedSeen.has(code)) {
        mismatchedSeen.add(code);
        mismatched.push({ code, partNo, candidates: list });
      }
      continue;
    }

    hasError = true;
    if (!ambiguousSeen.has(code)) {
      ambiguousSeen.add(code);
      ambiguous.push({ code, candidates: list });
    }
  }

  if (!hasError) {
    return { ok: true, ids };
  }

  const messages: string[] = [];
  if (missingCodes.length > 0) {
    messages.push(`존재하지 않는 MDG코드: ${missingCodes.join(", ")}`);
  }
  if (ambiguous.length > 0) {
    const ambiguousMessage = ambiguous
      .map(
        ({ code, candidates: cands }) =>
          `MDG코드 ${code} 은(는) ${cands.length}건이 등록되어 있습니다. Part No를 함께 입력해 어느 자재인지 지정하세요: ${formatCandidateList(cands)}`
      )
      .join("\n");
    messages.push(ambiguousMessage);
  }
  if (mismatched.length > 0) {
    const mismatchedMessage = mismatched
      .map(
        ({ code, partNo, candidates: cands }) =>
          `MDG코드 ${code} 에 Part No '${partNo}' 인 자재가 없습니다. 등록된 Part No: ${formatCandidateList(cands)}`
      )
      .join("\n");
    messages.push(mismatchedMessage);
  }

  return { ok: false, error: messages.join("\n") };
}
