// src/routes/projects/hsojOS/os/news-proxy.server.ts
// Server-only helper (the .server.ts name stops it from ever being bundled for the browser).
// Forwards requests to FreeNewsApi with the secret key, so the key never reaches visitors.
import { env } from '$env/dynamic/private';
import { error, type RequestEvent } from '@sveltejs/kit';

const UPSTREAM = 'https://api.freenewsapi.io/v1';

/** Only these topics are allowed through */
export const TOPICS = [
	'education', 'environment', 'food', 'gadgets', 'gaming', 'health', 'medicine', 'mental health',
	'movies', 'music', 'neuroscience', 'nutrition', 'politics', 'public health', 'robotics', 'science',
	'social sciences', 'space', 'technology', 'travel', 'wildlife', 'world'
];

const MAX_REQUESTS_PER_MINUTE = 60; // per visitor, so nobody can burn your daily quota
const MAX_CACHE_ENTRIES = 500;

type Cached = { expires: number; body: string };
const cache = new Map<string, Cached>();
const visits = new Map<string, { count: number; resetAt: number }>();

/** Simple per-visitor limit. Memory is per server instance, which is fine for a small site. */
function tooManyRequests(event: RequestEvent): boolean {
	let visitor = 'unknown';
	try {
		visitor = event.getClientAddress();
	} catch {
		/* some hosts don't expose the address */
	}

	const now = Date.now();
	if (visits.size > 1000) {
		for (const [key, v] of visits) if (v.resetAt < now) visits.delete(key);
	}

	const entry = visits.get(visitor);
	if (!entry || entry.resetAt < now) {
		visits.set(visitor, { count: 1, resetAt: now + 60_000 });
		return false;
	}
	entry.count++;
	return entry.count > MAX_REQUESTS_PER_MINUTE;
}

function respond(status: number, body: string, ttlMs: number) {
	return new Response(body, {
		status,
		headers: {
			'content-type': 'application/json',
			// Lets the browser and any CDN reuse good answers too
			'cache-control': status === 200 ? `public, max-age=${Math.floor(ttlMs / 1000)}` : 'no-store'
		}
	});
}

/**
 * Call FreeNewsApi. `params` must already be checked by the caller.
 * Good answers are cached for `ttlMs` so repeat visits don't use up the daily limit.
 */
export async function forward(
	event: RequestEvent,
	path: '/news' | '/details',
	params: URLSearchParams,
	ttlMs: number
) {
	const key = env.FREENEWSAPI_KEY;
	if (!key) error(503, 'FREENEWSAPI_KEY is not set on the server');
	if (tooManyRequests(event)) error(429, 'Too many requests');

	const url = `${UPSTREAM}${path}?${params}`;
	const hit = cache.get(url);
	if (hit && hit.expires > Date.now()) return respond(200, hit.body, ttlMs);

	let res: Response;
	try {
		res = await event.fetch(url, { headers: { 'x-api-key': key, accept: 'application/json' } });
	} catch {
		error(502, 'Could not reach FreeNewsApi');
	}

	const body = await res.text();
	if (res.ok) {
		if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
		cache.set(url, { expires: Date.now() + ttlMs, body });
	}
	// Pass FreeNewsApi's status through (401/403 bad key, 429 rate limit) so the app can explain it
	return respond(res.status, body, ttlMs);
}