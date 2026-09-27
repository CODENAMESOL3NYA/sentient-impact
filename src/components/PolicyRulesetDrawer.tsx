import { ShieldCheck, SlidersHorizontal, ChevronDown, ChevronUp, Users } from 'lucide-react';
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

export function PolicyRulesetDrawer({
  rules,
  isOpen,
  onToggleOpen,
  onToggleRule,
  reviewerApprovals,
  onChangeApprovals,
  findings,
  activeFindingsCount,
}: PolicyRulesetDrawerProps) {
  const enabledCount = rules.filter((r) => r.enabled).length;
  const approvalRule = rules.find((r) => r.requiresMinApprovals);
  const approvalBlocked =
    Boolean(approvalRule?.enabled) &&
    reviewerApprovals < (approvalRule?.requiresMinApprovals ?? 2);

  return (
    <section className="border border-[#1E293B] bg-[#0D131F] rounded-lg overflow-hidden transition-colors">
      {/* Drawer Header Bar */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-[#0D131F]">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex items-center gap-2.5 text-left group cursor-pointer"
        >
          <SlidersHorizontal className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Lead Policy Ruleset
          </span>
          <span className="text-xs font-mono text-slate-400">
            · {enabledCount}/{rules.length} Standards Active
          </span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-200" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-200" />
          )}
        </button>

        {/* Compact Peer Approval Simulator & Gate Status */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Reviewer Approvals:</span>
            <div className="inline-flex rounded border border-[#1E293B] bg-[#090D16] p-0.5 font-mono">
              {[0, 1, 2, 3].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => onChangeApprovals(count)}
                  className={`px-2 py-0.5 rounded text-[11px] cursor-pointer transition-colors ${
                    reviewerApprovals === count
                      ? 'bg-sky-500/20 text-sky-300 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 font-mono text-xs">
            <ShieldCheck
              className={`w-3.5 h-3.5 ${
                approvalBlocked || activeFindingsCount > 0
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            />
            <span
              className={
                approvalBlocked || activeFindingsCount > 0
                  ? 'text-amber-300'
                  : 'text-emerald-300'
              }
            >
              {approvalBlocked
                ? `Needs ${(approvalRule?.requiresMinApprovals ?? 2) - reviewerApprovals} more approval(s)`
                : activeFindingsCount > 0
                ? `${activeFindingsCount} policy violation(s) flagged`
                : 'All active policies satisfied'}
            </span>
          </div>
        </div>
      </div>

      {/* Collapsible Ruleset Configuration Grid */}
      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-[#1E293B] bg-[#090D16]/60">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {rules.map((rule) => {
              const matchingCount = findings.filter((f) =>
                rule.enforcedCategories.includes(f.category)
              ).length;
              const isApprovalUnsatisfied =
                rule.requiresMinApprovals !== undefined &&
                reviewerApprovals < rule.requiresMinApprovals;

              return (
                <label
                  key={rule.id}
                  className={`flex flex-col justify-between p-3 rounded-md border cursor-pointer transition-colors ${
                    rule.enabled
                      ? 'border-sky-500/40 bg-[#131C2E]/80'
                      : 'border-[#1E293B] bg-[#090D16]/50 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono text-[11px] font-semibold text-sky-400">
                        {rule.code}
                      </span>
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => onToggleRule(rule.id)}
                        className="h-3.5 w-3.5 accent-sky-400 rounded cursor-pointer"
                      />
                    </div>
                    <div className="text-xs font-semibold text-slate-100 mb-1">
                      {rule.title}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {rule.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#1E293B]/80 flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-400">Status</span>
                    {!rule.enabled ? (
                      <span className="text-slate-500">Disabled</span>
                    ) : rule.requiresMinApprovals ? (
                      <span
                        className={
                          isApprovalUnsatisfied ? 'text-amber-400' : 'text-emerald-400'
                        }
                      >
                        {reviewerApprovals}/{rule.requiresMinApprovals} Approved
                      </span>
                    ) : matchingCount > 0 ? (
                      <span className="text-rose-400">{matchingCount} Flagged</span>
                    ) : (
                      <span className="text-emerald-400">Passing</span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
