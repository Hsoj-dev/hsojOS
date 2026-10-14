<!-- src/routes/projects/hsojOS/os/apps/Camera.svelte -->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { getWindowContext } from '../context';

	const win = getWindowContext();

	type Status = 'starting' | 'live' | 'denied' | 'unavailable';

	let status = $state<Status>('starting');
	let photoUrl = $state<string | null>(null);
	let photoName = $state('photo.png');
	let flash = $state(false);
	let video: HTMLVideoElement | undefined = $state();

	let stream: MediaStream | null = null;
	let token = 0; // lets a stale start() notice it was cancelled

	async function start() {
		const mine = ++token;
		status = 'starting';

		if (!navigator.mediaDevices?.getUserMedia) {
			status = 'unavailable'; // needs https or localhost
			return;
		}
		try {
			const s = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'user' },
				audio: false
			});
			if (mine !== token) {
				s.getTracks().forEach((t) => t.stop());
				return;
			}
			stream = s;
			if (video) {
				video.srcObject = s;
				await video.play().catch(() => {});
			}
			status = 'live';
		} catch (e) {
			if (mine !== token) return;
			const blocked = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
			status = blocked ? 'denied' : 'unavailable';
		}
	}

	function stop() {
		token++;
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
		if (video) video.srcObject = null;
	}

	// The camera runs only while the window is visible, so the camera light
	// goes off when you minimize or close it.
	$effect(() => {
		if (win.minimized) return;
		start();
		return () => stop();
	});

	function capture() {
		if (!video || status !== 'live' || !video.videoWidth) return;

		const canvas = document.createElement('canvas');
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		// Mirrored, so the photo matches the preview
		ctx.translate(canvas.width, 0);
		ctx.scale(-1, 1);
		ctx.drawImage(video, 0, 0);

		canvas.toBlob((blob) => {
			if (!blob) return;
			if (photoUrl) URL.revokeObjectURL(photoUrl);
			photoUrl = URL.createObjectURL(blob);
			photoName = `hsojos-photo-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
		}, 'image/png');

		flash = true;
		setTimeout(() => (flash = false), 120);
	}

	function retake() {
		if (photoUrl) URL.revokeObjectURL(photoUrl);
		photoUrl = null;
	}

	onDestroy(() => {
		if (photoUrl) URL.revokeObjectURL(photoUrl);
	});

	const textBtn =
		'cursor-pointer rounded-xl border-2 px-4 py-1.5 text-sm font-bold transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
</script>

<div class="relative size-full overflow-hidden bg-black text-white">
	<!-- Live preview (mirrored like a selfie camera) -->
	<video
		bind:this={video}
		playsinline
		muted
		autoplay
		class="size-full object-contain"
		style="transform: scaleX(-1);"
		aria-label="Camera preview"
	></video>

	{#if photoUrl}
		<img src={photoUrl} alt="Captured frame" class="absolute inset-0 size-full bg-black object-contain" />
		<div class="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3">
			<button type="button" onclick={retake} class="{textBtn} border-white/60 bg-black/50 backdrop-blur-sm hover:bg-white hover:text-black">
				Retake
			</button>
			<a
				href={photoUrl}
				download={photoName}
				class="{textBtn} border-primary bg-primary text-primary-content"
			>
				Save
			</a>
		</div>
	{:else if status === 'live'}
		<button
			type="button"
			onclick={capture}
			aria-label="Take picture"
			title="Take picture"
			class="absolute bottom-4 left-1/2 size-14 -translate-x-1/2 cursor-pointer rounded-full border-4 border-white bg-white/20 backdrop-blur-sm transition-all hover:bg-white/50 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
		></button>
	{/if}

	{#if status !== 'live'}
		<div class="absolute inset-0 grid place-items-center bg-black p-6 text-center">
			{#if status === 'starting'}
				<p class="text-sm text-white/70">Starting camera…</p>
			{:else if status === 'denied'}
				<div class="max-w-xs space-y-3">
					<p class="font-bold">Camera access is blocked</p>
					<p class="text-sm text-white/70">
						Allow the camera for this site in your browser's site settings, then try again.
					</p>
					<button type="button" onclick={start} class="{textBtn} border-primary bg-primary text-primary-content">
						Try again
					</button>
				</div>
			{:else}
				<div class="max-w-xs space-y-2">
					<p class="font-bold">No camera available</p>
					<p class="text-sm text-white/70">
						No camera was found, or this page isn't using https (browsers only allow cameras on secure pages).
					</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Shutter flash -->
	<div
		class="pointer-events-none absolute inset-0 bg-white transition-opacity duration-300 {flash ? 'opacity-80' : 'opacity-0'}"
		aria-hidden="true"
	></div>
</div>