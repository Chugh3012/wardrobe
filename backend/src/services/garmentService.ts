import { Container } from "@azure/cosmos";
import { randomUUID } from "node:crypto";
import type { Garment } from "../models/garment.js";
import { getDatabase } from "./cosmosClient.js";

function getContainer(): Container {
  return getDatabase().container("garments");
}

/**
 * Creates a new Garment document and returns the created item.
 */
export async function createGarment(
  input: Omit<Garment, "id" | "wearCount" | "createdAt" | "updatedAt">
): Promise<Garment> {
  const now = new Date().toISOString();
  const garment: Garment = {
    id: randomUUID(),
    wearCount: 0,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  const { resource } = await getContainer().items.create<Garment>(garment);
  if (!resource) {
    throw new Error("Cosmos DB create returned no resource.");
  }
  return resource;
}

/**
 * Reads a single Garment by id and userId (partition key).
 */
export async function readGarment(id: string, userId: string): Promise<Garment | undefined> {
  try {
    const { resource } = await getContainer().item(id, userId).read<Garment>();
    return resource ?? undefined;
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 404) {
      return undefined;
    }
    throw err;
  }
}

/**
 * Increments the wearCount on a Garment by 1 and updates the updatedAt timestamp.
 *
 * Uses Cosmos DB ETag optimistic concurrency to prevent lost updates from
 * concurrent requests (H6). If another request modified the document between
 * our read and replace, the 412 PreconditionFailed error is retried (up to 3 times).
 */
export async function incrementWearCount(id: string, userId: string): Promise<Garment> {
  const container = getContainer();
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { resource: existing, etag } = await container.item(id, userId).read<Garment>();
    if (!existing) {
      throw new Error(`Garment ${id} not found for user ${userId}.`);
    }
    const updated: Garment = {
      ...existing,
      wearCount: existing.wearCount + 1,
      updatedAt: new Date().toISOString(),
    };
    try {
      const { resource } = await container.item(id, userId).replace<Garment>(updated, {
        accessCondition: { type: "IfMatch", condition: etag! },
      });
      if (!resource) {
        throw new Error("Cosmos DB replace returned no resource.");
      }
      return resource;
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 412) {
        // Conflict — another request modified this document. Retry.
        if (attempt === MAX_RETRIES - 1) throw err;
        continue;
      }
      throw err;
    }
  }
  throw new Error("incrementWearCount: max retries exceeded.");
}

/**
 * Decrements the wearCount on a Garment by 1 (minimum 0) and updates the updatedAt timestamp.
 *
 * Uses Cosmos DB ETag optimistic concurrency (H6).
 */
export async function decrementWearCount(id: string, userId: string): Promise<Garment> {
  const container = getContainer();
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { resource: existing, etag } = await container.item(id, userId).read<Garment>();
    if (!existing) {
      throw new Error(`Garment ${id} not found for user ${userId}.`);
    }
    const updated: Garment = {
      ...existing,
      wearCount: Math.max(existing.wearCount - 1, 0),
      updatedAt: new Date().toISOString(),
    };
    try {
      const { resource } = await container.item(id, userId).replace<Garment>(updated, {
        accessCondition: { type: "IfMatch", condition: etag! },
      });
      if (!resource) {
        throw new Error("Cosmos DB replace returned no resource.");
      }
      return resource;
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 412) {
        if (attempt === MAX_RETRIES - 1) throw err;
        continue;
      }
      throw err;
    }
  }
  throw new Error("decrementWearCount: max retries exceeded.");
}

/** Fields that can be updated via PATCH /api/garments/{id}. */
export interface GarmentUpdate {
  name?: string;
  category?: string;
  catalogImageUrls?: string[];
  catalogEmbeddings?: number[][];
}

/**
 * Partially updates a Garment document and returns the updated item.
 *
 * Uses Cosmos DB ETag optimistic concurrency to prevent lost updates.
 */
export async function updateGarment(
  id: string,
  userId: string,
  updates: GarmentUpdate,
): Promise<Garment | undefined> {
  const container = getContainer();
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { resource: existing, etag } = await container.item(id, userId).read<Garment>();
    if (!existing) {
      return undefined;
    }
    const merged: Garment = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    try {
      const { resource } = await container.item(id, userId).replace<Garment>(merged, {
        accessCondition: { type: "IfMatch", condition: etag! },
      });
      if (!resource) {
        throw new Error("Cosmos DB replace returned no resource.");
      }
      return resource;
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 412) {
        if (attempt === MAX_RETRIES - 1) throw err;
        continue;
      }
      throw err;
    }
  }
  throw new Error("updateGarment: max retries exceeded.");
}

/**
 * Deletes a Garment by id and userId (partition key).
 * Throws if the document does not exist.
 */
export async function deleteGarment(id: string, userId: string): Promise<void> {
  await getContainer().item(id, userId).delete();
}

/**
 * Deletes a Garment by id and userId (partition key).
 * Throws if the document does not exist.
 */
export async function deleteGarment(id: string, userId: string): Promise<void> {
  await getContainer().item(id, userId).delete();
}

/**
 * Lists all garments for a given userId (unpaginated).
 * Used internally by endpoints that need the full set (e.g. stats, predict).
 */
export async function listGarments(userId: string): Promise<Garment[]> {
  const { resources } = await getContainer().items
    .query<Garment>({
      query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC",
      parameters: [{ name: "@userId", value: userId }],
    })
    .fetchAll();
  return resources;
}

/** Default page size for paginated garment queries (F3). */
const DEFAULT_PAGE_SIZE = 20;
/** Maximum allowed page size. */
const MAX_PAGE_SIZE = 100;

/** Result shape for paginated garment listing. */
export interface PaginatedGarments {
  garments: Garment[];
  continuationToken: string | undefined;
}

/**
 * Lists garments for a given userId with pagination (F3).
 *
 * @param userId          - The authenticated user's ID (partition key).
 * @param pageSize        - Number of items per page (default 20, max 100).
 * @param continuationToken - Cosmos DB continuation token for the next page.
 */
export async function listGarmentsPaginated(
  userId: string,
  pageSize?: number,
  continuationToken?: string,
): Promise<PaginatedGarments> {
  const effectivePageSize = Math.min(
    Math.max(pageSize ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  );

  const iterator = getContainer().items.query<Garment>(
    {
      query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC",
      parameters: [{ name: "@userId", value: userId }],
    },
    {
      maxItemCount: effectivePageSize,
      continuationToken: continuationToken || undefined,
    },
  );

  const response = await iterator.fetchNext();

  return {
    garments: response.resources ?? [],
    continuationToken: response.continuationToken ?? undefined,
  };
}
