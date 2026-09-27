import type { LLMClient } from './llmClient.js';
import { getWatsonxClient } from './watsonxClient.js';
import { getGeminiClient } from './geminiClient.js';

export type LLMProvider = 'watsonx' | 'gemini';

/**
 * Returns the LLMClient singleton for the given provider.
 * If no provider is specified, falls back to the LLM_PROVIDER env var,
 * then defaults to 'watsonx'.
 *
 * This is the single place in the codebase that knows about provider selection —
 * adapters and controllers call this instead of importing a specific client directly.
 */
export function getLLMClient(provider?: string): LLMClient {
    // Priority: explicit argument → LLM_PROVIDER env → 'watsonx'
    const resolved = (provider ?? process.env.LLM_PROVIDER ?? 'watsonx') as LLMProvider;
    if (resolved === 'gemini') {
        return getGeminiClient();
    }
    return getWatsonxClient();
}

/**
 * Returns the provider name for a given optional per-request override.
 * Uses the same resolution priority as getLLMClient() so the `source` label
 * in API responses always matches the client that was actually called.
 */
export function resolveProvider(provider?: string): LLMProvider {
    const resolved = (provider ?? process.env.LLM_PROVIDER ?? 'watsonx') as LLMProvider;
    return resolved === 'gemini' ? 'gemini' : 'watsonx';
}
