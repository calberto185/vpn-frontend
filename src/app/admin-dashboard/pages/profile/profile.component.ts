import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import UserEntity from '../../../auth/interfaces/auth-user.interface';
import { AdminAccountService } from '../../services/account/account.service';

@Component({
  selector: 'app-admin-profile',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class AdminProfileComponent implements OnInit {
  private accountService = inject(AdminAccountService);
  private fb = inject(FormBuilder);

  loading         = signal(false);
  saving          = signal(false);
  savingPwd       = signal(false);
  hasError        = signal('');
  toast           = signal<{ msg: string; ok: boolean } | null>(null);
  profile         = signal<UserEntity | null>(null);
  picturePreview  = signal<string>('');
  sessions        = signal<any[]>([]);
  loadingSessions = signal(false);
  revokingId      = signal<string | null>(null);

  form = this.fb.group({
    firstNames: ['', Validators.required],
    lastNames:  ['', Validators.required],
    picture:    [''],
  });

  phones: FormArray<FormControl<string>> = this.fb.array<FormControl<string>>([]);

  pwdForm = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword:     ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
  });

  ngOnInit(): void {
    this.loadProfile();
    this.loadSessions();
  }

  loadProfile(): void {
    this.loading.set(true);
    this.accountService.getMyProfile().subscribe({
      next: (resp) => {
        const data = resp?.data ?? null;
        this.profile.set(data);
        this.patchForm(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.hasError.set(err?.error?.message ?? 'No se pudo cargar el perfil.');
      },
    });
  }

  private patchForm(user: UserEntity | null): void {
    this.form.patchValue({
      firstNames: user?.firstNames || '',
      lastNames:  user?.lastNames  || '',
      picture:    user?.picture    || '',
    });
    this.picturePreview.set(user?.picture || '');
    this.phones.clear();
    ((user as any)?.telephone ?? []).forEach((t: any) => {
      const val = typeof t === 'string' ? t : (t?.phone ?? '');
      this.phones.push(new FormControl<any>(val));
    });
    this.form.markAsPristine();
  }

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
        this.form.patchValue({ picture: base64 });
        this.form.markAsDirty();
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  clearPicture() {
    this.picturePreview.set('');
    this.form.patchValue({ picture: '' });
    this.form.markAsDirty();
  }

  addPhone()             { this.phones.push(new FormControl<any>('')); this.form.markAsDirty(); }
  removePhone(i: number) { this.phones.removeAt(i); this.form.markAsDirty(); }

  saveProfile() {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.value;
    const telephone = this.phones.controls
      .map(c => c.value?.trim())
      .filter(Boolean)
      .map(phone => ({ phone, countryName: '', countryCode: '', flag: '', phoneCode: '', kind: '', isActive: true }));
    this.saving.set(true);
    this.accountService.updateMyProfile({
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

  changePassword() {
    if (this.pwdForm.invalid || this.savingPwd()) return;
    const v = this.pwdForm.value;
    if (v.newPassword !== v.confirmPassword) {
      this.showToast('Las contraseñas no coinciden.', false);
      return;
    }
    this.savingPwd.set(true);
    this.accountService.changeMyPassword(v.currentPassword!, v.newPassword!).subscribe({
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

  loadSessions(): void {
    this.loadingSessions.set(true);
    this.accountService.getMySessions().subscribe({
      next:  resp => { this.sessions.set(resp?.data ?? []); this.loadingSessions.set(false); },
      error: ()   => { this.sessions.set([]); this.loadingSessions.set(false); },
    });
  }

  revokeSession(sessionId: string): void {
    this.revokingId.set(sessionId);
    this.accountService.revokeSession(sessionId).subscribe({
      next: () => {
        this.revokingId.set(null);
        this.showToast('Sesión revocada', true);
        this.loadSessions();
      },
      error: err => {
        this.revokingId.set(null);
        this.showToast(err?.error?.message ?? 'Error al revocar sesión', false);
      },
    });
  }

  revokeAllSessions(): void {
    this.accountService.revokeAllSessions().subscribe({
      next: resp => {
        this.showToast(`${resp?.data?.count ?? 0} sesión(es) revocada(s)`, true);
        this.loadSessions();
      },
      error: err => this.showToast(err?.error?.message ?? 'Error al revocar sesiones', false),
    });
  }

  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 5000);
  }
}
