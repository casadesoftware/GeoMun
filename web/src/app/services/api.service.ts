import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient, private auth: AuthService) {}

  private headers() {
    return new HttpHeaders(this.auth.getAuthHeaders());
  }

  get<T>(url: string) {
    return this.http.get<T>(`/api/${url}`, { headers: this.headers() });
  }

  post<T>(url: string, body: any) {
    return this.http.post<T>(`/api/${url}`, body, { headers: this.headers() });
  }

  put<T>(url: string, body: any) {
    return this.http.put<T>(`/api/${url}`, body, { headers: this.headers() });
  }

  delete<T>(url: string) {
    return this.http.delete<T>(`/api/${url}`, { headers: this.headers() });
  }

  // Público (sin auth)
  getPublic<T>(url: string) {
    return this.http.get<T>(`/api/${url}`);
  }

  postFormData<T>(url: string, formData: FormData) {
    return this.http.post<T>(`/api/${url}`, formData, {
      headers: this.auth.getAuthHeaders(),
    });
  }

}
