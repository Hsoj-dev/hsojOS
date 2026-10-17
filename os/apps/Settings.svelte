<!-- src/routes/projects/hsojOS/os/apps/Settings.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	// Shared with the main site, so the OS and the site always use the same palette
	import { prefs, palettes, savePrefs, applyPalette, type Palette } from '$lib/prefs.svelte';
	import { CONFIG } from '../config';

	type Section = 'about' | 'appearance';
	const SECTIONS: { id: Section; label: string }[] = [
		{ id: 'about', label: 'About HsojOS' },
		{ id: 'appearance', label: 'Appearance' }
	];

	// Preview colors mirror the palettes in app.css (light, then dark). Update both together.
	const PREVIEW: Record<Palette, { label: string; base: string; accent: string }> = {
		mono: {
			label: 'Mono',
			base: 'bg-[#dedede] dark:bg-[#535353]',
			accent: 'bg-[#1a52b8] dark:bg-[#a6d0ff]'
		},
		warm: {
			label: 'Warm',
			base: 'bg-[#efe3cc] dark:bg-[#3b3430]',
			accent: 'bg-[#a8431f] dark:bg-[#f0916c]'
		},
		cool: {
			label: 'Cool',
			base: 'bg-[#d5e0e8] dark:bg-[#3a4656]',
			accent: 'bg-[#146579] dark:bg-[#7fd6e6]'
		}
	};

	let section = $state<Section>('about');
	let systemInfo = $state<[string, string][]>([]);
	let dark = $state(false);
	let confirmingReset = $state(false);

	function choosePalette(p: Palette) {
		prefs.palette = p;
		applyPalette();
		savePrefs();
	}

	function browserName() {
		const ua = navigator.userAgent;
		if (/Edg\//.test(ua)) return 'Edge';
		if (/OPR\//.test(ua)) return 'Opera';
		if (/Firefox\//.test(ua)) return 'Firefox';
		if (/Chrome\//.test(ua)) return 'Chrome';
		if (/Safari\//.test(ua)) return 'Safari';
		return 'Unknown';
	}

	onMount(() => {
		systemInfo = [
			['Browser', browserName()],
			['Screen', `${screen.width} x ${screen.height}`],
			['Language', navigator.language],
			['CPU threads', String(navigator.hardwareConcurrency ?? 'unknown')]
		];

		// The light/dark mode follows the system, so keep up with changes
		const query = matchMedia('(prefers-color-scheme: dark)');
		dark = query.matches;
		const onChange = (e: MediaQueryListEvent) => (dark = e.matches);
		query.addEventListener('change', onChange);
		return () => query.removeEventListener('change', onChange);
	});

	/** Erase everything HsojOS saved (to-dos, notes, volume, scores...). The main site's settings stay. */
	function resetData() {
		try {
			const keys: string[] = [];
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key?.startsWith('hsojos:')) keys.push(key);
			}
			keys.forEach((k) => localStorage.removeItem(k));
		} catch {
			/* storage blocked */
		}
		location.reload();
	}

	const CREDITS = [
		['Weather', 'Open-Meteo'],
		['Place names', 'BigDataCloud'],
		['News', 'FreeNewsApi.io'],
		['Whiteboard', 'Excalidraw'],
		['Videos', 'YouTube']
	];

	const rowLabel = 'w-28 shrink-0 text-base-content/60';
</script>

<div class="@container h-full">
	<div class="flex h-full flex-col @md:flex-row">
		<!-- Sections -->
		<nav
			class="flex shrink-0 gap-1 border-b border-base-content/15 p-2 @md:w-44 @md:flex-col @md:border-r @md:border-b-0"
			aria-label="Settings sections"
		>
			{#each SECTIONS as s (s.id)}
				<button
					type="button"
					onclick={() => (section = s.id)}
					aria-current={section === s.id ? 'page' : undefined}
					class="cursor-pointer rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-base-content/10 focus-visible:outline-2 focus-visible:outline-primary aria-[current=page]:bg-primary aria-[current=page]:font-bold aria-[current=page]:text-primary-content"
				>
					{s.label}
				</button>
			{/each}
		</nav>

		<!-- Content -->
		<div class="min-h-0 flex-1 overflow-y-auto p-5">
			{#if section === 'about'}
				<div class="space-y-6">
					<header>
						<h1 class="text-2xl font-bold">HsojOS</h1>
						<p class="text-sm text-base-content/60">A tiny desktop that lives in your browser.</p>
					</header>

					<dl class="space-y-2 text-sm">
						<div class="flex gap-3"><dt class={rowLabel}>Version</dt><dd>{CONFIG.version}</dd></div>
						<div class="flex gap-3"><dt class={rowLabel}>User</dt><dd>{CONFIG.userName}</dd></div>
						<div class="flex gap-3">
							<dt class={rowLabel}>Built with</dt>
							<dd>SvelteKit, Svelte 5, Tailwind CSS, daisyUI</dd>
						</div>
						{#if CONFIG.githubUrl}
							<div class="flex gap-3">
								<dt class={rowLabel}>Source code</dt>
								<dd>
									<a
										href={CONFIG.githubUrl}
										target="_blank"
										rel="noopener noreferrer"
										class="text-primary underline underline-offset-2 hover:no-underline"
									>
										View on GitHub
									</a>
								</dd>
							</div>
						{/if}
					</dl>

					<section>
						<h2 class="mb-2 text-sm font-bold">This device</h2>
						<dl class="space-y-2 text-sm">
							{#each systemInfo as [label, value]}
								<div class="flex gap-3"><dt class={rowLabel}>{label}</dt><dd>{value}</dd></div>
							{/each}
						</dl>
					</section>

					<section>
						<h2 class="mb-2 text-sm font-bold">Credits</h2>
						<dl class="space-y-2 text-sm">
							{#each CREDITS as [label, value]}
								<div class="flex gap-3"><dt class={rowLabel}>{label}</dt><dd>{value}</dd></div>
							{/each}
						</dl>
					</section>

					<section>
						<h2 class="mb-1 text-sm font-bold">Reset</h2>
						<p class="mb-2 text-sm text-base-content/60">
							Clears your to-dos, notes, volume, saved scores, and saved location, then restarts HsojOS.
						</p>
						{#if confirmingReset}
							<div class="flex flex-wrap items-center gap-2">
								<button
									type="button"
									onclick={resetData}
									class="cursor-pointer rounded-xl border-2 border-error bg-error px-4 py-1.5 text-sm font-bold text-error-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
								>
									Yes, erase everything
								</button>
								<button
									type="button"
									onclick={() => (confirmingReset = false)}
									class="cursor-pointer rounded-xl border-2 border-base-content/20 px-4 py-1.5 text-sm font-bold hover:border-primary hover:text-primary"
								>
									Cancel
								</button>
							</div>
						{:else}
							<button
								type="button"
								onclick={() => (confirmingReset = true)}
								class="cursor-pointer rounded-xl border-2 border-error px-4 py-1.5 text-sm font-bold text-error transition-colors hover:bg-error hover:text-error-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
							>
								Reset HsojOS data…
							</button>
						{/if}
					</section>
				</div>
			{:else}
				<div class="space-y-6">
					<header>
						<h1 class="text-2xl font-bold">Appearance</h1>
					</header>

					<section>
						<h2 class="mb-1 text-sm font-bold">Theme</h2>
						<p class="mb-3 text-sm text-base-content/60">
							The color palette is shared with the rest of the site.
						</p>
						<div class="grid grid-cols-1 gap-2 @sm:grid-cols-3" role="group" aria-label="Palette">
							{#each palettes as p (p)}
								<button
									type="button"
									onclick={() => choosePalette(p)}
									aria-pressed={prefs.palette === p}
									class="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-base-content/15 p-3 text-left transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-pressed:border-primary aria-pressed:bg-primary/10"
								>
									<span class="flex overflow-hidden rounded-lg border border-base-content/20" aria-hidden="true">
										<span class="size-9 {PREVIEW[p].base}"></span>
										<span class="size-9 {PREVIEW[p].accent}"></span>
									</span>
									<span class="text-sm font-bold">{PREVIEW[p].label}</span>
								</button>
							{/each}
						</div>
					</section>

					<section>
						<h2 class="mb-1 text-sm font-bold">Color mode</h2>
						<p class="text-sm text-base-content/60">
							Currently <span class="font-bold text-base-content">{dark ? 'dark' : 'light'}</span>.
							This follows your device's setting.
						</p>
					</section>
				</div>
			{/if}
		</div>
	</div>
</div>