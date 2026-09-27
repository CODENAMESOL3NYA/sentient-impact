import { IamAuthenticator } from 'ibm-cloud-sdk-core';
import { WatsonXAI } from '@ibm-cloud/watsonx-ai';
import type { LLMClient } from './llmClient.js';

/**
 * The shape returned by a single textChat call.
 * Mirrors the OpenAI-compatible response that watsonx uses.
 */
export interface WatsonxChatResult {
    text: string;
    promptTokens: number;
    completionTokens: number;
}

/**
 * Singleton wrapper around the @ibm-cloud/watsonx-ai SDK.
 * Reads credentials from environment variables so adapters never
 * need to import the SDK directly.
 *
 * Required environment variables:
 *   WATSONX_API_KEY     – IBM Cloud IAM API key
 *   WATSONX_PROJECT_ID  – watsonx.ai project ID
 *   WATSONX_URL         – e.g. https://us-south.ml.cloud.ibm.com
 */
class WatsonxClient implements LLMClient {
    private readonly client: WatsonXAI;
    private readonly projectId: string;
    private readonly modelId: string;

    constructor() {
        const apiKey = process.env.WATSONX_API_KEY;
        const projectId = process.env.WATSONX_PROJECT_ID;
        const serviceUrl = process.env.WATSONX_URL ?? 'https://us-south.ml.cloud.ibm.com';
        const modelId = process.env.WATSONX_MODEL_ID ?? 'ibm/granite-3-3-8b-instruct';

        if (!apiKey || !projectId) {
            throw new Error(
                '[WatsonxClient] Missing required env vars: WATSONX_API_KEY and WATSONX_PROJECT_ID must both be set.'
            );
        }

        this.projectId = projectId;
        this.modelId = modelId;

        this.client = WatsonXAI.newInstance({
            authenticator: new IamAuthenticator({ apikey: apiKey }),
            serviceUrl,
            version: '2024-05-31',
        });
    }

    /**
     * Send a system + user message pair to the configured foundation model.
     * Returns the assistant reply text and real token usage from the model.
     *
     * @param systemPrompt – the agent's system instructions
     * @param userContent  – the formatted user message (diff + template)
     */
    async chat(systemPrompt: string, userContent: string): Promise<WatsonxChatResult> {
        const response = await this.client.textChat({
            modelId: this.modelId,
            projectId: this.projectId,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userContent  },
            ],
            maxTokens: 4096,
        });

        const result = response.result;
        const text = (result.choices?.[0]?.message?.content as string) ?? '';
        const usage = result.usage ?? { prompt_tokens: 0, completion_tokens: 0 };

        return {
            text,
            promptTokens:     usage.prompt_tokens     ?? 0,
            completionTokens: usage.completion_tokens ?? 0,
        };
    }
}

// Lazily initialised singleton — instantiated on first use so the server
// can still start (and serve mock requests) when live credentials are absent.
let _instance: WatsonxClient | null = null;

export function getWatsonxClient(): WatsonxClient {
    if (!_instance) {
        _instance = new WatsonxClient();
    }
    return _instance;
}
