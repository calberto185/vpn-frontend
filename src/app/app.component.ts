import { Component, OnInit } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { LoadingOverlayComponent } from "./shared/components/loading-overlay/loading-overlay.component";
import { ErrorOverlayComponent } from "./shared/components/error-overlay/error-overlay.component";
import { LoadingService } from './shared/services/loading.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoadingOverlayComponent, ErrorOverlayComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'carlosvm';
  isLoading = false;
  error: { title?: string; message?: string, call?: Function | any } | null = null;

  constructor(private router: Router, private loadingService: LoadingService) {
  this.router.events.subscribe(event => {
    if (event instanceof NavigationStart) {
      this.loadingService.show();
    }

    if (event instanceof NavigationEnd || event instanceof NavigationCancel) {
      this.loadingService.hide();
    }

    if (event instanceof NavigationError) {
      this.loadingService.hide();
      this.loadingService.showError('Error de navegación', 'No se pudo cargar la página.', this.error?.call );
    }
  });
}

  ngOnInit() {
    this.loadingService.loading$.subscribe(v => (this.isLoading = v));
    this.loadingService.error$.subscribe(e => (this.error = e));
  }
}
