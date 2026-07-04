function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
    },
  });
}

function normalizeUserId(value) {
  const userId = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,32}$/.test(userId)) return null;
  return userId;
}

function authorized(request, env) {
  if (!env.QUEUE_TOKEN) return true;
  return request.headers.get("authorization") === `Bearer ${env.QUEUE_TOKEN}`;
}

async function enqueue(request, env) {
  const body = await request.json().catch(() => ({}));
  const userId = normalizeUserId(body.userId || body.user_id);
  if (!userId) return json({ error: "invalid user id" }, 400);

  await env.DB.prepare(`
    INSERT INTO index_requests (user_id, request_count, status)
    VALUES (?, 1, 'pending')
    ON CONFLICT(user_id) DO UPDATE SET
      request_count = request_count + 1,
      status = 'pending',
      last_requested_at = CURRENT_TIMESTAMP
  `).bind(userId).run();

  return json({ ok: true, userId });
}

async function listQueue(request, env) {
  if (!authorized(request, env)) return json({ error: "unauthorized" }, 401);

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 50)));
  const result = await env.DB.prepare(`
    SELECT user_id, request_count, last_requested_at
    FROM index_requests
    WHERE status = 'pending'
    ORDER BY request_count DESC, last_requested_at ASC
    LIMIT ?
  `).bind(limit).all();

  return json({ users: result.results || [] });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return json({ ok: true });

    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/queue") {
      return enqueue(request, env);
    }
    if (request.method === "GET" && url.pathname === "/queue") {
      return listQueue(request, env);
    }

    return json({ ok: true, service: "ptt-ip-index-worker" });
  },
};
