import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageCoinComponent } from '../../../shared/components/language-coin/language-coin.component';
import { LocaleService } from '../../../shared/services/locale/locale.service';
import { BrandingStateService } from '../../../shared/services/branding/branding-state.service';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, LanguageCoinComponent],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.css'
})
export class AuthLayoutComponent implements OnInit {
  private localeService = inject(LocaleService);
  brandingState = inject(BrandingStateService);

  ngOnInit(): void {
    this.localeService.loadLanguages();
    this.localeService.loadCountries();
    this.localeService.loadTranslations();
  }
}
