import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { LinkRecord } from './links.service';

const apiUrl = 'http://localhost:3000/api/links';

describe('AppComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function createPage() {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    http.expectOne(apiUrl).flush([]);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the Snip heading and handles invalid URLs before sending a request', () => {
    const fixture = createPage();
    const app = fixture.componentInstance;

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Short links.');
    app.urlControl.setValue('ftp://example.com/file');
    app.submit();

    expect(app.urlError).toBe('Enter a valid http or https URL.');
    http.expectNone({ method: 'POST', url: apiUrl });
  });

  it('creates a link and refreshes the links table', () => {
    const fixture = createPage();
    const app = fixture.componentInstance;
    const link: LinkRecord = {
      code: 'a1B2c3',
      url: 'https://example.com/article',
      shortUrl: 'http://localhost:3000/a1B2c3',
      hits: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    app.urlControl.setValue(link.url);
    app.submit();
    http.expectOne({ method: 'POST', url: apiUrl }).flush(link);
    http.expectOne({ method: 'GET', url: apiUrl }).flush([link]);
    fixture.detectChanges();

    expect(app.createdLink()).toEqual(link);
    expect(fixture.nativeElement.querySelector('tbody a')?.textContent.trim()).toBe(link.code);
  });

  it('shows API validation errors inline', () => {
    const fixture = createPage();
    const app = fixture.componentInstance;
    app.urlControl.setValue('https://example.com');
    app.submit();

    http.expectOne({ method: 'POST', url: apiUrl }).flush(
      { error: 'URL must use http or https' },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(app.submitError()).toBe('URL must use http or https');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('URL must use http or https');
  });
});
