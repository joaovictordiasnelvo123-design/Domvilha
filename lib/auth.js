import crypto from "node:crypto";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // sessão de 7 dias

export class ConfigError extends Error {}
export class AuthError extends Error {}

function need(name) {
  const v = process.env[name];
  if (!v) throw new ConfigError(`Variável ${name} não configurada na Vercel (Settings > Environment Variables).`);
  return v;
}

const sha256 = (s) => crypto.createHash("sha256").update(s).digest();

// A chave da assinatura depende do segredo E da senha:
// trocar qualquer um dos dois derruba todas as sessões abertas.
function signingKey() {
  return sha256(`${need("ADMIN_SECRET")}|${need("ADMIN_PASSWORD")}`);
}

const sign = (payload) => crypto.createHmac("sha256", signingKey()).update(payload).digest("base64url");

export function passwordMatches(input) {
  const expected = sha256(need("ADMIN_PASSWORD"));
  const given = sha256(String(input ?? ""));
  return crypto.timingSafeEqual(expected, given);
}

export function issueToken(now = Date.now()) {
  const exp = now + TOKEN_TTL_MS;
  return { token: `${exp}.${sign(String(exp))}`, exp };
}

export function verifyToken(token, now = Date.now()) {
  if (typeof token !== "string") return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= now) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(expStr));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function requireAdmin(req) {
  const h = req.headers["authorization"] || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m || !verifyToken(m[1].trim())) throw new AuthError("Sessão inválida ou expirada.");
}
