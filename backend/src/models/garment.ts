/**
 * Represents a garment in the user's wardrobe catalog.
 * Stored in the "garments" Cosmos DB container, partitioned by userId.
 */
export interface Garment {
  id: string;
  userId: string;
  name: string;
  category: string; // e.g. "dress", "top", "bottom", "jacket", etc.
  catalogImageUrls: string[];
  /** Pre-computed image embeddings for similarity search (Issue #11). */
  catalogEmbeddings?: number[][];
  wearCount: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
