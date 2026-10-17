<!-- src/routes/projects/hsojOS/os/apps/Music.svelte -->
<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { env } from '$env/dynamic/public';
	import { getWindowContext } from '../context';
	import { sound } from '../sound.svelte';
	import { loadYouTubeApi, PlayerState, type YTPlayer } from './youtube-api';
	import {
		clock,
		makeOrder,
		nextPosition,
		parseTrack,
		prevPosition,
		type Repeat
	} from './music-utils';

	const win = getWindowContext();

	// Same key the YouTube app uses (PUBLIC_YOUTUBE_API_KEY in .env)
	const API_KEY = env.PUBLIC_YOUTUBE_API_KEY;

	const FAVORITES_KEY = 'hsojos:music-favorites';
	const PREFS_KEY = 'hsojos:music-prefs';
	const SEARCH_KEY = 'hsojos:music-search';

	// YouTube asks that its player stays visible and at least 200x200, so the video is shown
	// inside the spinning disc instead of being hidden.
	const DISC_NORMAL = 208;
	const DISC_FOCUS = 256;

	type Track = {
		id: string;
		source: 'youtube' | 'local';
		title: string;
		artist: string;
		thumb?: string;
		videoId?: string; // youtube
		url?: string; // local (a temporary link to the file on this computer)
	};
	type Tab = 'search' | 'favorites' | 'local';

	// ---------- Saved data ----------
	function readJson<T>(key: string, fallback: T): T {
		try {
			const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
			return raw ? (JSON.parse(raw) as T) : fallback;
		} catch {
			return fallback;
		}
	}

	function writeJson(key: string, value: unknown) {
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch {
			/* storage blocked or full */
		}
	}

	const isSavedTrack = (t: unknown): t is Track =>
		!!t &&
		typeof (t as Track).id === 'string' &&
		typeof (t as Track).videoId === 'string' &&
		typeof (t as Track).title === 'string' &&
		typeof (t as Track).artist === 'string';

	const savedPrefs = readJson<{ volume?: number; repeat?: string; shuffle?: boolean }>(PREFS_KEY, {});
	const savedSearch = readJson<{ query?: string; results?: unknown[] }>(SEARCH_KEY, {});

	// ---------- State ----------
	let tab = $state<Tab>('search');
	let pane = $state<'library' | 'playing'>('library'); // only matters in narrow windows
	let focus = $state(false);

	let query = $state(typeof savedSearch.query === 'string' ? savedSearch.query : '');
	const savedResults: Track[] = (savedSearch.results ?? [])
		.filter(isSavedTrack)
		.map((t) => ({ ...t, source: 'youtube' as const }));
	let results = $state<Track[]>(savedResults);
	let searching = $state(false);
	let searched = $state(savedResults.length > 0);
	let searchError = $state('');

	let favorites = $state<Track[]>(
		readJson<unknown[]>(FAVORITES_KEY, []).filter(isSavedTrack).map((t) => ({ ...t, source: 'youtube' as const }))
	);
	let localTracks = $state<Track[]>([]);

	// What's playing: a snapshot of a list, in play order
	let queue = $state<Track[]>([]);
	let order = $state<number[]>([]);
	let pos = $state(-1);
	let current = $derived<Track | undefined>(pos >= 0 ? queue[order[pos]] : undefined);

	let playing = $state(false);
	let elapsed = $state(0);
	let duration = $state(0);
	let scrubbing = $state(false);
	let scrubValue = $state(0);
	let notice = $state('');

	let shuffle = $state(!!savedPrefs.shuffle);
	let repeat = $state<Repeat>(savedPrefs.repeat === 'all' || savedPrefs.repeat === 'one' ? savedPrefs.repeat : 'off');
	let volume = $state(
		typeof savedPrefs.volume === 'number' ? Math.min(100, Math.max(0, savedPrefs.volume)) : 100
	);
	let volumeBeforeMute = 70;
	let dragOver = $state(false);

	let listed = $derived(tab === 'search' ? results : tab === 'favorites' ? favorites : localTracks);
	let discSize = $derived(focus ? DISC_FOCUS : DISC_NORMAL);
	let shownTime = $derived(scrubbing ? scrubValue : elapsed);

	let ytHost: HTMLElement | undefined = $state();
	let audioEl: HTMLAudioElement | undefined = $state();
	let fileInput: HTMLInputElement | undefined = $state();

	let ytPlayer: YTPlayer | null = null;
	let ytReady = false;
	let poll: ReturnType<typeof setInterval> | undefined;
	let errorStreak = 0;
	let nextLocalId = 0;
	let destroyed = false;

	// ---------- Saving ----------
	$effect(() => writeJson(FAVORITES_KEY, favorites));
	$effect(() => writeJson(PREFS_KEY, { volume, repeat, shuffle }));

	// ---------- Volume: this app's slider, scaled by the system volume ----------
	function applyVolume() {
		const level = (volume / 100) * sound.level;
		if (audioEl) audioEl.volume = level;
		if (ytPlayer && ytReady) {
			try {
				ytPlayer.setVolume(Math.round(level * 100));
			} catch {
				/* player not ready yet */
			}
		}
	}
	$effect(() => {
		void volume;
		void sound.level;
		applyVolume();
	});

	function toggleVolumeMute() {
		if (volume === 0) {
			volume = volumeBeforeMute || 70;
		} else {
			volumeBeforeMute = volume;
			volume = 0;
		}
	}

	// ---------- Searching ----------
	const decode = (s: string) => new DOMParser().parseFromString(s, 'text/html').documentElement.textContent ?? s;

	async function search(e: SubmitEvent) {
		e.preventDefault();
		const q = query.trim();
		if (!q) return;
		if (!API_KEY) {
			searchError = 'Search needs a YouTube API key. You can still play your favorites and local files.';
			searched = true;
			return;
		}

		searching = true;
		searchError = '';
		try {
			const params = new URLSearchParams({
				part: 'snippet',
				type: 'video',
				videoCategoryId: '10', // Music
				videoEmbeddable: 'true',
				videoSyndicated: 'true',
				maxResults: '15',
				q,
				key: API_KEY
			});
			const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
			const data = await res.json();
			if (!res.ok) {
				const reason = data?.error?.errors?.[0]?.reason;
				searchError =
					reason === 'quotaExceeded'
						? 'Out of search quota for today. Favorites and local files still work.'
						: (data?.error?.message ?? `Search failed (${res.status})`);
				return;
			}

			results = (data.items ?? []).map(
				(item: {
					id: { videoId: string };
					snippet: { title: string; channelTitle: string; thumbnails: { medium?: { url: string } } };
				}): Track => {
					const parsed = parseTrack(decode(item.snippet.title), decode(item.snippet.channelTitle));
					return {
						id: `yt:${item.id.videoId}`,
						source: 'youtube',
						videoId: item.id.videoId,
						title: parsed.title,
						artist: parsed.artist,
						thumb: item.snippet.thumbnails.medium?.url
					};
				}
			);
			searched = true;
			writeJson(SEARCH_KEY, { query: q, results }); // saves quota next time
		} catch {
			searchError = "Couldn't reach YouTube. Check your connection.";
		} finally {
			searching = false;
		}
	}

	// ---------- Favorites ----------
	const isFavorite = (t?: Track) => !!t && t.source === 'youtube' && favorites.some((f) => f.id === t.id);

	function toggleFavorite(t?: Track) {
		if (!t || t.source !== 'youtube') return;
		if (isFavorite(t)) favorites = favorites.filter((f) => f.id !== t.id);
		else favorites = [...favorites, { id: t.id, source: 'youtube', videoId: t.videoId, title: t.title, artist: t.artist, thumb: t.thumb }];
	}

	// ---------- Local files ----------
	const AUDIO_NAME = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|weba|webm)$/i;

	function addLocal(files: Iterable<File>) {
		const audio = [...files].filter((f) => f.type.startsWith('audio/') || AUDIO_NAME.test(f.name));
		if (audio.length === 0) return;

		const firstNew = localTracks.length;
		const added: Track[] = audio.map((f) => {
			const base = f.name.replace(/\.[^.]+$/, '');
			const parsed = parseTrack(base, '', 'Local file');
			return { id: `local:${nextLocalId++}`, source: 'local', title: parsed.title, artist: parsed.artist, url: URL.createObjectURL(f) };
		});
		localTracks = [...localTracks, ...added];
		tab = 'local';
		playFrom(localTracks, firstNew);
	}

	function onPick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		if (input.files) addLocal(input.files);
		input.value = '';
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files) addLocal(e.dataTransfer.files);
	}

	function onDragLeave(e: DragEvent) {
		if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) dragOver = false;
	}

	// ---------- Playback ----------
	function pauseYouTube() {
		try {
			ytPlayer?.pauseVideo();
		} catch {
			/* not ready */
		}
	}

	async function startCurrent() {
		const track = current;
		if (!track) return;
		notice = '';
		elapsed = 0;
		duration = 0;
		playing = false;

		if (track.source === 'youtube' && track.videoId) {
			audioEl?.pause();
			try {
				await loadYouTubeApi();
			} catch {
				notice = "Couldn't load the YouTube player.";
				return;
			}
			if (destroyed || current !== track || !ytHost || !window.YT) return;

			if (!ytPlayer) {
				ytPlayer = new window.YT.Player(ytHost, {
					host: 'https://www.youtube-nocookie.com',
					videoId: track.videoId,
					playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, playsinline: 1, rel: 0, iv_load_policy: 3 },
					events: {
						onReady: (e) => {
							ytReady = true;
							applyVolume();
							e.target.playVideo();
						},
						onStateChange: onYouTubeState,
						onError: onTrackError
					}
				});
			} else {
				ytPlayer.loadVideoById(track.videoId);
				applyVolume();
			}
		} else if (track.url && audioEl) {
			pauseYouTube();
			audioEl.src = track.url;
			applyVolume();
			try {
				await audioEl.play();
			} catch {
				notice = "Couldn't play that file.";
			}
		}
	}

	function onYouTubeState(e: { data: number }) {
		if (current?.source !== 'youtube') return;
		if (e.data === PlayerState.PLAYING) {
			playing = true;
			errorStreak = 0;
			duration = ytPlayer?.getDuration() || duration;
		} else if (e.data === PlayerState.PAUSED) {
			playing = false;
		} else if (e.data === PlayerState.ENDED) {
			playing = false;
			handleEnded();
		}
	}

	// A track that can't be played (embedding disabled, deleted...) is skipped
	function onTrackError() {
		playing = false;
		errorStreak++;
		if (errorStreak >= queue.length) {
			notice = "None of these tracks can be played.";
			return;
		}
		notice = "That one can't be played here. Skipping…";
		setTimeout(() => {
			if (!destroyed) advance();
		}, 1200);
	}

	function togglePlay() {
		if (!current) return;
		if (current.source === 'youtube') {
			if (!ytPlayer || !ytReady) return;
			if (playing) ytPlayer.pauseVideo();
			else ytPlayer.playVideo();
		} else if (audioEl) {
			if (playing) audioEl.pause();
			else audioEl.play().catch(() => {});
		}
	}

	function seek(seconds: number) {
		elapsed = seconds;
		if (current?.source === 'youtube') ytPlayer?.seekTo(seconds, true);
		else if (audioEl) audioEl.currentTime = seconds;
	}

	function playFrom(list: Track[], index: number) {
		queue = list.slice();
		order = makeOrder(queue.length, shuffle, index);
		pos = shuffle ? 0 : index;
		errorStreak = 0;
		pane = 'playing';
		startCurrent();
	}

	function handleEnded() {
		if (repeat === 'one') {
			seek(0);
			if (current?.source === 'youtube') ytPlayer?.playVideo();
			else audioEl?.play().catch(() => {});
			return;
		}
		advance(true);
	}

	function advance(auto = false) {
		if (pos < 0 || queue.length === 0) return;
		const next = nextPosition(pos, queue.length, repeat !== 'off');
		if (next === null) {
			// End of the queue: just stop
			if (auto) playing = false;
			else {
				seek(0);
			}
			return;
		}
		if (next === 0 && shuffle) {
			order = makeOrder(queue.length, true, Math.floor(Math.random() * queue.length));
		}
		pos = next;
		startCurrent();
	}

	function previous() {
		if (pos < 0) return;
		if (elapsed > 3) {
			seek(0);
			return;
		}
		pos = prevPosition(pos, queue.length, repeat !== 'off');
		startCurrent();
	}

	function toggleShuffle() {
		shuffle = !shuffle;
		if (pos < 0) return;
		const currentIndex = order[pos];
		order = makeOrder(queue.length, shuffle, currentIndex);
		pos = shuffle ? 0 : currentIndex;
	}

	function cycleRepeat() {
		repeat = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off';
	}

	// ---------- Local audio element events ----------
	const localOnly = (fn: () => void) => () => {
		if (current?.source === 'local') fn();
	};

	// ---------- Lifecycle ----------
	onMount(() => {
		// Keep the progress bar moving for the YouTube player
		poll = setInterval(() => {
			if (current?.source === 'youtube' && ytPlayer && ytReady) {
				try {
					elapsed = ytPlayer.getCurrentTime();
					duration = ytPlayer.getDuration() || duration;
				} catch {
					/* ignore */
				}
			}
		}, 500);
	});

	onDestroy(() => {
		destroyed = true;
		clearInterval(poll);
		try {
			ytPlayer?.destroy();
		} catch {
			/* ignore */
		}
		audioEl?.pause();
		localTracks.forEach((t) => t.url && URL.revokeObjectURL(t.url));
	});

	// Show the song in the title bar
	$effect(() => {
		win.setTitle(current ? `${current.title} · Music` : 'Music');
	});

	function onKeydown(e: KeyboardEvent) {
		if (!win.active || win.minimized || e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.key === 'Escape' && focus) {
			focus = false;
			return;
		}
		// Space plays/pauses, unless it would also press a focused control
		if (e.key === ' ' && !(e.target as HTMLElement | null)?.closest('input, textarea, select, button, a, [contenteditable]')) {
			e.preventDefault();
			togglePlay();
		}
	}

	// ---------- Icons ----------
	const ICONS: Record<string, string[]> = {
		play: ['M6 3l14 9-14 9z'],
		pause: ['M14 4h4v16h-4z', 'M6 4h4v16H6z'],
		prev: ['M19 20 9 12l10-8z', 'M5 19V5'],
		next: ['M5 4l10 8-10 8z', 'M19 5v14'],
		shuffle: [
			'm18 14 4 4-4 4', 'm18 2 4 4-4 4',
			'M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22',
			'M2 6h1.972a4 4 0 0 1 3.6 2.2', 'M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45'
		],
		repeat: ['m17 2 4 4-4 4', 'M3 11v-1a4 4 0 0 1 4-4h14', 'm7 22-4-4 4-4', 'M21 13v1a4 4 0 0 1-4 4H3'],
		repeat1: ['m17 2 4 4-4 4', 'M3 11v-1a4 4 0 0 1 4-4h14', 'm7 22-4-4 4-4', 'M21 13v1a4 4 0 0 1-4 4H3', 'M11 10h1v4'],
		heart: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'],
		'volume-low': ['M11 5 6 9H3v6h3l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7'],
		'volume-high': ['M11 5 6 9H3v6h3l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 5.5a9 9 0 0 1 0 13'],
		mute: ['M11 5 6 9H3v6h3l5 4z', 'm16 9 5 6', 'm21 9-5 6'],
		focus: ['M8 3H5a2 2 0 0 0-2 2v3', 'M21 8V5a2 2 0 0 0-2-2h-3', 'M3 16v3a2 2 0 0 0 2 2h3', 'M16 21h3a2 2 0 0 0 2-2v-3'],
		unfocus: ['M8 3v3a2 2 0 0 1-2 2H3', 'M21 8h-3a2 2 0 0 1-2-2V3', 'M3 16h3a2 2 0 0 1 2 2v3', 'M16 21v-3a2 2 0 0 1 2-2h3'],
		note: ['M9 18V5l12-2v13', 'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z', 'M21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
		plus: ['M5 12h14', 'M12 5v14']
	};

	const volumeIcon = $derived(volume === 0 ? 'mute' : volume < 50 ? 'volume-low' : 'volume-high');

	const tabBtn =
		'flex-1 cursor-pointer px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary aria-pressed:bg-primary aria-pressed:text-primary-content';
	const iconBtn =
		'grid size-9 shrink-0 cursor-pointer place-items-center rounded-full transition-colors hover:bg-base-content/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit aria-pressed:text-primary';
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet icon(name: string, className: string, filled = false)}
	<svg
		viewBox="0 0 24 24"
		class={className}
		fill={filled ? 'currentColor' : 'none'}
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#each ICONS[name] as d}
			<path {d} />
		{/each}
	</svg>
{/snippet}

