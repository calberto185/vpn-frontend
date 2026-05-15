import { Component, computed, inject } from '@angular/core';
import { AppToast, LoadingService } from '../../services/loading.service';

@Component({
  selector: 'app-toast',
  imports: [],
  templateUrl: './toast.component.html',
})
export class ToastComponent {
  private ui = inject(LoadingService);

  readonly toasts = computed(() => this.ui.toasts());

  dismiss(id: string): void {
    this.ui.dismissToast(id);
  }

  cfg(type: AppToast['type']): { icon: string; bar: string; bg: string; border: string; text: string } {
    const map = {
      success: {
        icon:   'text-emerald-500',
        bar:    'bg-emerald-500',
        bg:     'bg-white',
        border: 'border-emerald-200',
        text:   'text-gray-800',
      },
      warning: {
        icon:   'text-amber-500',
        bar:    'bg-amber-400',
        bg:     'bg-white',
        border: 'border-amber-200',
        text:   'text-gray-800',
      },
      error: {
        icon:   'text-red-500',
        bar:    'bg-red-500',
        bg:     'bg-white',
        border: 'border-red-200',
        text:   'text-gray-800',
      },
      info: {
        icon:   'text-sky-500',
        bar:    'bg-sky-500',
        bg:     'bg-white',
        border: 'border-sky-200',
        text:   'text-gray-800',
      },
    };
    return map[type] ?? map['info'];
  }
}
