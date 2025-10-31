import { DatePipe, NgClass } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import ActivitiesDevicesDashboardEntity from '../../interfaces/activitiesDevicesDashboard.interface';
import { ActivitiesDevicesDashboardService } from '../../services/dashboard/activitiesDevicesDashboard.service';

@Component({
  selector: 'app-dashboard',
  imports: [NgClass, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit{

  ListDevices = signal<ActivitiesDevicesDashboardEntity[]>([]);
  activitiesDevicesDashboardService = inject(ActivitiesDevicesDashboardService);

  // ListCountries = signal<CountryEntity[]>([]);
  ListUsers = signal<ActivitiesDevicesDashboardEntity[]>([]);
  hasError = signal("");

  ngOnInit(): void {
    this.fillListDevices();
  }

  async fillListDevices() {
    this.activitiesDevicesDashboardService.getCertificates().subscribe((resp) => {
      console.log("resp: ", resp)
      this.ListDevices.set(resp.data  ?? [])
    });
  }

}
