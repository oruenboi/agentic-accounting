import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

export function AuditHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-black/45">Audit</p>
        <h2 className="mt-2 font-serif text-4xl text-ink">Entity timelines</h2>
        <p className="mt-3 max-w-3xl text-sm text-black/65">
          Open audit from proposal, approval, and posted-entry detail routes to keep traceability tied to workflow context.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How to use this slice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-black/68">
          <p>Audit is context-first in the first milestone. Use links from a proposal, approval, or journal entry to open a concrete entity timeline.</p>
          <p>
            For a working seed example, open the draft timeline from the
            {' '}
            <Link className="font-semibold text-accent" to="/proposals">
              proposals queue
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
