import type { LLMClient, ChatResult } from './llmClient.js';

/**
 * Thin REST wrapper around the Google Gemini generateContent API.
 * Implements the shared LLMClient interface so it can be swapped in
 * anywhere WatsonxClient is used.
 *
 * Required environment variables:
 *   GEMINI_API_KEY   – Google AI API key
 *
 * Optional environment variables:
 *   GEMINI_MODEL_ID  – Model to use (default: gemini-2.0-flash)
 */
class GeminiClient implements LLMClient {
    private readonly apiKey: string;
    private readonly modelId: string;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error(
                '[GeminiClient] Missing required env var: GEMINI_API_KEY must be set.'
            );
        }
        this.apiKey = apiKey;
        this.modelId = process.env.GEMINI_MODEL_ID ?? 'gemini-2.0-flash';
    }

    /**
     * Send a system + user message pair to the configured Gemini model.
     * Maps the generic chat interface onto the Gemini generateContent request shape:
     *   - systemPrompt → system_instruction
     *   - userContent  → contents[0].parts[0].text
     *
     * Returns the assistant reply text and token usage from the API response.
     */
    async chat(systemPrompt: string, userContent: string): Promise<ChatResult> {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelId}:generateContent`;

        const requestBody = {
            system_instruction: {
                parts: [{ text: systemPrompt }],
            },
            contents: [
                {
                    parts: [{ text: userContent }],
                },
            ],
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'x-goog-api-key': `${this.apiKey}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
            const detail = body.error?.message ?? response.statusText;
            throw new Error(`[GeminiClient] API error ${response.status}: ${detail}`);
        }

        const json = await response.json() as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
            usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
        };

        const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const promptTokens     = json.usageMetadata?.promptTokenCount     ?? 0;
        const completionTokens = json.usageMetadata?.candidatesTokenCount ?? 0;

        return { text, promptTokens, completionTokens };
    }
}

// Lazily initialised singleton — instantiated on first use so the server
// can still start (and serve mock/watsonx requests) when Gemini credentials are absent.
let _instance: GeminiClient | null = null;

export function getGeminiClient(): GeminiClient {
    if (!_instance) {
        _instance = new GeminiClient();
    }
    return _instance;
}
