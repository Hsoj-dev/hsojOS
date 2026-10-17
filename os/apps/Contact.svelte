<!-- src/routes/projects/hsojOS/os/apps/Contact.svelte -->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { CONFIG } from '../config';
	import { getWindowContext } from '../context';
	import { sound } from '../sound.svelte';

	const win = getWindowContext();

	type Phase = 'ready' | 'calling' | 'voicemail' | 'ended';
	const RING_MS = 3600;

	let phase = $state<Phase>('ready');
	let elapsed = $state(0);
	let duration = $state(0);
	let needsTap = $state(false); // the browser blocked autoplay, so ask for a tap
	let failed = $state(false); // the recording couldn't be loaded
	let audio: HTMLAudioElement | undefined = $state();

	let ringTimer: ReturnType<typeof setTimeout> | undefined;

	let progress = $derived(duration > 0 ? Math.min(elapsed / duration, 1) : 0);

	// The voicemail follows the system volume slider
	$effect(() => {
		if (audio) audio.volume = sound.level;
	});

	const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

	function call() {
		sound.prime(); // we're inside a click, so sounds are allowed from here on
		failed = false;
		needsTap = false;
		elapsed = 0;
		phase = 'calling';

		// Two rings of a classic ringback tone
		for (const delay of [0, 1.8]) {
			sound.tone(440, delay, 1.2, 0.14, true);
			sound.tone(480, delay, 1.2, 0.14, true);
		}

		audio?.load(); // start fetching the recording while it "rings"
		ringTimer = setTimeout(pickUp, RING_MS);
	}

	function pickUp() {
		if (failed) return finish();
		phase = 'voicemail';
		play();
	}

	function play() {
		if (!audio) return;
		needsTap = false;
		audio.currentTime = 0;
		audio.volume = sound.level;
		audio.play().catch(() => {
			needsTap = true;
		});
	}

	function hangUp() {
		clearTimeout(ringTimer);
		audio?.pause();
		finish();
	}

	function finish() {
		clearTimeout(ringTimer);
		phase = 'ended';
	}

	function unmute() {
		if (sound.muted) sound.toggleMute();
		else if (sound.volume === 0) sound.setVolume(50);
	}

	onDestroy(() => {
		clearTimeout(ringTimer);
		audio?.pause();
	});

	const roundBtn =
		'grid size-16 cursor-pointer place-items-center rounded-full transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';
	const PHONE =
		'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z';
</script>

<!-- The recording. preload="none" so nothing downloads until someone calls. -->
<audio
	bind:this={audio}
	src={CONFIG.voicemailUrl}
	preload="none"
	onloadedmetadata={() => (duration = audio?.duration ?? 0)}
	ontimeupdate={() => (elapsed = audio?.currentTime ?? 0)}
	onended={finish}
	onerror={() => {
		failed = true;
		console.warn(`Contact: couldn't load the voicemail at ${CONFIG.voicemailUrl}`);
		if (phase === 'voicemail') finish(); // otherwise pickUp() notices
	}}
></audio>

<div class="flex h-full flex-col items-center justify-between bg-base-300/60 px-6 py-8 text-center">
	<!-- Status -->
	<p class="text-sm text-base-content/60" aria-live="polite">
		{#if phase === 'ready'}
			Ready to call
		{:else if phase === 'calling'}
			Calling…
		{:else if phase === 'voicemail'}
			Voicemail · {clock(elapsed)}
		{:else}
			Call ended
		{/if}
	</p>

	<!-- Who -->
	<div class="flex flex-col items-center gap-4">
		<div class="relative grid size-28 place-items-center">
			{#if phase === 'calling'}
				<span class="absolute inset-0 rounded-full border-2 border-primary motion-safe:animate-ping" aria-hidden="true"></span>
			{/if}
			<span class="relative grid size-28 place-items-center rounded-full border-2 border-primary bg-base-100 text-4xl font-bold text-primary">
				{CONFIG.userName.charAt(0).toUpperCase()}
			</span>
		</div>
		<div>
			<h1 class="text-2xl font-bold">{CONFIG.userName}</h1>
			<p class="text-sm text-base-content/60">mobile</p>
		</div>

		{#if phase === 'voicemail'}
			<!-- Sound bars and progress while the message plays -->
			<div class="flex h-8 items-center gap-1" aria-hidden="true">
				{#each [0, 1, 2, 3, 4, 5, 6] as i}
					<span
						class="h-6 w-1 rounded-full bg-primary motion-safe:animate-pulse"
						style:animation-delay="{i * 120}ms"
						style:animation-duration="900ms"
					></span>
				{/each}
			</div>
			<div class="h-1 w-48 overflow-hidden rounded-full bg-base-content/15" aria-hidden="true">
				<div class="h-full bg-primary transition-[width] duration-200" style:width="{progress * 100}%"></div>
			</div>

			{#if needsTap}
				<button type="button" onclick={play} class="cursor-pointer rounded-xl border-2 border-primary bg-primary px-4 py-1.5 text-sm font-bold text-primary-content">
					Play voicemail
				</button>
			{/if}
			{#if sound.level === 0}
				<p class="text-xs text-warning">
					Your volume is muted.
					<button type="button" onclick={unmute} class="cursor-pointer underline hover:no-underline">Turn it on</button>
				</p>
			{/if}
		{/if}
	</div>

	<!-- Controls -->
	<div class="flex w-full flex-col items-center gap-4">
		{#if phase === 'ready'}
			<button type="button" onclick={call} class="{roundBtn} bg-success text-success-content" aria-label="Call me">
				<svg viewBox="0 0 24 24" class="size-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d={PHONE} />
				</svg>
			</button>
			<p class="text-sm font-bold">Call me</p>
		{:else if phase === 'calling' || phase === 'voicemail'}
			<button type="button" onclick={hangUp} class="{roundBtn} bg-error text-error-content" aria-label="Hang up">
				<svg viewBox="0 0 24 24" class="size-7 rotate-[135deg]" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d={PHONE} />
				</svg>
			</button>
			<p class="text-sm font-bold">Hang up</p>
		{:else}
			<div class="w-full max-w-xs space-y-3 rounded-2xl border-2 border-primary/40 bg-primary/5 p-4">
				{#if failed}
					<p class="text-sm text-base-content/70">The voicemail isn't available right now.</p>
				{/if}
				<p class="text-sm font-bold">Can't talk right now?</p>
				<p class="text-sm text-base-content/70">Leave a message in the guestbook instead.</p>
				<button
					type="button"
					onclick={() => win.open('guestbook')}
					class="w-full cursor-pointer rounded-xl border-2 border-primary bg-primary px-4 py-2 text-sm font-bold text-primary-content transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
				>
					Open Messenger (Guestbook)
				</button>
			</div>
			<button type="button" onclick={call} class="cursor-pointer text-sm text-base-content/60 underline hover:text-primary hover:no-underline">
				Call again
			</button>
		{/if}

		<p class="text-xs text-base-content/40">Why is there a phone call app in here? idk either</p>
	</div>
</div>