import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonInfiniteScroll } from '@ionic/angular/ion-infinite-scroll';
import { IonInfiniteScrollContent } from '@ionic/angular/ion-infinite-scroll-content';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonSearchbar } from '@ionic/angular/ion-searchbar';
import { IonSegment } from '@ionic/angular/ion-segment';
import { IonSegmentButton } from '@ionic/angular/ion-segment-button';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { debounceTime, distinctUntilChanged, firstValueFrom, map } from 'rxjs';
import { ApiFailure, failureCopy, toApiFailure } from '../../core/api-failure';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { RouteListItemComponent } from './route-list-item.component';
import { TransitRoute, TransitRoutesService } from './transit-routes.service';
import { TripPlannerGateComponent } from './trip-planner-gate.component';

const PAGE_SIZE = 20;

type ListStatus = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-routes-page',
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonSearchbar,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonList,
    IonItem,
    IonSkeletonText,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonButton,
    RouteListItemComponent,
    StatePanelComponent,
    TripPlannerGateComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Routes</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="mode()" (ionChange)="mode.set($any($event.detail.value))">
          <ion-segment-button value="routes">
            <ion-label>Find a route</ion-label>
          </ion-segment-button>
          <ion-segment-button value="trip">
            <ion-label>Plan a trip</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
      @if (mode() === 'routes') {
        <ion-toolbar>
          <ion-searchbar
            [formControl]="search"
            placeholder="Route code, name or terminal"
            aria-label="Search jeepney routes"
            [maxlength]="160"
            [debounce]="0"
            inputmode="search"
          />
        </ion-toolbar>
      }
    </ion-header>

    <ion-content>
      @if (mode() === 'trip') {
        <app-trip-planner-gate />
      } @else {
        <ion-refresher slot="fixed" (ionRefresh)="refresh($any($event.target))">
          <ion-refresher-content />
        </ion-refresher>

        @switch (status()) {
          @case ('loading') {
            <ion-list aria-busy="true" aria-label="Loading routes">
              @for (row of skeletonRows; track row) {
                <ion-item>
                  <ion-skeleton-text slot="start" [animated]="true" class="skeleton-badge" />
                  <ion-label>
                    <ion-skeleton-text [animated]="true" class="skeleton-title" />
                    <ion-skeleton-text [animated]="true" class="skeleton-line" />
                  </ion-label>
                </ion-item>
              }
            </ion-list>
          }
          @case ('error') {
            <app-state-panel
              icon="cloud-offline-outline"
              [title]="failureText().title"
              [body]="failureText().body + supportSuffix()"
              actionLabel="Try again"
              (action)="load(true)"
            />
          }
          @case ('ready') {
            @if (routes().length === 0) {
              @if (query()) {
                <app-state-panel
                  icon="search-outline"
                  [title]="'No routes match “' + query() + '”'"
                  body="Try a route code, a route name, or a terminal along the route."
                />
              } @else {
                <app-state-panel
                  icon="bus-outline"
                  title="No routes published yet"
                  body="Active jeepney routes appear here once VALRYDE publishes them."
                />
              }
            } @else {
              <p class="result-count" aria-live="polite">{{ countLabel() }}</p>
              <ion-list>
                @for (route of routes(); track route.id) {
                  <app-route-list-item [route]="route" (selected)="open($event)" />
                }
              </ion-list>
              @if (loadMoreFailed()) {
                <div class="load-more-error" role="status">
                  <span>Couldn’t load more routes.</span>
                  <ion-button fill="clear" (click)="loadMore()">Retry</ion-button>
                </div>
              }
              <ion-infinite-scroll [disabled]="!hasMore() || loadMoreFailed()" (ionInfinite)="loadMore($any($event.target))">
                <ion-infinite-scroll-content loadingText="Loading more routes…" />
              </ion-infinite-scroll>
            }
          }
        }
      }
    </ion-content>
  `,
  styles: `
    .skeleton-badge {
      width: 44px;
      height: 28px;
    }
    .skeleton-title {
      width: 60%;
      height: 16px;
    }
    .skeleton-line {
      width: 80%;
      height: 14px;
    }
    .result-count {
      margin: 12px 16px 0;
      font-size: 14px;
      color: var(--valryde-muted);
    }
    .load-more-error {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 16px;
      color: var(--valryde-muted);
    }
  `,
})
export class RoutesPage {
  private readonly service = inject(TransitRoutesService);
  private readonly router = inject(Router);

  readonly search = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(160)] });
  readonly mode = signal<'routes' | 'trip'>('routes');
  readonly query = signal('');
  readonly status = signal<ListStatus>('loading');
  readonly routes = signal<TransitRoute[]>([]);
  readonly failure = signal<ApiFailure | null>(null);
  readonly loadMoreFailed = signal(false);
  private readonly page = signal(0);
  private readonly totalPages = signal(0);
  private readonly total = signal(0);
  private requestSeq = 0;

  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  readonly hasMore = computed(() => this.page() < this.totalPages());
  protected readonly failureText = computed(() => failureCopy(this.failure() ?? { kind: 'unavailable' }));
  protected readonly supportSuffix = computed(() => {
    const id = this.failure()?.requestId;
    return id ? ` (Reference: ${id})` : '';
  });
  protected readonly countLabel = computed(() =>
    this.total() === 1 ? '1 route' : `${this.total()} routes`,
  );

  constructor() {
    this.search.valueChanges
      .pipe(
        debounceTime(300),
        map((value) => value.trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((q) => {
        this.query.set(q);
        void this.load(true);
      });
    void this.load(true);
  }

  /** Loads page 1 (reset) or the next page. Responses for superseded queries are dropped. */
  async load(reset: boolean): Promise<void> {
    const seq = ++this.requestSeq;
    const nextPage = reset ? 1 : this.page() + 1;
    if (reset) {
      this.status.set('loading');
      this.loadMoreFailed.set(false);
    }
    try {
      const result = await firstValueFrom(
        this.service.list({ q: this.query(), page: nextPage, pageSize: PAGE_SIZE }),
      );
      if (seq !== this.requestSeq) return;
      this.routes.set(reset ? result.routes : [...this.routes(), ...result.routes]);
      this.page.set(result.pagination.page);
      this.totalPages.set(result.pagination.totalPages);
      this.total.set(result.pagination.total);
      this.status.set('ready');
    } catch (error) {
      if (seq !== this.requestSeq) return;
      if (reset) {
        this.failure.set(toApiFailure(error));
        this.status.set('error');
      } else {
        this.loadMoreFailed.set(true);
      }
    }
  }

  async loadMore(infinite?: { complete(): Promise<void> }): Promise<void> {
    this.loadMoreFailed.set(false);
    await this.load(false);
    await infinite?.complete();
  }

  async refresh(refresher: { complete(): Promise<void> }): Promise<void> {
    await this.load(true);
    await refresher.complete();
  }

  open(route: TransitRoute): void {
    void this.router.navigate(['/tabs/map'], { queryParams: { route: route.id } });
  }
}
