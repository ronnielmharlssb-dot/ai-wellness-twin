export class RequestBodyError extends Error {
  constructor(public readonly status: 400 | 413) { super(status === 413 ? "Request body exceeds 16 KiB." : "A valid JSON object is required."); }
}
export async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.body) throw new RequestBodyError(400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > 16_384) { await reader.cancel(); throw new RequestBodyError(413); }
      chunks.push(chunk.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    throw error instanceof RequestBodyError ? error : new RequestBodyError(400);
  } finally { reader.releaseLock(); }
}
