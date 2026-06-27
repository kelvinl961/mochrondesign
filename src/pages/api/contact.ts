import type { APIRoute } from 'astro';
import { contact } from '../../data/site';

export const prerender = false;

const resendApiKey = import.meta.env.RESEND_API_KEY;
const contactToEmail = import.meta.env.CONTACT_TO_EMAIL ?? contact.email;
const contactFromEmail =
  import.meta.env.CONTACT_FROM_EMAIL ?? 'Mochron Design <onboarding@resend.dev>';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function getField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export const POST: APIRoute = async ({ request }) => {
  if (!resendApiKey) {
    return new Response(
      JSON.stringify({
        error: 'Email service is not configured. Add RESEND_API_KEY to your environment.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid form submission.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (getField(formData, '_gotcha')) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const firstName = getField(formData, 'firstName');
  const lastName = getField(formData, 'lastName');
  const email = getField(formData, 'email');
  const phone = getField(formData, 'phone');
  const otherInfo = getField(formData, 'otherInfo');
  const propertyType = getField(formData, 'propertyType');
  const propertyStatus = getField(formData, 'propertyStatus');
  const location = getField(formData, 'location');
  const budget = getField(formData, 'budget');
  const idea = getField(formData, 'idea');

  if (!firstName || !lastName || !email) {
    return new Response(JSON.stringify({ error: 'Please fill in all required fields.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'Please enter a valid email address.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const fields = [
    ['Name', `${firstName} ${lastName}`],
    ['Email', email],
    ['Phone', phone],
    ['Other info', otherInfo],
    ['Property type', propertyType],
    ['Property status', propertyStatus],
    ['Location', location],
    ['Budget', budget],
    ['Project idea', idea],
  ].filter(([, value]) => value);

  const html = fields
    .map(
      ([label, value]) =>
        `<p><strong>${escapeHtml(label)}:</strong><br>${escapeHtml(value).replaceAll('\n', '<br>')}</p>`,
    )
    .join('');

  const text = fields.map(([label, value]) => `${label}: ${value}`).join('\n\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: contactFromEmail,
      to: [contactToEmail],
      reply_to: email,
      subject: `New enquiry from ${firstName} ${lastName}`,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Resend API error:', errorBody);

    return new Response(
      JSON.stringify({ error: 'Unable to send your message right now. Please try again later.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
