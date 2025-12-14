import { DatePipe, NgClass, UpperCasePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import ActivitiesDevicesDashboardEntity from '../../interfaces/activitiesDevicesDashboard.interface';
import { ActivitiesDevicesDashboardService } from '../../services/dashboard/activitiesDevicesDashboard.service';
import { UsersService } from '../../services/users/users.service';
import { SessionsService } from '../../services/sessions/sessions.service';
import UserEntity from '../../interfaces/user.interface'
import SessionsEntity from '../../interfaces/sessions.interface';
import { PaymentsService } from '../../services/payments/payments.service';
import PaymentsEntity from '../../interfaces/payment.interface';
import daysjs from 'dayjs';

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
  paymentsService = inject(PaymentsService);
  ListPayments = signal<PaymentsEntity[]>([]);

  // ListCountries = signal<CountryEntity[]>([]);
  ListUsers = signal<ActivitiesDevicesDashboardEntity[]>([]);
  profile = signal<UserEntity>(new UserEntity());
  hasError = signal("");
  btnAddService = signal(false);

  ngOnInit(): void {
    this.fillListSessions();
    // this.fillListDevices();
    this.fillListPayments();
    this.fillUser();
  }
 async fillListSessions() {
    this.sessionssService.get().subscribe((resp) => {
      // console.log("sessionssService get: ", resp)
      this.ListSessions.set(resp.data  ?? [])
    });
  }

  async fillListPayments() {
      this.paymentsService.getPayments("").subscribe((resp) => {
        // console.log("paymentsService getPayments: ", resp)
        this.ListPayments.set(resp.data ?? [])
      })
    }
  // async fillListDevices() {
  //   this.activitiesDevicesDashboardService.getCertificates().subscribe((resp) => {
  //     // console.log("resp: ", resp)
  //     this.ListDevices.set(resp.data  ?? [])
  //   });
  // }
  async fillUser() {
    this.usersService.profile().subscribe((resp) => {
      this.profile.set(resp)
      this.paymentsService.getPayments("").subscribe((pay) => {
      const upates = structuredClone(this.profile());
      console.log("upates  ", upates)
      console.log("this.ListPayments():  ", this.ListPayments())
      const services =  upates?.services?.map((f: any) => {
        const existPayments = [].concat(pay.data??[]).find((p: any) =>
          p.plan.plan_id == f.plan_id &&
          daysjs(new Date()).isAfter(p.plan.startedAt) &&
          daysjs(new Date()).isBefore(p.plan.endedAt))
          f["upToDate"] =  !!existPayments ? true : false;
          f["paymentAdvance"] =  this.ListPayments().filter(p => p.plan.plan_id == f.plan_id && !p.isPrePay).length;
        return f;
      })
      upates.services = services;
      this.profile.set(upates)
      console.log("this.profile ===>: ", this.profile())
      })
      this.btnAddService.set(this.profile()?.services?.length == 0 || !this.profile()?.services?.find(s => s.service_sortName.toUpperCase().includes("VPN")));
    });
  }

  getUpToDate(item:any) {
    return item["upToDate"]
  }

  getPaymentAdvance(item:any) {
    return item["paymentAdvance"]
  }

   addPlanOnlyVPN() {
      if(this.btnAddService()) {
          const dialog = document.getElementById('view_select_plans') as HTMLDialogElement;
          dialog?.showModal();
      }
    }
}
