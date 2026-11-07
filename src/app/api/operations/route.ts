import { context } from '@/server/context';
import { execute } from '@/server/operations';
import { json, errorResponse, sameOrigin, readBody } from '@/server/http';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const c = await context(request.headers.get('x-tenant-id'));
    return json(await execute(c, await readBody(request)));
  } catch (e) {
    return errorResponse(e);
  }
}
