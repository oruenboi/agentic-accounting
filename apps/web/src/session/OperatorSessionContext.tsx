import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { clearSessionStorage, loadSession, saveSession, type OperatorSession } from '../lib/session';

interface OperatorSessionContextValue {
  session: OperatorSession | null;
  setSession: (session: OperatorSession) => void;
  clearSession: () => void;
}

const OperatorSessionContext = createContext<OperatorSessionContextValue | undefined>(undefined);

export function OperatorSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<OperatorSession | null>(() => loadSession());

  const value = useMemo<OperatorSessionContextValue>(
    () => ({
      session,
      setSession(nextSession) {
        saveSession(nextSession);
        setSessionState(nextSession);
      },
      clearSession() {
        clearSessionStorage();
        setSessionState(null);
      }
    }),
    [session]
  );

  return <OperatorSessionContext.Provider value={value}>{children}</OperatorSessionContext.Provider>;
}

export function useOperatorSession() {
  const context = useContext(OperatorSessionContext);

  if (context === undefined) {
    throw new Error('useOperatorSession must be used inside OperatorSessionProvider.');
  }

  return context;
}
