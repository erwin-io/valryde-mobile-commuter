import { Injectable, InjectionToken, inject } from '@angular/core';
import { TransitRoute, TransitRoutePage } from './transit-routes.service';

/**
 * Offline fallback for public route metadata and geometry only. It is used only when the network
 * fails; fresh API data always wins. No credentials, account data or vehicle state is ever stored here.
 */
export const ROUTE_CACHE_LIMITS = {
  /** Entries older than this are discarded, not shown. */
  maxAgeMs: 3 * 24 * 60 * 60 * 1000,
  /** Most-recently-saved route details kept. */
  maxDetails: 25,
  /** Serialized size cap (UTF-16 chars), well under typical 5 MB WebView storage quotas. */
  maxChars: 1_500_000,
} as const;

/** "Oct 21, 3:05 PM" in the device locale, for "saved at" labels. */
export function savedAtLabel(savedAt: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(savedAt);
}

/** Bump when the cached shape changes; older payloads are dropped. */
const KEY = 'valryde.routeCache.v1';

export interface Cached<T> {
  value: T;
  savedAt: number;
}

interface CacheFile {
  details: Record<string, Cached<TransitRoute>>;
  /** Only the unfiltered first page of the route list. */
  list: Cached<TransitRoutePage> | null;
}

/** Minimal storage surface so tests can inject a fake (and browsers without storage still work). */
export type CacheStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const ROUTE_CACHE_STORAGE = new InjectionToken<CacheStorage | null>('ROUTE_CACHE_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null; // Storage disabled (private mode, policy): run without a cache.
    }
  },
});

@Injectable({ providedIn: 'root' })
export class RouteCacheService {
  private readonly storage = inject(ROUTE_CACHE_STORAGE);
  /** Injectable clock for expiry tests. */
  now = () => Date.now();

  saveDetail(route: TransitRoute): void {
    this.update((file) => {
      file.details[route.id] = { value: route, savedAt: this.now() };
    });
  }

  /** A saved route detail that has not expired, or null. */
  detail(routeId: string): Cached<TransitRoute> | null {
    return this.fresh(this.read().details[routeId]);
  }

  /** Invalidate a route the API no longer serves (404 or rejected id). */
  removeDetail(routeId: string): void {
    this.update((file) => {
      delete file.details[routeId];
    });
  }

  saveList(page: TransitRoutePage): void {
    this.update((file) => {
      file.list = { value: page, savedAt: this.now() };
    });
  }

  list(): Cached<TransitRoutePage> | null {
    return this.fresh(this.read().list);
  }

  clear(): void {
    try {
      this.storage?.removeItem(KEY);
    } catch {
      // Nothing cached to protect.
    }
  }

  private fresh<T>(entry: Cached<T> | null | undefined): Cached<T> | null {
    return entry && this.now() - entry.savedAt <= ROUTE_CACHE_LIMITS.maxAgeMs ? entry : null;
  }

  private read(): CacheFile {
    try {
      const parsed = JSON.parse(this.storage?.getItem(KEY) ?? 'null') as CacheFile | null;
      if (parsed && typeof parsed.details === 'object' && parsed.details !== null) return parsed;
    } catch {
      // Corrupt or foreign payload: start over.
    }
    return { details: {}, list: null };
  }

  private update(change: (file: CacheFile) => void): void {
    if (!this.storage) return;
    const file = this.read();
    change(file);
    this.prune(file);
    let serialized = JSON.stringify(file);
    // Evict oldest details, then the list, until the payload fits the size cap.
    while (serialized.length > ROUTE_CACHE_LIMITS.maxChars) {
      if (!this.evictOldest(file)) {
        if (!file.list) break;
        file.list = null;
      }
      serialized = JSON.stringify(file);
    }
    if (serialized.length > ROUTE_CACHE_LIMITS.maxChars) return this.clear();
    try {
      this.storage.setItem(KEY, serialized);
    } catch {
      this.clear(); // Quota exceeded: a stale partial cache is worse than none.
    }
  }

  /** Drop expired entries and keep only the newest `maxDetails` details. */
  private prune(file: CacheFile): void {
    const cutoff = this.now() - ROUTE_CACHE_LIMITS.maxAgeMs;
    if (file.list && file.list.savedAt < cutoff) file.list = null;
    const kept = Object.entries(file.details)
      .filter(([, entry]) => entry.savedAt >= cutoff)
      .sort(([, a], [, b]) => b.savedAt - a.savedAt)
      .slice(0, ROUTE_CACHE_LIMITS.maxDetails);
    file.details = Object.fromEntries(kept);
  }

  private evictOldest(file: CacheFile): boolean {
    const oldest = Object.entries(file.details).sort(([, a], [, b]) => a.savedAt - b.savedAt)[0];
    if (!oldest) return false;
    delete file.details[oldest[0]];
    return true;
  }
}
