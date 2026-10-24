import { Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { AlertController } from '@ionic/angular/alert-controller';
import { ToastController } from '@ionic/angular/toast-controller';
import { APP_CONFIG } from '../../core/app-config';
import { LocationResult, LocationService } from './location.service';
import { MapPage } from './map.page';
import { TransitMapComponent } from './transit-map.component';

@Component({ selector: 'app-transit-map', template: '' })
class FakeTransitMap {
  readonly styleUrl = input<string>();
  readonly center = input<[number, number]>();
  readonly zoom = input<number>();
  readonly userLocation = input<[number, number] | null>(null);
  readonly routeLine = input<unknown>(null);
  readonly vehicles = input<unknown[]>([]);
  readonly vehicleSelected = output<string>();
  readonly bottomInset = input(0);
  readonly active = input(true);
  readonly perspective = input(false);
  readonly userPanned = output<void>();
  focus = vi.fn();
}

describe('MapPage recenter', () => {
  async function setup(opts: { granted: boolean; result: LocationResult; alertRole?: string }) {
    const watcher: {
      onPosition?: (p: [number, number]) => void;
      onError?: (r: LocationResult) => void;
      stop: ReturnType<typeof vi.fn>;
    } = { stop: vi.fn() };
    const location = {
      isGranted: vi.fn().mockResolvedValue(opts.granted),
      locate: vi.fn().mockResolvedValue(opts.result),
      watch: vi.fn(async (onPosition: (p: [number, number]) => void, onError: (r: LocationResult) => void) => {
        watcher.onPosition = onPosition;
        watcher.onError = onError;
        return watcher.stop;
      }),
    };
    const alert = {
      present: vi.fn(),
      onDidDismiss: vi.fn().mockResolvedValue({ role: opts.alertRole }),
    };
    const toast = { present: vi.fn() };
    const alerts = { create: vi.fn().mockResolvedValue(alert) };
    const toasts = { create: vi.fn().mockResolvedValue(toast) };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LocationService, useValue: location },
        { provide: AlertController, useValue: alerts },
        { provide: ToastController, useValue: toasts },
        {
          provide: APP_CONFIG,
          useValue: { apiBaseUrl: '/api', mapStyleUrl: 'https://example.test/style.json', defaultCenter: [121, 14.6], defaultZoom: 11 },
        },
      ],
    });
    TestBed.overrideComponent(MapPage, {
      remove: { imports: [TransitMapComponent] },
      add: { imports: [FakeTransitMap] },
    });
    const fixture = TestBed.createComponent(MapPage);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    location.locate.mockClear();
    const map = () => fixture.debugElement.query(By.directive(FakeTransitMap)).componentInstance as FakeTransitMap;
    return { fixture, page: fixture.componentInstance, location, alerts, toasts, watcher, map };
  }

  it('explains before prompting and does not locate when the user declines', async () => {
    const { page, location, alerts } = await setup({
      granted: false,
      result: { kind: 'denied' },
      alertRole: 'cancel',
    });
    await page.recenter();
    expect(alerts.create).toHaveBeenCalledOnce();
    expect(location.locate).not.toHaveBeenCalled();
  });

  it('shows the location and focuses the map after the user allows', async () => {
    const { fixture, page } = await setup({
      granted: false,
      result: { kind: 'located', position: [121.05, 14.55] },
      alertRole: 'confirm',
    });
    await page.recenter();
    expect(page.userLocation()).toEqual([121.05, 14.55]);
    const map = fixture.debugElement.query(By.directive(FakeTransitMap));
    expect((map.componentInstance as FakeTransitMap).focus).toHaveBeenCalledWith([121.05, 14.55]);
  });

  it('keeps the map browsable and explains how to enable location after denial', async () => {
    const { page, toasts } = await setup({
      granted: false,
      result: { kind: 'denied' },
      alertRole: 'confirm',
    });
    await page.recenter();
    expect(page.userLocation()).toBeNull();
    expect(toasts.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('You can still browse the map') }),
    );
  });

  it('skips the explanation when permission is already granted', async () => {
    const { page, alerts, location } = await setup({
      granted: true,
      result: { kind: 'located', position: [121, 14.6] },
    });
    await page.recenter();
    expect(alerts.create).not.toHaveBeenCalled();
    expect(location.locate).toHaveBeenCalledOnce();
  });

  it('does not request GPS after a pending permission check finishes on a hidden tab', async () => {
    const { page, location, alerts } = await setup({
      granted: false,
      result: { kind: 'located', position: [121, 14.6] },
    });
    let finishPermission!: (granted: boolean) => void;
    location.isGranted.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (finishPermission = resolve)),
    );
    const pending = page.recenter();
    page.ionViewWillLeave();
    finishPermission(false);
    await pending;
    expect(alerts.create).not.toHaveBeenCalled();
    expect(location.locate).not.toHaveBeenCalled();
    expect(location.watch).not.toHaveBeenCalled();
  });

  it('does not request GPS after the location explanation resolves on a hidden tab', async () => {
    const { page, location, alerts } = await setup({
      granted: false,
      result: { kind: 'located', position: [121, 14.6] },
    });
    let finishExplanation!: (result: { role: string }) => void;
    const alert = {
      present: vi.fn(),
      onDidDismiss: vi.fn(
        () => new Promise<{ role: string }>((resolve) => (finishExplanation = resolve)),
      ),
    };
    alerts.create.mockResolvedValueOnce(alert);
    const pending = page.recenter();
    await vi.waitFor(() => expect(alert.onDidDismiss).toHaveBeenCalledOnce());
    page.ionViewWillLeave();
    finishExplanation({ role: 'confirm' });
    await pending;
    expect(alert.present).toHaveBeenCalledOnce();
    expect(location.locate).not.toHaveBeenCalled();
    expect(location.watch).not.toHaveBeenCalled();
  });

  describe('follow mode', () => {
    const located = { granted: true, result: { kind: 'located', position: [123.89, 10.31] } as LocationResult };

    it('a launch-time locate with prior permission centers once but does not start following', async () => {
      const { page, location } = await setup(located);
      expect(page.following()).toBe(false);
      expect(location.watch).not.toHaveBeenCalled();
    });

    it('an explicit tap follows position updates without changing the zoom', async () => {
      const { page, watcher, map } = await setup(located);
      await page.recenter();
      expect(page.following()).toBe(true);
      watcher.onPosition?.([123.9, 10.32]);
      expect(page.userLocation()).toEqual([123.9, 10.32]);
      expect(map().focus).toHaveBeenLastCalledWith([123.9, 10.32], true);
    });

    it('a second tap stops following and releases the GPS watch', async () => {
      const { page, watcher } = await setup(located);
      await page.recenter();
      await page.recenter();
      expect(page.following()).toBe(false);
      expect(watcher.stop).toHaveBeenCalled();
    });

    it('panning the map by hand leaves follow mode', async () => {
      const { page, watcher, map } = await setup(located);
      await page.recenter();
      map().userPanned.emit();
      expect(page.following()).toBe(false);
      expect(watcher.stop).toHaveBeenCalled();
      map().focus.mockClear();
      watcher.onPosition?.([123.95, 10.4]);
      expect(map().focus).not.toHaveBeenCalled();
    });

    it('leaving the Map tab stops following', async () => {
      const { page, watcher } = await setup(located);
      await page.recenter();
      page.ionViewDidLeave();
      expect(page.following()).toBe(false);
      expect(watcher.stop).toHaveBeenCalled();
    });

    it('does not start a delayed watch after the Map tab has left', async () => {
      let finishLocate: ((result: LocationResult) => void) | undefined;
      const pending = new Promise<LocationResult>((resolve) => (finishLocate = resolve));
      const context = await setup(located);
      const locationBeforeRequest = context.page.userLocation();
      const focusCallsBeforeRequest = context.map().focus.mock.calls.length;
      context.location.locate.mockReturnValueOnce(pending);
      const recentering = context.page.recenter();
      context.page.ionViewWillLeave();
      context.page.ionViewDidLeave();
      finishLocate?.({ kind: 'located', position: [123.9, 10.32] });
      await recentering;
      expect(context.location.watch).not.toHaveBeenCalled();
      expect(context.page.following()).toBe(false);
      expect(context.page.userLocation()).toEqual(locationBeforeRequest);
      expect(context.map().focus).toHaveBeenCalledTimes(focusCallsBeforeRequest);
    });

    it('permission revoked during follow stops following and explains the map still works', async () => {
      const { page, watcher, toasts } = await setup(located);
      await page.recenter();
      watcher.onError?.({ kind: 'denied' });
      expect(page.following()).toBe(false);
      expect(toasts.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ message: expect.stringContaining('The map still works') }),
      );
    });

    it('exposes the follow state to assistive technology', async () => {
      const { fixture, page } = await setup(located);
      await page.recenter();
      await fixture.whenStable();
      // Ionic copies aria-* into the shadow button (what screen readers read) once; read it there when present.
      const aria = (name: string) => {
        const host = fixture.nativeElement.querySelector('ion-fab-button') as HTMLElement;
        return host.shadowRoot?.querySelector('button')?.getAttribute(name) ?? host.getAttribute(name);
      };
      expect(aria('aria-pressed')).toBe('true');
      expect(aria('aria-label')).toBe('Stop following my location');
      await page.recenter();
      await fixture.whenStable();
      expect(aria('aria-pressed')).toBe('false');
      expect(aria('aria-label')).toBe('Show and follow my location');
    });
  });

  it('exposes an accessible optional map-pitch control', async () => {
    const { fixture, page, map } = await setup({ granted: false, result: { kind: 'denied' } });
    const buttons = () => Array.from(fixture.nativeElement.querySelectorAll('ion-fab-button')) as HTMLElement[];
    const pitchAria = (name: string) => {
      const host = buttons().at(-1);
      return host?.shadowRoot?.querySelector('button')?.getAttribute(name) ?? host?.getAttribute(name);
    };
    expect(map().perspective()).toBe(false);
    expect(pitchAria('aria-label')).toBe('Tilt map');
    expect(pitchAria('aria-pressed')).toBe('false');
    page.togglePerspective();
    await fixture.whenStable();
    expect(map().perspective()).toBe(true);
    expect(pitchAria('aria-label')).toBe('Use 2D map');
    expect(pitchAria('aria-pressed')).toBe('true');
  });

  describe('route sheet across tabs', () => {
    it('hides the sheet while another tab is shown and keeps the selection for when the user returns', async () => {
      const { fixture, page } = await setup({ granted: false, result: { kind: 'denied' } });
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      (page as unknown as { selection: { state: { set(v: unknown): void } } }).selection.state.set({ status: 'loading' });
      await fixture.whenStable();
      const modal = fixture.nativeElement.querySelector('ion-modal') as HTMLElement & { isOpen: boolean };
      expect(modal.isOpen).toBe(true);
      // Ionic detaches change detection from a page as it leaves; the sheet must still close.
      fixture.autoDetectChanges(false);
      fixture.changeDetectorRef.detach();
      page.ionViewWillLeave();
      expect(modal.isOpen).toBe(false);
      fixture.changeDetectorRef.reattach();
      fixture.autoDetectChanges();
      await fixture.whenStable();
      expect(page.active()).toBe(false);
      page.closeRoute(); // didDismiss from the hide must not clear ?route=
      expect(navigate).not.toHaveBeenCalled();
      page.ionViewWillEnter();
      expect(page.active()).toBe(true);
      page.closeRoute(); // a real dismiss on the Map tab clears the selection
      expect(navigate).toHaveBeenCalledWith([], { queryParams: { route: null, direction: null }, replaceUrl: true });
    });
  });
});
