import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShowClientPlansComponent } from './show-client-plans.component';

describe('ShowClientPlansComponent', () => {
  let component: ShowClientPlansComponent;
  let fixture: ComponentFixture<ShowClientPlansComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowClientPlansComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShowClientPlansComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
