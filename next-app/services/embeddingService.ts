/**
 * Embedding Service
 *
 * Abstracted embedding generation supporting multiple providers.
 * Default: OpenAI text-embedding-3-small (1536 dimensions)
 */

import type { EmbeddingProvider, EmbeddingConfig, EmbeddingResult } from '@/types/corpus';

const DEFAULT_PROVIDER: EmbeddingProvider = 'openai';
const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 50;

function getConfig(): EmbeddingConfig {
  const provider = (process.env.EMBEDDING_PROVIDER || DEFAULT_PROVIDER) as EmbeddingProvider;
  const model = process.env.EMBEDDING_MODEL || DEFAULT_MODEL;
  const dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || String(DEFAULT_DIMENSIONS), 10);

  let apiKey = '';
  switch (provider) {
    case 'openai':
      apiKey = process.env.OPENAI_API_KEY || '';
      break;
    case 'anthropic':
      apiKey = process.env.ANTHROPIC_API_KEY || '';
      break;
    case 'cohere':
      apiKey = process.env.COHERE_API_KEY || '';
      break;
  }

  return { provider, model, dimensions, apiKey };
}

export function isEmbeddingAvailable(): boolean {
  const config = getConfig();
  return config.apiKey.length > 0;
}

export function getEmbeddingDimensions(): number {
  return parseInt(process.env.EMBEDDING_DIMENSIONS || String(DEFAULT_DIMENSIONS), 10);
}

export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const config = getConfig();

  if (!config.apiKey) {
    throw new Error(
      `Embedding API key not configured for provider "${config.provider}". ` +
      `Set ${config.provider === 'openai' ? 'OPENAI_API_KEY' : 'EMBEDDING_API_KEY'} environment variable.`
    );
  }

  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();

  switch (config.provider) {
    case 'openai':
      return generateOpenAIEmbedding(text, config);
    default:
      throw new Error(`Embedding provider "${config.provider}" is not yet implemented.`);
  }
}

export async function generateEmbeddingBatch(
  texts: string[],
  options?: { batchSize?: number }
): Promise<EmbeddingResult[]> {
  const batchSize = options?.batchSize || 20;
  const results: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const config = getConfig();

    if (config.provider === 'openai') {
      const batchResults = await generateOpenAIEmbeddingBatch(batch, config);
      results.push(...batchResults);
    } else {
      for (const text of batch) {
        results.push(await generateEmbedding(text));
      }
    }
  }

  return results;
}

const EMBEDDING_TIMEOUT_MS = 10_000;

async function generateOpenAIEmbedding(text: string, config: EmbeddingConfig): Promise<EmbeddingResult> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      model: config.model,
      dimensions: config.dimensions,
    }),
    signal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI embedding API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const embedding = data.data[0].embedding as number[];
  const tokenCount = data.usage?.total_tokens || 0;

  return { embedding, tokenCount, model: config.model };
}

async function generateOpenAIEmbeddingBatch(
  texts: string[],
  config: EmbeddingConfig
): Promise<EmbeddingResult[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: texts,
      model: config.model,
      dimensions: config.dimensions,
    }),
    signal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI embedding batch API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const totalTokens = data.usage?.total_tokens || 0;
  const tokensPerItem = Math.ceil(totalTokens / texts.length);

  return data.data.map((item: { embedding: number[]; index: number }) => ({
    embedding: item.embedding,
    tokenCount: tokensPerItem,
    model: config.model,
  }));
}

export function estimateTokenCount(text: string): number {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount * 1.3);
}
