import { assertDisposableTestDatabase } from './test-database';

// The guard that protects real data from test cleanup deserves its own tests.
describe('assertDisposableTestDatabase', () => {
  const DEV = 'postgresql://pennywise:secret-pw@127.0.0.1:5432/pennywise_dev?schema=public';

  it('accepts a local database whose name ends in _test', () => {
    const url = assertDisposableTestDatabase(
      'postgresql://pennywise:secret-pw@127.0.0.1:5432/pennywise_test?schema=public',
      DEV,
    );
    expect(url.pathname).toBe('/pennywise_test');
  });

  it('accepts localhost as the host', () => {
    expect(() =>
      assertDisposableTestDatabase('postgres://u:p@localhost:5433/app_test', DEV),
    ).not.toThrow();
  });

  it.each([
    [undefined, /not set/],
    ['', /not set/],
    ['not a url', /not a valid URL/],
    ['mysql://u:p@127.0.0.1:3306/app_test', /postgresql:\/\//],
    ['postgresql://u:p@db.example.com:5432/app_test', /must be local/],
    ['postgresql://u:p@127.0.0.1:5432/pennywise_dev', /end in "_test"/],
    ['postgresql://u:p@127.0.0.1:5432/pennywise_testing', /end in "_test"/],
    ['postgresql://u:p@127.0.0.1:5432/Pennywise_Test', /end in "_test"/],
    ['postgresql://u:p@127.0.0.1:5432/a"b_test', /end in "_test"/],
  ])('rejects %p', (url, expected) => {
    expect(() => assertDisposableTestDatabase(url, DEV)).toThrow(expected);
  });

  it('rejects the development database even if it is named *_test', () => {
    const same = 'postgresql://u:p@127.0.0.1:5432/shared_test';
    expect(() => assertDisposableTestDatabase(same, same)).toThrow(/same database as DATABASE_URL/);
  });

  it('never puts the password in its error messages', () => {
    let message = '';
    try {
      assertDisposableTestDatabase('postgresql://u:secret-pw@db.example.com/x_test', DEV);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/must be local/);
    expect(message).not.toContain('secret-pw');
  });
});
