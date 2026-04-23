export function LoadingState({ label = 'Loading operator data…' }: { label?: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-black/10 bg-white/40 px-5 py-10 text-sm text-black/60">
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  body
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-black/12 bg-white/40 px-5 py-10">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm text-black/65">{body}</p>
    </div>
  );
}

export function ErrorState({
  title = 'Something failed',
  body
}: {
  title?: string;
  body: string;
}) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2">{body}</p>
    </div>
  );
}
