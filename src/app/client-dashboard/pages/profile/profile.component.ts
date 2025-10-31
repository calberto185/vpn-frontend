import { CommonModule } from '@angular/common';
import { Component, computed, EventEmitter, Input, OnChanges, Output, signal, SimpleChanges } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';



// =======================
// Types (based on sample)
// =======================
export type Plan = {
  plan_id: string;
  devicesLimit: number;
  name: string;
  amount: number;
  coinSymbol: string;
  symbol: string; // "-"
  period: string; // "-"
  startedAt: string; // ISO
  endedAt: string | null; // ISO | null
  state: boolean;
};

export type Cliente = {
  id: string;
  firstNames: string;
  lastNames: string;
  telephone: string[];
  picture: string; // base64/url
  role: 'standar' | 'admin' | 'user' | 'manager';
  isAdmin: boolean;
  email: string;
  password: string; // encrypted JSON string
  country: string;
  dni: string;
  state: 'Pendiente' | 'Aprobado' | 'Rechazado' | string;
  verified: boolean;
  verifiedAt: string; // ISO
  bloqued: boolean;
  bloquedAt: string; // ISO
  suspend: boolean;
  suspendAt: string; // ISO
  onService: boolean;
  onServiceAt: string; // ISO
  services: string[];
  observations: string;
  amount: number;
  coinSymbol: string;
  plan: Plan;
  plans: Plan[];
  createdAt: string; // ISO
};

// =======================
// Helper utils
// =======================
const isoOrNull = (d?: string | Date | null) => {
  if (!d) return null;
  try { return (typeof d === 'string' ? new Date(d) : d).toISOString(); } catch { return null; }
};

