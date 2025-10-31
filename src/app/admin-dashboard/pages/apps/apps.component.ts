import { CommonModule, DatePipe, NgClass } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import AppsEntity from '../../interfaces/apps.interface';
import { AppsService } from '../../services/apps/apps.service';

@Component({
  selector: 'app-apps',
  imports: [NgClass, DatePipe, ReactiveFormsModule, CommonModule],
  templateUrl: './apps.component.html',
  styleUrl: './apps.component.css'
})
export class AppsComponent implements OnInit{

  ListApps = signal<AppsEntity[]>([]);

  appsService = inject(AppsService);


  hasError = signal("");

  fb = inject(FormBuilder);
  appsForm = this.fb.group({
    name: ['', [Validators.required ]],
    description: ['', [Validators.required ]],
    route: ['', [Validators.required ]],
    kind: ['', [Validators.required ]],
    active: ['', [Validators.required ]],
  })

  ngOnInit(): void {
    this.fillListCountries();
  }


  fillListCountries() {
    this.appsService.get().subscribe((resp) => {
      console.log("resp countries: ", resp)
      this.ListApps.set(resp.data ?? [])
    })
  }
    onSubmit() {
    if(this.appsForm.invalid) {
      this.hasError.set("Formulario invalido");
      setTimeout(() => {
        this.hasError.set("");
      }, 3000);
      return;
    }
    const data: AppsEntity | any = this.appsForm.value;
    const dataToSave = new AppsEntity();
    dataToSave.set(data);

    console.log("dataToSave: ", dataToSave.get())
    this.appsService.register(dataToSave.get()).subscribe((resp) => {
        // if(resp?.error?.message) {
        //   this.hasError.set(resp?.error?.message)
        //   setTimeout(() => {
        //   this.hasError.set("")
        //   }, 4000);
        //   return;
        // }
        this.cerrarDialogo();
    });

  }
cerrarDialogo() {
  const dialogo: any = document.getElementById('add_apps');
  if (dialogo && dialogo.open) {
    dialogo.close();
  }
}
}
