import http from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const indexPath = join(root, "..", "data", "ip-index.json");
const remoteIndexUrl = "https://raw.githubusercontent.com/SkillGodAk/ptt-ip-index/master/data/ip-index.json";
const pendingUsersPath = join(root, "..", "data", "pending-users.json");
const queueUrl = process.env.PTT_INDEX_QUEUE_URL;
const port = Number(process.env.PORT || 5179);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function normalizeUserId(value) {
  const userId = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,32}$/.test(userId)) return null;
  return userId;
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function decodeHtml(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, "/")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanText(value) {
  return decodeHtml(value)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function absolutePttwebUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `https://www.pttweb.cc${path.startsWith("/") ? path : `/${path}`}`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 PTT-IP-Local/0.2",
      "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
      cookie: "over18=1",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function splitThreadItems(html) {
  return html.match(/<div class="thread-item[\s\S]*?(?=<div class="thread-item|$)/g) || [];
}

function parseUserTotals(html) {
  return {
    articles: Number(html.match(/totalArticles:([0-9]+)/)?.[1] || 0),
    replies: Number(html.match(/totalRecommends:([0-9]+)/)?.[1] || 0),
  };
}

function parsePostsFromUserHtml(userId, html, limit) {
  const posts = [];
  for (const item of splitThreadItems(html)) {
    if (posts.length >= limit) break;
    const href = decodeHtml(item.match(/<a href="([^"]*\/bbs\/[^"]*\/M\.[^"]+)"/)?.[1] || "");
    if (!href) continue;
    const title = cleanText(item.match(/<span class="thread-title"[^>]*>([\s\S]*?)<\/span>/)?.[1] || "(no title)");
    const board = cleanText(item.match(/<span class="thread-list-board"[^>]*>\[\s*([^\]]+)\s*\]<\/span>/)?.[1] || "");
    const dateText = cleanText(item.match(/<span class="thread-posttime"[^>]*>(20\d{2}\/\d{1,2}\/\d{1,2}(?:\s+\d{1,2}:\d{2})?)<\/span>/)?.[1] || "");
    posts.push({
      board,
      title,
      author: userId,
      dateText,
      url: absolutePttwebUrl(href),
      sourceIp: null,
    });
  }
  return posts;
}

function parseRepliesFromUserHtml(userId, html, limit) {
  const replies = [];
  for (const item of splitThreadItems(html)) {
    if (replies.length >= limit) break;
    const href = decodeHtml(item.match(/<a href="([^"]*\/bbs\/[^"]*\/M\.[^"]+)"/)?.[1] || "");
    const meta = cleanText(item.match(/<span class="ml-3 grey--text text--lighten-1"[^>]*>([\s\S]*?)<\/span>/)?.[1] || "");
    const ip = meta.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3})/)?.[1] || null;
    if (!href || !ip) continue;

    const userLinks = [...item.matchAll(/href="\/user\/([A-Za-z0-9_-]+)"/g)].map((match) => match[1]);
    const articleAuthor = userLinks.find((id) => id.toLowerCase() !== userId.toLowerCase()) || "";
    const title = cleanText(item.match(/<span class="thread-title"[^>]*>([\s\S]*?)<\/span>/)?.[1] || "(no title)");
    const board = cleanText(item.match(/<span class="thread-list-board"[^>]*>\[\s*([^\]]+)\s*\]<\/span>/)?.[1] || "");
    const type = cleanText(item.match(/<span class="white--text"[^>]*>([\s\S]*?)<\/span>/)?.[1] || "");
    const content = cleanText(item.match(/<span[^>]*class="yellow--text text--darken-2"[^>]*>:\s*([\s\S]*?)<\/span>/)?.[1] || "");

    replies.push({
      board,
      title,
      articleAuthor,
      replyUser: userId,
      type,
      content,
      dateText: meta.replace(ip, "").trim(),
      sourceIp: ip,
      url: absolutePttwebUrl(href),
    });
  }
  return replies;
}

