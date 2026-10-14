<!-- src\routes\projects\hsojOS\os\apps\Welcome.svelte -->
<script lang="ts">
	import { CONFIG } from '../config';
	import { getWindowContext } from '../context';

	const win = getWindowContext();

	const tips = [
		'Open Start to launch apps, or type to search for them.',
		'Click a dock icon to open an app. Click it again to minimize it.',
		'Drag a window by its title bar and resize it from any edge.',
		'The dots on a window close, minimize, and maximize it.',
		`Leave HsojOS idle for ${CONFIG.idleMinutes} minutes and the screen saver starts.`
	];
</script>

<div class="flex h-full flex-col gap-5 p-5">
	<div class="space-y-1">
		<h2 class="text-2xl font-bold">Welcome to HsojOS</h2>
		<p class="text-sm text-base-content/60">A tiny desktop that lives in your browser. Quick tour:</p>
	</div>

	<ol class="space-y-3">
		{#each tips as tip, i}
			<li class="flex items-start gap-3 text-sm">
				<span
					aria-hidden="true"
					class="grid size-6 shrink-0 place-items-center rounded-lg border border-primary text-xs font-bold text-primary"
				>
					{i + 1}
				</span>
				<span class="pt-0.5">{tip}</span>
			</li>
		{/each}
	</ol>

	<button
		type="button"
		onclick={() => win.close()}
		class="mt-auto cursor-pointer self-end rounded-xl border-2 border-primary bg-primary px-4 py-1.5 text-sm font-bold text-primary-content transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
	>
		Get started
	</button>
</div>