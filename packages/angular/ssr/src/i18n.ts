/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * Extracts a potential locale ID from a given URL based on the specified base path.
 *
 * This function parses the URL to locate a potential locale identifier that immediately
 * follows the base path segment in the URL's pathname. If the URL does not contain a valid
 * locale ID, an empty string is returned.
 *
 * @param url - The full URL from which to extract the locale ID.
 * @param basePath - The base path used as the reference point for extracting the locale ID.
 * @returns The extracted locale ID if present, or an empty string if no valid locale ID is found.
 *
 * @example
 * ```js
 * const url = new URL('https://example.com/base/en/page');
 * const basePath = '/base';
 * const localeId = getPotentialLocaleIdFromUrl(url, basePath);
 * console.log(localeId); // Output: 'en'
 * ```
 */
export function getPotentialLocaleIdFromUrl(url: URL, basePath: string): string {
  const { pathname } = url;

  // Move forward of the base path section.
  let start = basePath.length;
  if (pathname[start] === '/') {
    start++;
  }

  // Find the next forward slash.
  let end = pathname.indexOf('/', start);
  if (end === -1) {
    end = pathname.length;
  }

  // Extract the potential locale id.
  return pathname.slice(start, end);
}

/**
 * Represents a precomputed locale lookup structure for fast preferred locale resolution.
 */
export interface LocaleLookup {
  readonly supportedLocales: ReadonlyArray<string>;
  readonly defaultLocale: string;
  readonly exactMap: ReadonlyMap<string, string>;
  readonly prefixMap: ReadonlyMap<string, string>;
}

/**
 * Precomputes normalized locale mappings (exact lowercase matches and primary language subtag prefixes)
 * to optimize runtime locale matching.
 *
 * @param supportedLocales - An array of supported locales (e.g., `['en-US', 'fr-FR']`).
 * @returns A `LocaleLookup` structure containing precomputed lookup maps.
 */
export function createLocaleLookup(supportedLocales: ReadonlyArray<string>): LocaleLookup {
  const exactMap = new Map<string, string>();
  const prefixMap = new Map<string, string>();

  for (const locale of supportedLocales) {
    const normalizedLocale = normalizeLocale(locale);
    exactMap.set(normalizedLocale, locale);

    const [languagePrefix] = normalizedLocale.split('-', 1);
    if (!prefixMap.has(languagePrefix)) {
      prefixMap.set(languagePrefix, locale);
    }
  }

  return {
    supportedLocales,
    defaultLocale: supportedLocales[0],
    exactMap,
    prefixMap,
  };
}

/**
 * Parses the `Accept-Language` header and returns a list of locale preferences with their respective quality values.
 *
 * The `Accept-Language` header is typically a comma-separated list of locales, with optional quality values
 * in the form of `q=<value>`. If no quality value is specified, a default quality of `1` is assumed.
 * Special case: if the header is `*`, it returns the default locale with a quality of `1`.
 *
 * @param header - The value of the `Accept-Language` header.
 * @returns An array of `[locale, quality]` pairs sorted in descending quality order.
 */
function parseLanguageHeader(header: string): Array<readonly [string, number]> {
  if (header === '*') {
    return [['*', 1]];
  }

  const items = header.split(',');
  const parsedValues: Array<readonly [string, number]> = [];
  let needsSort = false;
  let prevQuality = 1;

  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }

    const semiIndex = trimmed.indexOf(';');
    let locale: string;
    let quality = 1;

    if (semiIndex === -1) {
      locale = trimmed;
    } else {
      locale = trimmed.slice(0, semiIndex).trim();
      const qualityPart = trimmed.slice(semiIndex + 1).trim();
      if (qualityPart.startsWith('q=')) {
        const q = parseFloat(qualityPart.slice(2));
        if (typeof q === 'number' && !isNaN(q) && q >= 0 && q <= 1) {
          quality = q;
        }
      }
    }

    if (quality > prevQuality) {
      needsSort = true;
    }
    prevQuality = quality;

    parsedValues.push([locale, quality]);
  }

  if (needsSort) {
    parsedValues.sort(([, qualityA], [, qualityB]) => qualityB - qualityA);
  }

  return parsedValues;
}

