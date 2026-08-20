import {
  normalizeWhatsAppNumber,
  normalizeWhatsAppWaId,
  whatsappRecipientDigits,
} from '../lib/whatsappNumber.js';

describe('normalizeWhatsAppNumber', () => {
  test('normalizes a 10-digit India local number', () => {
    expect(normalizeWhatsAppNumber('9876543210'))
      .toBe('+919876543210');
  });

  test('normalizes India country code without plus', () => {
    expect(normalizeWhatsAppNumber('919876543210'))
      .toBe('+919876543210');
  });

  test('normalizes formatted +91 number', () => {
    expect(normalizeWhatsAppNumber('+91 98765 43210'))
      .toBe('+919876543210');
  });

  test('normalizes formatted India local number', () => {
    expect(normalizeWhatsAppNumber('98765-43210'))
      .toBe('+919876543210');
  });

  test('preserves an explicit non-India international number', () => {
    expect(normalizeWhatsAppNumber('+1 415 555 2671'))
      .toBe('+14155552671');
  });

  test('rejects a 9-digit ambiguous number', () => {
    expect(normalizeWhatsAppNumber('987654321'))
      .toBeNull();
  });

  test('rejects arbitrary text', () => {
    expect(normalizeWhatsAppNumber('not a phone number'))
      .toBeNull();
  });

  test('rejects empty input', () => {
    expect(normalizeWhatsAppNumber(''))
      .toBeNull();
  });
});

describe('whatsappRecipientDigits', () => {
  test('returns canonical digits without plus', () => {
    expect(whatsappRecipientDigits('9876543210'))
      .toBe('919876543210');
  });

  test('returns null for invalid input', () => {
    expect(whatsappRecipientDigits('1234'))
      .toBeNull();
  });
});

describe('normalizeWhatsAppWaId', () => {
  test('normalizes an India Meta WaID', () => {
    expect(normalizeWhatsAppWaId('919876543210'))
      .toBe('+919876543210');
  });

  test('normalizes a non-India Meta WaID', () => {
    expect(normalizeWhatsAppWaId('14155552671'))
      .toBe('+14155552671');
  });

  test('rejects malformed WaID', () => {
    expect(normalizeWhatsAppWaId('1234'))
      .toBeNull();
  });
});
