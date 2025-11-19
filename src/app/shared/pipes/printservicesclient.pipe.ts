import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'printservicesclient'
})
export class PrintservicesclientPipe implements PipeTransform {

  transform(value: any[], ...args: unknown[]): unknown {
    let services = value.map(f => f["service_sortName"]).join(",");
    if(!services) {
      services = "Sin servicio"
    }
    return services;
  }

}
