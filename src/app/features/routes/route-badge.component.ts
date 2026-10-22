import { Component, computed, input } from '@angular/core';
import { badgeTextColor, routeColor } from './route-geometry';

/** Route code on the Admin-defined route color; color is never the only cue (the code is always shown). */
@Component({
  selector: 'app-route-badge',
  template: `<span class="badge" [style.background]="background()" [style.color]="textColor()">{{ code() }}</span>`,
  styles: `
    .badge {
      display: inline-block;
      min-width: 44px;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 14px;
      line-height: 20px;
      font-weight: 600;
      text-align: center;
      white-space: nowrap;
      box-shadow: inset 0 0 0 1px rgb(0 0 0 / 12%);
    }
  `,
})
export class RouteBadgeComponent {
  readonly code = input.required<string>();
  readonly color = input.required<string>();
  protected readonly background = computed(() => routeColor(this.color()));
  protected readonly textColor = computed(() => badgeTextColor(this.background()));
}
