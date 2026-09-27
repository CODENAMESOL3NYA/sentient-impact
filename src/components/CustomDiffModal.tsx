import { useState } from 'react';
import { Code, X, Play } from 'lucide-react';

interface CustomDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunCustomDiff: (title: string, diff: string, bypassCache: boolean) => void;
}

const SAMPLE_JWT_DIFF = `diff --git a/custom/auth.ts b/custom/auth.ts
--- a/custom/auth.ts
+++ b/custom/auth.ts
@@ -10,6 +10,9 @@ export function verifySessionToken(token: string, secret: string) {
-  return jwt.verify(token, secret, { algorithms: ["HS256"] });
+  // Quick decode without explicit algorithms whitelist
+  const payload = jwt.verify(token, secret);
+  return payload;
 }`;

export function CustomDiffModal({
  isOpen,
  onClose,
  onRunCustomDiff,
}: CustomDiffModalProps) {
  const [title, setTitle] = useState('fix(auth): Custom JWT Verification Patch');
  const [diffText, setDiffText] = useState(SAMPLE_JWT_DIFF);
  const [bypassCache, setBypassCache] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!diffText.trim()) return;
    onRunCustomDiff(title.trim() || 'Custom PR Diff', diffText, bypassCache);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-[#1E293B] bg-[#0D131F] shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#1E293B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              Inspect Custom Unified Git Diff
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              PR / Patch Context Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-[#090D16] border border-[#1E293B] text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Unified Git Diff Payload (dispatched to POST /api/analyze-pr)
            </label>
            <textarea
              rows={9}
              value={diffText}
              onChange={(e) => setDiffText(e.target.value)}
              className="w-full p-3 rounded-md bg-[#090D16] border border-[#1E293B] text-xs text-emerald-300 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={bypassCache}
                onChange={(e) => setBypassCache(e.target.checked)}
                className="accent-sky-400 rounded cursor-pointer"
              />
              <span>Bypass SHA-256 Deduplication Cache (`bypassCache: true`)</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-md border border-[#1E293B] text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs cursor-pointer"
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
}
