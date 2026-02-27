import { Component, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  @Output() back = new EventEmitter<void>();

  orgName = '';
  email = '';
  name = '';
  password = '';
  confirmPassword = '';
  loading = signal(false);
  error = signal('');
  success = signal(false);

  constructor(private http: HttpClient) {}

  register() {
    this.error.set('');

    if (!this.orgName || !this.email || !this.name || !this.password) {
      this.error.set('Todos los campos son obligatorios');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error.set('Las contraseñas no coinciden');
      return;
    }

    if (this.password.length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    this.loading.set(true);
    this.http.post('/api/auth/register', {
      orgName: this.orgName,
      email: this.email,
      name: this.name,
      password: this.password,
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Error al registrarse');
      },
    });
  }
}