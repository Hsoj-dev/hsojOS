<!-- src/routes/projects/hsojOS/os/apps/Browser.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { CONFIG } from '../config';

	// ---------- Navigation ----------
	// Cross-origin iframes hide their URL, so the address bar can't follow links clicked
	// inside a page. Back/forward walk through the URLs entered here (or searched).
	// '' is the homepage.
	let stack = $state<string[]>(['']);
	let index = $state(0);
	let address = $state('');
	let homeQuery = $state('');
	let loading = $state(false);
	let nonce = $state(0); // bumping this remounts the iframe (reload)

	let homeInput: HTMLInputElement | undefined = $state();

	let current = $derived(stack[index]);
	let canBack = $derived(index > 0);
	let canForward = $derived(index < stack.length - 1);

	$effect(() => {
		address = current;
	});
	$effect(() => {
		void nonce;
		loading = current !== '';
	});

	onMount(() => homeInput?.focus());

	/** Turn whatever was typed into a URL: real URL, bare domain, or a search */
	function resolve(input: string): string {
		const text = input.trim();
		if (/^https?:\/\//i.test(text)) return text;
		if (!/\s/.test(text) && /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(text)) return `https://${text}`;
		return CONFIG.browser.searchUrl.replace('%s', encodeURIComponent(text));
	}

	function go(url: string) {
		stack = [...stack.slice(0, index + 1), url];
		index = stack.length - 1;
	}

	function submit(value: string) {
		const text = value.trim();
		if (text) go(resolve(text));
	}

	const back = () => canBack && index--;
	const forward = () => canForward && index++;
	const reload = () => current && nonce++;
	const home = () => current !== '' && go('');
	const openExternal = () => current && window.open(current, '_blank', 'noopener,noreferrer');

	const toolBtn =
		'grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg transition-colors hover:bg-base-content/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit';
</script>

{#snippet iconButton(label: string, paths: string[], disabled: boolean, onclick: () => void)}
	<button type="button" class={toolBtn} aria-label={label} title={label} {disabled} {onclick}>
		<svg
			viewBox="0 0 24 24"
			class="size-4"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			{#each paths as d}
				<path {d} />
			{/each}
		</svg>
	</button>
{/snippet}

<div class="flex h-full flex-col">
	<!-- URL bar -->
	<form
		class="flex shrink-0 items-center gap-1 border-b border-base-content/15 p-1.5"
		onsubmit={(e) => {
			e.preventDefault();
			submit(address);
		}}
	>
		{@render iconButton('Back', ['m12 19-7-7 7-7', 'M19 12H5'], !canBack, back)}
		{@render iconButton('Forward', ['M5 12h14', 'm12 5 7 7-7 7'], !canForward, forward)}
		{@render iconButton(
			'Reload',
			['M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8', 'M21 3v5h-5'],
			current === '',
			reload
		)}
		{@render iconButton(
			'Home',
			[
				'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8',
				'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'
			],
			current === '',
			home
		)}

		<input
			bind:value={address}
			onfocus={(e) => e.currentTarget.select()}
			type="text"
			aria-label="Address"
			placeholder="Search {CONFIG.browser.searchName} or enter a URL"
			autocomplete="off"
			spellcheck="false"
			class="min-w-0 flex-1 rounded-lg border border-base-content/20 bg-base-content/5 px-3 py-1 text-sm outline-none placeholder:text-base-content/40 focus:border-primary"
		/>

		{@render iconButton(
			'Open in a new tab',
			['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
			current === '',
			openExternal
		)}
	</form>

	<!-- Page -->
	<div class="relative min-h-0 flex-1">
		{#if current === ''}
			<div class="grid h-full place-items-center overflow-auto p-6">
				<div class="flex w-full max-w-md flex-col items-center gap-6">
					<h1 class="text-4xl font-bold sm:text-5xl">Browser</h1>
					<form
						class="w-full"
						onsubmit={(e) => {
							e.preventDefault();
							submit(homeQuery);
							homeQuery = '';
						}}
					>
						<input
							bind:this={homeInput}
							bind:value={homeQuery}
							type="text"
							aria-label="Search"
							placeholder="Search {CONFIG.browser.searchName} or enter a URL"
							autocomplete="off"
							spellcheck="false"
							class="w-full rounded-full border-2 border-base-content/20 bg-base-content/5 px-5 py-2.5 outline-none placeholder:text-base-content/40 focus:border-primary"
						/>
					</form>
				</div>
			</div>
		{:else}
			{#if loading}
				<div class="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-primary"></div>
			{/if}
			{#key `${current}|${nonce}`}
				<iframe
					title="Web page"
					src={current}
					sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
					referrerpolicy="strict-origin-when-cross-origin"
					onload={() => (loading = false)}
					class="size-full border-0 bg-white"
				></iframe>
			{/key}
		{/if}
	</div>

	{#if current !== ''}
		<p class="shrink-0 border-t border-base-content/15 px-3 py-1 text-xs text-base-content/60">
			Blank page or a refused connection? That site doesn't allow embedding.
			<button type="button" onclick={openExternal} class="cursor-pointer underline hover:text-primary">
				Open it in a new tab
			</button>
		</p>
	{/if}
</div>