import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { forkJoin } from 'rxjs';
import {
  AdminTutorialService,
  ContentBlock,
  ContentBlockType,
  TutorialNode,
} from '../../services/tutorial/tutorial.service';

type ModalMode = 'create' | 'edit';

@Component({
  selector: 'app-admin-tutorial',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tutorial.component.html',
  styleUrl: './tutorial.component.css',
})
export class AdminTutorialComponent implements OnInit {
  private svc       = inject(AdminTutorialService);
  private sanitizer = inject(DomSanitizer);

  // ── State ──────────────────────────────────────────────────────────────────
  nodes      = signal<TutorialNode[]>([]);
  loading    = signal(false);
  saving     = signal(false);
  toast      = signal<{ msg: string; ok: boolean } | null>(null);

  // Selected node for viewing/editing its content
  selectedId = signal<string | null>(null);
  selected   = computed(() => this.nodes().find(n => n.id === this.selectedId()) ?? null);

  // Tree: root nodes and children lookup
  roots    = computed(() => this.nodes().filter(n => !n.parentId).sort((a, b) => a.order - b.order));
  childrenOf = (id: string) => this.nodes().filter(n => n.parentId === id).sort((a, b) => a.order - b.order);

  // Modal
  showModal  = signal(false);
  modalMode  = signal<ModalMode>('create');
  form = signal<Partial<TutorialNode>>({});

  // Content block editor
  editingContent = signal<ContentBlock[]>([]);

  // Delete confirm
  deleteTarget = signal<TutorialNode | null>(null);

  // Expanded tree nodes
  expanded = signal<Set<string>>(new Set());

