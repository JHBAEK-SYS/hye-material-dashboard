/**
 * Content-Disposition 헤더 값 생성.
 *
 * HTTP 헤더 값은 ByteString(latin-1, 코드포인트 0~255)만 담을 수 있어
 * 한글 등 비ASCII 문자를 `filename="..."`(구형 브라우저용 fallback)에
 * 그대로 넣으면 런타임에서 "Cannot convert argument to a ByteString" 에러가
 * 발생한다. fallback은 ASCII로만 구성하고, 실제 한글 파일명은
 * RFC 5987 퍼센트 인코딩된 `filename*=UTF-8''...`에 담아 최신 브라우저가
 * 이를 사용하도록 한다.
 */

/** fallback 파일명에서 헤더를 깨뜨릴 수 있는 문자(큰따옴표, CR, LF, 비ASCII)를 제거한다. */
function sanitizeAsciiFilename(name: string): string {
  return [...name]
    .filter((c) => {
      const code = c.codePointAt(0)!;
      if (code > 127) return false; // 비ASCII 제외
      if (c === '"' || c === "\r" || c === "\n") return false; // 헤더 인젝션 방지 문자 제외
      return true;
    })
    .join("");
}

export function contentDisposition(asciiName: string, utf8Name: string): string {
  const safeAsciiName = sanitizeAsciiFilename(asciiName);
  return `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(
    utf8Name
  )}`;
}
