import { Component, inject, OnInit, signal } from '@angular/core';

import { DatePipe, NgClass, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import UserEntity from '../../interfaces/user.interface';
import { UsersService } from '../../services/users/users.service';
import { PlansService } from '../../services/plans/plans.service';
import PlanEntity from '../../interfaces/plan.interface';
import { BankAccountService } from '../../services/bankAccount/bankAccount.service';
import bankAccountEntity from '../../interfaces/bankAccount.interface';
import { PaymentsService } from '../../services/payments/payments.service';
import paymentEntity from '../../interfaces/payment.interface';
@Component({
  selector: 'app-payments',
  imports: [NgClass, DatePipe, ReactiveFormsModule],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.css'
})
export class PaymentsComponent {

  ListUsers = signal<UserEntity[]>([]);
  ListBankAccount = signal<bankAccountEntity[]>([]);
  ListPlans = signal<PlanEntity[]>([]);
  ListPayments = signal<paymentEntity[]>([]);
  SelectClient = signal<UserEntity>(new UserEntity);
  selectedFile: File | null = null;

  userService = inject(UsersService);
  bankAccountService = inject(BankAccountService);
  plansService = inject(PlansService);
  paymentsService = inject(PaymentsService);

  hasError = signal("");

  fb = inject(FormBuilder);
  userForm = this.fb.group({
    user_id: ['', [Validators.required ]],
    plan_id: ['', [Validators.required ]],
    file: ['', [Validators.required ]],
    state: ['', [Validators.required ]],
    amount: ['', [Validators.required ]],
    method: ['', [Validators.required ]],
    methodPay: ['', [Validators.required ]],
    period: [''],
    note: ['']
  })
  ngOnInit(): void {
    this.fillListPayments();
    this.fillListUsers();
    this.fillBankAccount();
    this.fillListPlans();
  }
  fillListPayments() {
    this.paymentsService.getPayments().subscribe((resp) => {
      console.log("paymentsService getPayments: ", resp)
      this.ListPayments.set(resp.data ?? [])
    })
  }
  fillListUsers() {
    this.userService.getUsers().subscribe((resp) => {
      console.log("userService getUsers: ", resp)
      this.ListUsers.set(resp.data ?? [])
    })
  }
  fillBankAccount() {
    this.bankAccountService.getBankAccount().subscribe((resp) => {
      console.log('bankAccountService getBankAccount: ', resp)
      this.ListBankAccount.set(resp?.data ?? []);
    });
  }
  fillListPlans() {
    this.plansService.getPlans().subscribe((resp) => {
      console.log("fillListPlans getPlans: ", resp)
      this.ListPlans.set(resp.data ?? []);
    })
  }
  onSubmit() {
    try {
      if (this.userForm.invalid) {
        this.hasError.set('Formulario invalido');
        setTimeout(() => this.hasError.set(''), 3000);
        return;
      }
      const { user_id,
        plan_id,
        state,
        amount,
        method,
        methodPay,
        period,
        note
      } = this.userForm.value;
      const user = this.SelectClient();
      // const plan = this.ListPlans().find(p => p.id === plan_id);
      const plan = this.SelectClient().services.find(p => p.plan_id === plan_id);
      const accountToPaymnet = this.ListBankAccount().find(p => p.id === methodPay);
      if(!method || !state || !user.id || !plan?.plan_id || !accountToPaymnet?.id) return;

      const dataToSave = new paymentEntity();
      // dataToSave.amount = parseInt(data.amount);
      dataToSave.createdAt = new Date();
      dataToSave.kind = plan?.kind;
      dataToSave.method = method;
      dataToSave.methodPay.id = accountToPaymnet.id;
      dataToSave.methodPay.cardAccount = accountToPaymnet.cardAccount;
      dataToSave.methodPay.name = accountToPaymnet.name;
      dataToSave.methodPay.number = accountToPaymnet.number;
      dataToSave.methodPay.typeAccount = accountToPaymnet.typeAccount;
      dataToSave.note = note || "";
      dataToSave.period = period ? period : plan.startedAt.toDateString();
      dataToSave.plan = plan;
      dataToSave.amount = Number(amount);
      dataToSave.state = state;
      dataToSave.user_email = user.email;
      dataToSave.user_id = user.id
      dataToSave.user_name = user.firstNames + " "+ user.lastNames
      console.log("dataToSave: ", dataToSave)
      this.paymentsService.doesPayments(dataToSave.get(), this.selectedFile).subscribe({
      next: ({ progress, response }) => {
        console.log("progress: ", progress)
        // this.progress = progress;
        if (response) {
          console.log("response: ", response)
        }
        // if (response) this.response = response;
      },
      error: (err) => console.error('Error:', err),
    });
    } catch (error) {
      console.log("error: ", error)
    }
  }
onSelectClient(event: any) {
  const userId = (event.target as HTMLSelectElement).value;
  console.log("userId: ", userId)
  const user = this.ListUsers().find(d => d.id == userId);
  console.log("user: ", user)
  this.SelectClient().set(user);
}
  onUploadProof(event: Event) {
    console.log("event: ", event)
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
    } else {
      this.selectedFile = null;
    }
  }
cerrarDialogo() {
  const dialogo: any = document.getElementById('add_payment');
  if (dialogo && dialogo.open) {
    dialogo.close();
  }
}
}
