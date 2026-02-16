import type { AIProvider, AIProviderConfig, GenerateParams, GenerateResult } from '../types';

const DEFAULT_MODEL = 'gemini-2.0-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
}

export function createGeminiProvider(config: AIProviderConfig): AIProvider {
  const model = config.model ?? DEFAULT_MODEL;

  return {
    async generate(params: GenerateParams): Promise<GenerateResult> {
      const url = `${BASE_URL}/${model}:generateContent`;

      const body = {
        systemInstruction: { parts: [{ text: params.system }] },
        contents: [{ role: 'user', parts: [{ text: params.user }] }],
        generationConfig: {
          temperature: params.temperature ?? config.temperature ?? 0.8,
          maxOutputTokens: params.maxTokens ?? config.maxTokens ?? 8192,
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120_000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': config.apiKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          const truncated = errText.slice(0, 500);
          throw new Error(`Gemini API error (${res.status}): ${truncated}`);
        }

        const data = (await res.json()) as GeminiResponse;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

        return {
          text,
          usage: data.usageMetadata
            ? {
                inputTokens: data.usageMetadata.promptTokenCount ?? 0,
                outputTokens: data.usageMetadata.candidatesTokenCount ?? 0,
              }
            : undefined,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}
