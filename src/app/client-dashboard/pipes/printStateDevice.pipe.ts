import { Pipe, PipeTransform } from '@angular/core';
import daysjs from 'dayjs';

@Pipe({
  name: 'printstatedevice'
})
export class PrintStateDevicePipe implements PipeTransform {
  transform(obj: any): { text: string; class: string } {
  if (obj?.revoked) return { text: 'Revocado', class: 'badge-error' };
  if (obj?.suspend) return { text: 'Suspendido', class: 'badge-warning' };
  if (obj?.active) return { text: 'Activo', class: 'badge-success' };
  return { text: '-', class: '' };
}

}
