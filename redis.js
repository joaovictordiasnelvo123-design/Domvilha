import { Redis } from "@upstash/redis";
import { ConfigError } from "./auth.js";

// A integração da Vercel pode criar as variáveis com o prefixo UPSTASH_REDIS_* ou KV_*.
export function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new ConfigError("Banco de dados não conectado. Conecte o Upstash Redis ao projeto na Vercel (Storage) e faça um novo deploy.");
  }
  return new Redis({ url, token });
}

export const KEY_MENU = "dom-vilha:cardapio";
export const KEY_MENU_PREV = "dom-vilha:cardapio:anterior";
