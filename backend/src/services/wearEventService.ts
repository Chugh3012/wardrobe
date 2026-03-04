import { Container } from "@azure/cosmos";
import { randomUUID } from "node:crypto";
import type { WearEvent } from "../models/wearEvent.js";
import { getDatabase } from "./cosmosClient.js";

function getContainer(): Container {
  return getDatabase().container("wearEvents");
}

/**
 * Creates a new WearEvent document and returns the created item.
 */
export async function createWearEvent(
  input: Omit<WearEvent, "id" | "createdAt">
): Promise<WearEvent> {
  const wearEvent: WearEvent = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  const { resource } = await getContainer().items.create<WearEvent>(wearEvent);
  if (!resource) {
    throw new Error("Cosmos DB create returned no resource.");
  }
  return resource;
}

/**
 * Reads a single WearEvent by id and userId (partition key).
 */
export async function readWearEvent(id: string, userId: string): Promise<WearEvent | undefined> {
  try {
    const { resource } = await getContainer().item(id, userId).read<WearEvent>();
    return resource ?? undefined;
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 404) {
      return undefined;
    }
    throw err;
  }
}

/**
 * Deletes a WearEvent by id and userId (partition key).
 * Throws if the document does not exist.
 */
export async function deleteWearEvent(id: string, userId: string): Promise<void> {
  await getContainer().item(id, userId).delete();
}

/**
 * Lists all wear events for a given userId.
 */
export async function listWearEvents(userId: string): Promise<WearEvent[]> {
  const { resources } = await getContainer().items
    .query<WearEvent>({
      query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC",
      parameters: [{ name: "@userId", value: userId }],
    })
    .fetchAll();
  return resources;
}

/** Aggregated wear-event summary for a single garment (F4). */
export interface WearEventAggregation {
  garmentId: string;
  eventCount: number;
  lastWornDate: string;
}

/**
 * Returns per-garment aggregated wear-event statistics using a Cosmos DB
 * GROUP BY query (F4). This avoids fetching every individual wear event
 * for users with large histories.
 *
 * Returns one row per garment with eventCount and lastWornDate.
 */
export async function getWearEventAggregations(userId: string): Promise<WearEventAggregation[]> {
  const { resources } = await getContainer().items
    .query<WearEventAggregation>({
      query:
        "SELECT c.garmentId, COUNT(1) AS eventCount, MAX(c.createdAt) AS lastWornDate " +
        "FROM c WHERE c.userId = @userId GROUP BY c.garmentId",
      parameters: [{ name: "@userId", value: userId }],
    })
    .fetchAll();
  return resources;
}

/** Per-day wear count for activity calendar / streak calculations. */
export interface DailyWearCount {
  date: string;
  count: number;
}

/**
 * Returns per-day wear counts for a user since the given date (ISO 8601).
 * Used for activity calendar heatmaps and wear-streak computations.
 */
export async function getWearDates(userId: string, since: string): Promise<DailyWearCount[]> {
  const { resources } = await getContainer().items
    .query<{ wearDate: string; count: number }>({
      query:
        "SELECT SUBSTRING(c.createdAt, 0, 10) AS wearDate, COUNT(1) AS count " +
        "FROM c WHERE c.userId = @userId AND c.createdAt >= @since " +
        "GROUP BY SUBSTRING(c.createdAt, 0, 10)",
      parameters: [
        { name: "@userId", value: userId },
        { name: "@since", value: since },
      ],
    })
    .fetchAll();
  return resources.map((r) => ({ date: r.wearDate, count: r.count }));
}

/** Default page size for wear event history. */
const DEFAULT_HISTORY_SIZE = 20;
/** Maximum allowed page size for wear event history. */
const MAX_HISTORY_SIZE = 50;

/** Result shape for paginated wear event listing. */
export interface PaginatedWearEvents {
  events: WearEvent[];
  continuationToken: string | undefined;
}

/**
 * Lists wear events for a user with pagination (for outfit history).
 */
export async function listWearEventsPaginated(
  userId: string,
  pageSize?: number,
  continuationToken?: string,
): Promise<PaginatedWearEvents> {
  const effectivePageSize = Math.min(
    Math.max(pageSize ?? DEFAULT_HISTORY_SIZE, 1),
    MAX_HISTORY_SIZE,
  );

  const iterator = getContainer().items.query<WearEvent>(
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
    events: response.resources ?? [],
    continuationToken: response.continuationToken ?? undefined,
  };
}
