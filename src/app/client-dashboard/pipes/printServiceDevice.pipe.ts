import { Pipe, PipeTransform } from '@angular/core';
import daysjs from 'dayjs';

@Pipe({
  name: 'printservicedevice'
})
export class PrintServiceDevicePipe implements PipeTransform {
  transform(device: any, profile: any): string {
    const service: any = [].concat(profile?.services).find((p: any) => p?.plan_id == device.plan_id);
    if(!!service) return service?.service_sortName;
    return "-";
}

}
