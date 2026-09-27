export interface WatsonxChatResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
}

export interface WatsonxClient {
  chat(systemPrompt: string, userContent: string): Promise<WatsonxChatResult>;
}

/**
 * Returns a watsonx client wrapper for live LLM execution when USE_LIVE_LLM=true.
 */
export function getWatsonxClient(): WatsonxClient {
  return {
    async chat(systemPrompt: string, userContent: string): Promise<WatsonxChatResult> {
      const apiKey = process.env.WATSONX_AI_APIKEY || process.env.WATSONX_API_KEY;
      const projectId = process.env.WATSONX_AI_PROJECT_ID || process.env.WATSONX_PROJECT_ID;
      const serviceUrl = process.env.WATSONX_AI_SERVICE_URL || 'https://us-south.ml.cloud.ibm.com';
      const modelId = process.env.WATSONX_MODEL_ID || 'ibm/granite-3-8b-instruct';

      if (!apiKey || !projectId) {
        throw new Error(
          'Missing WATSONX_AI_APIKEY or WATSONX_AI_PROJECT_ID environment variables for live watsonx execution.'
        );
      }

      const { WatsonXAI } = await import('@ibm-cloud/watsonx-ai');
      const watsonxAI = WatsonXAI.newInstance({
        version: '2024-05-31',
        serviceUrl,
      });

      const response = await watsonxAI.textChat({
        modelId,
        projectId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [{ type: 'text', text: userContent }] },
        ],
        maxTokens: 2048,
        temperature: 0.1,
      });

      const choice = response.result?.choices?.[0];
      const text = choice?.message?.content ?? '{}';
      const usage = response.result?.usage;

      return {
        text,
        promptTokens: usage?.prompt_tokens ?? Math.ceil((systemPrompt.length + userContent.length) / 4),
        completionTokens: usage?.completion_tokens ?? Math.ceil(text.length / 4),
      };
    },
  };
}
