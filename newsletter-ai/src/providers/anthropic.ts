import type { AIProvider, AIProviderConfig, GenerateParams, GenerateResult } from '../types';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const BASE_URL = 'https://api.anthropic.com/v1/messages';

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export function createAnthropicProvider(config: AIProviderConfig): AIProvider {
  const model = config.model ?? DEFAULT_MODEL;

  return {
    async generate(params: GenerateParams): Promise<GenerateResult> {
      const body = {
        model,
        system: params.system,
        messages: [{ role: 'user' as const, content: params.user }],
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
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          const truncated = errText.slice(0, 500);
          throw new Error(`Anthropic API error (${res.status}): ${truncated}`);
        }

        const data = (await res.json()) as AnthropicResponse;
        const textBlock = data.content?.find((c) => c.type === 'text');
        const text = textBlock?.text ?? '';

        return {
          text,
          usage: data.usage
            ? {
                inputTokens: data.usage.input_tokens ?? 0,
                outputTokens: data.usage.output_tokens ?? 0,
              }
            : undefined,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}
