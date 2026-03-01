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
