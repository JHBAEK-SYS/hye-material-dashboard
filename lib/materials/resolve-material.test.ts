import { describe, expect, it } from "vitest";

import {
  resolveMaterialsForCodes,
  resolveMaterialsForLines,
  type MaterialCandidate,
  type MaterialLineInput,
} from "@/lib/materials/resolve-material";

describe("resolveMaterialsForCodes", () => {
  it("코드 1건·후보 1건이면 ok, idByCode가 정확하다", () => {
    const candidates: MaterialCandidate[] = [
      { id: 10, mdg_code: "111111", part_no: "P1", manufacturer: "M1", size: null },
    ];
    const result = resolveMaterialsForCodes(["111111"], candidates);
    expect(result).toEqual({
      ok: true,
      idByCode: new Map([["111111", 10]]),
    });
  });

  it("후보 0건이면 기존 문구 그대로 '존재하지 않는 MDG코드: '로 시작하는 에러를 반환한다", () => {
    const result = resolveMaterialsForCodes(["999999"], []);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("존재하지 않는 MDG코드: 999999");
    }
  });

  it("528191 실제 사례 — 같은 mdg_code·같은 제조사, part_no가 다른 2건은 모호 에러에 두 part_no가 모두 들어간다", () => {
    const candidates: MaterialCandidate[] = [
      {
        id: 1,
        mdg_code: "528191",
        part_no: "38SL-1-304",
        manufacturer: "Steel O'Brien",
        size: null,
      },
      {
        id: 2,
        mdg_code: "528191",
        part_no: "38SL-1.5-304",
        manufacturer: "Steel O'Brien",
        size: null,
      },
    ];
    const result = resolveMaterialsForCodes(["528191"], candidates);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        "MDG코드 528191 은(는) 2건이 등록되어 있어 어느 자재인지 정할 수 없습니다: 38SL-1-304 · Steel O'Brien / 38SL-1.5-304 · Steel O'Brien"
      );
    }
  });

  it("604311 실제 사례 — part_no와 manufacturer가 전부 null인 3건은 '(Part No 없음) · (제조사 없음)'로 표기된다", () => {
    const candidates: MaterialCandidate[] = [
      { id: 3, mdg_code: "604311", part_no: null, manufacturer: null, size: null },
      { id: 4, mdg_code: "604311", part_no: null, manufacturer: null, size: null },
      { id: 5, mdg_code: "604311", part_no: null, manufacturer: null, size: null },
    ];
    const result = resolveMaterialsForCodes(["604311"], candidates);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        "MDG코드 604311 은(는) 3건이 등록되어 있어 어느 자재인지 정할 수 없습니다: (Part No 없음) · (제조사 없음) / (Part No 없음) · (제조사 없음) / (Part No 없음) · (제조사 없음)"
      );
    }
  });

  it("없음과 모호가 동시에 있으면 두 메시지가 모두 들어가고 없음이 먼저 온다", () => {
    const candidates: MaterialCandidate[] = [
      {
        id: 1,
        mdg_code: "528191",
        part_no: "38SL-1-304",
        manufacturer: "Steel O'Brien",
        size: null,
      },
      {
        id: 2,
        mdg_code: "528191",
        part_no: "38SL-1.5-304",
        manufacturer: "Steel O'Brien",
        size: null,
      },
    ];
    const result = resolveMaterialsForCodes(["999999", "528191"], candidates);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        "존재하지 않는 MDG코드: 999999\nMDG코드 528191 은(는) 2건이 등록되어 있어 어느 자재인지 정할 수 없습니다: 38SL-1-304 · Steel O'Brien / 38SL-1.5-304 · Steel O'Brien"
      );
    }
  });

  it("후보 6건이면 5건만 나열되고 ' 외 1건'이 붙는다", () => {
    const candidates: MaterialCandidate[] = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      mdg_code: "700000",
      part_no: `P${i + 1}`,
      manufacturer: "M",
      size: null,
    }));
    const result = resolveMaterialsForCodes(["700000"], candidates);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        "MDG코드 700000 은(는) 6건이 등록되어 있어 어느 자재인지 정할 수 없습니다: P1 · M / P2 · M / P3 · M / P4 · M / P5 · M 외 1건"
      );
    }
  });

  it("후보 나열은 id 오름차순이다", () => {
    const candidates: MaterialCandidate[] = [
      { id: 30, mdg_code: "800000", part_no: "C", manufacturer: "M", size: null },
      { id: 10, mdg_code: "800000", part_no: "A", manufacturer: "M", size: null },
      { id: 20, mdg_code: "800000", part_no: "B", manufacturer: "M", size: null },
    ];
    const result = resolveMaterialsForCodes(["800000"], candidates);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        "MDG코드 800000 은(는) 3건이 등록되어 있어 어느 자재인지 정할 수 없습니다: A · M / B · M / C · M"
      );
    }
  });

  it("size가 있으면 표기에 포함된다", () => {
    const candidates: MaterialCandidate[] = [
      { id: 1, mdg_code: "900000", part_no: "P1", manufacturer: "M", size: "1.5" },
      { id: 2, mdg_code: "900000", part_no: "P2", manufacturer: "M", size: null },
    ];
    const result = resolveMaterialsForCodes(["900000"], candidates);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        "MDG코드 900000 은(는) 2건이 등록되어 있어 어느 자재인지 정할 수 없습니다: P1 · M · 규격 1.5 / P2 · M"
      );
    }
  });

  it("ok인 경우 idByCode가 codes 전부를 담는다", () => {
    const candidates: MaterialCandidate[] = [
      { id: 1, mdg_code: "111", part_no: "P1", manufacturer: "M1", size: null },
      { id: 2, mdg_code: "222", part_no: "P2", manufacturer: "M2", size: null },
    ];
    const result = resolveMaterialsForCodes(["111", "222"], candidates);
    expect(result).toEqual({
      ok: true,
      idByCode: new Map([
        ["111", 1],
        ["222", 2],
      ]),
    });
  });
});

