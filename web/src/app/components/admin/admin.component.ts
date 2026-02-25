import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../services/api.service';
import Swal from 'sweetalert2';
import QRCode from 'qrcode';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin.component.html',
})
export class AdminComponent implements OnInit {
  activeTab = signal<'users' | 'maps' | 'audit' | 'billing'>('users');

  // Users
  users = signal<any[]>([]);
  userForm: FormGroup;
  editingUser = signal<string | null>(null);
  showUserForm = signal(false);

  // Maps
  maps = signal<any[]>([]);

  // Audit
  auditLogs = signal<any[]>([]);

  // Billing
  billingStatus = signal<any>(null);

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
  ) {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      role: ['EDITOR'],
    });
  }

  ngOnInit() {
    this.loadUsers();
    this.loadMaps();
  }

  // === Users ===
  loadUsers() {
    this.api.get<any[]>('users').subscribe({ next: (d) => this.users.set(d) });
  }

  openUserForm(user?: any) {
    this.showUserForm.set(true);
    if (user) {
      this.editingUser.set(user.id);
      this.userForm.patchValue({ name: user.name, email: user.email, role: user.role, password: '' });
      this.userForm.get('password')?.clearValidators();
      this.userForm.get('password')?.updateValueAndValidity();
    } else {
      this.editingUser.set(null);
      this.userForm.reset({ role: 'EDITOR' });
      this.userForm.get('password')?.setValidators(Validators.required);
      this.userForm.get('password')?.updateValueAndValidity();
    }
  }

  closeUserForm() {
    this.showUserForm.set(false);
    this.editingUser.set(null);
  }

  saveUser() {
    if (this.userForm.invalid) return;
    const data = { ...this.userForm.value };
    if (!data.password) delete data.password;

    const id = this.editingUser();
    const req = id ? this.api.put(`users/${id}`, data) : this.api.post('users', data);
    req.subscribe({
      next: () => {
        this.loadUsers();
        this.closeUserForm();
        Swal.fire({ icon: 'success', title: id ? 'Actualizado' : 'Creado', timer: 1500, showConfirmButton: false, background: '#1e293b', color: '#fff' });
      },
      error: (e: any) => Swal.fire({ icon: 'error', title: 'Error', text: e.error?.message || 'Error al guardar', background: '#1e293b', color: '#fff' }),
    });
  }

  deleteUser(user: any) {
    Swal.fire({
      title: '¿Eliminar usuario?',
      text: `Se desactivará a ${user.name}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      background: '#1e293b',
      color: '#fff',
    }).then((r) => {
      if (r.isConfirmed) {
        this.api.delete(`users/${user.id}`).subscribe({
          next: () => this.loadUsers(),
        });
      }
    });
  }

  // === Maps ===
  loadMaps() {
    this.api.get<any[]>('maps').subscribe({ next: (d) => this.maps.set(d) });
  }

  toggleMapPublic(map: any) {
    this.api.put(`maps/${map.id}`, { isPublic: !map.isPublic }).subscribe({
      next: () => this.loadMaps(),
    });
  }

  toggleLayerPublic(layer: any) {
    this.api.put(`layers/${layer.id}`, { isPublic: !layer.isPublic }).subscribe({
      next: () => this.loadMaps(),
    });
  }

  // === Audit ===
  loadAudit() {
    this.api.get<any>('audit').subscribe({ next: (d) => this.auditLogs.set(d.data || []) });
  }

  async showQR(map: any) {
    const url = `${window.location.origin}/mapa/${map.slug}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });
    Swal.fire({
      title: map.name,
      html: `<img src="${dataUrl}" style="margin:0 auto"><p style="margin-top:12px;font-size:13px;color:#94a3b8;word-break:break-all">${url}</p>`,
      background: '#1e293b',
      color: '#fff',
      showConfirmButton: false,
      showCloseButton: true,
    });
  }

  loadBilling() {
    this.api.get<any>('billing/status').subscribe({ next: (d) => this.billingStatus.set(d) });
  }

  upgrade(plan: 'BASIC' | 'PRO') {
    this.api.post<any>('billing/checkout', { plan }).subscribe({
      next: (res) => { window.location.href = res.url; },
      error: (e: any) => Swal.fire({ icon: 'error', title: 'Error', text: e.error?.message, background: '#1e293b', color: '#fff' }),
    });
  }

  openPortal() {
    this.api.post<any>('billing/portal', {}).subscribe({
      next: (res) => { window.location.href = res.url; },
      error: (e: any) => Swal.fire({ icon: 'error', title: 'Error', text: e.error?.message, background: '#1e293b', color: '#fff' }),
    });
  }

  usagePercent(used: number, max: number): number {
    if (max === -1) return 0;
    return Math.round((used / max) * 100);
  }

  switchTab(tab: 'users' | 'maps' | 'audit' | 'billing') {
    this.activeTab.set(tab);
    if (tab === 'audit') this.loadAudit();
    if (tab === 'billing') this.loadBilling();
  }

}
