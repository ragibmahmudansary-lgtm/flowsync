export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[100] bg-[#EEF2F6] flex flex-col items-center justify-center">
      <div className="text-4xl font-bold tracking-wide text-[#0F172A]">
        FlowSync
      </div>
      <div className="mt-1 h-1 w-40 rounded bg-gradient-to-r from-[#FF6600] to-amber-400" />
      <div className="mt-3 text-sm text-[#52606D]">
        Preliminary Aircraft Aerodynamic Analysis · v1.0.0-beta
      </div>
      <div className="mt-8 w-72 h-1 rounded bg-slate-300 overflow-hidden">
        <div className="h-full w-2/3 bg-[#FF6600] animate-pulse" />
      </div>
      <div className="mt-4 text-xs text-[#52606D]">
        Initializing workspace, command registry and visualization engine…
      </div>
    </div>
  );
}
