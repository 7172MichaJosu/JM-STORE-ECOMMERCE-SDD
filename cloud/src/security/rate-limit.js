import { createHmac } from "node:crypto";
import { fail } from "../../../shared/domain/index.js";
export function limit(name, max, seconds, account = false) {
  return async (req, res, next) => {
    const ip =
      req.get("cf-connecting-ip") || req.socket.remoteAddress || "local";
    const identity = account
      ? `${ip}:${String(req.body?.email || "")
          .trim()
          .toLowerCase()}`
      : req.user && name === "checkout"
        ? `user:${req.user.id}`
        : ip;
    const key = createHmac("sha256", req.config.rateSecret)
      .update(name + ":" + identity)
      .digest("hex");
    const now = Math.floor(Date.now() / 1000),
      start = Math.floor(now / seconds) * seconds;
    const r = await req.db.first(
      "INSERT INTO rate_limit_buckets(bucket_key,window_start,expires_at,count) VALUES(?,?,?,1) ON CONFLICT(bucket_key,window_start) DO UPDATE SET count=count+1 RETURNING count",
      key,
      start,
      start + seconds,
    );
    if (r.count > max) {
      res.setHeader("Retry-After", String(start + seconds - now));
      fail(
        429,
        "RATE_LIMIT",
        "Demasiados intentos. Espera antes de volver a intentar.",
      );
    }
    next();
  };
}
