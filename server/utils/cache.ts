import { createHash } from 'node:crypto';

/**
 * Cache Entry definition
 */

export interface CacheEntry<T>{
    key:string;
    data:T;
    timestamp:number;
    ttlMs:number;
    hits:number;
    bobcoinsSaved:number;
}

export interface CacheStats{
    totalKeys:number;
    hits:number;
    misses:number;
    totalBobcoinSaved:number;
}

export class DiffCacheService{
    private cache:Map<string, CacheEntry<unknown>>=new Map();
    private stats: CacheStats ={
        totalKeys:0,
        hits:0,
        misses:0,
        totalBobcoinSaved:0
    };

    /**
     * Generates a deterministic SHA-256 hash from a normalized git diff payload.
     * Normalization strips trailing whitespaces and line endings
     * to guarantee identical diffs always produce the extact fingerprint
     */

    public generateDiffHash(diff:string,prId?:string):string{
        const normalizedDiff = diff.replace(/\r\n/g, '\n').trim();
        const payload = prId ? `${prId}::${normalizedDiff}`:normalizedDiff;
        return createHash('sha256').update(payload).digest('hex');
    }

    /**
     * Retrieves an entry if present and not expired. Increments hit counter
     */
    public get<T>(key:string): T | null{
        const entry = this.cache.get(key) as CacheEntry<T> | undefined;

        if(!entry){
            this.stats.misses++;
            return null;
        }

        const now = Date.now();
        if(now - entry.timestamp>entry.ttlMs){
            this.cache.delete(key);
            this.stats.totalKeys=this.cache.size;
            this.stats.misses++;
            return null;
        }

        entry.hits++
        //Each cache hit on an analyze-pr call prevents 1 full dual-agent run
        const savedCoins = 1.25;
        entry.bobcoinsSaved+=savedCoins;
        this.stats.hits++;
        this.stats.totalBobcoinSaved+=savedCoins;

        return entry.data;
    }

    /**
     * Caches an entry with a configurable TTL
     */
    public set<T>(key:string, data:T,ttlMs =3600000):void{
        const entry: CacheEntry<T>={
            key,
            data,
            timestamp:Date.now(),
            ttlMs,
            hits:0,
            bobcoinsSaved:0,
        };

        this.cache.set(key,entry as CacheEntry<unknown>);
        this.stats.totalKeys = this.cache.size;
    }

    /**
     * Return telemetry stats for monitoring cache efficiency and Bobcoin protection
     */

    public getStats():CacheStats{
        return{...this.stats};
    }

    /**
     * Clears all cache entries
     */
    public clear():void{
        this.cache.clear();
        this.stats.totalKeys=0;

    }
}

export const diffCache = new DiffCacheService();