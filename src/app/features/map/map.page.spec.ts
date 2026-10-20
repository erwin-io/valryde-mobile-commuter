import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
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
  focus = vi.fn();
}

describe('MapPage recenter', () => {
  async function setup(opts: { granted: boolean; result: LocationResult; alertRole?: string }) {
    const location = {
      isGranted: vi.fn().mockResolvedValue(opts.granted),
      locate: vi.fn().mockResolvedValue(opts.result),
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
        { provide: LocationService, useValue: location },
        { provide: AlertController, useValue: alerts },
        { provide: ToastController, useValue: toasts },
        {
          provide: APP_CONFIG,
          useValue: { mapStyleUrl: 'https://example.test/style.json', defaultCenter: [121, 14.6], defaultZoom: 11 },
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
    return { fixture, page: fixture.componentInstance, location, alerts, toasts };
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
});