describe("resolveMaterialsForLines", () => {
  it("후보 1건이면 part_no가 없어도 ok, ids가 정확하다", () => {
    const candidates: MaterialCandidate[] = [
      { id: 10, mdg_code: "111111", part_no: "P1", manufacturer: "M1", size: null },
    ];
    const lines: MaterialLineInput[] = [{ mdg_code: "111111" }];
    const result = resolveMaterialsForLines(lines, candidates);
    expect(result).toEqual({ ok: true, ids: [10] });
  });

  it("528191 실제 사례 — part_no 없이 2건 후보면 모호 에러, part_no를 지정하면 ok로 해당 id를 반환한다", () => {
    const candidates: MaterialCandidate[] = [
      {
        id: 1,
        mdg_code: "528191",
        part_no: "38SL-1-304",
        manufacturer: "Steel O'Brien",
        size: null,
      },
      {
        id: 2,
        mdg_code: "528191",
        part_no: "38SL-1.5-304",
        manufacturer: "Steel O'Brien",
        size: null,
      },
    ];

    const withoutPartNo = resolveMaterialsForLines(
      [{ mdg_code: "528191" }],
      candidates
    );
    expect(withoutPartNo.ok).toBe(false);
    if (!withoutPartNo.ok) {
      expect(withoutPartNo.error).toBe(
        "MDG코드 528191 은(는) 2건이 등록되어 있습니다. Part No를 함께 입력해 어느 자재인지 지정하세요: 38SL-1-304 · Steel O'Brien / 38SL-1.5-304 · Steel O'Brien"
      );
    }

    const withPartNo = resolveMaterialsForLines(
      [{ mdg_code: "528191", part_no: "38SL-1.5-304" }],
      candidates
    );
    expect(withPartNo).toEqual({ ok: true, ids: [2] });
  });

  it("part_no 대소문자를 무시하고 매칭한다", () => {
    const candidates: MaterialCandidate[] = [
      {
        id: 1,
        mdg_code: "528191",
        part_no: "38SL-1-304",
        manufacturer: "Steel O'Brien",
        size: null,
      },
      {
        id: 2,
        mdg_code: "528191",
        part_no: "38SL-1.5-304",
        manufacturer: "Steel O'Brien",
        size: null,
      },
    ];
    const result = resolveMaterialsForLines(
      [{ mdg_code: "528191", part_no: "38sl-1.5-304" }],
      candidates
    );
    expect(result).toEqual({ ok: true, ids: [2] });
  });

  it("Part No 불일치 — 등록되지 않은 part_no를 지정하면 등록된 Part No 목록이 안내된다", () => {
    const candidates: MaterialCandidate[] = [
      {
        id: 1,
        mdg_code: "528191",
        part_no: "38SL-1-304",
        manufacturer: "Steel O'Brien",
        size: null,
      },
      {
        id: 2,
        mdg_code: "528191",
        part_no: "38SL-1.5-304",
        manufacturer: "Steel O'Brien",
        size: null,
      },
    ];
    const result = resolveMaterialsForLines(
      [{ mdg_code: "528191", part_no: "XYZ" }],
      candidates
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        "MDG코드 528191 에 Part No 'XYZ' 인 자재가 없습니다. 등록된 Part No: 38SL-1-304 · Steel O'Brien / 38SL-1.5-304 · Steel O'Brien"
      );
    }
  });

  it("같은 코드를 서로 다른 part_no로 두 줄 입력하면 서로 다른 id로 해석된다", () => {
    const candidates: MaterialCandidate[] = [
      {
        id: 1,
        mdg_code: "528191",
        part_no: "38SL-1-304",
        manufacturer: "Steel O'Brien",
        size: null,
      },
      {
        id: 2,
        mdg_code: "528191",
        part_no: "38SL-1.5-304",
        manufacturer: "Steel O'Brien",
        size: null,
      },
    ];
    const lines: MaterialLineInput[] = [
      { mdg_code: "528191", part_no: "38SL-1-304" },
      { mdg_code: "528191", part_no: "38SL-1.5-304" },
    ];
    const result = resolveMaterialsForLines(lines, candidates);
    expect(result).toEqual({ ok: true, ids: [1, 2] });
  });

  it("없음과 모호가 동시에 있으면 두 메시지가 모두 들어가고 없음이 먼저 온다", () => {
    const candidates: MaterialCandidate[] = [
      {
        id: 1,
        mdg_code: "528191",
        part_no: "38SL-1-304",
        manufacturer: "Steel O'Brien",
        size: null,
      },
      {
        id: 2,
        mdg_code: "528191",
        part_no: "38SL-1.5-304",
        manufacturer: "Steel O'Brien",
        size: null,
      },
    ];
    const lines: MaterialLineInput[] = [
      { mdg_code: "999999" },
      { mdg_code: "528191" },
    ];
    const result = resolveMaterialsForLines(lines, candidates);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        "존재하지 않는 MDG코드: 999999\nMDG코드 528191 은(는) 2건이 등록되어 있습니다. Part No를 함께 입력해 어느 자재인지 지정하세요: 38SL-1-304 · Steel O'Brien / 38SL-1.5-304 · Steel O'Brien"
      );
    }
  });

  it("같은 코드가 3줄에서 모두 모호하면 메시지에 그 코드 문장이 1번만 나온다", () => {
    const candidates: MaterialCandidate[] = [
      {
        id: 1,
        mdg_code: "528191",
        part_no: "38SL-1-304",
        manufacturer: "Steel O'Brien",
        size: null,
      },
      {
        id: 2,
        mdg_code: "528191",
        part_no: "38SL-1.5-304",
        manufacturer: "Steel O'Brien",
        size: null,
      },
    ];
    const lines: MaterialLineInput[] = [
      { mdg_code: "528191" },
      { mdg_code: "528191" },
      { mdg_code: "528191" },
    ];
    const result = resolveMaterialsForLines(lines, candidates);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const occurrences = result.error.split("MDG코드 528191").length - 1;
      expect(occurrences).toBe(1);
    }
  });

  it("빈 lines 배열이면 { ok: true, ids: [] }를 반환한다", () => {
    const result = resolveMaterialsForLines([], []);
    expect(result).toEqual({ ok: true, ids: [] });
  });
});
