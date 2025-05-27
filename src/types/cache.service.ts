/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

// Cache configuration constants
export const CACHE_CONFIG = {
  TTL: {
    SHORT: 180,    // 3 minutes for frequently changing data
    MEDIUM: 600,   // 10 minutes for moderate data
    LONG: 1800,    // 30 minutes for stable data
    EXTENDED: 3600, // 1 hour for very stable data
  },
  PREFETCH_PAGES: 3,
  BATCH_SIZE: 100,
  MEMORY_CACHE_SIZE: 1000,
  MEMORY_CACHE_TTL: 60000, // 1 minute
  CATEGORY_MEMORY_SIZE: 500,
  CATEGORY_MEMORY_TTL: 120000, // 2 minutes
};

// Cache tag enum for better organization
export enum CacheTag {
  PRODUCT = 'product',
  ADMIN_PRODUCTS = 'admin_products',
  ALL_PRODUCTS = 'all_products',
  STOCK_OUT = 'stock_out',
  POPULAR = 'popular',
  CATEGORY = 'category',
  ALL_CATEGORIES = 'all_categories',
  CATEGORY_SEARCH = 'category_search',
  CATEGORY_WITH_COUNT = 'category_count',
  ORDER = "ORDER",
  ALL_ORDERS = "ALL_ORDERS",
  USER_ORDERS = "USER_ORDERS",
  ORDER_STATS = "ORDER_STATS",
}

// Cache key generators
export class CacheKeyGenerator {
  static orderByReference(reference: string) {
    throw new Error('Method not implemented.');
  }
  static recentOrders(safeLimit: number) {
    throw new Error('Method not implemented.');
  }
  static orderStats() {
    throw new Error('Method not implemented.');
  }
  // Product cache keys
  static product(id: string): string {
    return `p:${id}`;
  }
  
  static products(page: number, limit: number, search?: string): string {
    return `ps:${page}:${limit}:${search || 'none'}`;
  }
  
  static adminProducts(adminId: string, page: number, limit: number): string {
    return `ap:${adminId}:${page}:${limit}`;
  }
  
  static categoryProducts(categoryId: string, page: number, limit: number): string {
    return `cp:${categoryId || 'all'}:${page}:${limit}`;
  }
  
  static popular(limit: number): string {
    return `pop:${limit}`;
  }
  
  static stockOut(filter: string): string {
    return `so:${Buffer.from(filter).toString('base64').slice(0, 32)}`;
  }
  
  static lowStock(threshold: number): string {
    return `ls:${threshold}`;
  }

  // Category cache keys
  static category(identifier: string): string {
    return `c:${identifier}`;
  }
  
  static categoryList(page: number, limit: number): string {
    return `cl:${page}:${limit}`;
  }
  
  static categorySearch(keyword: string, page: number, limit: number): string {
    return `cs:${Buffer.from(keyword).toString('base64').slice(0, 16)}:${page}:${limit}`;
  }
  
  static simpleCategories(): string {
    return 'c:simple';
  }
  
  static categoriesWithCount(): string {
    return 'c:count';
  }
}

