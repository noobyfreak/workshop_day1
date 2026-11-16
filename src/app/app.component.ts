import { Component, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, ValidationErrors, ValidatorFn } from '@angular/forms';
import { finalize } from 'rxjs';
import { LinkRecord, LinksService } from './links.service';

const httpUrlValidator: ValidatorFn = (control): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? null
      : { httpUrl: true };
  } catch {
    return { httpUrl: true };
  }
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  readonly urlControl = new FormControl('', {
    nonNullable: true,
    validators: [httpUrlValidator],
  });
  readonly links = signal<LinkRecord[]>([]);
  readonly loading = signal(true);
  readonly listError = signal('');
  readonly submitError = signal('');
  readonly submitting = signal(false);
  readonly createdLink = signal<LinkRecord | null>(null);

  constructor(private readonly linksService: LinksService) {}

  ngOnInit(): void {
    this.loadLinks();
  }

  get urlError(): string {
    if (!this.urlControl.touched) return '';
    if (this.urlControl.hasError('required')) return 'Enter a URL to shorten.';
    if (this.urlControl.hasError('httpUrl')) return 'Enter a valid http or https URL.';
    return '';
  }

  submit(): void {
    this.urlControl.markAsTouched();
    if (this.urlControl.invalid || this.submitting()) return;

    this.submitting.set(true);
    this.submitError.set('');
    this.createdLink.set(null);

    this.linksService
      .createLink(this.urlControl.value.trim())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (link) => {
          this.createdLink.set(link);
          this.urlControl.reset();
          this.loadLinks();
        },
        error: (error: unknown) => this.submitError.set(this.linksService.errorMessage(error)),
      });
  }

  private loadLinks(): void {
    this.loading.set(true);
    this.listError.set('');

    this.linksService
      .getLinks()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (links) => this.links.set(links),
        error: (error: unknown) => this.listError.set(this.linksService.errorMessage(error)),
      });
  }
}
