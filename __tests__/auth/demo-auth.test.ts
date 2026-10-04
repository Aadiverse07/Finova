import { describe, expect, it } from 'vitest';
import { ALLOWED_EMAIL_DOMAINS, authAdapter, normalizeEmail } from '@/lib/demo-auth';

describe('demo email authentication validation', () => {
  it('centralizes the four supported email domains', () => {
    expect(ALLOWED_EMAIL_DOMAINS).toEqual(['gmail.com', 'outlook.com', 'icloud.com', 'aol.com']);
  });

  it('trims and normalizes email case', () => {
    expect(normalizeEmail('  USER@GMAIL.COM  ')).toBe('user@gmail.com');
    expect(authAdapter.validateEmail('  USER@GMAIL.COM  ')).toBeNull();
  });

  it('accepts only the supported domains', () => {
    for (const domain of ALLOWED_EMAIL_DOMAINS) {
      expect(authAdapter.validateEmail(`user@${domain}`)).toBeNull();
    }
  });

  it('rejects malformed emails and unsupported domains', () => {
    expect(authAdapter.validateEmail('not-an-email')).toBe('Enter a valid email address.');
    expect(authAdapter.validateEmail('user@yahoo.com')).toBe('Please use a Gmail, Outlook, iCloud, or AOL email address.');
    expect(authAdapter.validateEmail('user@hotmail.com')).toBe('Please use a Gmail, Outlook, iCloud, or AOL email address.');
    expect(authAdapter.validateEmail('user@protonmail.com')).toBe('Please use a Gmail, Outlook, iCloud, or AOL email address.');
  });

  it('keeps password validation in the separated auth adapter', () => {
    expect(authAdapter.validatePassword('')).toBe('Password is required.');
    expect(authAdapter.validatePassword('12345')).toBe('Password must contain at least 6 characters.');
    expect(authAdapter.validatePassword('123456')).toBeNull();
  });
});
