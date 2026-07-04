# PTT IP Index

Free, local-first PTT public source IP indexing prototype.

This project does not depend on Plytic data. GitHub Actions runs a small scheduled crawler, stores the generated index in `data/ip-index.json`, and the web prototype can use that index to show shared-IP clues.

## Free Architecture

- GitHub public repository: hosts code and scheduled Actions.
- GitHub Actions: crawls a small batch of seed users every 6 hours.
- Cloudflare Worker + D1: optional free queue for IDs searched by users.
- JSON index: stores `IP -> user IDs` and `user ID -> IPs` evidence.
- Web prototype: local UI for testing search and source IP analysis.

## Local Commands

```bash
npm test
npm run index:users
npm run serve
```

Open:

```text
http://127.0.0.1:5179
```

## Seed Users

Edit `data/seed-users.json` to decide which PTT IDs the free crawler should index.

## Optional Cloudflare Queue

Deploy `cloudflare-worker/` when you want users of the web app or APK to submit IDs for indexing without exposing a GitHub token.

1. Create a Cloudflare D1 database named `ptt_ip_index`.
2. Copy `cloudflare-worker/wrangler.toml.example` to `cloudflare-worker/wrangler.toml`.
3. Put the D1 database id into `wrangler.toml`.
4. Set `QUEUE_TOKEN` to a random secret.
5. Run the D1 schema:

```bash
cd cloudflare-worker
npm install
npm run d1:migrate
npm run deploy
```

6. Add GitHub repository secrets:

```text
PTT_INDEX_QUEUE_URL=https://your-worker.your-subdomain.workers.dev
PTT_INDEX_QUEUE_TOKEN=the-same-random-secret
```

After that, GitHub Actions imports queued IDs before each scheduled index update.

## Limits

This free version builds the index gradually. It will not instantly cover all PTT users. Shared IP is only a clue and does not prove two accounts belong to the same person.
