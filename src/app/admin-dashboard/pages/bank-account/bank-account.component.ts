import { DatePipe, NgClass, SlicePipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CountryEntity } from '../../interfaces/country.interface';
import bankAccountEntity from '../../interfaces/bankAccount.interface';
import { CountriesService } from '../../services/countries/countries.service';
import { BankAccountService } from '../../services/bankAccount/bankAccount.service';
import { PermissionsService } from '../../services/permissions/permissions.service';

@Component({
  selector: 'app-bank-account',
  imports: [NgClass, DatePipe, SlicePipe, ReactiveFormsModule],
  templateUrl: './bank-account.component.html',
  styleUrl: './bank-account.component.css',
})
export class BankAccountComponent implements OnInit, OnDestroy {

  // ── Permissions ────────────────────────────────────────────────────────────
  private permissions = inject(PermissionsService);
  canCreate = computed(() => this.permissions.canDo('settings/bank-account', 'create'));
  canUpdate = computed(() => this.permissions.canDo('settings/bank-account', 'update'));
  canDelete = computed(() => this.permissions.canDo('settings/bank-account', 'delete'));

  private countryService     = inject(CountriesService);
  private bankAccountService = inject(BankAccountService);
  private fb                 = inject(FormBuilder);
  private subs               = new Subscription();

  ListBankAccount = signal<bankAccountEntity[]>([]);
  ListCountry     = signal<CountryEntity[]>([]);
  hasError        = signal('');
  editItem        = signal<bankAccountEntity | null>(null);
  saving          = signal(false);
  loading         = signal(false);

  // ── Search / Filter ───────────────────────────────────────────────────────
  searchQuery  = signal('');
  filterType   = signal('');   // '' | typeAccount value
  filterActive = signal('');   // '' | 'active' | 'inactive'

