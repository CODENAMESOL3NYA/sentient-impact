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
    evictions:number;
}

/**
 * Default maximum number of entries allowed in the cache.
 * When the limit is reached the least-recently-used entry is evicted first.
 */
const DEFAULT_MAX_ENTRIES = 1_000;

export class DiffCacheService{
    /** Insertion/access order is maintained by Map — oldest key is first. */
    private cache:Map<string, CacheEntry<unknown>>=new Map();
    private readonly maxEntries:number;
    private stats: CacheStats ={
        totalKeys:0,
        hits:0,
        misses:0,
        totalBobcoinSaved:0,
        evictions:0,
    };

    constructor(maxEntries:number = DEFAULT_MAX_ENTRIES){
        this.maxEntries = maxEntries;
    }

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

        // Refresh LRU position: delete then re-insert so this key moves to the end of Map insertion order.
        this.cache.delete(key);
        this.cache.set(key, entry as CacheEntry<unknown>);

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
        // If the key already exists, remove it first so the re-insert lands at the end (LRU refresh).
        if(this.cache.has(key)){
            this.cache.delete(key);
        }

        const entry: CacheEntry<T>={
            key,
            data,
            timestamp:Date.now(),
            ttlMs,
            hits:0,
            bobcoinsSaved:0,
        };

        this.cache.set(key,entry as CacheEntry<unknown>);

        // Evict the least-recently-used entry (Map's first element) when over capacity.
        while(this.cache.size > this.maxEntries){
            const lruKey = this.cache.keys().next().value as string;
            this.cache.delete(lruKey);
            this.stats.evictions++;
        }

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
        this.stats = { totalKeys: 0, hits: 0, misses: 0, totalBobcoinSaved: 0, evictions: 0 };
    }
}

export const diffCache = new DiffCacheService();