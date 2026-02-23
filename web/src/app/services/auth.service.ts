import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'EDITOR';
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _token = signal<string | null>(localStorage.getItem('token'));
  private _user = signal<AuthUser | null>(this.loadUser());

  token = this._token.asReadonly();
  user = this._user.asReadonly();
  isAuthenticated = computed(() => !!this._token());
  role = computed(() => this._user()?.role ?? null);

  constructor(private http: HttpClient) {}

  private loadUser(): AuthUser | null {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>('/api/auth/login', { email, password });
  }

  setSession(res: LoginResponse) {
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
    this._token.set(res.token);
    this._user.set(res.user);
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this._token.set(null);
    this._user.set(null);
  }

  getAuthHeaders() {
    return { Authorization: `Bearer ${this._token()}` };
  }
}
