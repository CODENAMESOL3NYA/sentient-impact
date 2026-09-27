import React from 'react';
import { SlidersHorizontal, ChevronDown, ChevronUp, CheckSquare, Square, Users } from 'lucide-react';
import type { PolicyRule } from '../services/sentinelApi';
import type { CoachFinding } from '../types/sentinal';

interface PolicyRulesetDrawerProps {
  rules: PolicyRule[];
  isOpen: boolean;
  onToggleOpen: () => void;
  onToggleRule: (ruleId: string) => void;
  reviewerApprovals: number;
  onChangeApprovals: (count: number) => void;
  findings: CoachFinding[];
  activeFindingsCount: number;
}

export const PolicyRulesetDrawer: React.FC<PolicyRulesetDrawerProps> = ({
  rules,
  isOpen,
  onToggleOpen,
  onToggleRule,
  reviewerApprovals,
  onChangeApprovals,
  findings,
  activeFindingsCount,
}) => {
  const enabledCount = rules.filter((r) => r.enabled).length;
  const govRuleEnabled = rules.find((r) => r.isGovernanceRule)?.enabled ?? false;
  const approvalGatePassed = !govRuleEnabled || reviewerApprovals >= 2;

  return (
    <section className="border border-[#1E293B] bg-[#0D131F] rounded-lg overflow-hidden">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#090D16]/60 border-b border-[#1E293B]">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex items-center gap-3 text-left group focus:outline-none"
        >
          <SlidersHorizontal className="w-4 h-4 text-sky-400 shrink-0" />
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-slate-100 group-hover:text-sky-300 transition-colors">
                Lead Policy Ruleset
              </span>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {enabledCount}/{rules.length} active standards
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-xs font-mono tabular-nums text-amber-300">
                {activeFindingsCount} inline flags
              </span>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-4">
          {/* Reviewer Approvals Simulator Control */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>Peer Approvals:</span>
            <div className="inline-flex items-center border border-[#1E293B] bg-[#090D16] rounded p-0.5 font-mono tabular-nums">
              {[0, 1, 2, 3].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => onChangeApprovals(count)}
                  className={`px-2 py-0.5 text-xs rounded transition-colors whitespace-nowrap ${
                    reviewerApprovals === count
                      ? count >= 2
                        ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                        : 'bg-amber-500/20 text-amber-300 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
            <span
              className={`font-mono text-xs ${
                approvalGatePassed ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {approvalGatePassed ? 'Gate met' : 'Needs 2+'}
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleOpen}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-[#131C2E] border border-[#1E293B] rounded transition-colors whitespace-nowrap"
          >
            <span>{isOpen ? 'Collapse Rules' : 'Configure Ruleset'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Collapsible Rules Grid */}
      {isOpen && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 bg-[#0D131F]">
          {rules.map((rule) => {
            const matchedViolationCount = rule.isGovernanceRule
              ? reviewerApprovals < 2
                ? 1
                : 0
              : findings.filter((f) => rule.enforcedCategories.includes(f.category)).length;

            return (
              <button
                key={rule.id}
                type="button"
                onClick={() => onToggleRule(rule.id)}
                className={`flex flex-col justify-between p-3 rounded border text-left transition-colors ${
                  rule.enabled
                    ? 'bg-[#090D16] border-sky-500/40 hover:border-sky-400/60'
                    : 'bg-[#090D16]/40 border-[#1E293B] opacity-60 hover:opacity-90'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs font-semibold text-sky-400">
                      {rule.code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {rule.enabled && matchedViolationCount > 0 && (
                        <span className="text-[11px] font-mono tabular-nums text-rose-400">
                          {matchedViolationCount} {matchedViolationCount === 1 ? 'hit' : 'hits'}
                        </span>
                      )}
                      {rule.enabled ? (
                        <CheckSquare className="w-4 h-4 text-sky-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-slate-100 mb-1 leading-snug">
                    {rule.name}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {rule.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
