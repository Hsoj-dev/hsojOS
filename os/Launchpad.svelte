<!-- src\routes\projects\hsojOS\os\Launchpad.svelte -->
<script lang="ts">
	import { tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { APPS, type AppSettings } from './apps';
	import { shell } from './shell.svelte';
	import { sys } from './system.svelte';
	import { wm } from './windows.svelte';

	/** 4 columns x 3 rows. More apps than this adds pages automatically. */
	const PER_PAGE = 12;
	const SWIPE_PX = 50;

	const SORTED = [...APPS].sort((a, b) => a.title.localeCompare(b.title));
	const pages: AppSettings[][] = Array.from({ length: Math.ceil(SORTED.length / PER_PAGE) }, (_, i) =>
		SORTED.slice(i * PER_PAGE, (i + 1) * PER_PAGE)
	);

	let page = $state(0);
	let root: HTMLElement | undefined = $state();
	let wheelLocked = false;
	let touchStartX = 0;

	$effect(() => {
		if (shell.launchpadOpen) {
			page = 0;
			tick().then(() => root?.querySelector<HTMLButtonElement>('[data-app]')?.focus());
		}
	});

	$effect(() => {
		if (sys.mode !== 'active') shell.launchpadOpen = false;
	});

	function go(delta: number) {
		page = Math.min(pages.length - 1, Math.max(0, page + delta));
	}

	function close() {
		shell.launchpadOpen = false;
	}

	function launch(app: AppSettings) {
		wm.open(app.id);
		close();
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (!shell.launchpadOpen) return;
		if (e.key === 'Escape') close();
		else if (e.key === 'ArrowRight') go(1);
		else if (e.key === 'ArrowLeft') go(-1);
	}

	// Clicking empty space (anything that isn't an app) closes it
	function onBackgroundClick(e: MouseEvent) {
		if (!(e.target as HTMLElement).closest('button')) close();
	}

	function onWheel(e: WheelEvent) {
		if (pages.length < 2 || wheelLocked) return;
		const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
		if (Math.abs(d) < 20) return;
		go(d > 0 ? 1 : -1);
		wheelLocked = true;
		setTimeout(() => (wheelLocked = false), 450);
	}

	function onTouchEnd(e: TouchEvent) {
		const dx = e.changedTouches[0].clientX - touchStartX;
		if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? 1 : -1);
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if shell.launchpadOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={root}
		role="dialog"
		aria-label="Launchpad"
		tabindex="-1"
		class="absolute inset-0 z-[9999] flex flex-col items-center justify-center gap-8 overflow-hidden bg-base-300/70 px-4 py-6 outline-none backdrop-blur-xl"
		onclick={onBackgroundClick}
		onwheel={onWheel}
		ontouchstart={(e) => (touchStartX = e.touches[0].clientX)}
		ontouchend={onTouchEnd}
		transition:fade={{ duration: 150 }}
	>
		<div class="min-h-0 w-full max-w-3xl overflow-x-hidden overflow-y-auto">
			<div
				class="flex transition-transform duration-300 ease-out motion-reduce:transition-none"
				style:transform="translateX(-{page * 100}%)"
			>
				{#each pages as items, i}
					<ul
						class="grid w-full shrink-0 grid-cols-4 content-start gap-x-3 gap-y-6 sm:gap-x-8 sm:gap-y-8"
						inert={i !== page}
					>
						{#each items as app (app.id)}
							<li class="flex justify-center">
								<button
									type="button"
									data-app
									onclick={() => launch(app)}
									class="group flex w-full max-w-28 cursor-pointer flex-col items-center gap-2 rounded-2xl p-2 focus-visible:outline-none"
								>
									<span
										aria-hidden="true"
										class="grid size-16 place-items-center rounded-2xl border-2 border-base-content/20 bg-base-100/80 text-3xl transition-all group-hover:-translate-y-1 group-hover:border-primary group-hover:text-primary group-focus-visible:-translate-y-1 group-focus-visible:border-primary group-focus-visible:text-primary sm:size-20"
									>
										{app.glyph}
									</span>
									<span class="w-full truncate text-center text-sm">{app.title}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/each}
			</div>
		</div>

		{#if pages.length > 1}
			<nav class="flex items-center gap-2" aria-label="Launchpad pages">
				{#each pages as _, i}
					<button
						type="button"
						aria-label="Page {i + 1}"
						aria-current={i === page ? 'page' : undefined}
						onclick={() => (page = i)}
						class="h-2.5 cursor-pointer rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
							{i === page ? 'w-6 bg-primary' : 'w-2.5 bg-base-content/30 hover:bg-base-content/50'}"
					></button>
				{/each}
			</nav>
		{/if}
	</div>
{/if}