import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DocsResponse, DocContent } from '../models/doc.model';

@Injectable({ providedIn: 'root' })
export class DocsService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8086/api/docs';

  getDocs(path?: string): Observable<DocsResponse> {
    const url = path ? `${this.apiUrl}?path=${encodeURIComponent(path)}` : this.apiUrl;
    return this.http.get<DocsResponse>(url);
  }

  getDocContent(path: string): Observable<DocContent> {
    return this.http.get<DocContent>(`${this.apiUrl}/content?path=${encodeURIComponent(path)}`);
  }
}
