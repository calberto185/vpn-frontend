import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AdminSettingsService, NotificationsConfig } from '../../../services/settings/settings.service';

type Channel = 'telegram' | 'email' | 'whatsapp';
type TestState = 'idle' | 'testing' | 'ok' | 'error';

@Component({
  selector: 'app-notifications-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
})
export class NotificationsSettingsComponent implements OnInit {

  private svc = inject(AdminSettingsService);
  private fb  = inject(FormBuilder);

  loading = signal(true);
  saving  = signal(false);
  toast   = signal<{ msg: string; ok: boolean } | null>(null);

  testStates = signal<Record<Channel, TestState>>({
    telegram: 'idle',
    email:    'idle',
    whatsapp: 'idle',
  });

  waTestPhone = signal('');

  // Sections collapsed state
  openSection = signal<Channel | null>('telegram');

  // ── Forms ──────────────────────────────────────────────────────────────────
  tgForm = this.fb.group({
    token:         [''],
    admin_chat_id: [''],
  });

  waForm = this.fb.group({
    account_sid: [''],
    auth_token:  [''],
    from:        ['whatsapp:+14155238886'],
  });

  emailForm = this.fb.group({
    host:        ['smtp.gmail.com', Validators.required],
    port:        [465, [Validators.required, Validators.min(1), Validators.max(65535)]],
    secure:      [true],
    user:        ['', [Validators.required, Validators.email]],
    pass:        [''],
    from_name:   [''],
    admin_email: ['', Validators.email],
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit() {
    this.svc.getNotificationsConfig().subscribe({
      next: (r) => {
        const d = r.data;
        if (d) {
          this.tgForm.patchValue({
            token:         d.telegram.hasToken      ? '***' : '',
            admin_chat_id: d.telegram.admin_chat_id,
          });
          this.waForm.patchValue({
            account_sid: d.whatsapp.account_sid,
            auth_token:  d.whatsapp.hasAuthToken ? '***' : '',
            from:        d.whatsapp.from || 'whatsapp:+14155238886',
          });
          this.emailForm.patchValue({
            host:        d.email.host,
            port:        d.email.port,
            secure:      d.email.secure,
            user:        d.email.user,
            pass:        d.email.hasPass ? '***' : '',
            from_name:   d.email.from_name,
            admin_email: d.email.admin_email,
          });
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  onSave() {
    if (this.saving()) return;
    this.saving.set(true);

    const payload: Partial<NotificationsConfig> = {
      telegram: {
        token:         this.tgForm.value.token        || '',
        admin_chat_id: this.tgForm.value.admin_chat_id || '',
        hasToken:      false,
      },
      whatsapp: {
        provider:     'twilio',
        account_sid:  this.waForm.value.account_sid  || '',
        auth_token:   this.waForm.value.auth_token   || '',
        hasAuthToken: false,
        from:         this.waForm.value.from         || 'whatsapp:+14155238886',
      },
      email: {
        host:        this.emailForm.value.host        || 'smtp.gmail.com',
        port:        Number(this.emailForm.value.port) || 465,
        secure:      this.emailForm.value.secure      !== false,
        user:        this.emailForm.value.user        || '',
        pass:        this.emailForm.value.pass        || '',
        from_name:   this.emailForm.value.from_name   || '',
        admin_email: this.emailForm.value.admin_email || '',
        hasPass:     false,
      },
    };

    this.svc.saveNotificationsConfig(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.showToast('Configuración guardada', true);
      },
      error: (err: any) => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al guardar', false);
      },
    });
  }

  // ── Tests ──────────────────────────────────────────────────────────────────
  testTelegram() {
    this._setTest('telegram', 'testing');
    this.svc.testTelegram().subscribe({
      next:  () => this._setTest('telegram', 'ok'),
      error: () => this._setTest('telegram', 'error'),
    });
  }

  testEmail() {
    this._setTest('email', 'testing');
    this.svc.testEmail().subscribe({
      next:  () => this._setTest('email', 'ok'),
      error: () => this._setTest('email', 'error'),
    });
  }

  testWhatsApp() {
    const to = this.waTestPhone().trim();
    if (!to) { this.showToast('Ingresa un número para la prueba', false); return; }
    this._setTest('whatsapp', 'testing');
    this.svc.testWhatsApp(to).subscribe({
      next:  () => this._setTest('whatsapp', 'ok'),
      error: () => this._setTest('whatsapp', 'error'),
    });
  }

  private _setTest(ch: Channel, state: TestState) {
    this.testStates.update(s => ({ ...s, [ch]: state }));
    if (state === 'ok' || state === 'error') {
      setTimeout(() => this.testStates.update(s => ({ ...s, [ch]: 'idle' })), 4000);
    }
  }

  toggleSection(ch: Channel) {
    this.openSection.set(this.openSection() === ch ? null : ch);
  }

  testLabel(ch: Channel): string {
    switch (this.testStates()[ch]) {
      case 'testing': return 'Probando…';
      case 'ok':      return '✓ Enviado';
      case 'error':   return '✗ Error';
      default:        return 'Enviar prueba';
    }
  }

  testClass(ch: Channel): string {
    switch (this.testStates()[ch]) {
      case 'testing': return 'btn-ghost loading';
      case 'ok':      return 'btn-success';
      case 'error':   return 'btn-error';
      default:        return 'btn-outline';
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
