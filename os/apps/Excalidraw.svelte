<!-- src/routes/projects/hsojOS/os/apps/Excalidraw.svelte -->
<script lang="ts">
	let loaded = $state(false);
</script>

<div class="relative size-full">
	{#if !loaded}
		<p class="absolute inset-0 grid place-items-center text-sm text-base-content/60">
			Loading Excalidraw…
		</p>
	{/if}
	<iframe
		title="Excalidraw"
		src="https://excalidraw.com/"
		allow="clipboard-read; clipboard-write; fullscreen"
		referrerpolicy="strict-origin-when-cross-origin"
		onload={() => (loaded = true)}
		class="relative size-full border-0"
	></iframe>
</div>