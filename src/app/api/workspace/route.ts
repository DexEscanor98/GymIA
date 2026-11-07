import { context } from '@/server/context';
import { workspace } from '@/server/workspace';
import { json, errorResponse } from '@/server/http';
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return json(
      await workspace(
        await context(url.searchParams.get('tenant')),
        url.searchParams.get('day') || undefined,
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
