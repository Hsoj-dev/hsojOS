<!-- src/routes/projects/hsojOS/os/apps/YouTube.svelte -->
<script lang="ts">
	import { env } from '$env/dynamic/public';

	// Set PUBLIC_YOUTUBE_API_KEY in your .env (see the notes that came with this app)
	const API_KEY = env.PUBLIC_YOUTUBE_API_KEY;

	type Video = { id: string; title: string; channel: string; thumb: string };

	let query = $state('');
	let results = $state<Video[]>([]);
	let playing = $state<string | null>(null);
	let loading = $state(false);
	let searched = $state(false);
	let error = $state('');
	let searchToken = 0; // ignore responses from older searches

	/** Pull a video ID out of a pasted link or bare ID, or return null */
	function parseVideoId(input: string): string | null {
		const text = input.trim();
		// Bare IDs are 11 characters; require a digit/capital/-/_ so plain words still search
		if (/^[\w-]{11}$/.test(text) && /[0-9A-Z_-]/.test(text)) return text;

		try {
			const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
			const host = url.hostname.replace(/^(www|m)\./, '');
			if (host === 'youtu.be') {
				const id = url.pathname.slice(1);
				return /^[\w-]{11}$/.test(id) ? id : null;
			}
			if (host === 'youtube.com') {
				if (url.pathname === '/watch') {
					const v = url.searchParams.get('v');
					return v && /^[\w-]{11}$/.test(v) ? v : null;
				}
				return url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1] ?? null;
			}
		} catch {
			/* not a URL */
		}
		return null;
	}

	// The API returns HTML entities in titles (&amp; &#39; ...)
	const decode = (s: string) => new DOMParser().parseFromString(s, 'text/html').documentElement.textContent ?? s;

	async function search(q: string) {
		const token = ++searchToken;
		loading = true;
		error = '';
		searched = true;
		try {
			const params = new URLSearchParams({
				part: 'snippet',
				type: 'video',
				videoEmbeddable: 'true',
				safeSearch: 'moderate',
				maxResults: '12',
				q,
				key: API_KEY ?? ''
			});
			const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
			const data = await res.json();
			if (token !== searchToken) return;

			if (!res.ok) {
				const reason = data?.error?.errors?.[0]?.reason;
				error =
					reason === 'quotaExceeded'
						? 'Out of search quota for today. Paste a link instead, or try again tomorrow.'
						: (data?.error?.message ?? `Search failed (${res.status})`);
				results = [];
				return;
			}

			results = (data.items ?? []).map(
				(item: {
					id: { videoId: string };
					snippet: { title: string; channelTitle: string; thumbnails: { medium?: { url: string } } };
				}) => ({
					id: item.id.videoId,
					title: decode(item.snippet.title),
					channel: decode(item.snippet.channelTitle),
					thumb: item.snippet.thumbnails.medium?.url ?? ''
				})
			);
		} catch {
			if (token !== searchToken) return;
			error = "Couldn't reach YouTube. Check your connection.";
			results = [];
		} finally {
			if (token === searchToken) loading = false;
		}
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const text = query.trim();
		if (!text) return;

		const id = parseVideoId(text);
		if (id) {
			playing = id;
			return;
		}
		if (!API_KEY) {
			error = 'Search needs a YouTube API key. You can still paste a video link.';
			searched = true;
			playing = null;
			return;
		}
		playing = null;
		search(text);
	}
</script>

<div class="flex h-full flex-col">
	<form class="flex shrink-0 items-center gap-2 border-b border-base-content/15 p-2" onsubmit={submit}>
		{#if playing}
			<button
				type="button"
				onclick={() => (playing = null)}
				class="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-sm transition-colors hover:bg-base-content/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
			>
				← Back
			</button>
		{/if}
		<input
			bind:value={query}
			type="text"
			aria-label="Search YouTube or paste a link"
			placeholder="Search YouTube or paste a link"
			autocomplete="off"
			spellcheck="false"
			class="min-w-0 flex-1 rounded-lg border border-base-content/20 bg-base-content/5 px-3 py-1.5 text-sm outline-none placeholder:text-base-content/40 focus:border-primary"
		/>
		<button
			type="submit"
			class="shrink-0 cursor-pointer rounded-lg border-2 border-primary bg-primary px-3 py-1 text-sm font-bold text-primary-content transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
		>
			Go
		</button>
	</form>

	<div class="min-h-0 flex-1">
		{#if playing}
			<iframe
				title="YouTube player"
				src="https://www.youtube-nocookie.com/embed/{playing}?autoplay=1&rel=0"
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
				referrerpolicy="strict-origin-when-cross-origin"
				allowfullscreen
				class="size-full border-0 bg-black"
			></iframe>
		{:else if loading}
			<p class="grid h-full place-items-center text-sm text-base-content/60">Searching…</p>
		{:else if error}
			<p role="alert" class="grid h-full place-items-center p-6 text-center text-sm text-error">
				{error}
			</p>
		{:else if results.length > 0}
			<ul class="grid h-full grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] content-start gap-3 overflow-auto p-3">
				{#each results as video (video.id)}
					<li>
						<button
							type="button"
							onclick={() => (playing = video.id)}
							class="group flex w-full cursor-pointer flex-col gap-2 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						>
							<img
								src={video.thumb}
								alt=""
								loading="lazy"
								class="aspect-video w-full rounded-lg border-2 border-transparent object-cover transition-colors group-hover:border-primary"
							/>
							<span class="line-clamp-2 text-sm font-bold group-hover:text-primary">{video.title}</span>
							<span class="truncate text-xs text-base-content/60">{video.channel}</span>
						</button>
					</li>
				{/each}
			</ul>
		{:else if searched}
			<p class="grid h-full place-items-center text-sm text-base-content/60">No videos found.</p>
		{:else}
			<div class="grid h-full place-items-center p-6 text-center">
				<div class="space-y-2">
					<p class="text-2xl font-bold">YouTube</p>
					<p class="text-sm text-base-content/60">Search for a video, or paste a link.</p>
					{#if !API_KEY}
						<p class="text-xs text-warning">
							No API key found, so search is off. Pasted links still work.
						</p>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>