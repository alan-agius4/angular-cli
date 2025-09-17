/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import { CacheStorage, CacheStorageValue } from './cache-storage';
import { LRUCache } from './lru-cache';

/**
 * An in-memory implementation of `CacheStorage` with a configurable LRU cache.
 * This is the default cache used by the `AngularAppEngine` if no other cache is provided.
 */
export class InMemoryCache<V extends CacheStorageValue> implements CacheStorage<V> {
  private readonly lru: LRUCache<string, V>;

  /**
   * Creates an instance of `InMemoryCache`.
   * @param maxEntries The maximum number of entries to store in the cache. Defaults to 2000.
   */
  constructor(maxEntries = 2_000) {
    this.lru = new LRUCache(maxEntries);
  }

  /**
   * Retrieves an item from the in-memory cache.
   * @param key The unique key of the item.
   * @returns A promise that resolves to the cached value, or `null` if not found.
   */
  async getItem(key: string): Promise<V | null> {
    return this.lru.get(key) ?? null;
  }

  /**
   * Adds or updates an item in the in-memory cache.
   * @param key The unique key of the item.
   * @param value The value to store.
   * @returns A promise that resolves when the item is stored.
   */
  async setItem(key: string, value: V): Promise<void> {
    this.lru.put(key, value);
  }

  /**
   * Removes an item from the in-memory cache.
   * @param key The unique key of the item to remove.
   * @returns A promise that resolves when the item is removed.
   */
  async removeItem(key: string): Promise<void> {
    this.lru.delete(key);
  }
}
