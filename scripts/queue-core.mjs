export function normalizeUserId(value) {
  const userId = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,32}$/.test(userId)) return null;
  return userId;
}

export function uniqueQueueUsers(rows) {
  const seen = new Set();
  const users = [];

  for (const row of rows || []) {
    const rawUserId = typeof row === "string" ? row : row.user_id || row.userId;
    const userId = normalizeUserId(rawUserId);
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    users.push(userId);
  }

  return users;
}

export function mergeSeedUsers(existingUsers, queueUsers) {
  return uniqueQueueUsers([...(existingUsers || []), ...(queueUsers || [])]);
}
