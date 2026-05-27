/**
 * Layout for the public guest-facing booking flow.
 * Distinct route group `(public)` so we don't inherit the
 * authenticated app shell or its session guard.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-card antialiased">
      {children}
    </div>
  );
}
