import { json } from '@/server/http';

export async function GET() {
  return json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
}
