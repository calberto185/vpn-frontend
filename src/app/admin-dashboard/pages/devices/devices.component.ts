import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DeviceService } from '../../services/devices/devices.service';
import { UsersService } from '../../services/users/users.service';
import DeviceEntity from '../../interfaces/device.interface';
import UserEntity from '../../interfaces/user.interface';
import PlanClientDto from '../../interfaces/planClient.interface';
import { PermissionsService } from '../../services/permissions/permissions.service';

@Component({
  selector: 'app-devices',
  imports: [DatePipe, UpperCasePipe, ReactiveFormsModule],
  templateUrl: './devices.component.html',
  styleUrl: './devices.component.css'
})
export class DevicesComponent implements OnInit {

  // ── Permissions ────────────────────────────────────────────────────────────
  private permissions = inject(PermissionsService);
  canCreate = computed(() => this.permissions.canDo('devices', 'create'));
  canUpdate = computed(() => this.permissions.canDo('devices', 'update'));
  canDelete = computed(() => this.permissions.canDo('devices', 'delete'));

  private devicesService = inject(DeviceService);
  private usersService   = inject(UsersService);
  private fb             = inject(FormBuilder);

  // ── Lists ─────────────────────────────────────────────────────────────────
  ListDevices = signal<DeviceEntity[]>([]);
  ListUsers   = signal<UserEntity[]>([]);

  // ── Filters ───────────────────────────────────────────────────────────────
  searchQuery  = signal('');
  filterEstado = signal('');   // '' | 'activo' | 'suspendido' | 'revocado'

