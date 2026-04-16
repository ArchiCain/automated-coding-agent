import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AppConfigService } from '@features/api-client';

import { User, CreateUserRequest, UpdateUserRequest, UserListQuery, UserListResponse } from '../types';

@Injectable({ providedIn: 'root' })
export class UserManagementApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get baseUrl(): string {
    return `${this.config.backendUrl}/users`;
  }

  getUsers(query?: UserListQuery): Observable<UserListResponse> {
    let params = new HttpParams();
    if (query?.search) params = params.set('search', query.search);
    if (query?.page) params = params.set('page', query.page.toString());
    if (query?.limit) params = params.set('limit', query.limit.toString());
    if (query?.sortBy) params = params.set('sortBy', query.sortBy);
    if (query?.sortOrder) params = params.set('sortOrder', query.sortOrder);

    return this.http.get<UserListResponse>(this.baseUrl, { params, withCredentials: true });
  }

  getUser(id: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }

  createUser(data: CreateUserRequest): Observable<User> {
    return this.http.post<User>(this.baseUrl, data, { withCredentials: true });
  }

  updateUser(id: string, data: UpdateUserRequest): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}`, data, { withCredentials: true });
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }
}
