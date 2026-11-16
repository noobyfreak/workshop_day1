import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface LinkRecord {
  code: string;
  url: string;
  shortUrl: string;
  hits: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class LinksService {
  private readonly apiUrl = 'http://localhost:3000/api/links';

  constructor(private readonly http: HttpClient) {}

  createLink(url: string): Observable<LinkRecord> {
    return this.http.post<LinkRecord>(this.apiUrl, { url });
  }

  getLinks(): Observable<LinkRecord[]> {
    return this.http.get<LinkRecord[]>(this.apiUrl);
  }

  errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.error;
      if (typeof message === 'string') return message;
      if (error.status === 0) return 'Cannot reach the Snip API. Check that the backend is running.';
    }

    return 'Something went wrong. Please try again.';
  }
}
