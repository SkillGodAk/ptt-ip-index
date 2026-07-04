import { readFile, writeFile } from "node:fs/promises";
import { mergeSeedUsers, uniqueQueueUsers } from "./queue-core.mjs";

const seedPath = "data/seed-users.json";
const queueUrl = process.env.PTT_INDEX_QUEUE_URL;
const queueToken = process.env.PTT_INDEX_QUEUE_TOKEN;

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function fetchQueueUsers() {
  if (!queueUrl) {
    console.log("PTT_INDEX_QUEUE_URL is not set; skipping queue import.");
    return [];
  }

  const response = await fetch(`${queueUrl.replace(/\/$/, "")}/queue?limit=50`, {
    headers: queueToken ? { authorization: `Bearer ${queueToken}` } : {},
  });
  if (!response.ok) {
    throw new Error(`Queue import failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  return uniqueQueueUsers(data.users || data);
}

const existingSeeds = await readJson(seedPath, []);
const queueUsers = await fetchQueueUsers();
const nextSeeds = mergeSeedUsers(existingSeeds, queueUsers);

await writeFile(seedPath, `${JSON.stringify(nextSeeds, null, 2)}\n`, "utf8");
console.log(`Imported ${queueUsers.length} queue users. Seed users: ${nextSeeds.length}`);
