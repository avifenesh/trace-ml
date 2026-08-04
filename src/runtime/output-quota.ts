import { RUNTIME_PROTOCOL_LIMITS } from "./protocol";

type OutputStream = "stdout" | "stderr";

export interface TruncatedUtf8 {
  text: string;
  truncated: boolean;
  bytes: number;
}

export function truncateUtf8(
  value: string,
  maxBytes: number,
): TruncatedUtf8 {
  const limit = Math.max(0, Math.floor(maxBytes));
  if (value.length === 0) {
    return { text: "", truncated: false, bytes: 0 };
  }
  if (limit === 0) {
    return { text: "", truncated: true, bytes: 0 };
  }

  const buffer = new Uint8Array(limit);
  const { read, written } = new TextEncoder().encodeInto(value, buffer);
  return {
    text: new TextDecoder().decode(buffer.subarray(0, written)),
    truncated: read < value.length,
    bytes: written,
  };
}

export class Utf8TextQuota {
  #remainingBytes: number;
  #truncated = false;

  constructor(maxBytes: number) {
    this.#remainingBytes = Math.max(0, Math.floor(maxBytes));
  }

  get truncated() {
    return this.#truncated;
  }

  take(value: string) {
    const result = truncateUtf8(value, this.#remainingBytes);
    this.#remainingBytes -= result.bytes;
    if (result.truncated) this.#truncated = true;
    return result.text;
  }
}

export class OutputQuota {
  readonly #maxBytes: number;
  readonly #maxLines: number;
  readonly #maxChunks: number;
  readonly #decoders = {
    stdout: new TextDecoder("utf-8", { fatal: true }),
    stderr: new TextDecoder("utf-8", { fatal: true }),
  };
  readonly #output = {
    stdout: "",
    stderr: "",
  };
  readonly #chunks: Array<{ stream: OutputStream; text: string }> = [];
  #acceptedBytes = 0;
  #bytesProduced = 0;
  #lineCount = 0;
  #lineLimitReached = false;
  #chunkLimitReached = false;
  #truncated = false;

  constructor(
    maxBytes: number,
    maxLines: number,
    maxChunks: number = RUNTIME_PROTOCOL_LIMITS.maxOutputChunks,
  ) {
    this.#maxBytes = Math.max(1, maxBytes);
    this.#maxLines = Math.max(1, maxLines);
    this.#maxChunks = Math.max(1, maxChunks);
  }

  write(stream: OutputStream, buffer: Uint8Array) {
    this.#bytesProduced += buffer.byteLength;
    if (this.#chunkLimitReached) {
      this.#truncated = true;
      return buffer.byteLength;
    }
    const remainingBytes = this.#maxBytes - this.#acceptedBytes;
    if (remainingBytes <= 0) {
      this.#truncated = true;
      return buffer.byteLength;
    }

    const accepted = buffer.subarray(
      0,
      Math.min(buffer.byteLength, remainingBytes),
    );
    this.#acceptedBytes += accepted.byteLength;
    if (accepted.byteLength < buffer.byteLength) this.#truncated = true;
    try {
      this.#append(stream, this.#decoders[stream].decode(accepted, {
        stream: true,
      }));
    } catch {
      this.#truncated = true;
      this.#decoders[stream] = new TextDecoder("utf-8", { fatal: true });
    }
    return buffer.byteLength;
  }

  finish() {
    for (const stream of ["stdout", "stderr"] as const) {
      try {
        this.#append(stream, this.#decoders[stream].decode());
      } catch {
        this.#truncated = true;
      }
    }
    return {
      stdout: this.#output.stdout,
      stderr: this.#output.stderr,
      output: [...this.#chunks],
      outputTruncated: this.#truncated,
      bytesProduced: this.#bytesProduced,
    };
  }

  #append(stream: OutputStream, value: string) {
    if (!value || this.#lineLimitReached || this.#chunkLimitReached) {
      if (value) this.#truncated = true;
      return;
    }
    const previous = this.#chunks.at(-1);
    if (
      previous &&
      previous.stream !== stream &&
      this.#chunks.length >= this.#maxChunks
    ) {
      this.#chunkLimitReached = true;
      this.#truncated = true;
      return;
    }

    if (this.#lineCount === 0) this.#lineCount = 1;
    let end = value.length;
    for (let index = 0; index < value.length; index += 1) {
      if (value[index] !== "\n") continue;
      if (this.#lineCount >= this.#maxLines) {
        end = index;
        this.#lineLimitReached = true;
        this.#truncated = true;
        break;
      }
      this.#lineCount += 1;
    }
    const accepted = value.slice(0, end);
    this.#output[stream] += accepted;
    if (accepted) {
      if (previous?.stream === stream) {
        previous.text += accepted;
      } else {
        this.#chunks.push({ stream, text: accepted });
      }
    }
  }
}
