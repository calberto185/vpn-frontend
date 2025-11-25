import { CommonModule, DatePipe, NgClass } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { PaymentsService } from '../../services/payments/payments.service';
import PaymentsEntity from '../../interfaces/payment.interface';
import { PrintperiodPipe } from '../../pipes/printPeriod.pipe';

@Component({
  selector: 'app-payments',
  imports: [NgClass, DatePipe, ReactiveFormsModule, CommonModule, PrintperiodPipe],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.css'
})
export class PaymentsComponent  implements OnInit{


  paymentsService = inject(PaymentsService);
  ListPayments = signal<PaymentsEntity[]>([]);
  summary = {
    payments: 0,
    accepts: 0,
    pending: 0,
  }
  hasError = signal("");
  fb = inject(FormBuilder);
// deviceForm = this.fb.group({
      // id: [''], // opcional
      // user_id: ['', Validators.required],
      // device: ['', Validators.required],
      // typeDevice: ['', Validators.required],
      // active: [false],
      // certificate: [''],
      // suspendedAt: [{ value: '', disabled: true }],
      // revokedAt: [{ value: '', disabled: true }]
  // })

  ngOnInit(): void {
    this. fillListPayments();
  }
  fillListPayments() {
      this.paymentsService.getPayments("").subscribe((resp) => {
        console.log("paymentsService getPayments: ", resp)
        this.ListPayments.set(resp.data ?? [])
        const result = this.ListPayments().reduce((acc: any, n) => {
            this.summary.payments +=  1;
            if(!!n.isPrePay && n.state.toLowerCase() == "pagado") {
              this.summary.accepts += 1;
            }
            if(!n.isPrePay && n.state.toLowerCase() !== "pagado") {
              this.summary.pending +=  1;
            }
          return this.summary
        }, this.summary)
        this.summary = result;
      })
    }
}
