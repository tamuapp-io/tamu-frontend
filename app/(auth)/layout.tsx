export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh grid-cols-1 lg:grid-cols-[1fr_minmax(420px,560px)]">
      <aside className="relative hidden bg-foreground p-12 text-primary-foreground lg:flex lg:flex-col">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary-foreground font-semibold text-foreground">
            T
          </div>
          <span className="text-lg font-semibold">Tamu</span>
        </div>

        <div className="mt-auto space-y-6">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Run service like the front-of-house owns the room.
          </h1>
          <p className="max-w-md text-base text-primary-foreground/70">
            One screen for tonight&apos;s timeline, the floor, and every walk-in.
            Built for restaurants that take reservations seriously.
          </p>
          <ul className="space-y-2 text-sm text-primary-foreground/70">
            <li>• Live timeline + floor plan in one view</li>
            <li>• ≤ 2 taps to seat a guest, anywhere on the floor</li>
            <li>• Multi-tenant, multi-section, multi-language ready</li>
          </ul>
        </div>

        <p className="mt-12 text-xs text-primary-foreground/40">
          © {new Date().getFullYear()} Tamu · Phase 1 preview build
        </p>
      </aside>

      <main className="flex items-center justify-center bg-background p-6 sm:p-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
