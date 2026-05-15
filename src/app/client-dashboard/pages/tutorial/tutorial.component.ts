import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { ClientTutorialService, TutorialNode } from '../../services/tutorial/tutorial.service';

@Component({
  selector: 'app-tutorial',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tutorial.component.html',
  styleUrl: './tutorial.component.css',
})
export class TutorialComponent implements OnInit {
  private svc       = inject(ClientTutorialService);
  private sanitizer = inject(DomSanitizer);

  loading = signal(true);
  nodes   = signal<TutorialNode[]>([]);
  error   = signal(false);

  /** Root-level nodes */
  roots = computed(() => this.nodes().filter(n => !n.parentId).sort((a, b) => a.order - b.order));

  /** Currently selected node path: [rootId, childId?, grandchildId?, ...] */
  breadcrumb = signal<string[]>([]);

  /** The deepest selected node */
  selectedNode = computed<TutorialNode | null>(() => {
    const crumb = this.breadcrumb();
    if (!crumb.length) return null;
    return this.nodes().find(n => n.id === crumb[crumb.length - 1]) ?? null;
  });

  /** Children of the last breadcrumb node */
  currentChildren = computed(() => {
    const crumb = this.breadcrumb();
    const parentId = crumb.length ? crumb[crumb.length - 1] : null;
    return this.nodes()
      .filter(n => n.parentId === parentId)
      .sort((a, b) => a.order - b.order);
  });

  /** Active tab index per block (blockIndex → tabIndex) */
  activeTabs = signal<Record<string, number>>({});

  ngOnInit(): void {
    this.svc.getPublic().subscribe({
      next: r => {
        this.nodes.set(r.data ?? []);
        this.loading.set(false);
        // Auto-select first root
        const first = this.nodes().filter(n => !n.parentId).sort((a, b) => a.order - b.order)[0];
        if (first) this.selectNode(first.id);
      },
      error: () => { this.loading.set(false); this.error.set(true); },
    });
  }

  selectNode(id: string): void {
    const node = this.nodes().find(n => n.id === id);
    if (!node) return;

    // Build path from root
    const path: string[] = [];
    let current: TutorialNode | undefined = node;
    while (current) {
      path.unshift(current.id);
      current = current.parentId ? this.nodes().find(n => n.id === current!.parentId!) : undefined;
    }
    this.breadcrumb.set(path);
    this.activeTabs.set({});
  }

  /** Children of a specific node */
  childrenOf(id: string): TutorialNode[] {
    return this.nodes().filter(n => n.parentId === id).sort((a, b) => a.order - b.order);
  }

  /** Check if a node is in the current selection path */
  isInPath(id: string): boolean {
    return this.breadcrumb().includes(id);
  }

  isSelected(id: string): boolean {
    const crumb = this.breadcrumb();
    return crumb[crumb.length - 1] === id;
  }

  setTab(blockKey: string, idx: number): void {
    this.activeTabs.update(t => ({ ...t, [blockKey]: idx }));
  }

  getTab(blockKey: string): number {
    return this.activeTabs()[blockKey] ?? 0;
  }

  getNodeTitle(id: string): string {
    return this.nodes().find(n => n.id === id)?.title ?? '';
  }

  safeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html ?? '');
  }

  safeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.embedUrl(url));
  }

  /** Normalize YouTube URLs to embed format */
  embedUrl(url: string): string {
    if (!url) return '';
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
    return url;
  }
}
