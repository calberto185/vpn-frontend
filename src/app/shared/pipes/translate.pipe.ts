import { inject, Pipe, PipeTransform } from '@angular/core';
import { LocaleService } from '../services/locale/locale.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false, // re-evalúa en cada ciclo de CD y cuando cambian señales
})
export class TranslatePipe implements PipeTransform {
  private localeService = inject(LocaleService);

  transform(key: string): string {
    return this.localeService.t(key);
  }
}
