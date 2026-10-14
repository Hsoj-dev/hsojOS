<!-- src\routes\projects\hsojOS\os\ShutdownScreen.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	let button: HTMLButtonElement | undefined = $state();
	onMount(() => button?.focus());
</script>

<div
	role="dialog"
	aria-modal="true"
	aria-label="Shut down"
	class="fixed inset-0 z-[9999] grid place-items-center bg-black p-6 text-center text-white"
	transition:fade|global={{ duration: 400 }}
>
	<div class="space-y-6">
		<div class="space-y-1">
			<p class="text-lg font-bold">HsojOS has shut down</p>
			<p class="text-sm text-white/60">It's now safe to close this tab.</p>
		</div>
		<button
			bind:this={button}
			type="button"
			onclick={() => location.reload()}
			class="cursor-pointer rounded-xl border-2 border-white/40 px-4 py-1.5 text-sm transition-colors hover:bg-white hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
		>
			Power on
		</button>
	</div>
</div>