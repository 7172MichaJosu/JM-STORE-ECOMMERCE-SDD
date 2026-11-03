import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { createHash } from "node:crypto";
const handler = (req, res) =>
  res
    .status(429)
    .json({
      error: {
        code: "RATE_LIMIT",
        message: "Demasiados intentos. Espera antes de volver a intentar.",
        requestId: req.requestId,
      },
    });
export const limiter = (limit, windowMs = 60000, keyGenerator) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler,
    ...(keyGenerator ? { keyGenerator } : {}),
  });
const accountKey = (req) =>
  ipKeyGenerator(req.ip) +
  ":" +
  createHash("sha256")
    .update(
      String(req.body?.email || "")
        .trim()
        .toLowerCase(),
    )
    .digest("hex");
export const loginLimit = () => limiter(10, 15 * 60 * 1000, accountKey);
export const registrationLimit = () => limiter(5, 15 * 60 * 1000, accountKey);
export const checkoutLimit = () =>
  limiter(20, 60000, (req) =>
    req.user ? "user:" + req.user.id : ipKeyGenerator(req.ip),
  );
