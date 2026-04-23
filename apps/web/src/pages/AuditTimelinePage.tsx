import { useParams } from 'react-router-dom';
import { getEntityTimeline } from '../lib/api';
import { useOperatorSession } from '../session/OperatorSessionContext';
import { useAsyncData } from './useAsyncData';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { formatDateTime } from '../lib/format';

export function AuditTimelinePage() {
  const { entityType = '', entityId = '' } = useParams();
  const { session } = useOperatorSession();
  const { data, loading, error } = useAsyncData(() => getEntityTimeline(session!, entityType, entityId), [session, entityType, entityId]);

  if (loading) {
    return <LoadingState label="Loading entity timeline…" />;
  }

  if (error !== null) {
    return <ErrorState title="Timeline load failed" body={error} />;
  }

  if (data === null || data.length === 0) {
    return <EmptyState title="No timeline events" body="This entity has no timeline events for the active operator session." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-black/45">Audit timeline</p>
        <h2 className="mt-2 font-serif text-4xl text-ink">{entityType.replaceAll('_', ' ')} history</h2>
        <p className="mt-3 max-w-3xl text-sm text-black/65">Entity {entityId}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ordered event history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.map((event) => (
            <div key={event.eventId} className="rounded-3xl border border-black/8 bg-black/[0.02] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">{event.eventName}</p>
                  <p className="mt-1 text-xs text-black/55">
                    {event.actor.actorDisplayName ?? event.actor.actorId ?? 'Unknown actor'} · {formatDateTime(event.eventTimestamp)}
                  </p>
                </div>
                {event.actionStatus ? <Badge value={event.actionStatus} /> : null}
              </div>
              <p className="mt-3 text-sm text-black/68">{event.summary ?? 'No human summary recorded.'}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
