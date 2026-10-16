<!-- src/routes/projects/hsojOS/os/apps/ImageViewer.svelte -->
<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { getWindowContext } from '../context';

	const win = getWindowContext();

	type Photo = { id: number; name: string; url: string };

	const MIN_ZOOM = 0.25;
	const MAX_ZOOM = 8;

	let photos = $state<Photo[]>([]);
	let index = $state(0);
	let zoom = $state(1);
	let pan = $state({ x: 0, y: 0 });
	let dragOver = $state(false);
	let failedIds = $state<number[]>([]); // files the browser couldn't decode (e.g. some HEIC)
	let fileInput: HTMLInputElement | undefined = $state();
	let strip: HTMLElement | undefined = $state();

	let nextId = 0;
	let panning = $state<{ px: number; py: number; x: number; y: number } | null>(null);

	let current = $derived(photos[index]);

	// Files you pick stay on your computer: we just make temporary links to them
	function add(files: Iterable<File>) {
		const images = [...files].filter((f) => f.type.startsWith('image/'));
		if (images.length === 0) return;
		const added = images.map((f) => ({ id: nextId++, name: f.name, url: URL.createObjectURL(f) }));
		const firstNew = photos.length;
		photos = [...photos, ...added];
		select(firstNew);
	}

	function select(i: number) {
		index = Math.min(Math.max(i, 0), Math.max(photos.length - 1, 0));
		resetView();
	}

	const next = () => photos.length > 1 && select((index + 1) % photos.length);
	const prev = () => photos.length > 1 && select((index - 1 + photos.length) % photos.length);

	function removeCurrent() {
		const photo = photos[index];
		if (!photo) return;
		URL.revokeObjectURL(photo.url);
		photos = photos.filter((_, i) => i !== index);
		select(index);
	}

	onDestroy(() => photos.forEach((p) => URL.revokeObjectURL(p.url)));

	// ---------- Zoom and pan ----------
	function resetView() {
		zoom = 1;
		pan = { x: 0, y: 0 };
	}

	function setZoom(z: number) {
		zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
		if (zoom <= 1) pan = { x: 0, y: 0 };
	}

	function onWheel(e: WheelEvent) {
		if (!current) return;
		e.preventDefault();
		setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
	}

	function onStageDown(e: PointerEvent) {
		if (zoom <= 1) return;
		panning = { px: e.clientX, py: e.clientY, x: pan.x, y: pan.y };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onStageMove(e: PointerEvent) {
		if (!panning) return;
		pan = { x: panning.x + e.clientX - panning.px, y: panning.y + e.clientY - panning.py };
	}

	function onStageUp() {
		panning = null;
	}

	// ---------- Opening files ----------
	function onPick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		if (input.files) add(input.files);
		input.value = ''; // so picking the same file again still works
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files) add(e.dataTransfer.files);
	}

	function onDragLeave(e: DragEvent) {
		if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) dragOver = false;
	}

	// ---------- Keyboard ----------
	function onKeydown(e: KeyboardEvent) {
		if (!win.active || win.minimized || e.ctrlKey || e.metaKey || e.altKey) return;
		if ((e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]')) return;
		if (!current) return;

		let handled = true;
		if (e.key === 'ArrowRight') next();
		else if (e.key === 'ArrowLeft') prev();
		else if (e.key === '+' || e.key === '=') setZoom(zoom * 1.25);
		else if (e.key === '-') setZoom(zoom / 1.25);
		else if (e.key === '0') resetView();
		else handled = false;
		if (handled) e.preventDefault();
	}

	// Keep the selected thumbnail visible
	$effect(() => {
		void index;
		tick().then(() =>
			strip?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
		);
	});

	const toolBtn =
		'grid h-8 min-w-8 shrink-0 cursor-pointer place-items-center rounded-lg px-2 text-sm transition-colors hover:bg-base-content/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit';
</script>

<svelte:window onkeydown={onKeydown} />

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
	<input bind:this={fileInput} type="file" accept="image/*" multiple class="hidden" onchange={onPick} />

	<!-- Toolbar -->
	<div class="flex shrink-0 items-center gap-1 border-b border-base-content/15 p-1.5">
		<button
			type="button"
			onclick={() => fileInput?.click()}
			class="shrink-0 cursor-pointer rounded-lg border-2 border-primary bg-primary px-3 py-1 text-sm font-bold text-primary-content transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
		>
			Open
		</button>

		{#if current}
			<button type="button" class={toolBtn} aria-label="Previous photo" disabled={photos.length < 2} onclick={prev}>
				‹
			</button>
			<button type="button" class={toolBtn} aria-label="Next photo" disabled={photos.length < 2} onclick={next}>
				›
			</button>

			<p class="min-w-0 flex-1 truncate px-1 text-sm">
				{current.name}
				<span class="text-base-content/50">{index + 1} / {photos.length}</span>
			</p>

			<button type="button" class={toolBtn} aria-label="Zoom out" onclick={() => setZoom(zoom / 1.25)}>−</button>
			<button type="button" class="{toolBtn} w-14 tabular-nums" aria-label="Reset zoom" title="Fit to window" onclick={resetView}>
				{Math.round(zoom * 100)}%
			</button>
			<button type="button" class={toolBtn} aria-label="Zoom in" onclick={() => setZoom(zoom * 1.25)}>+</button>
			<button type="button" class={toolBtn} aria-label="Remove from viewer" title="Remove from viewer" onclick={removeCurrent}>
				×
			</button>
		{/if}
	</div>

	<!-- Stage -->
	{#if current}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="relative min-h-0 flex-1 touch-none overflow-hidden bg-base-300 {zoom > 1 ? (panning ? 'cursor-grabbing' : 'cursor-grab') : ''}"
			onwheel={onWheel}
			onpointerdown={onStageDown}
			onpointermove={onStageMove}
			onpointerup={onStageUp}
			onpointercancel={onStageUp}
			ondblclick={() => (zoom === 1 ? setZoom(2) : resetView())}
		>
			{#if failedIds.includes(current.id)}
				<p class="grid size-full place-items-center p-6 text-center text-sm text-base-content/60">
					Your browser can't display this file ({current.name}).
				</p>
			{:else}
				{#key current.id}
					<img
						src={current.url}
						alt={current.name}
						draggable="false"
						class="size-full object-contain select-none"
						style:transform="translate({pan.x}px, {pan.y}px) scale({zoom})"
						onerror={() => (failedIds = [...failedIds, current.id])}
					/>
				{/key}
			{/if}
		</div>

		{#if photos.length > 1}
			<ul bind:this={strip} class="flex shrink-0 gap-2 overflow-x-auto border-t border-base-content/15 p-2">
				{#each photos as photo, i (photo.id)}
					<li class="shrink-0">
						<button
							type="button"
							onclick={() => select(i)}
							aria-label="Show {photo.name}"
							aria-current={i === index ? 'true' : undefined}
							class="block cursor-pointer overflow-hidden rounded-lg border-2 border-transparent opacity-70 transition-all hover:opacity-100 focus-visible:outline-2 focus-visible:outline-primary aria-[current=true]:border-primary aria-[current=true]:opacity-100"
						>
							<img src={photo.url} alt="" loading="lazy" class="size-14 object-cover" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	{:else}
		<div class="grid min-h-0 flex-1 place-items-center p-6 text-center">
			<div class="space-y-3">
				<p class="text-2xl font-bold">Image Viewer</p>
				<p class="text-sm text-base-content/60">Open photos from your computer, or drop them here.</p>
			</div>
		</div>
	{/if}

	{#if dragOver}
		<div
			class="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-primary/10 text-sm font-bold text-primary"
		>
			Drop photos to open them
		</div>
	{/if}
</div>
