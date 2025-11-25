import { Pipe, PipeTransform } from '@angular/core';
import daysjs from 'dayjs';

@Pipe({
  name: 'printperiod'
})
export class PrintperiodPipe implements PipeTransform {
  transform(startDate: string | Date, endDate: string | Date | null): string {
    if (!startDate) return 'Invalid date';
    const meses = [
      "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
      "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
    ];
    const start = daysjs(startDate);
    const end = daysjs(endDate);
    if (!start.isValid()) return 'Invalid start date';
    if (endDate && !end.isValid()) return 'Invalid end date';
    if (endDate) {
      return `${meses[start.month()]}-${start.format('DD-MM-YYYY')} → ${end.format('DD-MM-YYYY')}`;
    }
    return start.format('DD-MM-YYYY');
  }

}
