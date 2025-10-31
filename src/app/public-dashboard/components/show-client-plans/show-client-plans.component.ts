import { Component, inject, OnInit, signal } from '@angular/core';
import PlanEntity from '../../interfaces/plan.interface';
import { PlansService } from '../../services/plans/plans.service';

import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
@Component({
  selector: 'app-show-client-plans',
  imports: [],
  templateUrl: './show-client-plans.component.html',
  styleUrl: './show-client-plans.component.css'
})
export class ShowClientPlansComponent  implements OnInit{


  ListPlans = signal<PlanEntity[] | any[]>([]);
  router = inject(Router);


  plansService = inject(PlansService);

  sanitizer = inject(DomSanitizer);

  ngOnInit(): void {
    this.fillListPlans();
  }


  hasError = signal("");

  fillListPlans() {
    // this.plansService.getPlans().subscribe((resp) => {
    //   console.log("fillListPlans resp: ", resp)
    //   const dataFormat = (resp.data ?? []).map(p => {
    //   const processed = (p.html ?? '').replace(/routerLink="/g, 'data-routerlink="');
    //   return { ...p, safeHtml: this.sanitizer.bypassSecurityTrustHtml(processed) };
    // });
    //   this.ListPlans.set(dataFormat);
    // })

    this.plansService.getPlans().subscribe((resp) => {
      console.log("fillListPlans resp: ", resp)
    //   const dataFormat = (resp.data ?? []).map(p => {
    //   const processed = (p.html ?? '').replace(
    //     /\s*\(click\)\s*=\s*"SelectPlan\(\s*p\s*\)"/g,
    //     ` data-select-plan="${p.id}"`
    //   );
    //   return { ...p, safeHtml: this.sanitizer.bypassSecurityTrustHtml(processed) };
    // });
    //   this.ListPlans.set(dataFormat);
      this.ListPlans.set(resp.data ?? []);
    })
  }


    onSubmit() {
    const dataToSave = new PlanEntity();
    // dataToSave.set();
    this.plansService.register(dataToSave.get()).subscribe((resp) => {
      console.log("resp: ", resp)
        // if(resp?.error?.message) {
        //   this.hasError.set(resp?.error?.message)
        //   setTimeout(() => {
        //   this.hasError.set("")
        //   }, 4000);
        //   return;
        // }
    });

  }

onCancel() {
  const dialogo: any = document.getElementById('add_server');
  if (dialogo && dialogo.open) {
    dialogo.close();
  }
}
 onContainerClick(ev: MouseEvent) {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-select-plan]');
    if (el) {
      ev.preventDefault();
      const id = el.getAttribute('data-select-plan')!;
      const plan = this.ListPlans().find(x => x.id === id);
      if (plan) this.SelectPlan(plan);
    }
  }
SelectPlan(d: PlanEntity) {
    // const user = this.authService.user();
    // const dataPlanClientDto = new PlanClientDto();
    // dataPlanClientDto.name = d.name;
    // dataPlanClientDto.devicesLimit = d.limitDevices;
    // dataPlanClientDto.plan_id = d.id;
    // dataPlanClientDto.amount = d.amount;
    // dataPlanClientDto.coinSymbol = d.coinSymbol;
    // dataPlanClientDto.period = "-";
    // this.userService.updateClientPlan(user?.id ?? "", dataPlanClientDto.get()).subscribe((resp) => {
    //   console.log("resp: ", resp)
    //     // if(resp?.error?.message) {
    //     //   this.hasError.set(resp?.error?.message)
    //     //   setTimeout(() => {
    //     //   this.hasError.set("")
    //     //   }, 4000);
    //     //   return;
    //     // }
    // });

    this.router.navigateByUrl('/auth/register');
  console.log(d)
}

}
