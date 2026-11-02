import { getRedis } from "../lib/redis.js";
import { passwordMatches, issueToken } from "../lib/auth.js";
import { send, sendError, readJson, clientIp, sleep } from "../lib/http.js";

const MAX_ATTEMPTS = 8;      // tentativas por IP...
const WINDOW_SECONDS = 15 * 60; // ...a cada 15 minutos

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Método não permitido." });
  }
  try {
    const redis = getRedis();
    const key = `dom-vilha:rl:login:${clientIp(req)}`;
    const attempts = await redis.incr(key);
    if (attempts === 1) await redis.expire(key, WINDOW_SECONDS);
    if (attempts > MAX_ATTEMPTS) {
      if ((await redis.ttl(key)) < 0) await redis.expire(key, WINDOW_SECONDS); // nunca fica bloqueado para sempre
      return send(res, 429, { error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." });
    }

    const body = await readJson(req);
    const password = typeof body?.password === "string" ? body.password : "";
    if (!password || !passwordMatches(password)) {
      await sleep(400);
      return send(res, 401, { error: "Senha incorreta." });
    }

    await redis.del(key);
    return send(res, 200, issueToken());
  } catch (e) {
    return sendError(res, e);
  }
}
