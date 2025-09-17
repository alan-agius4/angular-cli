/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * Represents the types of values that can be stored in the cache.
 * It can be `null`, `string`, `number`, `boolean`, or a plain `object`.
 */
export type CacheStorageValue = null | string | number | boolean | object;

/**
 * Represents a storage interface for caching data.
 * This interface is compatible with the popular `unstorage` library.
 */
export interface CacheStorage<V extends CacheStorageValue = CacheStorageValue> {
  /**
   * Retrieves an item from the cache.
   * @param key The unique key of the item in the cache.
   * @returns A promise that resolves to the cached value, or `null` if the item does not exist.
   */
  getItem(key: string): Promise<V | null>;

  /**
   * Adds or updates an item in the cache.
   * @param key The unique key of the item to be cached.
   * @param value The value to be cached.
   * @returns A promise that resolves when the item has been successfully stored.
   */
  setItem(key: string, value: V): Promise<void>;

  /**
   * Removes an item from the cache.
   * @param key The unique key of the item to be removed.
   * @returns A promise that resolves when the item has been successfully removed.
   */
  removeItem(key: string): Promise<void>;
}
