import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CountryEntity } from '../../interfaces/country.interface';
import { CountriesService } from '../../services/countries/countries.service';
import { ContinentEntity } from '../../interfaces/continent.interface';
import { ContinentsService } from '../../../client-dashboard/services/continents/continents.service';
import { PermissionsService } from '../../services/permissions/permissions.service';

@Component({
  selector: 'app-countries',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './countries.component.html',
  styleUrl: './countries.component.css'
})
export class CountriesComponent implements OnInit {

  ListCountries  = signal<CountryEntity[]>([]);
  ListContinents = signal<ContinentEntity[]>([]);

  // ── Permissions ────────────────────────────────────────────────────────────
  private permissions = inject(PermissionsService);
  canCreate = computed(() => this.permissions.canDo('settings/countries', 'create'));
  canUpdate = computed(() => this.permissions.canDo('settings/countries', 'update'));
  canDelete = computed(() => this.permissions.canDo('settings/countries', 'delete'));

  private countryService   = inject(CountriesService);
  private continentsService = inject(ContinentsService);
  private fb               = inject(FormBuilder);

  toast    = signal<{ msg: string; ok: boolean } | null>(null);
  hasError = signal('');
  editItem = signal<CountryEntity | null>(null);
  viewItem = signal<CountryEntity | null>(null);
  saving   = signal(false);
  deleting = signal(false);
  loading  = signal(false);

  // ── Search / Filter ───────────────────────────────────────────────────────
  searchQuery   = signal('');
  filterActive  = signal('');  // '' | 'active' | 'inactive'

  filteredCountries = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const fa = this.filterActive();
    return this.ListCountries().filter(c => {
      const matchQ = !q || (
        c.countryName.toLowerCase().includes(q) ||
        c.countryCode.toLowerCase().includes(q) ||
        c.languageName.toLowerCase().includes(q) ||
        c.languageCode.toLowerCase().includes(q) ||
        (c.phoneCode ?? '').toLowerCase().includes(q)
      );
      const matchActive =
        !fa ||
        (fa === 'active'   &&  c.isActive) ||
        (fa === 'inactive' && !c.isActive);
      return matchQ && matchActive;
    });
  });

  // ── Computed stats ────────────────────────────────────────────────────────
  totalCountries    = computed(() => this.ListCountries().length);
  activeCountries   = computed(() => this.ListCountries().filter(c => c.isActive).length);
  inactiveCountries = computed(() => this.ListCountries().filter(c => !c.isActive).length);

  // ── Forms ─────────────────────────────────────────────────────────────────
  createForm = this.fb.group({
    countryName:    ['', Validators.required],
    countryCode:    ['', Validators.required],
    languageName:   ['', Validators.required],
    languageCode:   ['', Validators.required],
    currencyName:   ['', Validators.required],
    currencyCode:   ['', Validators.required],
    currencySymbol: ['', Validators.required],
    currencyFormat: ['', Validators.required],
    flag:           ['', Validators.required],
    phoneCode:      ['', Validators.required],
    continent:      ['', Validators.required],
    isActive:       [false],
    visible:        [false],
  });

  editForm = this.fb.group({
    countryName:    ['', Validators.required],
    countryCode:    ['', Validators.required],
    languageName:   ['', Validators.required],
    languageCode:   ['', Validators.required],
    currencyName:   ['', Validators.required],
    currencyCode:   ['', Validators.required],
    currencySymbol: ['', Validators.required],
    currencyFormat: ['', Validators.required],
    flag:           ['', Validators.required],
    phoneCode:      ['', Validators.required],
    continent:      ['', Validators.required],
    isActive:       [false],
    visible:        [false],
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.fillListCountries();
    this.fillListContinents();
  }

  fillListCountries() {
    this.loading.set(true);
    this.countryService.getAllCountries().subscribe({
      next:  resp => { this.ListCountries.set(resp.data ?? []); this.loading.set(false); },
      error: ()   => this.loading.set(false),
    });
  }

  fillListContinents() {
    this.continentsService.get().subscribe(resp => this.ListContinents.set(resp.data ?? []));
  }

  // ── Create ────────────────────────────────────────────────────────────────
  onSubmit() {
    if (this.createForm.invalid) { this.showToast('Formulario inválido. Revisa los campos.', false); return; }
    const data = this.createForm.value;
    const existContinent = this.ListContinents().find(c => c.id === data.continent);
    if (!existContinent) { this.showToast('Selecciona un continente válido', false); return; }
    const dataToSave = new CountryEntity();
    dataToSave.set(data);
    const continent = new ContinentEntity(); continent.set(existContinent);
    dataToSave.continent = continent;
    this.saving.set(true);
    this.countryService.register(dataToSave.get()).subscribe({
      next: () => {
        this.saving.set(false);
        this.fillListCountries();
        (document.getElementById('add_country') as HTMLDialogElement | null)?.close();
        this.createForm.reset({ isActive: false, visible: false });
        this.showToast('País creado exitosamente.', true);
      },
      error: err => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al crear el país', false);
      },
    });
  }

  // ── View ──────────────────────────────────────────────────────────────────
  openViewModal(country: CountryEntity) {
    this.viewItem.set(country);
    (document.getElementById('view_country') as HTMLDialogElement | null)?.showModal();
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  openEditModal(country: CountryEntity) {
    this.editItem.set(country);
    this.editForm.patchValue({
      countryName:    country.countryName,
      countryCode:    country.countryCode,
      languageName:   country.languageName,
      languageCode:   country.languageCode,
      currencyName:   country.currencyName,
      currencyCode:   country.currencyCode,
      currencySymbol: country.currencySymbol,
      currencyFormat: country.currencyFormat,
      flag:           country.flag,
      phoneCode:      country.phoneCode,
      continent:      (country.continent as any)?.id ?? '',
      isActive:       country.isActive,
      visible:        country.visible,
    });
    (document.getElementById('edit_country') as HTMLDialogElement | null)?.showModal();
  }

  onEditSubmit() {
    if (this.editForm.invalid) return;
    const data = this.editForm.value;
    const existContinent = this.ListContinents().find(c => c.id === data.continent);
    if (!existContinent) { this.showToast('Selecciona un continente válido', false); return; }
    const dataToSave = new CountryEntity();
    dataToSave.set({ ...this.editItem()!, ...data });
    const continent = new ContinentEntity(); continent.set(existContinent);
    dataToSave.continent = continent;
    this.saving.set(true);
    this.countryService.update(dataToSave.get() as any).subscribe({
      next: () => {
        this.saving.set(false);
        this.fillListCountries();
        (document.getElementById('edit_country') as HTMLDialogElement | null)?.close();
        this.showToast('País actualizado.', true);
      },
      error: err => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al actualizar', false);
      },
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  openDeleteModal(country: CountryEntity) {
    this.editItem.set(country);
    (document.getElementById('delete_country') as HTMLDialogElement | null)?.showModal();
  }

  confirmDelete() {
    const country = this.editItem(); if (!country) return;
    this.deleting.set(true);
    this.countryService.delete(country.id).subscribe({
      next: () => {
        this.deleting.set(false);
        (document.getElementById('delete_country') as HTMLDialogElement | null)?.close();
        this.fillListCountries();
        this.showToast('País eliminado.', true);
      },
      error: err => {
        this.deleting.set(false);
        this.showToast(err?.error?.message ?? 'Error al eliminar', false);
      },
    });
  }

  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