function uniqueBy(records, keyFn) {
  const seen = new Set();
  return records.filter((record) => {
    const key = keyFn(record);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchUserHtmlPages(userId, type, limit) {
  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(limit / pageSize));
  const urls = Array.from({ length: pages }, (_, index) => {
    return `https://www.pttweb.cc/user/${encodeURIComponent(userId)}?t=${type}&page=${index + 1}`;
  });
  return mapWithConcurrency(urls, 4, (pageUrl) => fetchText(pageUrl).catch(() => ""));
}

function parseArticleIp(html) {
  const text = cleanText(html);
  return text.match(/(?:\u4f86\u81ea|from):\s*([0-9]{1,3}(?:\.[0-9]{1,3}){3})/i)?.[1] || null;
}

function parseArticleMeta(html, targetUserId) {
  const userIds = [...html.matchAll(/href="\/user\/([A-Za-z0-9_-]+)"/g)].map((match) => match[1]);
  const uniqueIds = [...new Set(userIds)].filter((id) => id.toLowerCase() !== targetUserId.toLowerCase());
  return {
    author: userIds[0] || "",
    sourceIp: parseArticleIp(html),
    candidateIds: uniqueIds,
  };
}

function summarizeIps(records, sharedLinks) {
  const linksByIp = new Map();
  for (const link of sharedLinks) {
    const list = linksByIp.get(link.sharedIp) || [];
    list.push(link);
    linksByIp.set(link.sharedIp, list);
  }

  const map = new Map();
  for (const record of records) {
    if (!record.sourceIp) continue;
    const entry = map.get(record.sourceIp) || {
      ip: record.sourceIp,
      count: 0,
      firstSeenText: record.dateText,
      lastSeenText: record.dateText,
      evidenceUrls: [],
      kinds: new Set(),
      otherUsers: [],
    };
    entry.count += 1;
    entry.lastSeenText = record.dateText || entry.lastSeenText;
    entry.evidenceUrls.push(record.url);
    entry.kinds.add(record.kind || "record");
    map.set(record.sourceIp, entry);
  }

  return [...map.values()]
    .map((entry) => ({
      ...entry,
      kinds: [...entry.kinds],
      otherUsers: linksByIp.get(entry.ip) || [],
    }))
    .sort((a, b) => b.count - a.count || b.otherUsers.length - a.otherUsers.length || a.ip.localeCompare(b.ip));
}

async function readLocalIndex() {
  try {
    return JSON.parse(await readFile(indexPath, "utf8"));
  } catch {
    try {
      const response = await fetch(remoteIndexUrl, {
        headers: { "user-agent": "Mozilla/5.0 PTT-IP-Local/0.2" },
      });
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }
}

function summarizeIndexedIps(userId, index) {
  const normalizedUserId = userId.toLowerCase();
  const userEntry = index?.byUser?.[normalizedUserId];
  if (!userEntry) return null;

  return userEntry.ips.map((ipEntry) => {
    const otherUsers = (index.byIp?.[ipEntry.ip]?.users || [])
      .filter((user) => user.userId !== normalizedUserId)
      .map((user) => ({
        otherUserId: user.userId,
        sharedIp: ipEntry.ip,
        evidenceCount: user.evidenceCount,
        evidenceUrls: user.evidence.map((record) => record.url).filter(Boolean),
        reason: "自建索引顯示此 ID 也出現過相同來源 IP",
      }));

    return {
      ip: ipEntry.ip,
      count: ipEntry.evidenceCount,
      firstSeenText: ipEntry.evidence.at(-1)?.dateText || "",
      lastSeenText: ipEntry.evidence[0]?.dateText || "",
      evidenceUrls: ipEntry.evidence.map((record) => record.url).filter(Boolean),
      kinds: [...new Set(ipEntry.evidence.map((record) => record.type))],
      otherUsers,
    };
  });
}

function addLink(linkMap, otherUserId, sharedIp, evidenceUrl, reason) {
  if (!otherUserId || !sharedIp) return;
  const key = `${otherUserId.toLowerCase()}|${sharedIp}`;
  const link = linkMap.get(key) || {
    otherUserId,
    sharedIp,
    evidenceCount: 0,
    evidenceUrls: [],
    reason,
  };
  link.evidenceCount += 1;
  if (evidenceUrl && !link.evidenceUrls.includes(evidenceUrl)) link.evidenceUrls.push(evidenceUrl);
  linkMap.set(key, link);
}

async function findSharedIpLinks({ userId, targetIps, replies, articleMetas, candidateIds, isAll }) {
  const links = new Map();

  for (const reply of replies) {
    const meta = articleMetas.get(reply.url);
    if (reply.sourceIp && meta?.sourceIp && reply.sourceIp === meta.sourceIp) {
      const otherId = meta.author || reply.articleAuthor;
      if (otherId.toLowerCase() !== userId.toLowerCase()) {
        addLink(links, otherId, reply.sourceIp, reply.url, "目標留言 IP 與該文章作者發文 IP 相同");
      }
    }
  }

  const candidates = [...new Set(candidateIds)]
    .filter((id) => /^[A-Za-z0-9_-]{2,32}$/.test(id))
    .filter((id) => id.toLowerCase() !== userId.toLowerCase())
    .slice(0, isAll ? 200 : 80);

  await mapWithConcurrency(candidates, 8, async (candidateId) => {
    try {
      const html = await fetchText(`https://www.pttweb.cc/user/${encodeURIComponent(candidateId)}?t=message&page=1`);
      const candidateReplies = parseRepliesFromUserHtml(candidateId, html, 20);
      for (const reply of candidateReplies) {
        if (reply.sourceIp && targetIps.has(reply.sourceIp)) {
          addLink(links, candidateId, reply.sourceIp, reply.url, "候選帳號公開留言紀錄出現相同 IP");
        }
      }
    } catch {
      // Ignore candidate lookup failures; this is an opportunistic local scan.
    }
  });

  return [...links.values()].sort((a, b) => b.evidenceCount - a.evidenceCount || a.otherUserId.localeCompare(b.otherUserId));
}

async function handleUserSearch(req, res, url) {
  const userId = decodeURIComponent(url.pathname.replace("/api/user/", "")).trim();
  const limitParam = url.searchParams.get("limit") || "12";
  if (!/^[A-Za-z0-9_-]{2,32}$/.test(userId)) {
    sendJson(res, 400, { error: "Invalid user id" });
    return;
  }

  const userUrl = `https://www.pttweb.cc/user/${encodeURIComponent(userId)}`;
  const localIndex = await readLocalIndex();
  const indexedIps = summarizeIndexedIps(userId, localIndex);
  if (indexedIps && url.searchParams.get("fast") !== "0") {
    const indexedLinks = indexedIps.flatMap((ip) => ip.otherUsers);
    sendJson(res, 200, {
      userId,
      mode: "indexed",
      totals: { articles: null, replies: null },
      fetchedAt: new Date().toISOString(),
      posts: [],
      replies: [],
      ips: indexedIps,
      sharedIpLinks: indexedLinks,
      sourceIpProvider: "own-index",
      note: "Using this repository's own generated index.",
    });
    return;
  }

  const userHtml = await fetchText(userUrl);
  const totals = parseUserTotals(userHtml);
  const isAll = limitParam === "all";
  const postLimit = isAll ? Math.max(1, totals.articles) : Math.max(1, Math.min(100, Number(limitParam || 12)));
  const replyLimit = isAll ? Math.max(1, totals.replies) : postLimit;

  const articlePages = await fetchUserHtmlPages(userId, "article", postLimit);
  const messagePages = await fetchUserHtmlPages(userId, "message", replyLimit);
  const posts = uniqueBy([
    ...parsePostsFromUserHtml(userId, userHtml, postLimit),
    ...articlePages.flatMap((html) => parsePostsFromUserHtml(userId, html, postLimit)),
  ], (post) => post.url).slice(0, postLimit);
  const replies = uniqueBy([
    ...parseRepliesFromUserHtml(userId, userHtml, replyLimit),
    ...messagePages.flatMap((html) => parseRepliesFromUserHtml(userId, html, replyLimit)),
  ], (reply) => `${reply.url}|${reply.sourceIp}|${reply.content}|${reply.dateText}`).slice(0, replyLimit);

  const candidateIds = new Set(replies.map((reply) => reply.articleAuthor).filter(Boolean));

  await mapWithConcurrency(posts, 8, async (post) => {
    try {
      const articleHtml = await fetchText(post.url);
      const meta = parseArticleMeta(articleHtml, userId);
      post.sourceIp = meta.sourceIp;
      for (const id of meta.candidateIds) candidateIds.add(id);
    } catch {
      post.sourceIp = null;
    }
  });

  const replyArticleUrls = [...new Set(replies.map((reply) => reply.url).filter(Boolean))];
  const replyArticleMetaEntries = await mapWithConcurrency(replyArticleUrls, 8, async (articleUrl) => {
    try {
      const articleHtml = await fetchText(articleUrl);
      const meta = parseArticleMeta(articleHtml, userId);
      for (const id of meta.candidateIds) candidateIds.add(id);
      return [articleUrl, meta];
    } catch {
      return [articleUrl, { author: "", sourceIp: null, candidateIds: [] }];
    }
  });
  const articleMetas = new Map(replyArticleMetaEntries);

  const records = [
    ...posts.map((post) => ({ ...post, kind: "post" })),
    ...replies.map((reply) => ({ ...reply, kind: "reply" })),
  ];
  const targetIps = new Set(records.map((record) => record.sourceIp).filter(Boolean));
  const localSharedIpLinks = await findSharedIpLinks({
    userId,
    targetIps,
    replies,
    articleMetas,
    candidateIds,
    isAll,
  });
  const indexedLinks = indexedIps?.flatMap((ip) => ip.otherUsers) || [];
  sendJson(res, 200, {
    userId,
    mode: isAll ? "all" : "sample",
    totals,
    fetchedAt: new Date().toISOString(),
    posts,
    replies,
    ips: indexedIps || summarizeIps(records, localSharedIpLinks),
    sharedIpLinks: indexedLinks.length ? indexedLinks : localSharedIpLinks,
    sourceIpProvider: indexedIps ? "own-index" : "local-scan",
    note: indexedIps
      ? "Using this repository's own generated index."
      : "Local scan only. Add this user to data/seed-users.json and let GitHub Actions build the index.",
  });
}

async function handleQueueUser(req, res, url) {
  const userId = normalizeUserId(decodeURIComponent(url.pathname.replace("/api/queue/", "")));
  if (!userId) {
    sendJson(res, 400, { error: "invalid user id" });
    return;
  }

  if (queueUrl) {
    const response = await fetch(`${queueUrl.replace(/\/$/, "")}/queue`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    sendJson(res, response.ok ? 200 : response.status, await response.json().catch(() => ({ ok: false })));
    return;
  }

  const pendingUsers = await readJson(pendingUsersPath, []);
  const nextUsers = [...new Set([...pendingUsers, userId])].sort();
  await writeJson(pendingUsersPath, nextUsers);
  sendJson(res, 200, { ok: true, userId, localFallback: true });
}

async function serveStatic(req, res, url) {
  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "content-type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  try {
    if (req.method === "GET" && url.pathname.startsWith("/api/user/")) {
      await handleUserSearch(req, res, url);
      return;
    }
    if (req.method === "POST" && url.pathname.startsWith("/api/queue/")) {
      await handleQueueUser(req, res, url);
      return;
    }
    if (req.method === "GET") {
      await serveStatic(req, res, url);
      return;
    }
    res.writeHead(405);
    res.end("Method not allowed");
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`PTT IP web prototype: http://127.0.0.1:${port}`);
});
