/**
 * TypeScript types for the Knowledge Corpus system.
 */

export interface KnowledgeDocumentMetadata {
  topics?: string[];
  entities?: string[];
  dateRange?: string;
  documentId?: string;
  sourceFile?: string;
  block?: string;      // G, E, D, M, F, H, C
  code?: string;       // e.g., DIR-G-01
  audience?: string;
  tier?: string;
}

export interface KnowledgeDocumentSummary {
  id: string;
  vertical: string;
  title: string;
  slug: string;
  wordCount: number;
  chunkCount: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeDocument {
  id: string;
  vertical: string;
  title: string;
  slug: string;
  content: string;
  summary: string | null;
  wordCount: number;
  metadata: KnowledgeDocumentMetadata | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  createdAt: Date;
}

export interface ChunkOptions {
  targetWords?: number;
  maxWords?: number;
  minWords?: number;
  overlapWords?: number;
}

export interface Chunk {
  index: number;
  content: string;
  wordCount: number;
  tokenCount: number;
  sectionHeading?: string;
}

export type EmbeddingProvider = 'openai' | 'anthropic' | 'cohere';

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  apiKey: string;
}

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
  model: string;
}

export interface KnowledgeSearchOptions {
  vertical?: string;
  limit?: number;
  threshold?: number;
}

export interface KnowledgeSearchResult {
  documentSlug: string;
  documentTitle: string;
  chunkIndex: number;
  chunkContent: string;
  similarity: number;
}

export interface IngestResult {
  documentsProcessed: number;
  documentsCreated: number;
  documentsUpdated: number;
  chunksCreated: number;
  embeddingsGenerated: number;
  errors: Array<{ file: string; error: string }>;
  duration: number;
}

export interface IngestDocumentResult {
  document: KnowledgeDocument;
  chunksCreated: number;
  embeddingsGenerated: number;
}
