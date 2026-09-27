/**
 * Shared interface for all LLM provider clients.
 * Both WatsonxClient and GeminiClient implement this so adapters
 * remain decoupled from any specific provider SDK.
 */
export interface ChatResult {
    text: string;
    promptTokens: number;
    completionTokens: number;
}

export interface LLMClient {
    chat(systemPrompt: string, userContent: string): Promise<ChatResult>;
}
