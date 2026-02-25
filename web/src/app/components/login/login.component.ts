import { Component, signal, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent implements AfterViewInit {
  form: FormGroup;
  loading = signal(false);

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private auth: AuthService,
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);

    const { email, password } = this.form.value;
    this.auth.login(email, password).subscribe({
      next: (res) => {
        this.auth.setSession(res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: 'Credenciales inválidas', background: '#1e293b', color: '#fff' });
      },
    });
  }

  ngAfterViewInit() {
    const video = document.querySelector('video');
       if (video) {
         video.src = 'assets/video.mp4';
         video.loop = true;
         video.muted = true;
         video.play().catch(() => {});
       }
}

}
