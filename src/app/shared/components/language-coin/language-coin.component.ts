import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-language-coin',
  imports: [],
  templateUrl: './language-coin.component.html',
  styleUrl: './language-coin.component.css'
})
export class LanguageCoinComponent {

  selectedLanguage = signal("es");
  selectedCurrency = signal("RUB");
  onLanguageChange($event: any) {
  this.selectedLanguage.set($event);
  }
  onCurrencyChange($event: any) {
  this.selectedCurrency.set($event);
  }
}
