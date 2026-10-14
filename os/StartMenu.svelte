<!-- src/routes/projects/hsojOS/os/StartMenu.svelte -->
<!-- Renders the Start button AND its popup, so the page only needs <StartMenu /> -->
<script lang="ts">
	import { tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import { APPS, type AppSettings } from './apps';
	import { CONFIG } from './config';
	import { shell } from './shell.svelte';
	import { sys } from './system.svelte';
	import { wm } from './windows.svelte';

	const SORTED = [...APPS].sort((a, b) => a.title.localeCompare(b.title));

	let open = $state(false);
	let powerOpen = $state(false);
	let query = $state('');
	let selected = $state(0);

	let root: HTMLElement | undefined = $state();
	let startButton: HTMLButtonElement | undefined = $state();
	let search: HTMLInputElement | undefined = $state();
	let list: HTMLElement | undefined = $state();

	let results = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return SORTED;
		return SORTED.filter(
			(a) => a.title.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)
		);
	});

	// Going to sleep, locking, etc. closes the menu
	$effect(() => {
		if (sys.mode !== 'active') close();
	});

	async function toggle() {
		if (open) {
			close();
			return;
		}
		query = '';
		selected = 0;
		powerOpen = false;
		open = true;
		await tick();
		search?.focus();
	}

	function close() {
		open = false;
		powerOpen = false;
	}

	function launch(app: AppSettings) {
		shell.launchpadOpen = false;
		wm.open(app.id);
		close();
	}

	function power(action: () => void) {
		close();
		action();
	}

	async function move(delta: number) {
		if (results.length === 0) return;
		selected = (selected + delta + results.length) % results.length;
		await tick();
		list?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' });
	}

	function onSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			move(1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			move(-1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const app = results[selected];
			if (app) launch(app);
		}
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (!open || e.key !== 'Escape') return;
		if (powerOpen) {
			powerOpen = false;
			return;
		}
		close();
		startButton?.focus();
	}

	function onWindowPointerDown(e: PointerEvent) {
		if (open && root && !root.contains(e.target as Node)) close();
	}

	function onPanelPointerDown(e: PointerEvent) {
		if (powerOpen && !(e.target as HTMLElement).closest('[data-power]')) powerOpen = false;
	}
</script>

<svelte:window onkeydown={onWindowKeydown} onpointerdown={onWindowPointerDown} onblur={close} />

<div bind:this={root} class="relative justify-self-start">
	{#if open}
		<div
			role="dialog"
			aria-label="Start menu"
			tabindex="-1"
			class="absolute bottom-full left-0 z-50 mb-3 flex w-80 max-w-[calc(100vw-1.5rem)] flex-col rounded-2xl border-2 border-base-content/15 bg-base-100/90 shadow-2xl shadow-black/40 outline-none backdrop-blur-xl"
			onpointerdown={onPanelPointerDown}
			transition:fly={{ y: 10, duration: 140 }}
		>
			<!-- Search -->
			<div class="p-3 pb-2">
				<label
					class="flex items-center gap-2 rounded-xl border border-base-content/20 bg-base-content/5 px-3 py-2 focus-within:border-primary"
				>
					<svg
						viewBox="0 0 24 24"
						class="size-4 shrink-0 text-base-content/50"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						aria-hidden="true"
					>
						<circle cx="11" cy="11" r="6" />
						<path d="m20 20-4-4" />
					</svg>
					<input
						bind:this={search}
						bind:value={query}
						oninput={() => (selected = 0)}
						onkeydown={onSearchKeydown}
						type="text"
						placeholder="Search apps"
						aria-label="Search apps"
						autocomplete="off"
						spellcheck="false"
						class="w-full bg-transparent text-sm outline-none placeholder:text-base-content/40"
					/>
				</label>
			</div>

			<!-- App list -->
			<p class="px-4 pb-1 text-xs text-base-content/50">Apps</p>
			<ul
				bind:this={list}
				class="max-h-72 overflow-y-auto px-2 pb-2"
				style="scrollbar-width: thin; scrollbar-color: color-mix(in oklab, var(--color-base-content) 40%, transparent) transparent;"
			>
				{#each results as app, i (app.id)}
					<li>
						<button
							type="button"
							data-selected={i === selected}
							onclick={() => launch(app)}
							onpointerenter={() => (selected = i)}
							class="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors data-[selected=true]:bg-primary data-[selected=true]:text-primary-content"
						>
							<span
								aria-hidden="true"
								class="grid size-9 shrink-0 place-items-center rounded-lg border border-current/25"
							>
								{app.glyph}
							</span>
							<span class="min-w-0">
								<span class="block truncate text-sm font-bold">{app.title}</span>
								{#if app.description}
									<span class="block truncate text-xs opacity-60">{app.description}</span>
								{/if}
							</span>
						</button>
					</li>
				{:else}
					<li class="px-3 py-6 text-center text-sm text-base-content/50">
						No apps match "{query}"
					</li>
				{/each}
			</ul>

			<!-- User + power -->
			<div class="relative flex items-center justify-between border-t border-base-content/15 px-3 py-2">
				<div class="flex items-center gap-2 text-sm">
					<span
						aria-hidden="true"
						class="grid size-7 place-items-center rounded-full border-2 border-primary text-xs font-bold text-primary"
					>
						{CONFIG.userName.charAt(0).toUpperCase()}
					</span>
					<span class="font-bold">{CONFIG.userName}</span>
				</div>

				<button
					type="button"
					data-power
					aria-label="Power"
					aria-expanded={powerOpen}
					aria-haspopup="menu"
					onclick={() => (powerOpen = !powerOpen)}
					class="grid size-8 cursor-pointer place-items-center rounded-lg transition-colors hover:bg-base-content/10 aria-expanded:bg-base-content/10 focus-visible:outline-2 focus-visible:outline-primary"
				>
					<svg
						viewBox="0 0 24 24"
						class="size-4"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						aria-hidden="true"
					>
						<path d="M12 3v9" />
						<path d="M6.3 6.8a8 8 0 1 0 11.4 0" />
					</svg>
				</button>

				{#if powerOpen}
					<div
						data-power
						role="menu"
						aria-label="Power options"
						class="absolute right-3 bottom-full mb-2 flex w-36 flex-col rounded-xl border-2 border-base-content/15 bg-base-100 p-1 shadow-xl shadow-black/30"
						transition:fly={{ y: 6, duration: 110 }}
					>
						<button
							type="button"
							role="menuitem"
							onclick={() => power(() => sys.sleep())}
							class="cursor-pointer rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-primary hover:text-primary-content focus-visible:bg-primary focus-visible:text-primary-content focus-visible:outline-none"
						>
							Sleep
						</button>
						<button
							type="button"
							role="menuitem"
							onclick={() => power(() => sys.restart())}
							class="cursor-pointer rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-primary hover:text-primary-content focus-visible:bg-primary focus-visible:text-primary-content focus-visible:outline-none"
						>
							Restart
						</button>
						<button
							type="button"
							role="menuitem"
							onclick={() => power(() => sys.shutDown())}
							class="cursor-pointer rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-error hover:text-error-content focus-visible:bg-error focus-visible:text-error-content focus-visible:outline-none"
						>
							Shut down
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<button
		bind:this={startButton}
		type="button"
		aria-expanded={open}
		aria-haspopup="dialog"
		onclick={toggle}
		class="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-primary bg-primary px-3 py-1.5 text-sm font-bold text-primary-content transition-all hover:-translate-y-0.5 aria-expanded:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
	>
		<span aria-hidden="true">◆</span>
		Start
	</button>
</div>