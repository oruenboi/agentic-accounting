import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, TextInput } from '../components/ui/Field';
import { useOperatorSession } from '../session/OperatorSessionContext';

export function SessionPage({ onSaved }: { onSaved?: () => void }) {
  const navigate = useNavigate();
  const { session, setSession } = useOperatorSession();
  const [apiBaseUrl, setApiBaseUrl] = useState(
    session?.apiBaseUrl ?? import.meta.env.VITE_DEFAULT_API_BASE_URL ?? 'https://api.nexiuslabs.com'
  );
  const [bearerToken, setBearerToken] = useState(session?.bearerToken ?? '');
  const [organizationId, setOrganizationId] = useState(session?.organizationId ?? '10000000-0000-4000-8000-000000000003');
  const [periodId, setPeriodId] = useState(session?.periodId ?? '');

  return (
    <div className="grain flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-4xl overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-ink px-8 py-10 text-paper">
            <p className="text-xs uppercase tracking-[0.24em] text-paper/45">Alpha operator bootstrap</p>
            <h1 className="mt-4 font-serif text-4xl">Connect the console to the live control plane.</h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-paper/72">
              This first UI slice uses a manual operator session so you can inspect the live accounting workflow immediately. Paste a valid bearer token and the active organization context, then the console routes directly onto the existing tool API.
            </p>
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-paper/72">
              <p className="font-semibold text-paper">First slice included</p>
              <ul className="mt-3 space-y-2">
                <li>Dashboard triage</li>
                <li>Proposal queue and draft inspection</li>
                <li>Approval queue with resolve and escalate controls</li>
                <li>Posted-entry explorer and audit timeline</li>
              </ul>
            </div>
          </div>

          <div className="bg-white/85 px-6 py-8">
            <CardHeader className="px-0 pt-0">
              <CardTitle>Session context</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSession({
                    apiBaseUrl,
                    bearerToken,
                    organizationId,
                    periodId: periodId || undefined
                  });
                  onSaved?.();
                  navigate('/dashboard');
                }}
              >
                <Field label="API base URL">
                  <TextInput value={apiBaseUrl} onChange={(event) => setApiBaseUrl(event.target.value)} required />
                </Field>
                <Field label="Bearer token" hint="Use a Supabase access token for a user with organization access.">
                  <TextInput value={bearerToken} onChange={(event) => setBearerToken(event.target.value)} required />
                </Field>
                <Field label="Organization ID">
                  <TextInput value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} required />
                </Field>
                <Field label="Period ID (optional)">
                  <TextInput value={periodId} onChange={(event) => setPeriodId(event.target.value)} />
                </Field>
                <Button className="w-full" type="submit">
                  Open operator console
                </Button>
              </form>
            </CardContent>
          </div>
        </div>
      </Card>
    </div>
  );
}
