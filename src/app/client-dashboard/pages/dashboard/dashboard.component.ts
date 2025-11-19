import { DatePipe, NgClass, UpperCasePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import ActivitiesDevicesDashboardEntity from '../../interfaces/activitiesDevicesDashboard.interface';
import { ActivitiesDevicesDashboardService } from '../../services/dashboard/activitiesDevicesDashboard.service';
import { UsersService } from '../../services/users/users.service';
import { SessionsService } from '../../services/sessions/sessions.service';
import UserEntity from '../../interfaces/user.interface'
import SessionsEntity from '../../interfaces/sessions.interface';

@Component({
  selector: 'app-dashboard',
  imports: [NgClass, DatePipe, UpperCasePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit{
  now = new Date();
  ListDevices = signal<ActivitiesDevicesDashboardEntity[]>([]);
  ListSessions = signal<SessionsEntity[]>([]);
  activitiesDevicesDashboardService = inject(ActivitiesDevicesDashboardService);
  usersService = inject(UsersService);
  sessionssService = inject(SessionsService);

  // ListCountries = signal<CountryEntity[]>([]);
  ListUsers = signal<ActivitiesDevicesDashboardEntity[]>([]);
  profile = signal<UserEntity>(new UserEntity());
  hasError = signal("");

  ngOnInit(): void {
    this.fillListSessions();
    // this.fillListDevices();
    this.fillUser();
  }
 async fillListSessions() {
    this.sessionssService.get().subscribe((resp) => {
      console.log("sessionssService get: ", resp)
      this.ListSessions.set(resp.data  ?? [])
    });
  }
  // async fillListDevices() {
  //   this.activitiesDevicesDashboardService.getCertificates().subscribe((resp) => {
  //     // console.log("resp: ", resp)
  //     this.ListDevices.set(resp.data  ?? [])
  //   });
  // }
  async fillUser() {
    this.usersService.profile().subscribe((resp) => {
      // console.log("resp: ", resp)
      this.profile.set(resp)
    });
  }


}
