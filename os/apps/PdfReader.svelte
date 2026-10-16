<!-- src/routes/projects/hsojOS/os/apps/PdfReader.svelte -->
<!-- Uses the browser's own PDF viewer, so it's great on desktop and limited on phones -->
<script lang="ts">
	import { onDestroy } from 'svelte';

	let url = $state<string | null>(null);
	let name = $state('');
	let error = $state('');
	let dragOver = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();

	// False in browsers with no built-in PDF viewer (many phones)
	const supported =
		typeof navigator === 'undefined' ||
		(navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled !== false;

	function open(file: File) {
		if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
			error = `"${file.name}" isn't a PDF.`;
			return;
		}
		if (url) URL.revokeObjectURL(url);
		// Re-wrap with the right type so the browser's viewer always recognizes it
		url = URL.createObjectURL(new Blob([file], { type: 'application/pdf' }));
		name = file.name;
		error = '';
	}

	function onPick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) open(file);
		input.value = '';
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const file = e.dataTransfer?.files[0];
		if (file) open(file);
	}

	function onDragLeave(e: DragEvent) {
		if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) dragOver = false;
	}

	onDestroy(() => {
		if (url) URL.revokeObjectURL(url);
	});

	const linkBtn =
		'shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-sm transition-colors hover:bg-base-content/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary';
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="relative flex h-full flex-col"
	ondragover={(e) => {
		e.preventDefault();
		dragOver = true;
	}}
	ondragleave={onDragLeave}
	ondrop={onDrop}
>
	<input
		bind:this={fileInput}
		type="file"
		accept="application/pdf,.pdf"
		class="hidden"
		onchange={onPick}
	/>

	<div class="flex shrink-0 items-center gap-1 border-b border-base-content/15 p-1.5">
		<button
			type="button"
			onclick={() => fileInput?.click()}
			class="shrink-0 cursor-pointer rounded-lg border-2 border-primary bg-primary px-3 py-1 text-sm font-bold text-primary-content transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
		>
			{url ? 'Open another' : 'Open PDF'}
		</button>

		<p class="min-w-0 flex-1 truncate px-1 text-sm">{name}</p>

		{#if url}
			<a href={url} target="_blank" rel="noopener" class={linkBtn}>Open in new tab</a>
		{/if}
	</div>

	<div class="relative min-h-0 flex-1">
		{#if url && supported}
			<iframe title={name} src={url} class="size-full border-0 bg-white"></iframe>
		{:else if url}
			<div class="grid size-full place-items-center p-6 text-center">
				<div class="max-w-xs space-y-3">
					<p class="font-bold">This browser can't show PDFs here</p>
					<p class="text-sm text-base-content/60">You can still read it in a new tab, or download it.</p>
					<div class="flex justify-center gap-2">
						<a href={url} target="_blank" rel="noopener" class="rounded-xl border-2 border-primary bg-primary px-4 py-1.5 text-sm font-bold text-primary-content">
							Open in new tab
						</a>
						<a href={url} download={name} class="rounded-xl border-2 border-base-content/20 px-4 py-1.5 text-sm font-bold hover:border-primary hover:text-primary">
							Download
						</a>
					</div>
				</div>
			</div>
		{:else}
			<div class="grid size-full place-items-center p-6 text-center">
				<div class="space-y-3">
					<p class="text-2xl font-bold">PDF Reader</p>
					<p class="text-sm text-base-content/60">Open a PDF from your computer, or drop one here.</p>
					{#if error}
						<p role="alert" class="text-sm text-error">{error}</p>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	{#if dragOver}
		<div
			class="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-primary/10 text-sm font-bold text-primary"
		>
			Drop a PDF to open it
		</div>
	{/if}
</div>
