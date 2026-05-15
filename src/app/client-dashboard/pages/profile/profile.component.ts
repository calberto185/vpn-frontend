import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClientService } from '../../services/client/client.service';
import UserEntity from '../../interfaces/user.interface';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, DatePipe, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {

  private clientService = inject(ClientService);
  private fb            = inject(FormBuilder);

  // ── State ────────────────────────────────────────────────────────────────
  profile       = signal<UserEntity>(new UserEntity());
  saving        = signal(false);
  savingPwd     = signal(false);
  toast         = signal<{ msg: string; ok: boolean } | null>(null);
  picturePreview = signal<string>('');

  // ── Profile form (only client-editable fields) ───────────────────────────
  profileForm: FormGroup = this.fb.group({
    firstNames: ['', [Validators.required, Validators.minLength(2)]],
    lastNames:  ['', [Validators.required, Validators.minLength(2)]],
    country:    [''],
    dni:        [''],
    picture:    [''],
  });

  // ── Telephones ────────────────────────────────────────────────────────────
  phones: FormArray<FormControl<string>> = this.fb.array<FormControl<string>>([]);

  // ── Password form ─────────────────────────────────────────────────────────
  pwdForm: FormGroup = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword:     ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    this.clientService.getMe().subscribe({
      next: (resp) => {
        const u = resp?.data ?? new UserEntity();
        this.profile.set(u);
        this.patchForm(u);
      },
      error: () => {
        // keep whatever was already patched
      },
    });
  }

  private patchForm(u: UserEntity) {
    this.profileForm.patchValue({
      firstNames: u.firstNames,
      lastNames:  u.lastNames,
      country:    typeof u.country === 'string' ? u.country : (u.country as any)?.name ?? '',
      dni:        u.dni,
      picture:    u.picture,
    });
    this.picturePreview.set(u.picture ?? '');
    this.phones.clear();
    (u.telephone ?? []).forEach((t: any) => {
      const val = typeof t === 'string' ? t : (t?.phone ?? '');
      this.phones.push(new FormControl<any>(val));
    });
    this.profileForm.markAsPristine();
  }

  // ── Avatar ────────────────────────────────────────────────────────────────
  handleFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        const scale  = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.75);
        this.picturePreview.set(base64);
        this.profileForm.patchValue({ picture: base64 });
        this.profileForm.markAsDirty();
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  clearPicture() {
    this.picturePreview.set('');
    this.profileForm.patchValue({ picture: '' });
    this.profileForm.markAsDirty();
  }

  // ── Telephones ────────────────────────────────────────────────────────────
  addPhone()           { this.phones.push(new FormControl<any>('')); this.profileForm.markAsDirty(); }
  removePhone(i: number) { this.phones.removeAt(i); this.profileForm.markAsDirty(); }

  // ── Save profile ──────────────────────────────────────────────────────────
  saveProfile() {
    if (this.profileForm.invalid || this.saving()) return;
    const v = this.profileForm.value;
    const telephone = this.phones.controls
      .map(c => c.value?.trim())
      .filter(Boolean)
      .map(phone => ({ phone, countryName: '', countryCode: '', flag: '', phoneCode: '', kind: '', isActive: true }));

    this.saving.set(true);
    this.clientService.updateMe({
      firstNames: v.firstNames?.trim(),
      lastNames:  v.lastNames?.trim(),
      picture:    v.picture ?? '',
      telephone,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showToast('Perfil actualizado correctamente.', true);
        this.loadProfile();
      },
      error: err => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al guardar el perfil.', false);
      },
    });
  }

  // ── Change password ───────────────────────────────────────────────────────
  changePassword() {
    if (this.pwdForm.invalid || this.savingPwd()) return;
    const v = this.pwdForm.value;
    if (v.newPassword !== v.confirmPassword) {
      this.showToast('Las contraseñas no coinciden.', false);
      return;
    }
    this.savingPwd.set(true);
    this.clientService.changePassword(v.currentPassword, v.newPassword).subscribe({
      next: () => {
        this.savingPwd.set(false);
        this.pwdForm.reset();
        this.showToast('Contraseña cambiada correctamente.', true);
      },
      error: err => {
        this.savingPwd.set(false);
        this.showToast(err?.error?.message ?? 'Error al cambiar la contraseña.', false);
      },
    });
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 5000);
  }
}
