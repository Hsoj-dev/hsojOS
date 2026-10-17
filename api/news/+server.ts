// src/routes/projects/hsojOS/api/news/+server.ts
// GET /projects/hsojOS/api/news?language=en&country=ph&topic=health&offset=10
import type { RequestHandler } from './$types';
import { forward, TOPICS } from '../../os/news-proxy.server';

export const GET: RequestHandler = (event) => {
	const query = event.url.searchParams;
	const params = new URLSearchParams();

	// Only known-good values are passed on. Anything else is dropped.
	const language = query.get('language');
	if (language && /^[a-z]{2,3}$/i.test(language)) params.set('language', language.toLowerCase());

	const country = query.get('country');
	if (country && /^[a-z]{2}$/i.test(country)) params.set('country', country.toLowerCase());

	const topic = query.get('topic');
	if (topic && TOPICS.includes(topic)) params.set('topic', topic);

	const offset = Number(query.get('offset'));
	if (Number.isInteger(offset) && offset > 0 && offset <= 1000) params.set('offset', String(offset));

	return forward(event, '/news', params, 5 * 60_000); // headlines stay fresh for 5 minutes
};