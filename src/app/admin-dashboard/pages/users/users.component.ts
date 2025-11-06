import { Component, inject, OnInit, signal } from '@angular/core';
import { CountriesService } from '../../services/countries/countries.service';
import { CountryEntity } from '../../interfaces/country.interface';
import UserEntity from '../../interfaces/user.interface';
import { UsersService } from '../../services/users/users.service';
import { DatePipe, NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlansService } from '../../services/plans/plans.service';
import PlanEntity from '../../interfaces/plan.interface';
import PlanClientDto from '../../interfaces/planClient.interface';
import { ServersService } from '../../services/servers/servers.service';
import serversEntity from '../../interfaces/servers.interface';
import ServicesEntity from '../../interfaces/services.interface';
import { ServicesService } from '../../services/services/services.service';
import PlanClientServerDto from '../../interfaces/planClientServer.interface';
import AdminTelephoneDto from '../../interfaces/AdminTelephone.interface';

@Component({
  selector: 'app-users',
  imports: [NgClass, DatePipe, ReactiveFormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css'
})
export class UsersComponent implements OnInit{

  ListCountries = signal<CountryEntity[]>([]);
  ListUsers = signal<UserEntity[]>([]);
  ListPlan = signal<PlanEntity[]>([]);
  ListServices = signal<ServicesEntity[]>([]);
  ListServers = signal<serversEntity[]>([]);

  selectedCountry = signal(new CountryEntity());
  toggleDropdown = signal(false);

  countryService = inject(CountriesService);
  userService = inject(UsersService);
  planService = inject(PlansService);
  serversService = inject(ServersService);
  servicesService = inject(ServicesService);


  hasError = signal("");

  fb = inject(FormBuilder);
  userForm = this.fb.group({
    firstNames: ['', [Validators.required ]],
    lastNames: ['', [Validators.required ]],
    // dni: ['', [Validators.required ]],
    phone: ['', [Validators.required ]],
    role: ['', [Validators.required ]],
    country: ['', [Validators.required ]],
    email: ['', [Validators.required, Validators.email ]],
    password: ['', [Validators.required, Validators.minLength(8) ]],
    services: [''],
    planes: [''],
    servers: [''],
    createdAt: [''],
    observations: ['']
  })

  ngOnInit(): void {
    this.fillListCountries();
    this.fillListUsers();
    this.fillListPlan();
    this.fillListServers();
    this.fillListServices();
  }


  fillListCountries() {
    this.countryService.getAllCountries().subscribe((resp) => {
      console.log("countryService getAllCountries: ", resp)
      this.ListCountries.set(resp.data ?? [])
    })
  }
  fillListUsers() {
    this.userService.getUsers().subscribe((resp) => {
      console.log("userService getUsers: ", resp)
      this.ListUsers.set(resp.data ?? [])
    })
  }
  fillListPlan() {
    this.planService.getPlans().subscribe((resp) => {
      console.log("planService getPlans: ", resp)
      this.ListPlan.set(resp.data ?? [])
    })
  }
  fillListServers() {
    this.serversService.getServers().subscribe((resp) => {
      console.log("serversService getServers: ", resp)
      this.ListServers.set(resp.data ?? [])
    })
  }
  fillListServices() {
    this.servicesService.get().subscribe((resp) => {
      console.log("servicesService get: ", resp)
      this.ListServices.set(resp.data ?? [])
    })
  }
    onSubmit() {
    if(this.userForm.invalid) {
      this.hasError.set("Formulario invalido");
      setTimeout(() => {
        this.hasError.set("");
      }, 3000);
      return;
    }
    const {services, planes, servers, createdAt, ...data} = this.userForm.value;
    const dataToSave = new UserEntity();
    dataToSave.set(data);
    // dataToSave.telephone = data.phone ? [data.phone] : []

    const modelPhone = new AdminTelephoneDto();
    modelPhone.countryCode = this.selectedCountry().countryCode;
    modelPhone.countryName = this.selectedCountry().countryName;
    modelPhone.flag = this.selectedCountry().flag;
    modelPhone.phoneCode = this.selectedCountry().phoneCode;
    modelPhone.isActive = true;
    modelPhone.phone = data.phone || "";
    modelPhone.whatsapp_id = modelPhone.phoneCode.replace("+","")+""+modelPhone.phone+"@c.us";
    dataToSave.telephone = modelPhone?.phone ? [modelPhone] : []

    const exist_Country = this.ListCountries().find(f => f.id == data.country);
    const country = new CountryEntity();
    if(!exist_Country) return;
    country.set(exist_Country);
    dataToSave.country = country;


    const exist_Service = this.ListServices().find(f => f.id == services);
    const servicesEntity = new ServicesEntity();
    if(!!exist_Service) {
      servicesEntity.set(exist_Service);
    }

     const exist_Servers = this.ListServers().find(f => f.id == servers);
    const _serversEntity = new PlanClientServerDto();
    if(!!exist_Servers) {
      _serversEntity.access_permmit = exist_Servers.active;
      _serversEntity.addAt = new Date();
      // _serversEntity.plan_id = exist_plan.id;
      _serversEntity.server_country = exist_Servers.country.countryName;
      _serversEntity.server_id = exist_Servers.id;
      _serversEntity.server_name = exist_Servers.name;
    }

    const exist_plan = this.ListPlan().find(f => f.id == planes);
    const planClient = new PlanClientDto();
    if(!!exist_plan) {
      planClient.service_id = servicesEntity.id;
      planClient.service_longName = servicesEntity.longName;
      planClient.service_sortName = servicesEntity.sortName;
      planClient.plan_id = exist_plan.id;
      planClient.plan_title_name = exist_plan.title_name;
      planClient.plan_title_prefix = exist_plan.title_prefix;
      planClient.plan_title_suffix = exist_plan.title_suffix;
      planClient.price = exist_plan.price;
      planClient.currencyCode = exist_plan.currencyCode;
      planClient.currencyFormat = exist_plan.currencyFormat;
      planClient.currencyName = exist_plan.currencyName;
      planClient.currencySymbol = exist_plan.currencySymbol;
      planClient.kind = exist_plan.kind;
      planClient.limitDevices = exist_plan.limitDevices;
      planClient.startedAt = new Date( createdAt || new Date());
      planClient.active = exist_plan.active;
      planClient.endedAt = null;
      if(!!_serversEntity.server_id) {
        _serversEntity.plan_id = exist_plan.id;
      planClient.servers = [_serversEntity];
      }
    };
    dataToSave.services = [ planClient ];

    console.log("dataToSave.get(): ", dataToSave.get())

    this.userService.register(dataToSave.get()).subscribe((resp) => {
        if(resp?.error?.message) {
          this.hasError.set(resp?.error?.message)
          setTimeout(() => {
          this.hasError.set("")
          }, 4000);
          return;
        }

      this.fillListCountries();
      this.fillListUsers();
    });
    this.cerrarDialogo();
    this.userForm.reset()
  }
cerrarDialogo() {
  const dialogo: any = document.getElementById('add_user');
  if (dialogo && dialogo.open) {
    dialogo.close();
  }
}

getServiceNameById(id: string): string {
  const service = this.ListPlan().find(s => s.id === id);
  return service ? service.id : id;
}


  changeCountry(selected: CountryEntity | any) {
    this.selectedCountry.set(selected);
    this.toggleDropdown.set(false)
  }

}
