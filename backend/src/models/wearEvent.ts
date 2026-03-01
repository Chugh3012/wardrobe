/**
 * Represents a single wear event — the user confirming (or correcting)
 * which garment they wore on a given day.
 * Stored in the "wearEvents" Cosmos DB container, partitioned by userId.
 */
export interface WearEvent {
  id: string;
  userId: string;
  garmentId: string;
  outfitImageUrl: string;
  predictedGarmentId: string;
  confidence: number;
  confirmed: boolean;
  createdAt: string; // ISO 8601
}
