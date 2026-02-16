import type { AIProvider, AIProviderConfig, GenerateParams, GenerateResult } from '../types';

const DEFAULT_MODEL = 'gpt-4o-mini';
const BASE_URL = 'https://api.openai.com/v1/chat/completions';

interface OpenAIResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export function createOpenAIProvider(config: AIProviderConfig): AIProvider {
  const model = config.model ?? DEFAULT_MODEL;

  return {
    async generate(params: GenerateParams): Promise<GenerateResult> {
      const body = {
        model,
        messages: [
          { role: 'system' as const, content: params.system },
          { role: 'user' as const, content: params.user },
        ],
        temperature: params.temperature ?? config.temperature ?? 0.8,
        max_tokens: params.maxTokens ?? config.maxTokens ?? 8192,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120_000);
      try {
        const res = await fetch(BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          const truncated = errText.slice(0, 500);
          throw new Error(`OpenAI API error (${res.status}): ${truncated}`);
        }

        const data = (await res.json()) as OpenAIResponse;
        const text = data.choices?.[0]?.message?.content ?? '';

        return {
          text,
          usage: data.usage
            ? {
                inputTokens: data.usage.prompt_tokens ?? 0,
                outputTokens: data.usage.completion_tokens ?? 0,
              }
            : undefined,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}