interface MemoryCacheEntry {
  data: any;
  expiry: number;
}

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly isProd: boolean;
  private  redisClient: any;
  
  // In-memory caches for different services
  private readonly productMemoryCache = new Map<string, MemoryCacheEntry>();
  private readonly categoryMemoryCache = new Map<string, MemoryCacheEntry>();
  
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {
    this.isProd = this.configService.get<string>('NODE_ENV') === 'production';
  }

  async onModuleInit() {
    this.initializeRedisClient();
    this.setupPeriodicCleanup();
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Initialize Redis client for advanced operations
   */
  private initializeRedisClient(): void {
    try {
      if ((this.cacheManager as any).store?.getClient) {
        this.redisClient = (this.cacheManager as any).store.getClient();
      } else if ((this.cacheManager as any).store?.scanStream) {
        this.redisClient = (this.cacheManager as any).store;
      } else if ((this.cacheManager as any).client) {
        this.redisClient = (this.cacheManager as any).client;
      }
      this.logger.log('Redis client initialized successfully');
    } catch (error) {
      this.logger.warn('Redis client initialization failed, using fallback methods', error);
    }
  }

  /**
   * Setup periodic cleanup for memory caches
   */
  private setupPeriodicCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupMemoryCache();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Clean up expired memory cache entries
   */
  private cleanupMemoryCache(): void {
    //const now = Date.now();
    
    // Clean product cache
    this.cleanupSpecificCache(
      this.productMemoryCache, 
      CACHE_CONFIG.MEMORY_CACHE_SIZE, 
      'product'
    );
    
    // Clean category cache
    this.cleanupSpecificCache(
      this.categoryMemoryCache, 
      CACHE_CONFIG.CATEGORY_MEMORY_SIZE, 
      'category'
    );
  }

  /**
   * Clean up specific memory cache
   */
  private cleanupSpecificCache(
    cache: Map<string, MemoryCacheEntry>, 
    maxSize: number, 
    cacheType: string
  ): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Remove expired entries
    for (const [key, value] of cache.entries()) {
      if (value.expiry < now) {
        cache.delete(key);
        cleanedCount++;
      }
    }
    
    // If cache is too large, remove oldest entries
    if (cache.size > maxSize) {
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => a[1].expiry - b[1].expiry);
      
      const toRemove = entries.slice(0, cache.size - maxSize);
      toRemove.forEach(([key]) => cache.delete(key));
      cleanedCount += toRemove.length;
    }
    
    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} ${cacheType} cache entries`);
    }
  }

  /**
   * Get appropriate memory cache based on cache type
   */
  private getMemoryCache(cacheType: 'product' | 'category'): Map<string, MemoryCacheEntry> {
    return cacheType === 'product' ? this.productMemoryCache : this.categoryMemoryCache;
  }

  /**
   * Get appropriate TTL based on cache type
   */
  private getMemoryTTL(cacheType: 'product' | 'category'): number {
    return cacheType === 'product' 
      ? CACHE_CONFIG.MEMORY_CACHE_TTL 
      : CACHE_CONFIG.CATEGORY_MEMORY_TTL;
  }

  /**
   * Enhanced memory cache with TTL
   */
  private setMemoryCache(
    key: string, 
    data: any, 
    cacheType: 'product' | 'category',
    ttl?: number
  ): void {
    const cache = this.getMemoryCache(cacheType);
    const defaultTTL = this.getMemoryTTL(cacheType);
    
    cache.set(key, {
      data,
      expiry: Date.now() + (ttl || defaultTTL)
    });
  }

  /**
   * Get from memory cache
   */
  private getFromMemoryCache(
    key: string, 
    cacheType: 'product' | 'category'
  ): any | null {
    const cache = this.getMemoryCache(cacheType);
    const entry = cache.get(key);
    
    if (!entry) return null;
    
    if (entry.expiry < Date.now()) {
      cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Multi-level cache get (memory -> Redis)
   */
  async get<T>(
    key: string, 
    cacheType: 'product' | 'category' = 'product'
  ): Promise<T | null> {
    try {
      // Check memory cache first
      const memoryResult = this.getFromMemoryCache(key, cacheType);
      if (memoryResult) {
        this.logger.debug(`Memory cache hit: ${key}`);
        return memoryResult;
      }
      
      // Check Redis cache
      const redisResult = await this.cacheManager.get<T>(key);
      if (redisResult) {
        // Store in memory cache for faster access
        this.setMemoryCache(key, redisResult, cacheType);
        this.logger.debug(`Redis cache hit: ${key}`);
        return redisResult;
      }
      
      this.logger.debug(`Cache miss: ${key}`);
      return null;
    } catch (error) {
      this.logger.warn(`Cache get failed for key: ${key}`, error);
      return null;
    }
  }

  /**
   * Multi-level cache set (memory + Redis)
   */
  async set(
    key: string, 
    data: any, 
    ttl: number, 
    cacheType: 'product' | 'category' = 'product'
  ): Promise<void> {
    try {
      // Set in memory cache
      this.setMemoryCache(key, data, cacheType, ttl * 1000);
      
      // Set in Redis cache
      await this.cacheManager.set(key, data, ttl);
      
      this.logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      this.logger.warn(`Cache set failed for key: ${key}`, error);
    }
  }

  /**
   * Delete specific cache key
   */
  async delete(key: string, cacheType: 'product' | 'category' = 'product'): Promise<void> {
    try {
      // Remove from memory cache
      const cache = this.getMemoryCache(cacheType);
      cache.delete(key);
      
      // Remove from Redis cache
      await this.cacheManager.del(key);
      
      this.logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      this.logger.warn(`Cache delete failed for key: ${key}`, error);
    }
  }

  /**
   * Get keys by pattern (Redis only)
   */
  async getKeysByPattern(pattern: string): Promise<string[]> {
    if (!this.redisClient?.scanStream) {
      this.logger.warn('Redis scanStream not available for pattern matching');
      return [];
    }

    try {
      return new Promise((resolve, reject) => {
        const keys: string[] = [];
        const stream = this.redisClient.scanStream({
          match: pattern,
          count: 200,
        });
        
        stream.on('data', (resultKeys: string[]) => {
          keys.push(...resultKeys);
        });
        
        stream.on('end', () => resolve(keys));
        stream.on('error', reject);
        
        // Add timeout
        setTimeout(() => {
          stream.destroy();
          resolve(keys);
        }, 5000);
      });
    } catch (error) {
      this.logger.warn(`Pattern scan failed: ${pattern}`, error);
      return [];
    }
  }

  /**
   * Get cache patterns for a specific tag
   */
  private getCachePatternsForTag(tag: CacheTag): string[] {
    switch (tag) {
      case CacheTag.PRODUCT:
        return ['p:*'];
      case CacheTag.ADMIN_PRODUCTS:
        return ['ap:*'];
      case CacheTag.ALL_PRODUCTS:
        return ['ps:*'];
      case CacheTag.STOCK_OUT:
        return ['so:*'];
      case CacheTag.POPULAR:
        return ['pop:*'];
      case CacheTag.CATEGORY:
        return ['c:*'];
      case CacheTag.ALL_CATEGORIES:
        return ['cl:*'];
      case CacheTag.CATEGORY_SEARCH:
        return ['cs:*'];
      case CacheTag.CATEGORY_WITH_COUNT:
        return ['c:count', 'c:simple'];
      default:
        return [];
    }
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Optimized cache invalidation with batching
   */
  async invalidateByTag(tag: CacheTag): Promise<void> {
    const patterns = this.getCachePatternsForTag(tag);
    
    await Promise.all(patterns.map(async (pattern) => {
      const keys = await this.getKeysByPattern(pattern);
      if (keys.length === 0) return;
      
      // Clear memory cache entries
      const cacheType = this.getCacheTypeFromTag(tag);
      const memoryCache = this.getMemoryCache(cacheType);
      keys.forEach(key => memoryCache.delete(key));
      
      // Batch delete from Redis
      const batches = this.createBatches(keys, CACHE_CONFIG.BATCH_SIZE);
      await Promise.all(batches.map(batch => 
        Promise.allSettled(batch.map(key => this.cacheManager.del(key)))
      ));
      
      this.logger.debug(`Invalidated ${keys.length} keys for pattern: ${pattern}`);
    }));
  }

  /**
   * Get cache type from tag
   */
  private getCacheTypeFromTag(tag: CacheTag): 'product' | 'category' {
    const categoryTags = [
      CacheTag.CATEGORY, 
      CacheTag.ALL_CATEGORIES, 
      CacheTag.CATEGORY_SEARCH, 
      CacheTag.CATEGORY_WITH_COUNT
    ];
    
    return categoryTags.includes(tag) ? 'category' : 'product';
  }

  /**
   * Invalidate multiple cache tags
   */
  async invalidateMultipleTags(tags: CacheTag[]): Promise<void> {
    await Promise.allSettled(
      tags.map(tag => this.invalidateByTag(tag))
    );
  }

  /**
   * Invalidate admin-specific product caches
   */
  async invalidateAdminProductCaches(adminId: string): Promise<void> {
    const pattern = `ap:${adminId}:*`;
    const keys = await this.getKeysByPattern(pattern);
    
    if (keys.length > 0) {
      // Clear from memory cache
      keys.forEach(key => this.productMemoryCache.delete(key));
      
      // Clear from Redis
      const batches = this.createBatches(keys, CACHE_CONFIG.BATCH_SIZE);
      await Promise.all(batches.map(batch => 
        Promise.allSettled(batch.map(key => this.cacheManager.del(key)))
      ));
      
      this.logger.debug(`Invalidated ${keys.length} admin product cache keys`);
    }
  }

  /**
   * Cache health check and metrics
   */
  async getMetrics(): Promise<any> {
    return {
      productMemoryCache: {
        size: this.productMemoryCache.size,
        maxSize: CACHE_CONFIG.MEMORY_CACHE_SIZE,
      },
      categoryMemoryCache: {
        size: this.categoryMemoryCache.size,
        maxSize: CACHE_CONFIG.CATEGORY_MEMORY_SIZE,
      },
      redis: {
        connected: !!this.redisClient,
      },
      config: CACHE_CONFIG,
    };
  }

  /**
   * Clear all caches (use with caution)
   */
  async clearAll(): Promise<void> {
    try {
      // Clear memory caches
      this.productMemoryCache.clear();
      this.categoryMemoryCache.clear();
      
      // Clear Redis cache (if available)
      if (this.redisClient?.flushdb) {
        await this.redisClient.flushdb();
      } else {
        // Fallback: try to get all keys and delete them
        const allPatterns = ['p:*', 'ps:*', 'ap:*', 'cp:*', 'pop:*', 'so:*', 'ls:*', 'c:*', 'cl:*', 'cs:*'];
        for (const pattern of allPatterns) {
          const keys = await this.getKeysByPattern(pattern);
          if (keys.length > 0) {
            await Promise.allSettled(keys.map(key => this.cacheManager.del(key)));
          }
        }
      }
      
      this.logger.log('All caches cleared successfully');
    } catch (error) {
      this.logger.error('Failed to clear all caches', error);
      throw error;
    }
  }

  /**
   * Warm up cache with common queries
   */
  async warmup(warmupCallback?: () => Promise<void>): Promise<void> {
    try {
      if (warmupCallback) {
        await warmupCallback();
      }
      this.logger.log('Cache warmup completed');
    } catch (error) {
      this.logger.error('Cache warmup failed', error);
    }
  }
}