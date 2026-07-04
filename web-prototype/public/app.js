const input = document.querySelector("#userId");
const button = document.querySelector("#searchButton");
const statusEl = document.querySelector("#status");
const summaryEl = document.querySelector("#summary");
const contentEl = document.querySelector("#content");
const tabs = [...document.querySelectorAll(".tab")];

let activeTab = "posts";
let currentResult = null;
let postDisplayLimit = 100;

button.addEventListener("click", search);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") search();
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeTab = tab.dataset.tab;
    tabs.forEach((item) => item.classList.toggle("active", item === tab));
    render();
  });
});

async function search() {
  const userId = input.value.trim();
  if (!userId) {
    statusEl.textContent = "請輸入使用者 ID。";
    return;
  }

  button.disabled = true;
  currentResult = null;
  summaryEl.textContent = "";
  contentEl.innerHTML = "";
  statusEl.textContent = "完整掃描中：目前使用本機即時掃描。要像索引網站一樣快，需要先建立自己的本機索引。";

  try {
    const response = await fetch(`/api/user/${encodeURIComponent(userId)}?limit=all`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "查詢失敗");
    currentResult = data;
    queueUserForIndex(userId);
    statusEl.textContent = `完成：發文 ${data.posts.length}/${data.totals?.articles ?? "?"}，留言 ${data.replies.length}/${data.totals?.replies ?? "?"}，來源 IP ${data.ips.length}，同 IP 帳號線索 ${data.sharedIpLinks.length}。`;
    render();
  } catch (error) {
    currentResult = null;
    statusEl.textContent = error instanceof Error ? error.message : "查詢失敗";
    render();
  } finally {
    button.disabled = false;
  }
}

async function queueUserForIndex(userId) {
  try {
    await fetch(`/api/queue/${encodeURIComponent(userId)}`, { method: "POST" });
  } catch {
    // Queueing is best-effort; search results should not fail because queueing failed.
  }
}

function render() {
  if (!currentResult) {
    summaryEl.textContent = "";
    contentEl.innerHTML = "";
    return;
  }

  summaryEl.innerHTML = `
    <span class="result-id">目前結果：${escapeHtml(currentResult.userId)}</span>
    <span class="scan-mode">來源 IP：${currentResult.sourceIpProvider === "own-index" ? "自建索引" : "本機掃描"}</span>
  `;

  if (activeTab === "posts") renderPosts();
  if (activeTab === "ips") renderIps();
}

function renderPosts() {
  if (currentResult.sourceIpProvider === "own-index" && currentResult.posts.length === 0 && currentResult.replies.length === 0) {
    contentEl.innerHTML = `
      <div class="warning">
        目前使用自建索引快速結果，只顯示來源 IP 分析。推發文紀錄需要另外做背景載入，或使用本機完整掃描模式。
      </div>
    `;
    return;
  }

  const posts = currentResult.posts.slice(0, postDisplayLimit);
  const replies = currentResult.replies.slice(0, postDisplayLimit);

  contentEl.innerHTML = `
    <div class="post-toolbar">
      <label for="postDisplayLimit">推發文顯示筆數</label>
      <select id="postDisplayLimit">
        ${[20, 50, 100, 200, 500].map((value) => `
          <option value="${value}" ${postDisplayLimit === value ? "selected" : ""}>最近 ${value} 筆</option>
        `).join("")}
      </select>
      <span>來源 IP 分析不受此選項影響，固定使用完整掃描資料。</span>
    </div>
    <div class="section-title">發文紀錄 <span>顯示 ${posts.length} / ${currentResult.posts.length} 筆</span></div>
    <div class="grid">
      ${posts.map((post) => `
        <article class="item">
          <div class="item-title">${escapeHtml(post.title)}</div>
          <div class="meta">
            看板：${escapeHtml(post.board || "-")}<br>
            日期：${escapeHtml(post.dateText || "-")}<br>
            發文來源 IP：<strong>${post.sourceIp ? escapeHtml(post.sourceIp) : "來源頁未提供或解析失敗"}</strong><br>
            <a href="${post.url}" target="_blank" rel="noreferrer">開啟文章</a>
          </div>
        </article>
      `).join("") || `<div class="warning">沒有發文紀錄。</div>`}
    </div>
    <div class="section-title">推噓留言紀錄 <span>顯示 ${replies.length} / ${currentResult.replies.length} 筆</span></div>
    <div class="grid">
      ${replies.map((reply) => `
        <article class="item">
          <div class="item-title">${escapeHtml(reply.type || "留言")} ${escapeHtml(reply.title)}</div>
          <div class="meta">
            看板：${escapeHtml(reply.board || "-")}<br>
            原作者：${escapeHtml(reply.articleAuthor || "-")}<br>
            內容：${escapeHtml(reply.content || "-")}<br>
            你的留言來源 IP：<strong>${reply.sourceIp ? escapeHtml(reply.sourceIp) : "來源頁未提供或解析失敗"}</strong><br>
            時間：${escapeHtml(reply.dateText || "-")}<br>
            <a href="${reply.url}" target="_blank" rel="noreferrer">開啟文章</a>
          </div>
        </article>
      `).join("") || `<div class="warning">沒有留言紀錄。</div>`}
    </div>
  `;

  const picker = document.querySelector("#postDisplayLimit");
  picker.addEventListener("change", () => {
    postDisplayLimit = Number(picker.value);
    renderPosts();
  });
}

function renderIps() {
  if (currentResult.ips.length === 0) {
    contentEl.innerHTML = `<div class="warning">目前沒有解析到公開來源 IP。</div>`;
    return;
  }

  contentEl.innerHTML = `
    <div class="warning">
      同 IP 只代表線索，不代表同一人。目前優先使用本專案自己的索引資料；索引尚未涵蓋的 ID 會退回本機即時掃描。
    </div>
    <div class="ip-list">
      ${currentResult.ips.map((ip) => renderIpCard(ip)).join("")}
    </div>
  `;
}

function renderIpCard(ip) {
  const otherUsers = ip.otherUsers || [];
  return `
    <article class="ip-card">
      <div class="ip-head">
        <div>
          <div class="ip-address">${escapeHtml(ip.ip)}</div>
          <div class="meta">${formatIpMeta(ip)}</div>
        </div>
        <div class="match-count">${otherUsers.length} 個其他 ID</div>
      </div>
      <div class="other-users">
        ${otherUsers.length === 0 ? `<div class="no-match">目前自建索引/本機掃描未找到其他 ID 使用此 IP。</div>` : ""}
        ${otherUsers.map((user) => `
          <div class="user-match">
            <strong>${escapeHtml(user.otherUserId)}</strong>
            <span>${user.evidenceCount} 筆同 IP</span>
            <span>${escapeHtml(user.reason)}</span>
            <div class="evidence-links">
              ${user.evidenceUrls.slice(0, 8).map((url) => `<a href="${url}" target="_blank" rel="noreferrer">證據</a>`).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function labelKind(kind) {
  if (kind === "post") return "發文";
  if (kind === "reply") return "留言";
  return kind;
}

function formatIpMeta(ip) {
  const date = ip.lastSeenText ? new Date(ip.lastSeenText).toLocaleDateString("zh-TW") : "";
  const country = ip.country ? `${escapeHtml(ip.country)} ・ ` : "";
  const kinds = (ip.kinds || []).map(labelKind).join(" / ");
  return `${country}${date || kinds}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
