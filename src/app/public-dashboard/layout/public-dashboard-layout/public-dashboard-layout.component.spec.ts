import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PublicDashboardLayoutComponent } from './public-dashboard-layout.component';

describe('PublicDashboardLayoutComponent', () => {
  let component: PublicDashboardLayoutComponent;
  let fixture: ComponentFixture<PublicDashboardLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicDashboardLayoutComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PublicDashboardLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
