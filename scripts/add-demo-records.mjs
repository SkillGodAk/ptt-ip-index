import { readFile, writeFile } from "node:fs/promises";
import { buildIpIndex, mergeIndex, normalizeRecord } from "./index-core.mjs";

const indexPath = "data/ip-index.json";

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

const existingIndex = await readJson(indexPath, buildIpIndex([]));
const demoRecords = [
  {
    userId: "arelies",
    ip: "114.39.44.144",
    type: "post",
    board: "demo",
    dateText: "2026/07/04",
    url: "https://www.pttweb.cc/user/arelies",
    title: "demo indexed source ip",
  },
  {
    userId: "godblessgogp",
    ip: "114.39.44.144",
    type: "reply",
    board: "demo",
    dateText: "2026/07/04",
    url: "https://www.pttweb.cc/user/godblessgogp",
    title: "demo shared source ip",
  },
  {
    userId: "arelies",
    ip: "36.238.37.70",
    type: "post",
    board: "demo",
    dateText: "2026/07/04",
    url: "https://www.pttweb.cc/user/arelies",
    title: "demo indexed source ip",
  },
  {
    userId: "godblessgogp",
    ip: "36.238.37.70",
    type: "reply",
    board: "demo",
    dateText: "2026/07/04",
    url: "https://www.pttweb.cc/user/godblessgogp",
    title: "demo shared source ip",
  },
];

const nextIndex = mergeIndex(existingIndex, demoRecords.map(normalizeRecord));
await writeFile(indexPath, `${JSON.stringify(nextIndex, null, 2)}\n`, "utf8");
console.log("Demo shared-IP records added.");