@Component({
  selector: 'app-profile',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent  implements OnChanges {
  @Input() value: Partial<Cliente> | null = null;
  @Output() save = new EventEmitter<Cliente>();

  form: FormGroup;
  private fb = new FormBuilder();
  picturePreview = signal<string>('');

  constructor() {
    this.form = this.fb.group({
      id: this.fb.control<string>(''),
      firstNames: this.fb.control<string>('', { validators: [Validators.required, Validators.minLength(2)] }),
      lastNames: this.fb.control<string>('', { validators: [Validators.required, Validators.minLength(2)] }),
      telephone: this.fb.array<FormControl<string>>([]),
      picture: this.fb.control<string>(''),
      role: this.fb.control<'standar' | 'admin' | 'user' | 'manager'>('standar'),
      isAdmin: this.fb.control<boolean>(false),
      email: this.fb.control<string>('', { validators: [Validators.required, Validators.email] }),
      password: this.fb.control<string>('', { nonNullable: true }), // encrypted JSON string (display only)
      country: this.fb.control<string>(''),
      dni: this.fb.control<string>('', { validators: [Validators.minLength(8)] }),
      state: this.fb.control<string>('Pendiente'),
      verified: this.fb.control<boolean>(false),
      verifiedAt: this.fb.control<string>(''),
      bloqued: this.fb.control<boolean>(false),
      bloquedAt: this.fb.control<string>(''),
      suspend: this.fb.control<boolean>(false),
      suspendAt: this.fb.control<string>(''),
      onService: this.fb.control<boolean>(false),
      onServiceAt: this.fb.control<string>(''),
      services: this.fb.array<FormControl<string>>([]),
      observations: this.fb.control<string>(''),
      amount: this.fb.control<number>(0),
      coinSymbol: this.fb.control<string>(''),
      plan: this.fb.group({
        plan_id: this.fb.control<string>(''),
        devicesLimit: this.fb.control<number>(1),
        name: this.fb.control<string>(''),
        amount: this.fb.control<number>(0),
        coinSymbol: this.fb.control<string>(''),
        symbol: this.fb.control<string>('-'),
        period: this.fb.control<string>('-'),
        startedAt: this.fb.control<string>(''),
        endedAt: this.fb.control<string | null>(null),
        state: this.fb.control<boolean>(true),
      }),
      plans: this.fb.control<Plan[] | null>(null),
      createdAt: this.fb.control<string>(''),
    });
  }

  ngOnChanges(): void {
    if (this.value) {
      // patch simple arrays
      this.setArray(this.telephones, this.value.telephone || []);
      this.setArray(this.servicesArr, this.value.services || []);

      // patch form
      this.form.patchValue({
        ...this.value,
        verifiedAt: this.value.verifiedAt || '',
        bloquedAt: this.value.bloquedAt || '',
        suspendAt: this.value.suspendAt || '',
        onServiceAt: this.value.onServiceAt || '',
        plan: {
          ...this.form.get('plan')!.value,
          ...(this.value.plan || {})
        }
      });

      // preview avatar
      const pic = this.value.picture || '';
      this.picturePreview.set(pic);
    }
  }

  // ============ Getters
  get telephones() { return this.form.get('telephone') as FormArray<FormControl<string>>; }
  get servicesArr() { return this.form.get('services') as FormArray<FormControl<string>>; }

  // ============ UI helpers
  avatarUrl = computed(() => this.picturePreview() || 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"80\" height=\"80\"><rect width=\"100%\" height=\"100%\" fill=\"#f3f4f6\"/><text x=\"50%\" y=\"55%\" font-size=\"12\" text-anchor=\"middle\" fill=\"#6b7280\">sin foto</text></svg>`) );

  handleFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result);
      this.picturePreview.set(base64);
      this.form.patchValue({ picture: base64 });
    };
    reader.readAsDataURL(file);
  }

  clearPicture() {
    this.picturePreview.set('');
    this.form.patchValue({ picture: '' });
  }

  addTelephone() { this.telephones.push(new FormControl<any>('')); }
  removeTelephone(i: number) { this.telephones.removeAt(i); }

  addService() { this.servicesArr.push(new FormControl<any>('')); }
  removeService(i: number) { this.servicesArr.removeAt(i); }

  setArray(arr: FormArray<FormControl<any>>, values: string[]) {
    arr.clear();
    values.forEach(v => arr.push(new FormControl<any>(v)));
  }

  dateLocal(v?: string | null) {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(+d)) return '';
    const z = new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString();
    return z.slice(0,16); // yyyy-MM-ddTHH:mm
  }

  setDate(key: 'verifiedAt'|'bloquedAt'|'suspendAt'|'onServiceAt', event: any) {
    const local = event.target.value
    const iso = local ? new Date(local).toISOString() : '';
    this.form.patchValue({ [key]: iso });
  }

  setNestedDate(group: 'plan', key: 'startedAt' | 'endedAt', event: any) {
    const local = event.target.value
    const iso = local ? new Date(local).toISOString() : '';
    (this.form.get(group) as FormGroup).patchValue({ [key]: iso });
  }

  // ============ Submit
  onSubmit() {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();

    const payload: Cliente = {
      id: raw.id || crypto.randomUUID(),
      firstNames: raw.firstNames?.trim() || '',
      lastNames: raw.lastNames?.trim() || '',
      telephone: (raw.telephone || []).map((x: any)=> (x || '').trim()).filter(Boolean),
      picture: raw.picture || '',
      role: raw.role || 'standar',
      isAdmin: !!raw.isAdmin,
      email: raw.email?.trim() || '',
      password: raw.password || '', // keep encrypted string; do NOT decrypt here
      country: raw.country?.trim() || '',
      dni: raw.dni?.trim() || '',
      state: raw.state || 'Pendiente',
      verified: !!raw.verified,
      verifiedAt: isoOrNull(raw.verifiedAt) || '1970-01-01T00:00:00.001Z',
      bloqued: !!raw.bloqued,
      bloquedAt: isoOrNull(raw.bloquedAt) || '1970-01-01T00:00:00.001Z',
      suspend: !!raw.suspend,
      suspendAt: isoOrNull(raw.suspendAt) || '1970-01-01T00:00:00.001Z',
      onService: !!raw.onService,
      onServiceAt: isoOrNull(raw.onServiceAt) || '1970-01-01T00:00:00.001Z',
      services: (raw.services || []).map((x: any) => (x || '').trim()).filter(Boolean),
      observations: raw.observations || '',
      amount: Number(raw.amount ?? 0),
      coinSymbol: raw.coinSymbol || '',
      plan: {
        plan_id: raw.plan?.plan_id || crypto.randomUUID(),
        devicesLimit: Number(raw.plan?.devicesLimit ?? 1),
        name: raw.plan?.name || '',
        amount: Number(raw.plan?.amount ?? 0),
        coinSymbol: raw.plan?.coinSymbol || '',
        symbol: raw.plan?.symbol || '-',
        period: raw.plan?.period || '-',
        startedAt: isoOrNull(raw.plan?.startedAt) || new Date().toISOString(),
        endedAt: raw.plan?.endedAt ? isoOrNull(raw.plan?.endedAt) : null,
        state: !!raw.plan?.state,
      },
      plans: raw.plans || [],
      createdAt: raw.createdAt || new Date().toISOString(),
    };

    this.save.emit(payload);
  }

  reset() {
    this.form.reset();
    this.telephones.clear();
    this.servicesArr.clear();
    this.picturePreview.set('');
    if (this.value) this.ngOnChanges();
  }

  preview() { return JSON.stringify(this.form.getRawValue(), null, 2); }
}

// =======================
// Example usage (Routing)
// =======================
// In your routes:
// { path: 'clientes/:id', loadComponent: () => import('./cliente-profile.component').then(m => m.ClienteProfileFormComponent) }

// =======================
// Notes
// - Tailwind: classes already included on inputs/buttons/containers.
// - Password: treated as encrypted JSON string; this UI does not decrypt it for safety.
// - Date fields: rendered as datetime-local with proper ISO <-> local conversion.
// - Arrays: telephone & services handled via FormArray with add/remove.
// - Emits (save) with a strongly typed Cliente payload ready to persist.