  filteredAccounts = computed(() => {
    const q  = this.searchQuery().toLowerCase().trim();
    const ft = this.filterType();
    const fa = this.filterActive();
    return this.ListBankAccount().filter(a => {
      const matchQ = !q || (
        (a.name ?? '').toLowerCase().includes(q) ||
        (a.number ?? '').toLowerCase().includes(q) ||
        (a.typeAccount ?? '').toLowerCase().includes(q)
      );
      const matchType   = !ft || a.typeAccount === ft;
      const matchActive =
        !fa ||
        (fa === 'active'   &&  a.active) ||
        (fa === 'inactive' && !a.active);
      return matchQ && matchType && matchActive;
    });
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  totalAccounts    = computed(() => this.ListBankAccount().length);
  activeAccounts   = computed(() => this.ListBankAccount().filter(a => a.active).length);
  inactiveAccounts = computed(() => this.ListBankAccount().filter(a => !a.active).length);
  visibleAccounts  = computed(() => this.ListBankAccount().filter(a => a.visible).length);

  // ── Type tracking for conditional crypto section ──────────────────────────
  createType = signal('');
  editType   = signal('');

  isCreateCrypto = computed(() => this.isCryptoType(this.createType()));
  isEditCrypto   = computed(() => this.isCryptoType(this.editType()));

  // ── Account type catalog ──────────────────────────────────────────────────
  readonly ACCOUNT_TYPES = [
    { group: 'Tradicional', value: 'bank_transfer',      label: 'Transferencia bancaria' },
    { group: 'Tradicional', value: 'card',               label: 'Tarjeta' },
    { group: 'Tradicional', value: 'cash',               label: 'Efectivo' },
    { group: 'Tradicional', value: 'sbp',                label: 'SBP — Pago Rápido (Rusia)' },
    { group: 'Tradicional', value: 'tbank',              label: 'T-Bank' },
    { group: 'Tradicional', value: 'yoomoney',           label: 'YooMoney' },
    { group: 'Cripto',      value: 'crypto_usdt_trc20',  label: 'USDT TRC-20 (Tron)' },
    { group: 'Cripto',      value: 'crypto_usdt_erc20',  label: 'USDT ERC-20 (Ethereum)' },
    { group: 'Cripto',      value: 'crypto_usdt_bep20',  label: 'USDT BEP-20 (BSC)' },
    { group: 'Cripto',      value: 'crypto_btc',         label: 'Bitcoin (BTC)' },
    { group: 'Cripto',      value: 'crypto_eth',         label: 'Ethereum (ETH)' },
    { group: 'Cripto',      value: 'crypto_ton',         label: 'TON' },
    { group: 'Cripto',      value: 'crypto_usdc',        label: 'USDC' },
    { group: 'Cripto',      value: 'binance_pay',        label: 'Binance Pay' },
    { group: 'Cripto',      value: 'bybit_pay',          label: 'Bybit Pay' },
  ];

  readonly TRAD_TYPES = this.ACCOUNT_TYPES.filter(t => t.group === 'Tradicional');
  readonly CRYPTO_TYPES = this.ACCOUNT_TYPES.filter(t => t.group === 'Cripto');

  // ── Forms ─────────────────────────────────────────────────────────────────
  bankAccountForm = this.fb.group({
    name:          ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    number:        ['', Validators.required],
    cardAccount:   [''],
    typeAccount:   ['', Validators.required],
    country_id:    ['', Validators.required],
    active:        [false],
    visible:       [false],
    note:          ['', Validators.maxLength(500)],
    // Cripto
    network:       [''],
    currency:      [''],
    qr_code:       [''],
    min_amount:    [0],
    confirmations: [1],
  });

  editForm = this.fb.group({
    id:            [''],
    name:          ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    number:        ['', Validators.required],
    cardAccount:   [''],
    typeAccount:   ['', Validators.required],
    country_id:    ['', Validators.required],
    active:        [false],
    visible:       [false],
    note:          ['', Validators.maxLength(500)],
    // Cripto
    network:       [''],
    currency:      [''],
    qr_code:       [''],
    min_amount:    [0],
    confirmations: [1],
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.fillBankAccount();
    this.fillCountry();

    this.subs.add(
      this.bankAccountForm.get('typeAccount')!.valueChanges.subscribe(v => this.createType.set(v ?? ''))
    );
    this.subs.add(
      this.editForm.get('typeAccount')!.valueChanges.subscribe(v => this.editType.set(v ?? ''))
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  fillBankAccount() {
    this.loading.set(true);
    this.bankAccountService.getBankAccount().subscribe({
      next:  resp => { this.ListBankAccount.set(resp?.data ?? []); this.loading.set(false); },
      error: ()   => this.loading.set(false),
    });
  }

  fillCountry() {
    this.countryService.getAllCountries().subscribe(resp => this.ListCountry.set(resp?.data ?? []));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  isCryptoType(type: string): boolean {
    return type.startsWith('crypto_') || ['binance_pay', 'bybit_pay'].includes(type);
  }

  typeLabel(type: string): string {
    return this.ACCOUNT_TYPES.find(t => t.value === type)?.label ?? type;
  }

  numberPlaceholder(type: string): string {
    switch (type) {
      case 'bank_transfer': return 'IBAN / Número de cuenta';
      case 'card':          return 'Número de tarjeta';
      case 'cash':          return 'Referencia / Nombre del punto';
      case 'sbp':           return 'Número de teléfono (+7...)';
      case 'tbank':         return 'Número de teléfono (+7...)';
      case 'yoomoney':      return 'ID de wallet (41001...)';
      case 'binance_pay':   return 'Binance Pay ID';
      case 'bybit_pay':     return 'Bybit UID / Pay ID';
      default:              return 'Dirección de wallet';
    }
  }

  // ── Create ────────────────────────────────────────────────────────────────
  onSubmit() {
    if (this.bankAccountForm.invalid) {
      this.hasError.set('Formulario inválido. Revisa los campos requeridos.');
      setTimeout(() => this.hasError.set(''), 3000);
      return;
    }
    const v = this.bankAccountForm.value;
    const findCountry = this.ListCountry().find(c => c.id === v.country_id);
    if (!findCountry) { this.hasError.set('Selecciona un país válido'); setTimeout(() => this.hasError.set(''), 3000); return; }

    try {
      const dataToSave = new bankAccountEntity();
      dataToSave.set(v);
      const c = new CountryEntity(); c.set(findCountry); dataToSave.country = c.get();
      this.bankAccountService.register(dataToSave.get()).subscribe({
        next: () => {
          this.fillBankAccount();
          (document.getElementById('add_account') as HTMLDialogElement | null)?.close();
          this.bankAccountForm.reset({ active: false, visible: false, min_amount: 0, confirmations: 1 });
          this.createType.set('');
        },
        error: err => { this.hasError.set(err?.error?.message ?? 'Error al registrar'); setTimeout(() => this.hasError.set(''), 4000); },
      });
    } catch (e: any) {
      this.hasError.set(e.message); setTimeout(() => this.hasError.set(''), 3000);
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  openEditModal(account: bankAccountEntity) {
    this.editItem.set(account);
    this.editType.set(account.typeAccount);
    this.editForm.patchValue({
      id:            account.id,
      name:          account.name,
      number:        account.number,
      cardAccount:   account.cardAccount,
      typeAccount:   account.typeAccount,
      country_id:    (account.country as any)?.id ?? '',
      active:        account.active,
      visible:       account.visible,
      note:          account.note,
      network:       account.network,
      currency:      account.currency,
      qr_code:       account.qr_code,
      min_amount:    account.min_amount,
      confirmations: account.confirmations,
    });
    (document.getElementById('edit_account') as HTMLDialogElement | null)?.showModal();
  }

  onEditSubmit() {
    if (this.editForm.invalid) return;
    const v = this.editForm.value;
    const findCountry = this.ListCountry().find(c => c.id === v.country_id);
    if (!findCountry) { this.hasError.set('Selecciona un país válido'); setTimeout(() => this.hasError.set(''), 3000); return; }
    try {
      const dataToSave = new bankAccountEntity();
      dataToSave.set({ ...this.editItem()!, ...v });
      const c = new CountryEntity(); c.set(findCountry); dataToSave.country = c.get();
      this.saving.set(true);
      this.bankAccountService.update(dataToSave as any).subscribe({
        next: () => {
          this.saving.set(false);
          this.fillBankAccount();
          (document.getElementById('edit_account') as HTMLDialogElement | null)?.close();
        },
        error: err => {
          this.saving.set(false);
          this.hasError.set(err?.error?.message ?? 'Error al actualizar');
          setTimeout(() => this.hasError.set(''), 3000);
        },
      });
    } catch (e: any) {
      this.saving.set(false); this.hasError.set(e.message); setTimeout(() => this.hasError.set(''), 3000);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  openDeleteModal(account: bankAccountEntity) {
    this.editItem.set(account);
    (document.getElementById('delete_account') as HTMLDialogElement | null)?.showModal();
  }
}
