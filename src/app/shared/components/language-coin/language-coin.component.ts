import { Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocaleService } from '../../services/locale/locale.service';

@Component({
  selector: 'app-language-coin',
  imports: [CommonModule],
  templateUrl: './language-coin.component.html',
  styleUrl: './language-coin.component.css'
})
export class LanguageCoinComponent implements OnInit {
  localeService = inject(LocaleService);

  @ViewChild('langDetails') langDetails!: ElementRef<HTMLDetailsElement>;
  @ViewChild('coinDetails') coinDetails!: ElementRef<HTMLDetailsElement>;

  ngOnInit() {
    this.localeService.loadLanguages();
    this.localeService.loadCountries();
  }

  selectLanguage(languageCode: string) {
    this.localeService.setCountryByLanguage(languageCode);
    this.closeAll();
  }

  selectCountry(country: any) {
    this.localeService.setCountry(country);
    this.closeAll();
  }

  private closeAll() {
    if (this.langDetails?.nativeElement) {
      this.langDetails.nativeElement.open = false;
    }
    if (this.coinDetails?.nativeElement) {
      this.coinDetails.nativeElement.open = false;
    }
  }
}
