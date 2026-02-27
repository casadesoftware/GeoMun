import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { LoginComponent } from './components/login/login.component';
import { AdminComponent } from './components/admin/admin.component';
import { EditorComponent } from './components/editor/editor.component';
import { PublicMapComponent } from './components/public-map/public-map.component';
import { SuperadminComponent } from './components/superadmin/superadmin.component';
import { RegisterComponent } from './components/register/register.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, LoginComponent, AdminComponent, EditorComponent, PublicMapComponent, SuperadminComponent, RegisterComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  isPublicRoute = signal(false);
  publicSlug = signal<string | null>(null);
  showRegister = signal(false);

  constructor(public auth: AuthService) {
    this.checkPublicRoute();
  }

  private checkPublicRoute() {
    const path = window.location.pathname;
    if (path.startsWith('/mapa/')) {
      this.isPublicRoute.set(true);
      this.publicSlug.set(path.replace('/mapa/', ''));
    }
  }

  view = computed(() => {
    if (this.isPublicRoute()) return 'public';
    if (!this.auth.isAuthenticated()) return 'login';
    return this.auth.role();
  });

  logout() {
    this.auth.logout();
  }
}