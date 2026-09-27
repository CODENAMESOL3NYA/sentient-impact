import React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

export type AnalysisStage = 'hashing' | 'subagents' | 'topology';

interface LoadingSkeletonHudProps {
  stage: AnalysisStage;
  perspective: 'developer' | 'release';
}

const STAGES: Array<{ id: AnalysisStage; label: string; detail: string }> = [
  {
    id: 'hashing',
    label: 'Hashing Diff...',
    detail: 'Normalizing unified diff & computing SHA-256 deduplication key',
  },
  {
    id: 'subagents',
    label: 'Running Subagents...',
    detail: 'Executing Agent A (Coach) & Agent B (Radar) concurrently via Promise.all',
  },
  {
    id: 'topology',
    label: 'Building Topology...',
    detail: 'Calculating 4-factor risk index & mapping downstream blast radius',
  },
];

export const LoadingSkeletonHud: React.FC<LoadingSkeletonHudProps> = ({
  stage,
  perspective,
}) => {
  const activeIdx = STAGES.findIndex((s) => s.id === stage);

  return (
    <div className="space-y-5">
      {/* Multi-Stage Micro Step Indicator Bar */}
      <div className="border border-[#1E293B] bg-[#0D131F] rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STAGES.map((step, idx) => {
            const isDone = idx < activeIdx;
            const isCurrent = idx === activeIdx;

            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 p-3 rounded border transition-colors ${
                  isCurrent
                    ? 'bg-[#090D16] border-sky-500/50'
                    : isDone
                    ? 'bg-[#090D16]/60 border-emerald-500/30'
                    : 'bg-[#090D16]/30 border-[#1E293B] opacity-60'
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
                  <div
                    className={`text-xs font-mono font-semibold ${
                      isCurrent
                        ? 'text-sky-300'
                        : isDone
                        ? 'text-emerald-300'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    {step.detail}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skeleton Card Loaders matching perspective layout */}
      {perspective === 'developer' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-8 space-y-4">
            {[1, 2].map((block) => (
              <div
                key={block}
                className="border border-[#1E293B] bg-[#0D131F] rounded-lg overflow-hidden animate-pulse"
              >
                <div className="h-10 bg-[#090D16] border-b border-[#1E293B] px-4 flex items-center justify-between">
                  <div className="h-3 w-48 bg-slate-800 rounded" />
                  <div className="h-3 w-24 bg-slate-800 rounded" />
                </div>
                <div className="p-4 space-y-2.5">
                  <div className="h-3 w-3/4 bg-slate-800/80 rounded" />
                  <div className="h-3 w-5/6 bg-slate-800/80 rounded" />
                  <div className="h-24 w-full bg-[#090D16] border border-[#1E293B] rounded mt-3 p-3 space-y-2">
                    <div className="h-3 w-1/3 bg-slate-800 rounded" />
                    <div className="h-3 w-2/3 bg-slate-800 rounded" />
                    <div className="h-8 w-full bg-slate-900 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="xl:col-span-4 border border-[#1E293B] bg-[#0D131F] rounded-lg p-4 space-y-4 animate-pulse">
            <div className="h-4 w-40 bg-slate-800 rounded" />
            <div className="h-16 w-full bg-[#090D16] rounded border border-[#1E293B]" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-14 bg-[#090D16] rounded border border-[#1E293B]" />
              <div className="h-14 bg-[#090D16] rounded border border-[#1E293B]" />
              <div className="h-14 bg-[#090D16] rounded border border-[#1E293B]" />
            </div>
            <div className="h-44 w-full bg-[#090D16] rounded border border-[#1E293B]" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 animate-pulse">
          <div className="xl:col-span-4 h-80 border border-[#1E293B] bg-[#0D131F] rounded-lg p-5 space-y-4">
            <div className="h-4 w-44 bg-slate-800 rounded" />
            <div className="h-20 w-full bg-[#090D16] rounded border border-[#1E293B]" />
            <div className="space-y-3">
              <div className="h-3 w-full bg-slate-800 rounded" />
              <div className="h-3 w-full bg-slate-800 rounded" />
              <div className="h-3 w-full bg-slate-800 rounded" />
            </div>
          </div>
          <div className="xl:col-span-8 h-80 border border-[#1E293B] bg-[#0D131F] rounded-lg p-5" />
        </div>
      )}
    </div>
  );
};
