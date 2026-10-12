import { validateEnv } from './env.validation';

const VALID = { NODE_ENV: 'development', PORT: '3000', CORS_ORIGIN: 'http://localhost:5173' };

describe('validateEnv', () => {
  it('accepts a valid environment and converts PORT to a number', () => {
    const env = validateEnv(VALID);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGIN).toBe('http://localhost:5173');
  });

  it('applies defaults for NODE_ENV and PORT', () => {
    const env = validateEnv({ CORS_ORIGIN: 'https://pennywise.example' });
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
  });

  it('keeps only the declared variables', () => {
    const env = validateEnv({ ...VALID, PATH: '/usr/bin', SECRET: 'x' });
    expect(Object.keys(env).sort()).toEqual(['CORS_ORIGIN', 'NODE_ENV', 'PORT']);
  });

  it('rejects a missing CORS_ORIGIN with a readable message', () => {
    expect(() => validateEnv({ PORT: '3000' })).toThrow(
      /Invalid environment configuration:\n- .*CORS_ORIGIN/,
    );
  });

  it.each([
    ['*', 'wildcard'],
    ['http://localhost:5173/', 'trailing slash'],
    ['http://localhost:5173/app', 'path'],
    ['ftp://localhost', 'non-http scheme'],
    ['localhost:5173', 'missing scheme'],
    ['http://a.example,http://b.example', 'multiple origins'],
    ['', 'empty string'],
  ])('rejects CORS_ORIGIN %p (%s)', (origin) => {
    expect(() => validateEnv({ ...VALID, CORS_ORIGIN: origin })).toThrow(/CORS_ORIGIN/);
  });

  it.each(['0', '70000', 'abc', '3000.5', ''])('rejects PORT %p', (port) => {
    expect(() => validateEnv({ ...VALID, PORT: port })).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ ...VALID, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('reports every invalid variable at once', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging', PORT: 'abc' })).toThrow(
      /NODE_ENV[\s\S]*PORT[\s\S]*CORS_ORIGIN/,
    );
  });
});
