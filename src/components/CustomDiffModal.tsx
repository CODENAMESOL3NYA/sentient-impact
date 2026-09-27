import React, { useState } from 'react';
import { X, Play, FileCode } from 'lucide-react';

interface CustomDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunCustomDiff: (title: string, diffText: string, bypassCache: boolean) => void;
}

const SAMPLE_JWT_DIFF = `diff --git a/custom/auth.ts b/custom/auth.ts
--- a/custom/auth.ts
+++ b/custom/auth.ts
@@ -10,7 +10,7 @@ export function authenticateSession(token: string, secret: string) {
-  return jwt.verify(token, secret, { algorithms: ["HS256"] });
+  // Bypassing algorithm check for legacy tokens
+  return jwt.verify(token, secret);
 }`;

export const CustomDiffModal: React.FC<CustomDiffModalProps> = ({
  isOpen,
  onClose,
  onRunCustomDiff,
}) => {
  const [title, setTitle] = useState('hotfix(auth): Custom JWT Verification Patch');
  const [diffText, setDiffText] = useState(SAMPLE_JWT_DIFF);
  const [bypassCache, setBypassCache] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!diffText.trim()) return;
    onRunCustomDiff(title.trim() || 'Custom Git Diff', diffText, bypassCache);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-2xl bg-[#0D131F] border border-[#1E293B] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1E293B] bg-[#090D16]">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              Analyze Custom Unified Git Diff
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              PR / Patch Context Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-[#090D16] border border-[#1E293B] rounded text-slate-100 focus:outline-none focus:border-sky-500"
              placeholder="feat(api): Describe your patch..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                Unified Diff Payload (Dispatched to POST /api/analyze-pr)
              </label>
              <button
                type="button"
                onClick={() => setDiffText(SAMPLE_JWT_DIFF)}
                className="text-xs text-sky-400 hover:text-sky-300 font-mono"
              >
                Load CWE-327 Sample Diff
              </button>
            </div>
            <textarea
              rows={9}
              value={diffText}
              onChange={(e) => setDiffText(e.target.value)}
              className="w-full p-3 text-xs font-mono bg-[#090D16] border border-[#1E293B] rounded text-slate-200 focus:outline-none focus:border-sky-500 leading-relaxed"
              placeholder="Paste unified git diff (+ / - lines)..."
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#1E293B]">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={bypassCache}
                onChange={(e) => setBypassCache(e.target.checked)}
                className="rounded border-slate-600 bg-[#090D16] text-sky-500"
              />
              <span>Bypass SHA-256 Deduplication Cache</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-[#131C2E] border border-[#1E293B] rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Run Subagent Analysis</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
