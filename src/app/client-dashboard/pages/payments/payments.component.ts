import { CommonModule, DatePipe, NgClass } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { PaymentsService } from '../../services/payments/payments.service';
import PaymentsEntity from '../../interfaces/payment.interface';

@Component({
  selector: 'app-payments',
  imports: [NgClass, DatePipe, ReactiveFormsModule, CommonModule],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.css'
})
export class PaymentsComponent  implements OnInit{


  paymentsService = inject(PaymentsService);
  ListPayments = signal<PaymentsEntity[]>([]);
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
    this. fillListUsers();
  }
  fillListUsers() {
      this.paymentsService.getPayments("").subscribe((resp) => {
        console.log("paymentsService getPayments: ", resp)
        this.ListPayments.set(resp.data ?? [])
      })
    }
}