  filteredDevices = computed(() => {
    const q      = this.searchQuery().toLowerCase().trim();
    const estado = this.filterEstado();
    return this.ListDevices().filter(d => {
      const userName = this.userNameById(d.user_id).toLowerCase();
      const matchQ = !q || (
        d.device.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        d.user_id.toLowerCase().includes(q) ||
        userName.includes(q) ||
        (d.sui_email ?? '').toLowerCase().includes(q)
      );
      const matchEstado =
        !estado ||
        (estado === 'activo'     && d.active && !d.revoked && !d.suspend) ||
        (estado === 'suspendido' && d.suspend) ||
        (estado === 'revocado'   && d.revoked) ||
        (estado === 'inactivo'   && !d.active);
      return matchQ && matchEstado;
    });
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  devicesTotal     = computed(() => this.ListDevices().length);
  devicesActivos   = computed(() => this.ListDevices().filter(d => d.active && !d.revoked && !d.suspend).length);
  devicesRevocados = computed(() => this.ListDevices().filter(d => d.revoked).length);

  // ── User map for display ──────────────────────────────────────────────────
  private usersMap = computed(() => new Map(this.ListUsers().map(u => [u.id, u])));

  userNameById(id: string): string {
    const u = this.usersMap().get(id);
    return u ? `${u.firstNames} ${u.lastNames}` : id;
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  selectedDevice  = signal<DeviceEntity | null>(null);
  clientSelected  = signal<UserEntity>(new UserEntity());
  planSelected    = signal<PlanClientDto>(new PlanClientDto());

  toast = signal<{ msg: string; ok: boolean } | null>(null);
  hasError = signal('');

  // ── Add form ──────────────────────────────────────────────────────────────
  deviceForm = this.fb.group({
    user_id:    ['', Validators.required],
    plan_id:    ['', Validators.required],
    server_id:  ['', Validators.required],
    protocol:   ['s-ui', Validators.required],
    device:     ['', Validators.required],
    typeDevice: ['', Validators.required],
    active:     [true],
  });

  // ── Edit form ─────────────────────────────────────────────────────────────
  editForm = this.fb.group({
    device:     ['', Validators.required],
    typeDevice: ['', Validators.required],
    active:     [false],
    suspend:    [false],
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.fillListDevices();
    if (this.permissions.canDo('users', 'view')) this.fillListUsers();
  }

  fillListDevices() {
    this.devicesService.getDevices().subscribe(resp => this.ListDevices.set(resp.data ?? []));
  }

  fillListUsers() {
    this.usersService.getUsers().subscribe(resp => this.ListUsers.set(resp.data ?? []));
  }

  // ── Add device ────────────────────────────────────────────────────────────
  onSelectedUser(event: Event) {
    const id = (event.target as HTMLSelectElement).value;
    const user = this.ListUsers().find(u => u.id === id);
    if (user) {
      this.clientSelected.set(user);
      this.deviceForm.patchValue({ plan_id: '', server_id: '' });
      this.planSelected.set(new PlanClientDto());
    }
  }

  onSelectedPlan(event: Event) {
    const plan_id = (event.target as HTMLSelectElement).value;
    const plan = this.clientSelected().services.find(p => p.plan_id === plan_id);
    if (plan) {
      this.planSelected.set(plan);
      this.deviceForm.patchValue({ server_id: '' });
    }
  }

  onSubmit() {
    if (this.deviceForm.invalid) {
      this.hasError.set('Formulario inválido');
      setTimeout(() => this.hasError.set(''), 3000);
      return;
    }
    const { user_id, plan_id, server_id, protocol, device, typeDevice, active } = this.deviceForm.value;
    const payload = {
      user_id,
      plan_id,
      service_id: this.planSelected().service_id,
      server_id,
      protocol,
      device,
      typeDevice,
      active: active ?? false,
    };

    this.devicesService.register(payload).subscribe({
      next: () => {
        this.showToast('Dispositivo registrado', true);
        this.fillListDevices();
        this.closeModal('add_device');
        this.deviceForm.reset({ protocol: 's-ui', active: true });
        this.clientSelected.set(new UserEntity());
        this.planSelected.set(new PlanClientDto());
      },
      error: err => this.showToast(err?.error?.message ?? 'Error al registrar', false),
    });
  }

  onCancelAdd() {
    this.closeModal('add_device');
    this.deviceForm.reset({ protocol: 's-ui', active: true });
    this.clientSelected.set(new UserEntity());
    this.planSelected.set(new PlanClientDto());
  }

  // ── Edit device ───────────────────────────────────────────────────────────
  openEdit(d: DeviceEntity) {
    this.selectedDevice.set(d);
    this.editForm.patchValue({
      device:     d.device,
      typeDevice: d.typeDevice,
      active:     d.active,
      suspend:    d.suspend,
    });
    this.openModal('edit_device');
  }

  onEditSubmit() {
    const dev = this.selectedDevice();
    if (!dev?.id || this.editForm.invalid) return;
    const { device, typeDevice, active, suspend } = this.editForm.value;
    this.devicesService.update({
      id: dev.id,
      device:     device    ?? dev.device,
      typeDevice: typeDevice ?? dev.typeDevice,
      active:     active    ?? dev.active,
      suspend:    suspend   ?? dev.suspend,
    }).subscribe({
      next: () => {
        this.showToast('Dispositivo actualizado', true);
        this.fillListDevices();
        this.closeModal('edit_device');
      },
      error: err => this.showToast(err?.error?.message ?? 'Error al editar', false),
    });
  }

  // ── Revoke / Delete ───────────────────────────────────────────────────────
  openRevoke(d: DeviceEntity) {
    this.selectedDevice.set(d);
    this.openModal('revoke_device');
  }

  doRevoke() {
    const dev = this.selectedDevice();
    if (!dev?.id) return;
    this.devicesService.update({ id: dev.id, revoked: true, revokedAt: new Date() }).subscribe({
      next: () => {
        this.showToast('Dispositivo revocado', true);
        this.fillListDevices();
        this.closeModal('revoke_device');
      },
      error: err => this.showToast(err?.error?.message ?? 'Error al revocar', false),
    });
  }

  openDelete(d: DeviceEntity) {
    this.selectedDevice.set(d);
    this.openModal('delete_device');
  }

  openView(d: DeviceEntity) {
    this.selectedDevice.set(d);
    this.openModal('view_device');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }

  openModal(id: string) {
    (document.getElementById(id) as HTMLDialogElement | null)?.showModal();
  }

  closeModal(id: string) {
    (document.getElementById(id) as HTMLDialogElement | null)?.close();
  }

  stateLabel(d: DeviceEntity): string {
    if (d.revoked)  return 'Revocado';
    if (d.suspend)  return 'Suspendido';
    if (d.active)   return 'Activo';
    return 'Inactivo';
  }

  stateClass(d: DeviceEntity): string {
    if (d.revoked)  return 'badge-error';
    if (d.suspend)  return 'badge-warning';
    if (d.active)   return 'badge-success';
    return 'badge-ghost';
  }
}
