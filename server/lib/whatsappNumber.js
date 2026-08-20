/**
 * Convert a WhatsApp number into canonical E.164 form.
 *
 * FluencyJet's current signup audience is primarily India:
 *   9876543210     -> +919876543210
 *   919876543210   -> +919876543210
 *   +91 98765 43210 -> +919876543210
 *
 * An explicitly international number beginning with "+" is preserved
 * if it contains a valid E.164-length digit sequence.
 *
 * Invalid / ambiguous values return null. We deliberately do not guess.
 */
export function normalizeWhatsAppNumber(value) {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return null;
  }

  const digits = raw.replace(/\D/g, '');

  // Explicit international E.164-style input.
  if (raw.startsWith('+') && /^\d{8,15}$/.test(digits)) {
    return `+${digits}`;
  }

  // Existing India number including country code but without "+".
  if (/^91\d{10}$/.test(digits)) {
    return `+${digits}`;
  }

  // FluencyJet India local mobile number.
  if (/^\d{10}$/.test(digits)) {
    return `+91${digits}`;
  }

  // Fail closed. Never invent a country code for ambiguous input.
  return null;
}

export function whatsappRecipientDigits(value) {
  const normalized = normalizeWhatsAppNumber(value);

  return normalized ? normalized.slice(1) : null;
}

/**
 * Normalize a provider-supplied WhatsApp WaID.
 *
 * Meta WaIDs are already country-qualified and are supplied as digits.
 * Unlike user-entered signup values, we must NOT prepend an India
 * country code here.
 */
export function normalizeWhatsAppWaId(value) {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (!/^\d{8,15}$/.test(digits)) {
    return null;
  }

  return `+${digits}`;
}
