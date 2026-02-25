import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-superadmin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './superadmin.component.html',
})

export class SuperadminComponent implements OnInit {
  activeTab = signal<'tenants' | 'users' | 'audit'>('tenants');

  // Tenants
  tenants = signal<any[]>([]);
  tenantForm: FormGroup;
  showTenantForm = signal(false);
  editingTenant = signal<string | null>(null);

  // Users
  users = signal<any[]>([]);
  userForm: FormGroup;
  showUserForm = signal(false);
  editingUser = signal<string | null>(null);

  // Audit
  auditLogs = signal<any[]>([]);

  constructor(private fb: FormBuilder, private api: ApiService) {
    this.tenantForm = this.fb.group({
      name: ['', Validators.required],
      slug: ['', Validators.required],
    });

    this.userForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      role: ['ADMIN'],
      tenantId: ['', Validators.required],
    });
  }

  ngOnInit() {
    this.loadTenants();
    this.loadUsers();
  }

  // === Tenants ===
  loadTenants() {
    this.api.get<any[]>('tenants').subscribe({ next: (d) => this.tenants.set(d) });
  }

  openTenantForm(tenant?: any) {
    this.showTenantForm.set(true);
    if (tenant) {
      this.editingTenant.set(tenant.id);
      this.tenantForm.patchValue({ name: tenant.name, slug: tenant.slug });
      this.tenantForm.get('slug')?.disable();
    } else {
      this.editingTenant.set(null);
      this.tenantForm.reset();
      this.tenantForm.get('slug')?.enable();
    }
  }

  saveTenant() {
    if (this.tenantForm.invalid) return;
    const id = this.editingTenant();
    const data = this.tenantForm.getRawValue();
    const req = id ? this.api.put(`tenants/${id}`, { name: data.name }) : this.api.post('tenants', data);
    req.subscribe({
      next: () => { this.loadTenants(); this.showTenantForm.set(false); },
      error: (e: any) => Swal.fire({ icon: 'error', title: 'Error', text: e.error?.message, background: '#1e293b', color: '#fff' }),
    });
  }

  toggleTenantActive(tenant: any) {
    this.api.put(`tenants/${tenant.id}`, { active: !tenant.active }).subscribe({
      next: () => this.loadTenants(),
    });
  }

  // === Users ===
  loadUsers() {
    this.api.get<any[]>('users').subscribe({ next: (d) => this.users.set(d) });
  }

  openUserForm(user?: any) {
    this.showUserForm.set(true);
    if (user) {
      this.editingUser.set(user.id);
      this.userForm.patchValue({ name: user.name, email: user.email, role: user.role, tenantId: user.tenantId || '', password: '' });
      this.userForm.get('password')?.clearValidators();
      this.userForm.get('password')?.updateValueAndValidity();
    } else {
      this.editingUser.set(null);
      this.userForm.reset({ role: 'ADMIN' });
      this.userForm.get('password')?.setValidators(Validators.required);
      this.userForm.get('password')?.updateValueAndValidity();
    }
  }

  saveUser() {
    if (this.userForm.invalid) return;
    const data = { ...this.userForm.value };
    if (!data.password) delete data.password;

    const id = this.editingUser();
    const req = id ? this.api.put(`users/${id}`, data) : this.api.post('users', data);
    req.subscribe({
      next: () => { this.loadUsers(); this.showUserForm.set(false); },
      error: (e: any) => Swal.fire({ icon: 'error', title: 'Error', text: e.error?.message, background: '#1e293b', color: '#fff' }),
    });
  }

  // === Audit ===
  loadAudit() {
    this.api.get<any>('audit').subscribe({ next: (d) => this.auditLogs.set(d.data || []) });
  }

  switchTab(tab: 'tenants' | 'users' | 'audit') {
    this.activeTab.set(tab);
    if (tab === 'audit') this.loadAudit();
  }

  getTenantName(tenantId: string | null): string {
    if (!tenantId) return 'Sin tenant';
    const t = this.tenants().find((t: any) => t.id === tenantId);
    return t?.name || 'Desconocido';
  }

  toggleUserActive(user: any) {
    const action = user.active ? 'Desactivar' : 'Activar';
    Swal.fire({
      title: `¿${action} usuario?`, text: user.name, icon: 'warning',
      showCancelButton: true, confirmButtonColor: user.active ? '#ef4444' : '#22c55e',
      confirmButtonText: action, cancelButtonText: 'Cancelar',
      background: '#1e293b', color: '#fff',
    }).then((r) => {
      if (r.isConfirmed) {
        this.api.put(`users/${user.id}`, { active: !user.active }).subscribe({ next: () => this.loadUsers() });
      }
    });
  }

}