export const MAX_REQUEST_BODY_BYTES = 4096;

export function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function readBoundedBody(
  request: Request,
): Promise<{ tooLarge: boolean; invalidUtf8: boolean; text: string }> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      return { tooLarge: true, invalidUtf8: false, text: "" };
    }
    if (parsedLength > MAX_REQUEST_BODY_BYTES) {
      return { tooLarge: true, invalidUtf8: false, text: "" };
    }
  }

  if (!request.body) return { tooLarge: false, invalidUtf8: false, text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel();
        return { tooLarge: true, invalidUtf8: false, text: "" };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return {
      tooLarge: false,
      invalidUtf8: false,
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    };
  } catch {
    return { tooLarge: false, invalidUtf8: true, text: "" };
  }
}
