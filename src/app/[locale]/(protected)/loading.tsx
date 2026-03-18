export default function ProtectedLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl border bg-card" />
    </div>
  );
}
