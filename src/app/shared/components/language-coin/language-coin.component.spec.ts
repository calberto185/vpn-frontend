import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LanguageCoinComponent } from './language-coin.component';

describe('LanguageCoinComponent', () => {
  let component: LanguageCoinComponent;
  let fixture: ComponentFixture<LanguageCoinComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LanguageCoinComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LanguageCoinComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
