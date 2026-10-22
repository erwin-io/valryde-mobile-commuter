import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Device-local favorite routes (checklist 36). Stores only public route identifiers and an optional
 * direction; never account data, and never in the secure authentication store. Not synced across
 * devices or accounts: there is no approved backend contract for that.
 */
export interface FavoriteRoute {
  routeId: string;
  directionId: string | null;
  savedAt: number;
}

export const MAX_FAVORITES = 50;
const KEY = 'valryde.favorites.v1';

/** Capacitor Preferences (native key-value store; localStorage on the web). Separate from secure storage. */
export const FAVORITES_STORE = new InjectionToken<Pick<typeof Preferences, 'get' | 'set'>>('FAVORITES_STORE', {
  providedIn: 'root',
  factory: () => Preferences,
});

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly store = inject(FAVORITES_STORE);
  private operations: Promise<unknown> = Promise.resolve();
  private loading?: Promise<void>;

  /** Newest first. */
  readonly favorites = signal<FavoriteRoute[]>([]);
  readonly loaded = signal(false);
  /** A Preferences read failed; do not mistake an unavailable store for an empty list. */
  readonly loadFailed = signal(false);
  private readonly ids = computed(() => new Set(this.favorites().map((f) => f.routeId)));

  /** Loads once after success; concurrent and retrying calls share the active read. */
  load(): Promise<void> {
    if (this.loaded() && !this.loadFailed()) return Promise.resolve();
    if (!this.loading) {
      const active = (async () => {
        try {
          const { value } = await this.store.get({ key: KEY });
          this.favorites.set(parse(value));
          this.loadFailed.set(false);
        } catch {
          // Keep the current in-memory state and surface a retry. Treating this as an empty store
          // could let a later save overwrite favorites that still exist on disk.
          this.loadFailed.set(true);
        }
        this.loaded.set(true);
      })().finally(() => {
        if (this.loading === active) this.loading = undefined;
      });
      this.loading = active;
    }
    return this.loading;
  }

  isFavorite(routeId: string): boolean {
    return this.ids().has(routeId);
  }

  /** Saves a route (one entry per route; saving again updates the direction and moves it to the top). */
  async save(routeId: string, directionId: string | null): Promise<'saved' | 'full'> {
    await this.load();
    if (this.loadFailed()) throw new Error('Favorite storage is unavailable');
    return this.enqueue(async () => {
      const others = this.favorites().filter((f) => f.routeId !== routeId);
      if (others.length >= MAX_FAVORITES) return 'full';
      const next = [{ routeId, directionId, savedAt: Date.now() }, ...others];
      await this.persist(next);
      this.favorites.set(next);
      return 'saved';
    });
  }

  async remove(routeId: string): Promise<void> {
    await this.load();
    if (this.loadFailed()) throw new Error('Favorite storage is unavailable');
    await this.enqueue(async () => {
      const next = this.favorites().filter((f) => f.routeId !== routeId);
      if (next.length === this.favorites().length) return;
      await this.persist(next);
      this.favorites.set(next);
    });
  }

  /** Serializes complete mutations so failed storage writes never leave false in-memory favorite state. */
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operations.then(operation);
    this.operations = result.catch(() => undefined);
    return result;
  }

  private async persist(favorites: FavoriteRoute[]): Promise<void> {
    await this.store.set({ key: KEY, value: JSON.stringify(favorites) });
  }
}

/** Accepts only well-formed entries, de-duplicated by route, capped at MAX_FAVORITES. */
function parse(value: string | null): FavoriteRoute[] {
  let raw: unknown;
  try {
    raw = JSON.parse(value ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: FavoriteRoute[] = [];
  for (const entry of raw) {
    const routeId = (entry as FavoriteRoute)?.routeId;
    if (typeof routeId !== 'string' || !routeId || routeId.length > 64 || seen.has(routeId)) continue;
    const directionId = (entry as FavoriteRoute).directionId;
    const savedAt = (entry as FavoriteRoute).savedAt;
    seen.add(routeId);
    result.push({
      routeId,
      directionId: typeof directionId === 'string' && directionId.length <= 64 ? directionId : null,
      savedAt: typeof savedAt === 'number' && Number.isFinite(savedAt) && savedAt >= 0 ? savedAt : 0,
    });
  }
  return result.slice(0, MAX_FAVORITES);
}
