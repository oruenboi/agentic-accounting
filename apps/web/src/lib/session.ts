export interface OperatorSession {
  apiBaseUrl: string;
  bearerToken: string;
  organizationId: string;
  periodId?: string;
}

export const SESSION_STORAGE_KEY = 'agentic-accounting.operator-session';

export function loadSession(): OperatorSession | null {
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (raw === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<OperatorSession>;

    if (
      typeof parsed.apiBaseUrl !== 'string' ||
      typeof parsed.bearerToken !== 'string' ||
      typeof parsed.organizationId !== 'string'
    ) {
      return null;
    }

    return {
      apiBaseUrl: parsed.apiBaseUrl,
      bearerToken: parsed.bearerToken,
      organizationId: parsed.organizationId,
      periodId: typeof parsed.periodId === 'string' && parsed.periodId.length > 0 ? parsed.periodId : undefined
    };
  } catch {
    return null;
  }
}

export function saveSession(session: OperatorSession) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSessionStorage() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}
