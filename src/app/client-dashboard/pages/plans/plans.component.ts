import { Component } from '@angular/core';
import { ShowClientPlansComponent } from "../../components/show-client-plans/show-client-plans.component";

@Component({
  selector: 'app-plans',
  imports: [ShowClientPlansComponent],
  templateUrl: './plans.component.html',
  styleUrl: './plans.component.css'
})
export class PlansComponent {

}
