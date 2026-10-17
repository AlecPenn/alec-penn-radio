// Real listener count for Alec Penn Radio.
// Each tuned-in browser checks in every 30s; anyone not seen for 75s drops off.
// Needs a free Upstash Redis database connected to this Vercel project
// (Vercel → Storage → Upstash). Without it, the site simply hides the counter.
const KEY = "apr:listeners";
const STALE_MS = 75000;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return res.status(200).json({ count: null });

  const now = Date.now();
  const id = String((req.query && req.query.id) || "").replace(/[^a-z0-9]/gi, "").slice(0, 32);
  const cmds = [["ZREMRANGEBYSCORE", KEY, "0", String(now - STALE_MS)]];
  if (req.method === "POST" && id) cmds.push(["ZADD", KEY, String(now), id]);
  if (req.method === "DELETE" && id) cmds.push(["ZREM", KEY, id]);
  cmds.push(["ZCARD", KEY]);
  try {
    const r = await fetch(url.replace(/\/$/, "") + "/pipeline", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
    });
    const j = await r.json();
    const count = Array.isArray(j) ? j[j.length - 1]?.result : null;
    return res.status(200).json({ count: typeof count === "number" ? count : null });
  } catch (e) {
    return res.status(200).json({ count: null });
  }
}
