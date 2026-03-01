import { Container } from "@azure/cosmos";
import { randomUUID } from "node:crypto";
import type { PredictionAudit } from "../models/predictionAudit.js";
import { getDatabase } from "./cosmosClient.js";

function getContainer(): Container {
  return getDatabase().container("predictionAudits");
}

/**
 * Creates a new PredictionAudit document and returns the created item.
 */
export async function createPredictionAudit(
  input: Omit<PredictionAudit, "id" | "createdAt">
): Promise<PredictionAudit> {
  const audit: PredictionAudit = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  const { resource } = await getContainer().items.create<PredictionAudit>(audit);
  if (!resource) {
    throw new Error("Cosmos DB create returned no resource.");
  }
  return resource;
}

/**
 * Reads a single PredictionAudit by id and userId (partition key).
 */
export async function readPredictionAudit(
  id: string,
  userId: string
): Promise<PredictionAudit | undefined> {
  try {
    const { resource } = await getContainer().item(id, userId).read<PredictionAudit>();
    return resource ?? undefined;
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 404) {
      return undefined;
    }
    throw err;
  }
}

/**
 * Lists all prediction audits for a given userId.
 */
export async function listPredictionAudits(userId: string): Promise<PredictionAudit[]> {
  const { resources } = await getContainer().items
    .query<PredictionAudit>({
      query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC",
      parameters: [{ name: "@userId", value: userId }],
    })
    .fetchAll();
  return resources;
}