{#snippet trackRow(track: Track, index: number, list: Track[])}
	{@const isCurrent = current?.id === track.id}
	<li>
		<div class="flex items-center gap-1 rounded-xl pr-1 transition-colors {isCurrent ? 'bg-primary/10' : 'hover:bg-base-content/5'}">
			<button
				type="button"
				onclick={() => playFrom(list, index)}
				class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl p-2 text-left focus-visible:outline-2 focus-visible:outline-primary"
			>
				<span class="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-base-content/10 text-base-content/50">
					{#if track.thumb}
						<img src={track.thumb} alt="" loading="lazy" class="size-full object-cover" />
					{:else}
						{@render icon('note', 'size-5')}
					{/if}
					{#if isCurrent && playing}
						<span class="absolute inset-0 grid place-items-center bg-black/55 text-white">
							{@render icon('play', 'size-4', true)}
						</span>
					{/if}
				</span>
				<span class="min-w-0">
					<span class="block truncate text-sm font-bold {isCurrent ? 'text-primary' : ''}">{track.title}</span>
					<span class="block truncate text-xs text-base-content/60">{track.artist}</span>
				</span>
			</button>
			{#if track.source === 'youtube'}
				<button
					type="button"
					class="{iconBtn} size-8"
					aria-label={isFavorite(track) ? `Remove ${track.title} from favorites` : `Add ${track.title} to favorites`}
					aria-pressed={isFavorite(track)}
					onclick={() => toggleFavorite(track)}
				>
					{@render icon('heart', 'size-4', isFavorite(track))}
				</button>
			{/if}
		</div>
	</li>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="@container relative h-full"
	ondragover={(e) => {
		e.preventDefault();
		dragOver = true;
	}}
	ondragleave={onDragLeave}
	ondrop={onDrop}
>
	<input bind:this={fileInput} type="file" accept="audio/*" multiple class="hidden" onchange={onPick} />

	<audio
		bind:this={audioEl}
		preload="none"
		onplay={localOnly(() => (playing = true))}
		onpause={localOnly(() => (playing = false))}
		onended={localOnly(() => {
			playing = false;
			handleEnded();
		})}
		ontimeupdate={localOnly(() => (elapsed = audioEl?.currentTime ?? 0))}
		onloadedmetadata={localOnly(() => (duration = audioEl?.duration ?? 0))}
		onerror={localOnly(onTrackError)}
	></audio>

	<div class="flex h-full flex-col">
		<!-- Narrow windows switch between the two halves -->
		{#if !focus}
			<div class="flex shrink-0 border-b border-base-content/15 @2xl:hidden" role="group" aria-label="View">
				<button type="button" class={tabBtn} aria-pressed={pane === 'library'} onclick={() => (pane = 'library')}>Library</button>
				<button type="button" class="{tabBtn} border-l border-base-content/15" aria-pressed={pane === 'playing'} onclick={() => (pane = 'playing')}>Now playing</button>
			</div>
		{/if}

		<div class="flex min-h-0 flex-1">
			<!-- ===== Library ===== -->
			<section class="min-h-0 min-w-0 flex-1 flex-col {pane === 'library' ? 'flex' : 'hidden'} @2xl:flex" aria-label="Library">
				<div class="flex shrink-0 overflow-hidden border-b border-base-content/15" role="group" aria-label="Library sections">
					<button type="button" class={tabBtn} aria-pressed={tab === 'search'} onclick={() => (tab = 'search')}>Search</button>
					<button type="button" class="{tabBtn} border-l border-base-content/15" aria-pressed={tab === 'favorites'} onclick={() => (tab = 'favorites')}>
						Favorites{favorites.length > 0 ? ` (${favorites.length})` : ''}
					</button>
					<button type="button" class="{tabBtn} border-l border-base-content/15" aria-pressed={tab === 'local'} onclick={() => (tab = 'local')}>Local</button>
				</div>

				{#if tab === 'search'}
					<form class="flex shrink-0 gap-2 p-2" onsubmit={search}>
						<input
							bind:value={query}
							type="text"
							placeholder="Search for music"
							aria-label="Search for music"
							autocomplete="off"
							spellcheck="false"
							class="min-w-0 flex-1 rounded-lg border border-base-content/20 bg-base-content/5 px-3 py-1.5 text-sm outline-none placeholder:text-base-content/40 focus:border-primary"
						/>
						<button
							type="submit"
							disabled={searching}
							class="shrink-0 cursor-pointer rounded-lg border-2 border-primary bg-primary px-3 py-1 text-sm font-bold text-primary-content transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
						>
							{searching ? '…' : 'Search'}
						</button>
					</form>
				{:else if tab === 'local'}
					<div class="shrink-0 p-2">
						<button
							type="button"
							onclick={() => fileInput?.click()}
							class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-base-content/25 px-3 py-2 text-sm transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
						>
							{@render icon('plus', 'size-4')}
							Add audio files
						</button>
					</div>
				{/if}

				<div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
					{#if tab === 'search' && searchError}
						<p role="alert" class="p-4 text-center text-sm text-error">{searchError}</p>
					{:else if tab === 'search' && searching}
						<p class="p-4 text-center text-sm text-base-content/60">Searching…</p>
					{:else if listed.length > 0}
						<ul>
							{#each listed as track, i (track.id)}
								{@render trackRow(track, i, listed)}
							{/each}
						</ul>
					{:else}
						<p class="p-6 text-center text-sm text-base-content/50">
							{#if tab === 'search'}
								{searched ? 'No music found. Try another search.' : 'Search for a song or an artist.'}
							{:else if tab === 'favorites'}
								No favorites yet. Tap the heart on a song to save it here.
							{:else}
								Add audio files from your computer, or drop them anywhere in this window. They stay on your computer and are forgotten when you close the app.
							{/if}
						</p>
					{/if}
				</div>
			</section>

			<!-- ===== Now playing (also the focus mode: it expands to cover the app and blurs what is behind it) ===== -->
			<section
				class="min-h-0 flex-col items-center overflow-y-auto border-base-content/15
					{focus
					? 'absolute inset-0 z-20 flex justify-center bg-base-100/50 backdrop-blur-2xl'
					: `flex-1 @2xl:w-84 @2xl:flex-none @2xl:border-l ${pane === 'playing' ? 'flex' : 'hidden'} @2xl:flex`}"
				aria-label="Now playing"
			>
				<div class="my-auto flex w-full max-w-sm flex-col items-center gap-3 p-5">
					<!-- Spinning disc: the YouTube video lives inside it -->
					<div
						class="disc rounded-full border-2 border-base-content/20 bg-base-100/60 p-3"
						style:animation-play-state={playing ? 'running' : 'paused'}
					>
						<div class="relative overflow-hidden rounded-full bg-base-300" style:width="{discSize}px" style:height="{discSize}px">
							<div class="yt-wrap absolute inset-0 {current?.source === 'youtube' ? '' : 'hidden'}">
								<div bind:this={ytHost}></div>
							</div>
							{#if current?.source !== 'youtube'}
								<span class="absolute inset-0 grid place-items-center text-base-content/30">
									{@render icon('note', 'size-16')}
								</span>
							{/if}
						</div>
					</div>

					<!-- Title and singer -->
					<div class="w-full text-center">
						<p class="truncate font-bold {focus ? 'text-2xl' : 'text-lg'}">{current?.title ?? 'Nothing playing'}</p>
						<p class="truncate text-sm text-base-content/60">{current?.artist ?? 'Search for a song or add a file'}</p>
						{#if notice}
							<p role="status" class="mt-1 text-xs text-warning">{notice}</p>
						{/if}
					</div>

					<!-- Progress -->
					<div class="flex w-full items-center gap-2 text-xs text-base-content/60 tabular-nums">
						<span class="w-9 text-right">{clock(shownTime)}</span>
						<input
							type="range"
							min="0"
							max={Math.max(duration, 1)}
							step="1"
							value={shownTime}
							disabled={!current || duration === 0}
							oninput={(e) => {
								scrubbing = true;
								scrubValue = Number(e.currentTarget.value);
							}}
							onchange={(e) => {
								seek(Number(e.currentTarget.value));
								scrubbing = false;
							}}
							aria-label="Seek"
							class="min-w-0 flex-1 cursor-pointer accent-primary disabled:cursor-default"
						/>
						<span class="w-9">{clock(duration)}</span>
					</div>

					<!-- Main controls -->
					<div class="flex items-center gap-1">
						{#if !focus}
							<button type="button" class={iconBtn} aria-label="Shuffle" aria-pressed={shuffle} onclick={toggleShuffle}>
								{@render icon('shuffle', 'size-4')}
							</button>
						{/if}
						<button type="button" class={iconBtn} aria-label="Previous" disabled={!current} onclick={previous}>
							{@render icon('prev', 'size-5', true)}
						</button>
						<button
							type="button"
							class="grid size-14 cursor-pointer place-items-center rounded-full bg-primary text-primary-content transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-40"
							aria-label={playing ? 'Pause' : 'Play'}
							disabled={!current}
							onclick={togglePlay}
						>
							{@render icon(playing ? 'pause' : 'play', 'size-6', true)}
						</button>
						<button type="button" class={iconBtn} aria-label="Next" disabled={!current} onclick={() => advance()}>
							{@render icon('next', 'size-5', true)}
						</button>
						{#if !focus}
							<button
								type="button"
								class={iconBtn}
								aria-label={repeat === 'off' ? 'Repeat: off' : repeat === 'all' ? 'Repeat: all' : 'Repeat: one'}
								aria-pressed={repeat !== 'off'}
								onclick={cycleRepeat}
							>
								{@render icon(repeat === 'one' ? 'repeat1' : 'repeat', 'size-4')}
							</button>
						{/if}
					</div>

					<!-- Favorite, volume, focus -->
					<div class="flex w-full items-center justify-between gap-2">
						<button
							type="button"
							class={iconBtn}
							aria-label={isFavorite(current) ? 'Remove from favorites' : 'Add to favorites'}
							aria-pressed={isFavorite(current)}
							disabled={!current || current.source !== 'youtube'}
							title={current?.source === 'local' ? "Local files can't be saved to favorites" : undefined}
							onclick={() => toggleFavorite(current)}
						>
							{@render icon('heart', 'size-5', isFavorite(current))}
						</button>

						{#if !focus}
							<div class="flex min-w-0 flex-1 items-center gap-1">
								<button type="button" class="{iconBtn} size-8" aria-label={volume === 0 ? 'Unmute' : 'Mute'} onclick={toggleVolumeMute}>
									{@render icon(volumeIcon, 'size-4')}
								</button>
								<input
									type="range"
									min="0"
									max="100"
									step="1"
									value={volume}
									oninput={(e) => (volume = Number(e.currentTarget.value))}
									aria-label="Player volume"
									class="h-1 min-w-0 flex-1 cursor-pointer accent-primary"
								/>
							</div>
						{/if}

						<button
							type="button"
							class={iconBtn}
							aria-label={focus ? 'Exit focus mode' : 'Focus mode'}
							title={focus ? 'Exit focus mode (Esc)' : 'Focus mode'}
							disabled={!current && !focus}
							onclick={() => (focus = !focus)}
						>
							{@render icon(focus ? 'unfocus' : 'focus', 'size-5')}
						</button>
					</div>

					{#if !focus && sound.level === 0}
						<p class="text-xs text-warning">The system volume is muted.</p>
					{/if}
				</div>
			</section>
		</div>
	</div>

	{#if dragOver}
		<div class="pointer-events-none absolute inset-2 z-30 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-primary/10 text-sm font-bold text-primary">
			Drop audio files to play them
		</div>
	{/if}
</div>

<style>
	.disc {
		animation: disc-spin 12s linear infinite;
	}
	@keyframes disc-spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.disc {
			animation: none;
		}
	}

	/* The 16:9 video fills the round disc, cropped from the sides. Clicks pass through to our own controls. */
	.yt-wrap :global(iframe) {
		position: absolute;
		top: 0;
		left: 50%;
		height: 100%;
		width: 177.78%;
		max-width: none;
		transform: translateX(-50%);
		border: 0;
		pointer-events: none;
	}
</style>