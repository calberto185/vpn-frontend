import { Component, computed, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { NgClass, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CrmService, CrmClient, PipelineBoard } from '../../services/crm/crm.service';
import { PermissionsService } from '../../services/permissions/permissions.service';
import { SocketService } from '../../../shared/services/socket.service';
import { Subscription } from 'rxjs';

const STAGE_LABELS: Record<string, string> = {
  lead:       '🔵 Lead',
  contactado: '🟡 Contactado',
  activo:     '🟢 Activo',
  riesgo:     '🔴 En riesgo',
  inactivo:   '⚫ Inactivo',
};

const STAGE_COLORS: Record<string, string> = {
  lead:       'badge-info',
  contactado: 'badge-warning',
  activo:     'badge-success',
  riesgo:     'badge-error',
  inactivo:   'badge-ghost',
};

const TAG_PRESETS = ['vip', 'rusia', 'latam', 'moroso', 'nuevo', 'empresa'];

@Component({
  selector: 'app-crm',
  imports: [NgClass, DatePipe, FormsModule],
  templateUrl: './crm.component.html',
  styleUrl: './crm.component.css',
})
export class CrmComponent implements OnInit, OnDestroy {
  // ── Permissions ────────────────────────────────────────────────────────────
  private permissions = inject(PermissionsService);
  canCreate = computed(() => this.permissions.canDo('crm', 'create'));
  canUpdate = computed(() => this.permissions.canDo('crm', 'update'));
  canDelete = computed(() => this.permissions.canDo('crm', 'delete'));

  crmService  = inject(CrmService);
  private socketSvc = inject(SocketService);
  private subs      = new Subscription();

  board        = signal<PipelineBoard | null>(null);
  allTags      = signal<{ tag: string; count: number }[]>([]);
  selectedClient = signal<CrmClient | null>(null);
  activeStageFilter = signal<string>('all');
  tagFilter    = signal<string>('');
  loading      = signal(false);
  noteText     = signal('');
  newTagInput  = signal('');
  hasError     = signal('');

  stages = Object.keys(STAGE_LABELS);
  stageLabels  = STAGE_LABELS;
  stageColors  = STAGE_COLORS;
  tagPresets   = TAG_PRESETS;

  ngOnInit(): void {
    this.loadBoard();
    this.loadTags();

    // Tiempo real: cuando un usuario cambia de estado, reflejar en el board CRM
    this.subs.add(
      this.socketSvc.onUserUpdated().subscribe(evt => {
        const newStage = this._stageFromUserState(evt.state, evt.suspend);
        if (!newStage) return;

        this.board.update(b => {
          if (!b) return b;
          const next: PipelineBoard = { ...b, board: { ...b.board } };
          // Buscar al cliente en todos los stages
          for (const stage of Object.keys(next.board)) {
            const idx = next.board[stage].findIndex(c => c.id === evt.user_id);
            if (idx === -1) continue;
            if (stage === newStage) return next; // ya está en el stage correcto
            const client = { ...next.board[stage][idx], pipeline_stage: newStage };
            next.board[stage] = next.board[stage].filter((_, i) => i !== idx);
            next.board[newStage] = [client, ...(next.board[newStage] ?? [])];
            break;
          }
          return next;
        });

        // Actualizar el detalle abierto si corresponde
        if (this.selectedClient()?.id === evt.user_id) {
          this.selectedClient.update(c => c ? { ...c, pipeline_stage: newStage } : c);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  /** Derivar stage CRM a partir del estado de usuario */
  private _stageFromUserState(state: string, suspend?: boolean): string | null {
    if (suspend) return 'riesgo';
    switch (state) {
      case 'Activo':      return 'activo';
      case 'Suspendido':  return 'riesgo';
      case 'Inactivo':    return 'inactivo';
      default:            return null;
    }
  }

  loadBoard(): void {
    this.loading.set(true);
    this.crmService.getPipelineBoard().subscribe({
      next: (resp) => {
        this.board.set(resp.data);
        this.loading.set(false);
      },
      error: () => {
        this.hasError.set('Error cargando el pipeline');
        this.loading.set(false);
      },
    });
  }

  loadTags(): void {
    this.crmService.getTagsList().subscribe({
      next: (resp) => this.allTags.set(resp.data),
    });
  }

  getClientsForStage(stage: string): CrmClient[] {
    const b = this.board();
    if (!b) return [];
    let clients = b.board[stage] || [];
    const tf = this.tagFilter();
    if (tf) clients = clients.filter(c => c.tags?.includes(tf));
    return clients;
  }

  totalClients(): number {
    return this.board()?.total ?? 0;
  }

  openClient(client: CrmClient): void {
    this.selectedClient.set({ ...client });
    this.noteText.set('');
    this.newTagInput.set('');
    const el = document.getElementById('crm_detail') as HTMLDialogElement;
    el?.showModal();
  }

  closeDetail(): void {
    const el = document.getElementById('crm_detail') as HTMLDialogElement;
    el?.close();
    this.selectedClient.set(null);
  }

  changeStage(stage: string): void {
    const c = this.selectedClient();
    if (!c) return;
    this.crmService.setPipelineStage(c.id, stage).subscribe(() => {
      this.loadBoard();
      this.selectedClient.update(cl => cl ? { ...cl, pipeline_stage: stage } : cl);
    });
  }

  addNote(): void {
    const c    = this.selectedClient();
    const text = this.noteText().trim();
    if (!c || !text) return;
    this.crmService.addNote(c.id, text).subscribe(resp => {
      if (resp?.data) {
        this.selectedClient.update(cl => cl
          ? { ...cl, notes: [...(cl.notes || []), resp.data] }
          : cl
        );
      }
      this.noteText.set('');
    });
  }

  deleteNote(noteId: string): void {
    const c = this.selectedClient();
    if (!c) return;
    this.crmService.deleteNote(c.id, noteId).subscribe(() => {
      this.selectedClient.update(cl =>
        cl ? { ...cl, notes: (cl.notes || []).filter(n => n.id !== noteId) } : cl
      );
    });
  }

  addTag(tag?: string): void {
    const c   = this.selectedClient();
    const val = (tag || this.newTagInput()).trim().toLowerCase();
    if (!c || !val) return;
    if (c.tags?.includes(val)) return;
    this.crmService.addTag(c.id, val).subscribe(() => {
      this.selectedClient.update(cl =>
        cl ? { ...cl, tags: [...(cl.tags || []), val] } : cl
      );
      this.newTagInput.set('');
      this.loadTags();
      this.loadBoard();
    });
  }

  removeTag(tag: string): void {
    const c = this.selectedClient();
    if (!c) return;
    this.crmService.removeTag(c.id, tag).subscribe(() => {
      this.selectedClient.update(cl =>
        cl ? { ...cl, tags: (cl.tags || []).filter(t => t !== tag) } : cl
      );
      this.loadTags();
      this.loadBoard();
    });
  }

  filterByTag(tag: string): void {
    this.tagFilter.set(this.tagFilter() === tag ? '' : tag);
  }

  stageColor(stage: string): string {
    return STAGE_COLORS[stage] ?? 'badge-ghost';
  }

  stageLabel(stage: string): string {
    return STAGE_LABELS[stage] ?? stage;
  }
}
