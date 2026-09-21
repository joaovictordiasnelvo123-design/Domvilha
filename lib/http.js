import { AuthError, ConfigError } from "./auth.js";
import { ValidationError } from "./validate.js";

export function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(body));
}

export function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff) return xff.split(",")[0].trim();
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "desconhecido";
}

// A Vercel já converte JSON em objeto (req.body); este helper cobre os outros casos.
export async function readJson(req) {
  let body = req.body;
  if (body === undefined) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    body = Buffer.concat(chunks).toString("utf8");
  }
  if (Buffer.isBuffer(body)) body = body.toString("utf8");
  if (typeof body === "string") {
    try { return JSON.parse(body); } catch { return null; }
  }
  return body ?? null;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Converte erros conhecidos em respostas claras; o resto vira 500 genérico (detalhes só no log).
export function sendError(res, e) {
  if (e instanceof ValidationError) return send(res, 400, { error: e.message });
  if (e instanceof AuthError) return send(res, 401, { error: e.message });
  if (e instanceof ConfigError) return send(res, 500, { error: e.message });
  console.error(e);
  return send(res, 500, { error: "Erro interno. Tente novamente em instantes." });
}
