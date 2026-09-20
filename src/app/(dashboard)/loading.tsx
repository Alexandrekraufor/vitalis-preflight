/**
 * Skeleton for every dashboard route.
 *
 * `animate-pulse` is dropped for anyone who asked the system to reduce motion;
 * the layout still communicates "content is arriving" without the animation.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>

      <div className="motion-safe:animate-pulse">
        <div className="h-6 w-56 rounded bg-border-subtle" />
        <div className="mt-2 h-4 w-96 max-w-full rounded bg-border-subtle/60" />
      </div>

      <div className="grid grid-cols-1 gap-3 motion-safe:animate-pulse sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="h-24 rounded-[var(--radius-card)] border border-border-subtle bg-surface"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 motion-safe:animate-pulse lg:grid-cols-2">
        <div className="h-64 rounded-[var(--radius-card)] border border-border-subtle bg-surface" />
        <div className="h-64 rounded-[var(--radius-card)] border border-border-subtle bg-surface" />
      </div>
    </div>
  );
}
