import { Component, inject, OnInit, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { LoadingOverlayComponent } from './shared/components/loading-overlay/loading-overlay.component';
import { ErrorOverlayComponent }   from './shared/components/error-overlay/error-overlay.component';
import { ToastComponent }          from './shared/components/toast/toast.component';
import { LoadingService }          from './shared/services/loading.service';
import { BrandingStateService }    from './shared/services/branding/branding-state.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoadingOverlayComponent, ErrorOverlayComponent, ToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'carlosvm';

  private loadingService  = inject(LoadingService);
  private router          = inject(Router);
  private brandingState   = inject(BrandingStateService);

  isLoading = signal(false);

  constructor() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart)  this.loadingService.show();
      if (event instanceof NavigationEnd || event instanceof NavigationCancel) this.loadingService.hide();
      if (event instanceof NavigationError) {
        this.loadingService.hide();
        this.loadingService.showTypedError({
          type:        'error',
          title:       'Error de navegación',
          message:     'No se pudo cargar la página solicitada.',
          actionLabel: 'Recargar',
          action:      () => window.location.reload(),
        });
      }
    });
  }

  ngOnInit(): void {
    this.brandingState.load();
    this.loadingService.loading$.subscribe(v => this.isLoading.set(v));
  }
}
