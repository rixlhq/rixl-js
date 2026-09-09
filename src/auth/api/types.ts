export interface ApiErrorContext {
  status: number;
  endpoint: string;
  data?: unknown;
}

/**
 * Generic API error class - wraps ky's HTTPError for consistency
 */
export class ApiError extends Error {
  public status: number;
  public endpoint: string;
  public data?: unknown;

  constructor(message: string, ...rest: [number, string?, unknown?] | [ApiErrorContext]) {
    super(message);
    this.name = "ApiError";

    const firstArg = rest[0];
    if (typeof firstArg === "number") {
      this.status = firstArg;
      this.endpoint = rest[1] ?? "";
      this.data = rest[2];
      return;
    }

    this.status = firstArg.status;
    this.endpoint = firstArg.endpoint;
    this.data = firstArg.data;
  }
}
