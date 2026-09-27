import { CheckCircle2, Loader2 } from 'lucide-react';

export type AnalysisStage = 'hashing' | 'subagents' | 'topology';

interface LoadingSkeletonHudProps {
  stage: AnalysisStage;
  perspective: 'developer' | 'release';
}

const STAGES: { id: AnalysisStage; label: string; detail: string }[] = [
  {
    id: 'hashing',
    label: 'Hashing Diff...',
    detail: 'Computing deterministic SHA-256 fingerprint & checking deduplication cache',
  },
  {
    id: 'subagents',
    label: 'Running Subagents...',
    detail: 'Executing Agent A (Blindspot Coach) & Agent B (Blast-Radius Radar) in parallel',
  },
  {
    id: 'topology',
    label: 'Building Topology...',
    detail: 'Synthesizing downstream dependency graph, risk index & rollback runbook',
  },
];

export function LoadingSkeletonHud({ stage, perspective }: LoadingSkeletonHudProps) {
  const activeIdx = STAGES.findIndex((s) => s.id === stage);

  return (
    <div className="space-y-4">
      {/* Multi-Stage Micro Step Indicator Bar */}
      <div className="border border-[#1E293B] bg-[#0D131F] rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {STAGES.map((item, idx) => {
            const isDone = idx < activeIdx;
            const isCurrent = idx === activeIdx;

            return (
              <div
                key={item.id}
                className={`flex items-start gap-2.5 flex-1 p-2.5 rounded-md border transition-colors ${
                  isCurrent
                    ? 'border-sky-500/50 bg-[#131C2E]'
                    : isDone
                    ? 'border-emerald-500/30 bg-emerald-950/10'
                    : 'border-[#1E293B] bg-[#090D16]/50 opacity-50'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-600" />
                  )}
                </div>
                <div>
                  <div className="font-mono text-xs font-semibold text-slate-100">
                    {item.label}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-snug mt-0.5">
                    {item.detail}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Layout-Matched Skeleton Card Loaders */}
      {perspective === 'developer' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 border border-[#1E293B] bg-[#0D131F] rounded-lg p-4 space-y-3 animate-pulse">
            <div className="h-4 w-56 bg-slate-800 rounded" />
            <div className="space-y-2 pt-2">
              <div className="h-3 w-full bg-slate-800/80 rounded" />
              <div className="h-3 w-11/12 bg-slate-800/80 rounded" />
              <div className="h-20 w-full bg-slate-800/50 border border-slate-700/50 rounded-md my-2" />
              <div className="h-3 w-10/12 bg-slate-800/80 rounded" />
              <div className="h-3 w-9/12 bg-slate-800/80 rounded" />
            </div>
          </div>
          <div className="lg:col-span-4 border border-[#1E293B] bg-[#0D131F] rounded-lg p-4 space-y-3 animate-pulse">
            <div className="h-4 w-40 bg-slate-800 rounded" />
            <div className="h-16 w-full bg-slate-800/60 rounded" />
            <div className="h-24 w-full bg-slate-800/60 rounded" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 border border-[#1E293B] bg-[#0D131F] rounded-lg p-4 space-y-3 animate-pulse">
            <div className="h-4 w-44 bg-slate-800 rounded" />
            <div className="h-14 w-28 bg-slate-800 rounded" />
            <div className="space-y-2 pt-2">
              <div className="h-2.5 w-full bg-slate-800 rounded" />
              <div className="h-2.5 w-full bg-slate-800 rounded" />
              <div className="h-2.5 w-full bg-slate-800 rounded" />
              <div className="h-2.5 w-full bg-slate-800 rounded" />
            </div>
          </div>
          <div className="lg:col-span-8 border border-[#1E293B] bg-[#0D131F] rounded-lg p-4 space-y-3 animate-pulse">
            <div className="h-4 w-52 bg-slate-800 rounded" />
            <div className="h-56 w-full bg-slate-800/50 rounded" />
          </div>
        </div>
      )}
    </div>
  );
}
