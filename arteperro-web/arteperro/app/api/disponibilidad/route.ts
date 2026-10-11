import { disponibilidad } from '@/lib/agenda';
export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json(await disponibilidad());
}
