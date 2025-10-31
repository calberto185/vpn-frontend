import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResetearpasswordPageComponent } from './resetearpassword-page.component';

describe('ResetearpasswordPageComponent', () => {
  let component: ResetearpasswordPageComponent;
  let fixture: ComponentFixture<ResetearpasswordPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetearpasswordPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResetearpasswordPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
