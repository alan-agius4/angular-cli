/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * Represents an entry in the Incremental Static Regeneration (ISR) cache.
 * This interface defines the structure of the data stored for each cached page,
 * including the HTML content, creation timestamp, and response headers.
 */
export interface ISRCacheItem {
  /**
   * The HTML content of the cached page.
   */
  html: string;

  /**
   * The timestamp (in milliseconds) when the cache entry was created.
   * This is used to determine if the entry is stale and needs revalidation.
   */
  createdAt: number;

  /**
   * A readonly record of HTTP headers associated with the cached response.
   * These headers are served along with the HTML content.
   */
  headers: Readonly<Record<string, string>>;

  /**
   * A flag indicating whether a regeneration of the cache entry is currently in progress.
   * This is used to prevent multiple regeneration requests for the same page from being
   * initiated simultaneously.
   */
  isRegenerationInProgress?: boolean;
}
