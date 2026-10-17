<!-- src/routes/projects/hsojOS/os/apps/News.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { CONFIG } from '../config';
	import { loc } from '../location.svelte';

	// Calls go to our own server endpoint (src/routes/projects/hsojOS/api/news), which holds the
	// secret key. FreeNewsApi itself doesn't allow requests straight from a browser (CORS).
	const BASE = `${base}/projects/hsojOS/api/news`;
	const PREFS_KEY = 'hsojos:news';

	const TOPICS = [
		'education', 'environment', 'food', 'gadgets', 'gaming', 'health', 'medicine', 'mental health',
		'movies', 'music', 'neuroscience', 'nutrition', 'politics', 'public health', 'robotics', 'science',
		'social sciences', 'space', 'technology', 'travel', 'wildlife', 'world'
	];

	type Scope = 'country' | 'global';
	type Article = { uuid: string; title: string; published_at: string; publisher: string };
	type Details = {
		title: string;
		thumbnail?: string;
		publisher: string;
		published_at: string;
		original_url?: string;
		body?: string;
	};

	let scope = $state<Scope>('country');
	let topic = $state('');
	let articles = $state<Article[]>([]);
	let nextOffset = $state<number | null>(null);
	let loading = $state(false);
	let loadingMore = $state(false);
	let error = $state('');

	let selected = $state<Article | null>(null);
	let details = $state<Details | null>(null);
	let detailsLoading = $state(false);
	let detailsError = $state('');

	const detailsCache = new Map<string, Details>();
	let token = 0;

	let country = $derived(loc.countryCode?.toLowerCase() ?? null);
	let needsCountry = $derived(scope === 'country' && !country);

	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
			if (saved.scope === 'country' || saved.scope === 'global') scope = saved.scope;
			if (TOPICS.includes(saved.topic)) topic = saved.topic;
		} catch {
			/* ignore */
		}
		loc.load();
		refresh();
	});

	function savePrefs() {
		try {
			localStorage.setItem(PREFS_KEY, JSON.stringify({ scope, topic }));
		} catch {
			/* ignore */
		}
	}

	// ---------- API ----------
	type ErrorKind = 'nokey' | 'network' | 'auth' | 'rate' | 'http';
	class ApiError extends Error {
		kind: ErrorKind;
		constructor(kind: ErrorKind) {
			super(kind);
			this.kind = kind;
		}
	}

	async function api(path: string, params: Record<string, string>) {
		let res: Response;
		try {
			res = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`);
		} catch {
			throw new ApiError('network');
		}
		if (res.status === 503) throw new ApiError('nokey');
		if (res.status === 401 || res.status === 403) throw new ApiError('auth');
		if (res.status === 429) throw new ApiError('rate');
		if (!res.ok) throw new ApiError('http');
		return res.json();
	}

	function messageFor(e: unknown) {
		const kind = e instanceof ApiError ? e.kind : 'http';
		return {
			nokey: 'The news key is missing on the server. Add FREENEWSAPI_KEY to your .env file and restart the dev server.',
			auth: 'FreeNewsApi rejected the API key. Check FREENEWSAPI_KEY.',
			rate: 'Too many requests right now. Wait a moment and try again.',
			network: "Couldn't reach the news service. Check your connection and try again.",
			http: 'Something went wrong loading the news. Try again.'
		}[kind];
	}

	function listParams(offset = 0): Record<string, string> {
		const params: Record<string, string> = { language: CONFIG.news.language };
		if (scope === 'country' && country) params.country = country;
		if (topic) params.topic = topic;
		if (offset > 0) params.offset = String(offset);
		return params;
	}

	async function refresh() {
		selected = null;
		details = null;
		if (needsCountry) {
			articles = [];
			nextOffset = null;
			error = '';
			return;
		}
		const mine = ++token;
		loading = true;
		error = '';
		try {
			const data = await api('', listParams());
			if (mine !== token) return;
			articles = data.data ?? [];
			nextOffset = data.meta?.has_more ? (data.meta.next_offset ?? null) : null;
		} catch (e) {
			if (mine !== token) return;
			articles = [];
			nextOffset = null;
			error = messageFor(e);
		} finally {
			if (mine === token) loading = false;
		}
	}

	async function loadMore() {
		if (nextOffset === null || loadingMore) return;
		const mine = token;
		loadingMore = true;
		try {
			const data = await api('', listParams(nextOffset));
			if (mine !== token) return;
			const seen = new Set(articles.map((a) => a.uuid));
			const fresh: Article[] = (data.data ?? []).filter((a: Article) => !seen.has(a.uuid));
			articles = [...articles, ...fresh];
			// If the page added nothing new, stop offering more
			nextOffset = fresh.length > 0 && data.meta?.has_more ? (data.meta.next_offset ?? null) : null;
		} catch (e) {
			error = messageFor(e);
		} finally {
			loadingMore = false;
		}
	}

	async function open(article: Article) {
		selected = article;
		detailsError = '';
		const cached = detailsCache.get(article.uuid);
		if (cached) {
			details = cached;
			return;
		}
		details = null;
		detailsLoading = true;
		try {
			const data = await api('/details', { uuid: article.uuid });
			if (selected?.uuid !== article.uuid) return;
			details = data.data as Details;
			detailsCache.set(article.uuid, details);
		} catch (e) {
			if (selected?.uuid !== article.uuid) return;
			detailsError = messageFor(e);
		} finally {
			if (selected?.uuid === article.uuid) detailsLoading = false;
		}
	}

	async function useMyLocation() {
		await loc.locate();
		refresh();
	}

	// ---------- Display helpers ----------
	const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
	function ago(iso: string) {
		const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
		const abs = Math.abs(seconds);
		if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
		if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
		return rtf.format(Math.round(seconds / 86400), 'day');
	}

	const label = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

	/** The API returns the body as one block, so split it into short paragraphs */
	function paragraphs(body: string): string[] {
		const sentences = body.split(/(?<=[.!?])\s+(?=[A-Z“"‘'])/);
		const out: string[] = [];
		for (let i = 0; i < sentences.length; i += 3) out.push(sentences.slice(i, i + 3).join(' '));
		return out;
	}

	const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : null);

	const segment =
		'cursor-pointer px-3 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary aria-pressed:bg-primary aria-pressed:text-primary-content';
</script>

<div class="flex h-full flex-col">
	{#if selected}
		<!-- Article view -->
		<div class="flex shrink-0 items-center gap-2 border-b border-base-content/15 p-1.5">
			<button
				type="button"
				onclick={() => (selected = null)}
				class="cursor-pointer rounded-lg px-2.5 py-1 text-sm transition-colors hover:bg-base-content/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
			>
				← Back
			</button>
		</div>

		<article class="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
			<h1 class="text-xl leading-snug font-bold">{details?.title ?? selected.title}</h1>
			<p class="text-sm text-base-content/60">
				{selected.publisher} · {ago(selected.published_at)}
			</p>

			{#if detailsLoading}
				<p class="text-sm text-base-content/60">Loading the article…</p>
			{:else if detailsError}
				<p role="alert" class="text-sm text-error">{detailsError}</p>
			{:else if details}
				{#if details.thumbnail}
					<img
						src={details.thumbnail}
						alt=""
						loading="lazy"
						referrerpolicy="no-referrer"
						class="max-h-64 w-full rounded-xl object-cover"
					/>
				{/if}
				{#if details.body}
					<div class="space-y-3 text-sm leading-relaxed">
						{#each paragraphs(details.body) as p}
							<p>{p}</p>
						{/each}
					</div>
				{/if}
				{#if safeUrl(details.original_url)}
					<a
						href={safeUrl(details.original_url)}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-block rounded-xl border-2 border-primary px-4 py-1.5 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-content"
					>
						Read the original on {details.publisher}
					</a>
				{/if}
			{/if}
		</article>
	{:else}
		<!-- Filters -->
		<div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-base-content/15 p-2">
			<div class="flex overflow-hidden rounded-lg border-2 border-base-content/20" role="group" aria-label="Scope">
				<button
					type="button"
					class={segment}
					aria-pressed={scope === 'country'}
					onclick={() => {
						scope = 'country';
						savePrefs();
						refresh();
					}}
				>
					{country ? `Your country (${country.toUpperCase()})` : 'Your country'}
				</button>
				<button
					type="button"
					class="{segment} border-l-2 border-base-content/20"
					aria-pressed={scope === 'global'}
					onclick={() => {
						scope = 'global';
						savePrefs();
						refresh();
					}}
				>
					Global
				</button>
			</div>

			<label class="flex items-center gap-2 text-sm">
				<span class="text-base-content/60">Topic</span>
				<select
					bind:value={topic}
					onchange={() => {
						savePrefs();
						refresh();
					}}
					class="rounded-lg border-2 border-base-content/20 bg-base-100 px-2 py-1 text-sm outline-none focus:border-primary"
				>
					<option value="">All topics</option>
					{#each TOPICS as t}
						<option value={t}>{label(t)}</option>
					{/each}
				</select>
			</label>
		</div>

		<!-- Headlines -->
		<div class="min-h-0 flex-1 overflow-y-auto">
			{#if loading}
				<p class="grid h-full place-items-center text-sm text-base-content/60">Loading headlines…</p>
			{:else if needsCountry}
				<div class="grid h-full place-items-center p-6 text-center">
					<div class="max-w-xs space-y-3">
						<p class="font-bold">Which country are you in?</p>
						<p class="text-sm text-base-content/60">
							Share your location to see local news, or switch to Global.
						</p>
						<button type="button" onclick={useMyLocation} class="cursor-pointer rounded-xl border-2 border-primary bg-primary px-4 py-1.5 text-sm font-bold text-primary-content">
							Use my location
						</button>
					</div>
				</div>
			{:else if error}
				<div class="grid h-full place-items-center p-6 text-center">
					<div class="max-w-sm space-y-3">
						<p role="alert" class="text-sm text-error">{error}</p>
						<button type="button" onclick={refresh} class="cursor-pointer rounded-xl border-2 border-base-content/20 px-4 py-1.5 text-sm font-bold hover:border-primary hover:text-primary">
							Try again
						</button>
					</div>
				</div>
			{:else if articles.length === 0}
				<p class="grid h-full place-items-center p-6 text-center text-sm text-base-content/60">
					No stories found for these filters. Try Global or another topic.
				</p>
			{:else}
				<ul class="divide-y divide-base-content/10">
					{#each articles as article (article.uuid)}
						<li>
							<button
								type="button"
								onclick={() => open(article)}
								class="group w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-base-content/5 focus-visible:bg-base-content/5 focus-visible:outline-none"
							>
								<span class="block text-sm leading-snug font-bold group-hover:text-primary">{article.title}</span>
								<span class="mt-1 block text-xs text-base-content/60">
									{article.publisher} · {ago(article.published_at)}
								</span>
							</button>
						</li>
					{/each}
				</ul>
				{#if nextOffset !== null}
					<div class="p-3 text-center">
						<button
							type="button"
							onclick={loadMore}
							disabled={loadingMore}
							class="cursor-pointer rounded-xl border-2 border-base-content/20 px-4 py-1.5 text-sm font-bold hover:border-primary hover:text-primary disabled:cursor-default disabled:opacity-50"
						>
							{loadingMore ? 'Loading…' : 'Load more'}
						</button>
					</div>
				{/if}
			{/if}
		</div>
		<p class="shrink-0 border-t border-base-content/15 px-3 py-1 text-xs text-base-content/50">
			News from FreeNewsApi.io
		</p>
	{/if}
</div>