<!-- src\routes\projects\hsojOS\os\LockScreen.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { CONFIG } from './config';
	import { sys } from './system.svelte';

	let now = $state(new Date());
	let value = $state('');
	let failed = $state(false);
	let input: HTMLInputElement | undefined = $state();
	let shaker: HTMLElement | undefined = $state();

	const pad = (n: number) => String(n).padStart(2, '0');

	let hh = $derived(String(now.getHours() % 12 || 12));
	let mm = $derived(pad(now.getMinutes()));
	let meridiem = $derived(now.getHours() < 12 ? 'AM' : 'PM');
	let date = $derived(
		now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' })
	);

	onMount(() => {
		input?.focus();
		const t = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(t);
	});

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (sys.unlock(value)) return;

		failed = true;
		value = '';
		input?.focus();
		if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
			shaker?.animate(
				[
					{ transform: 'translateX(0)' },
					{ transform: 'translateX(-8px)' },
					{ transform: 'translateX(8px)' },
					{ transform: 'translateX(-4px)' },
					{ transform: 'translateX(0)' }
				],
				{ duration: 280 }
			);
		}
	}
</script>

<div
	role="dialog"
	aria-modal="true"
	aria-label="Lock screen"
	class="fixed inset-0 z-[9999] grid place-items-center bg-base-300/90 text-base-content backdrop-blur-2xl"
	style="background-image: radial-gradient(color-mix(in oklab, var(--color-base-content) 14%, transparent) 1px, transparent 1px); background-size: 24px 24px;"
	transition:fade|global={{ duration: 200 }}
>
	<div class="pointer-events-none absolute size-80 rounded-full bg-primary/15 blur-3xl sm:size-125"></div>

	<div class="relative flex flex-col items-center gap-10 px-4">
		<div class="text-center">
			<p class="flex items-baseline justify-center text-7xl font-bold tracking-tighter tabular-nums sm:text-8xl">
				{hh}<span class="mx-1 text-primary">:</span>{mm}
				<span class="ml-3 text-xl font-normal tracking-normal text-base-content/50 sm:text-2xl">
					{meridiem}
				</span>
			</p>
			<p class="mt-2 text-lg text-base-content/60">{date}</p>
		</div>

		<form class="flex w-72 flex-col items-center gap-3" onsubmit={submit}>
			<div
				aria-hidden="true"
				class="grid size-16 place-items-center rounded-full border-2 border-primary text-2xl font-bold text-primary"
			>
				{CONFIG.userName.charAt(0).toUpperCase()}
			</div>
			<p class="font-bold">{CONFIG.userName}</p>

			<div bind:this={shaker} class="flex w-full items-center gap-2">
				<input
					bind:this={input}
					bind:value
					oninput={() => (failed = false)}
					type="password"
					placeholder="Password"
					aria-label="Password"
					autocomplete="off"
					class="w-full rounded-xl border-2 border-base-content/20 bg-base-100/80 px-3 py-2 text-sm outline-none placeholder:text-base-content/40 focus:border-primary"
				/>
				<button
					type="submit"
					aria-label="Unlock"
					class="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl border-2 border-primary bg-primary text-primary-content transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
				>
					→
				</button>
			</div>

			<p role="alert" class="h-5 text-sm text-error">{failed ? 'Incorrect password' : ''}</p>
		</form>
	</div>
</div>