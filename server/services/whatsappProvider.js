// server/services/whatsappProvider.js
//
// Phase 4 provider boundary.
//
// IMPORTANT:
// Real WhatsApp/Meta delivery is intentionally NOT implemented yet.
// Tests may mock this module, but production code cannot send a message
// through it until a later explicitly-reviewed Phase 4 step.

/**
 * Send a WhatsApp template message.
 *
 * Future provider contract:
 * {
 *   to: string,
 *   templateName: string,
 *   languageCode: string,
 *   components?: Array,
 *   automationEventId: string
 * }
 *
 * Future success contract:
 * {
 *   provider: 'meta',
 *   messageId: string
 * }
 */
export async function sendWhatsAppTemplate(_message) {
  const error = new Error(
    'Real WhatsApp delivery is not implemented or enabled.',
  );

  error.code = 'WHATSAPP_PROVIDER_DISABLED';
  throw error;
}
