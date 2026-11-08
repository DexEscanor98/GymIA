type TransactionalEmail = { to: string; subject: string; text: string; html: string };

export async function sendTransactionalEmail(message: TransactionalEmail) {
  const brevoKey = process.env.BREVO_API_KEY;
  const brevoFrom = process.env.BREVO_FROM_EMAIL;
  if (brevoKey && brevoFrom) {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: {
          email: brevoFrom,
          ...(process.env.BREVO_FROM_NAME ? { name: process.env.BREVO_FROM_NAME } : {}),
        },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        htmlContent: message.html,
      }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Brevo rechazó el correo (HTTP ${response.status}).`);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[DEV EMAIL] To: ${message.to}\n${message.subject}\n${message.text}`);
      return;
    }
    throw new Error('Configura BREVO_API_KEY y BREVO_FROM_EMAIL para enviar correos.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`El proveedor de correo rechazó el mensaje (HTTP ${response.status}).`);
}
