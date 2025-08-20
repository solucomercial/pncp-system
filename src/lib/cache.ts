interface CacheEntry {
 isViable: boolean;
 timestamp: number;
}

const CACHE_TTL = 24 * 60 * 60 * 1000;

const analysisCache = new Map<string, CacheEntry>();

export function getCachedAnalysis(numeroControlePNCP: string): boolean | null {
 const entry = analysisCache.get(numeroControlePNCP);

 if (!entry) {
  return null;
 }

 const isExpired = (Date.now() - entry.timestamp) > CACHE_TTL;
 if (isExpired) {
  analysisCache.delete(numeroControlePNCP);
  return null;
 }

 return entry.isViable;
}

export function setCachedAnalysis(numeroControlePNCP: string, isViable: boolean): void {
 const entry: CacheEntry = {
  isViable,
  timestamp: Date.now(),
 };
 analysisCache.set(numeroControlePNCP, entry);
}

export function clearAnalysisCache(): void {
 analysisCache.clear();
 console.log("Cache de análise de licitações foi limpo.");
}