/**
 * Gets the preferred locale based on the highest quality value from the provided `Accept-Language` header
 * and the set of available locales.
 *
 * This function adheres to the HTTP `Accept-Language` header specification as defined in
 * [RFC 7231](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.5), including:
 * - Case-insensitive matching of language tags.
 * - Quality value handling (e.g., `q=1`, `q=0.8`). If no quality value is provided, it defaults to `q=1`.
 * - Prefix matching (e.g., `en` matching `en-US` or `en-GB`).
 *
 * @param header - The `Accept-Language` header string to parse and evaluate. It may contain multiple
 *                 locales with optional quality values, for example: `'en-US;q=0.8,fr-FR;q=0.9'`.
 * @param supportedLocales - An array of supported locales (e.g., `['en-US', 'fr-FR']`) or a precomputed `LocaleLookup`.
 * @returns The best matching locale from the supported languages, or `undefined` if no match is found.
 *
 * @example
 * ```js
 * getPreferredLocale('en-US;q=0.8,fr-FR;q=0.9', ['en-US', 'fr-FR', 'de-DE'])
 * // returns 'fr-FR'
 *
 * getPreferredLocale('en;q=0.9,fr-FR;q=0.8', ['en-US', 'fr-FR', 'de-DE'])
 * // returns 'en-US'
 *
 * getPreferredLocale('es-ES;q=0.7', ['en-US', 'fr-FR', 'de-DE'])
 * // returns undefined
 * ```
 */
export function getPreferredLocale(
  header: string,
  supportedLocales: ReadonlyArray<string> | LocaleLookup,
): string | undefined {
  const lookup = Array.isArray(supportedLocales)
    ? createLocaleLookup(supportedLocales)
    : (supportedLocales as LocaleLookup);

  const locales = lookup.supportedLocales;
  if (locales.length < 2) {
    return lookup.defaultLocale;
  }

  // Fast path for empty or wildcard-only header
  if (!header || header === '*') {
    return lookup.defaultLocale;
  }

  const trimmedHeader = header.trim();
  if (trimmedHeader === '' || trimmedHeader === '*') {
    return lookup.defaultLocale;
  }

  const { exactMap, prefixMap } = lookup;

  // Fast path for a single simple language tag without quality value or list (e.g. 'en-US' or 'it')
  if (!trimmedHeader.includes(',') && !trimmedHeader.includes(';')) {
    const normalized = normalizeLocale(trimmedHeader);
    const exact = exactMap.get(normalized);
    if (exact !== undefined) {
      return exact;
    }

    const [languagePrefix] = normalized.split('-', 1);
    const prefixMatch = prefixMap.get(languagePrefix);
    if (prefixMatch !== undefined) {
      return prefixMatch;
    }

    return lookup.defaultLocale;
  }

  const parsedLocales = parseLanguageHeader(trimmedHeader);

  // Handle edge cases:
  // - No preferred locales provided.
  // - Wildcard preference.
  if (parsedLocales.length === 0 || (parsedLocales.length === 1 && parsedLocales[0][0] === '*')) {
    return lookup.defaultLocale;
  }

  // Iterate through parsed locales in descending order of quality.
  let bestMatch: string | undefined;
  let qualityZeroNormalizedLocales: Set<string> | undefined;

  for (const [locale, quality] of parsedLocales) {
    const normalizedLocale = normalizeLocale(locale);
    if (quality === 0) {
      qualityZeroNormalizedLocales ??= new Set<string>();
      qualityZeroNormalizedLocales.add(normalizedLocale);
      continue; // Skip locales with quality value of 0.
    }

    // Exact match found.
    const exactMatch = exactMap.get(normalizedLocale);
    if (exactMatch !== undefined) {
      return exactMatch;
    }

    // If an exact match is not found, try prefix matching (e.g., "en" matches "en-US").
    // Store the first prefix match encountered, as it has the highest quality value.
    if (bestMatch !== undefined) {
      continue;
    }

    const [languagePrefix] = normalizedLocale.split('-', 1);
    const prefixMatch = prefixMap.get(languagePrefix);
    if (prefixMatch !== undefined) {
      bestMatch = prefixMatch;
    }
  }

  if (bestMatch !== undefined) {
    return bestMatch;
  }

  // Return the first locale that is not quality zero.
  if (qualityZeroNormalizedLocales !== undefined) {
    for (const locale of locales) {
      if (!qualityZeroNormalizedLocales.has(normalizeLocale(locale))) {
        return locale;
      }
    }

    return undefined;
  }

  return lookup.defaultLocale;
}

/**
 * Normalizes a locale string by converting it to lowercase.
 *
 * @param locale - The locale string to normalize.
 * @returns The normalized locale string in lowercase.
 *
 * @example
 * ```ts
 * const normalized = normalizeLocale('EN-US');
 * console.log(normalized); // Output: "en-us"
 * ```
 */
function normalizeLocale(locale: string): string {
  return locale.toLowerCase();
}
