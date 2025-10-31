import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShowClientServersComponent } from './show-client-servers.component';

describe('ShowClientServersComponent', () => {
  let component: ShowClientServersComponent;
  let fixture: ComponentFixture<ShowClientServersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowClientServersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShowClientServersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
