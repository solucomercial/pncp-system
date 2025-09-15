import { PncpLicitacao } from './types';

interface CacheEntry {
 licitacoes: PncpLicitacao[];
 timestamp: number;
}

const CACHE_TTL = 60 * 60 * 1000;

const apiCache = new Map<string, CacheEntry>();

export function getCachedApiResult(cacheKey: string): PncpLicitacao[] | null {
 const entry = apiCache.get(cacheKey);

 if (!entry) {
  return null;
 }

 const isExpired = (Date.now() - entry.timestamp) > CACHE_TTL;
 if (isExpired) {
  apiCache.delete(cacheKey);
  console.log(`♻️  Cache da API expirado para a chave: ${cacheKey}`);
  return null;
 }

 console.log(`✅ Resultado encontrado no cache da API para a chave: ${cacheKey}`);
 return entry.licitacoes;
}

export function setCachedApiResult(cacheKey: string, licitacoes: PncpLicitacao[]): void {
 const entry: CacheEntry = {
  licitacoes,
  timestamp: Date.now(),
 };
 apiCache.set(cacheKey, entry);
 console.log(`💾 Resultado da API salvo no cache com a chave: ${cacheKey}`);
}

export function clearApiCache(): void {
 apiCache.clear();
 console.log("🧹 Cache de resultados da API foi limpo.");
}