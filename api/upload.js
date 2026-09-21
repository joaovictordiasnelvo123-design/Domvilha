import crypto from "node:crypto";
import { put } from "@vercel/blob";
import { requireAdmin } from "../lib/auth.js";
import { parseImageDataUrl } from "../lib/validate.js";
import { send, sendError, readJson } from "../lib/http.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Método não permitido." });
  }
  try {
    requireAdmin(req);
    const body = await readJson(req);
    const { buffer, contentType, ext } = parseImageDataUrl(body?.image);
    const blob = await put(`cardapio/${crypto.randomUUID()}.${ext}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: true,
    });
    return send(res, 200, { url: blob.url });
  } catch (e) {
    return sendError(res, e);
  }
}