  readonly blockTypes: ContentBlockType[] = ['text', 'image', 'video', 'link', 'button', 'tabs', 'steps'];
  readonly blockLabels: Record<ContentBlockType, string> = {
    text:   'Texto / HTML',
    image:  'Imagen',
    video:  'Video (URL)',
    link:   'Enlace',
    button: 'Botón',
    tabs:   'Pestañas',
    steps:  'Pasos',
  };

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: r => { this.nodes.set(r.data ?? []); this.loading.set(false); },
      error: () => { this.loading.set(false); this.showToast('Error al cargar nodos', false); },
    });
  }

  // ── Tree navigation ────────────────────────────────────────────────────────
  toggleExpand(id: string): void {
    this.expanded.update(set => {
      const copy = new Set(set);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  }

  isExpanded(id: string): boolean { return this.expanded().has(id); }

  selectNode(id: string): void {
    this.selectedId.set(id);
    const node = this.nodes().find(n => n.id === id);
    this.editingContent.set(node ? structuredClone(node.content) : []);
  }

  // ── Modal helpers ──────────────────────────────────────────────────────────
  openCreate(parentId: string | null = null): void {
    this.form.set({ parentId, title: '', icon: 'fa-regular fa-file', iconType: 'fa', description: '', isVisible: true, content: [] });
    this.modalMode.set('create');
    this.showModal.set(true);
  }

  openEdit(node: TutorialNode): void {
    this.form.set({ ...node });
    this.modalMode.set('edit');
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); }

  saveModal(): void {
    const f = this.form();
    if (!f.title?.trim()) { this.showToast('El título es requerido', false); return; }
    this.saving.set(true);

    if (this.modalMode() === 'create') {
      this.svc.create(f).subscribe({
        next: r => {
          this.nodes.update(list => [...list, r.data!]);
          this.saving.set(false);
          this.closeModal();
          this.showToast('Nodo creado', true);
        },
        error: (e) => { this.saving.set(false); this.showToast(e?.error?.message ?? 'Error', false); },
      });
    } else {
      this.svc.update(f as TutorialNode).subscribe({
        next: r => {
          this.nodes.update(list => list.map(n => n.id === r.data!.id ? r.data! : n));
          this.saving.set(false);
          this.closeModal();
          this.showToast('Nodo actualizado', true);
          // Refresh selected content too
          if (this.selectedId() === r.data!.id) {
            this.editingContent.set(structuredClone(r.data!.content));
          }
        },
        error: (e) => { this.saving.set(false); this.showToast(e?.error?.message ?? 'Error', false); },
      });
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  confirmDelete(node: TutorialNode): void { this.deleteTarget.set(node); }

  executeDelete(): void {
    const t = this.deleteTarget();
    if (!t) return;
    this.saving.set(true);
    this.svc.delete(t.id).subscribe({
      next: () => {
        // Remove this node and all descendants from local list
        const toRemove = this.getAllDescendantIds(t.id);
        toRemove.add(t.id);
        this.nodes.update(list => list.filter(n => !toRemove.has(n.id)));
        if (toRemove.has(this.selectedId() ?? '')) this.selectedId.set(null);
        this.deleteTarget.set(null);
        this.saving.set(false);
        this.showToast('Nodo eliminado', true);
      },
      error: (e) => { this.saving.set(false); this.showToast(e?.error?.message ?? 'Error', false); },
    });
  }

  private getAllDescendantIds(parentId: string): Set<string> {
    const result = new Set<string>();
    const children = this.nodes().filter(n => n.parentId === parentId);
    for (const c of children) {
      result.add(c.id);
      for (const id of this.getAllDescendantIds(c.id)) result.add(id);
    }
    return result;
  }

  // ── Content block editor ───────────────────────────────────────────────────
  addBlock(type: ContentBlockType): void {
    const defaults: Record<ContentBlockType, Record<string, any>> = {
      text:   { html: '' },
      image:  { src: '', alt: '', caption: '' },
      video:  { url: '', title: '' },
      link:   { href: '', label: '', target: '_blank' },
      button: { label: '', href: '', style: 'primary' },
      tabs:   { items: [{ label: 'Pestaña 1', html: '' }] },
      steps:  { items: [{ label: 'Paso 1', html: '' }] },
    };
    this.editingContent.update(list => [...list, { type, data: { ...defaults[type] } }]);
  }

  removeBlock(index: number): void {
    this.editingContent.update(list => list.filter((_, i) => i !== index));
  }

  moveBlock(index: number, dir: -1 | 1): void {
    this.editingContent.update(list => {
      const copy = [...list];
      const target = index + dir;
      if (target < 0 || target >= copy.length) return copy;
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  saveContent(): void {
    const node = this.selected();
    if (!node) return;
    this.saving.set(true);
    this.svc.update({ ...node, content: this.editingContent() }).subscribe({
      next: r => {
        this.nodes.update(list => list.map(n => n.id === r.data!.id ? r.data! : n));
        this.saving.set(false);
        this.showToast('Contenido guardado', true);
      },
      error: (e) => { this.saving.set(false); this.showToast(e?.error?.message ?? 'Error', false); },
    });
  }

  // Tabs/Steps sub-item helpers
  addSubItem(block: ContentBlock): void {
    const label = block.type === 'tabs' ? `Pestaña ${block.data['items'].length + 1}` : `Paso ${block.data['items'].length + 1}`;
    block.data['items'] = [...block.data['items'], { label, html: '' }];
    this.editingContent.update(list => [...list]); // trigger change
  }

  removeSubItem(block: ContentBlock, i: number): void {
    block.data['items'] = block.data['items'].filter((_: any, idx: number) => idx !== i);
    this.editingContent.update(list => [...list]);
  }

  trackByIndex(_: number, __: any): number { return _; }

  safeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html ?? '');
  }

  // ── Node ordering ──────────────────────────────────────────────────────────
  isFirst(node: TutorialNode): boolean {
    const siblings = this.nodes()
      .filter(n => n.parentId === node.parentId)
      .sort((a, b) => a.order - b.order);
    return siblings[0]?.id === node.id;
  }

  isLast(node: TutorialNode): boolean {
    const siblings = this.nodes()
      .filter(n => n.parentId === node.parentId)
      .sort((a, b) => a.order - b.order);
    return siblings[siblings.length - 1]?.id === node.id;
  }

  moveNode(node: TutorialNode, dir: -1 | 1): void {
    const siblings = this.nodes()
      .filter(n => n.parentId === node.parentId)
      .sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex(n => n.id === node.id);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= siblings.length) return;

    const other = siblings[targetIdx];
    // Swap order values
    const nodeUpdated  = { ...node,  order: other.order };
    const otherUpdated = { ...other, order: node.order  };

    this.saving.set(true);
    forkJoin([
      this.svc.update(nodeUpdated),
      this.svc.update(otherUpdated),
    ]).subscribe({
      next: ([r1, r2]) => {
        this.nodes.update(list => list.map(n => {
          if (n.id === r1.data!.id) return r1.data!;
          if (n.id === r2.data!.id) return r2.data!;
          return n;
        }));
        this.saving.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.showToast('Error al reordenar', false);
      },
    });
  }

  // ── Visibility toggle ──────────────────────────────────────────────────────
  toggleVisibility(node: TutorialNode): void {
    this.svc.update({ ...node, isVisible: !node.isVisible }).subscribe({
      next: r => this.nodes.update(list => list.map(n => n.id === r.data!.id ? r.data! : n)),
      error: () => this.showToast('Error al actualizar visibilidad', false),
    });
  }

  // ── Toast ──────────────────────────────────────────────────────────────────
  private showToast(msg: string, ok: boolean): void {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 3500);
  }

  // ── HTML toolbar helpers ───────────────────────────────────────────────────
  insertBlockHtml(el: HTMLTextAreaElement, block: ContentBlock, before: string, after: string): void {
    const start    = el.selectionStart;
    const end      = el.selectionEnd;
    const newValue = el.value.slice(0, start) + before + el.value.slice(start, end) + after + el.value.slice(end);
    el.value       = newValue;
    block.data['html'] = newValue;
    this.editingContent.update(list => [...list]);
    el.focus();
    el.setSelectionRange(start + before.length, end + before.length + (end - start));
  }

  insertSubItemHtml(el: HTMLTextAreaElement, item: Record<string, any>, before: string, after: string): void {
    const start    = el.selectionStart;
    const end      = el.selectionEnd;
    const newValue = el.value.slice(0, start) + before + el.value.slice(start, end) + after + el.value.slice(end);
    el.value       = newValue;
    item['html']   = newValue;
    this.editingContent.update(list => [...list]);
    el.focus();
    el.setSelectionRange(start + before.length, end + before.length + (end - start));
  }

  insertDescHtml(el: HTMLTextAreaElement, before: string, after: string): void {
    const start    = el.selectionStart;
    const end      = el.selectionEnd;
    const newValue = el.value.slice(0, start) + before + el.value.slice(start, end) + after + el.value.slice(end);
    el.value       = newValue;
    this.setFormField('description', newValue);
    el.focus();
    el.setSelectionRange(start + before.length, end + before.length + (end - start));
  }

  // ── Form field updater ─────────────────────────────────────────────────────
  setFormField(field: keyof TutorialNode, value: any): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  // ── Depth helper for indentation ───────────────────────────────────────────
  getDepth(nodeId: string): number {
    let depth = 0;
    let current = this.nodes().find(n => n.id === nodeId);
    while (current?.parentId) {
      depth++;
      current = this.nodes().find(n => n.id === current!.parentId!);
    }
    return depth;
  }
}
