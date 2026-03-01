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
 */
export async function incrementWearCount(id: string, userId: string): Promise<Garment> {
  const container = getContainer();
  const { resource: existing } = await container.item(id, userId).read<Garment>();
  if (!existing) {
    throw new Error(`Garment ${id} not found for user ${userId}.`);
  }
  const updated: Garment = {
    ...existing,
    wearCount: existing.wearCount + 1,
    updatedAt: new Date().toISOString(),
  };
  const { resource } = await container.item(id, userId).replace<Garment>(updated);
  if (!resource) {
    throw new Error("Cosmos DB replace returned no resource.");
  }
  return resource;
}

/**
 * Lists all garments for a given userId.
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
