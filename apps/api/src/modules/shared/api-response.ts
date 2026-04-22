import type { AuthenticatedRequest } from '../auth/authenticated-request.interface';

export function buildApiResponse<T>(request: AuthenticatedRequest, result: T) {
  return {
    ok: true,
    request_id: request.requestId ?? null,
    timestamp: new Date().toISOString(),
    result
  };
}
