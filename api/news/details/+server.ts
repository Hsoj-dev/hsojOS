// src/routes/projects/hsojOS/api/news/details/+server.ts
// GET /projects/hsojOS/api/news/details?uuid=ee1cab5b-77fe-44f5-952f-3c16e0786b7a
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { forward } from '../../../os/news-proxy.server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = (event) => {
	const uuid = event.url.searchParams.get('uuid');
	if (!uuid || !UUID.test(uuid)) error(400, 'A valid article uuid is required');

	return forward(event, '/details', new URLSearchParams({ uuid }), 60 * 60_000); // articles don't change
};