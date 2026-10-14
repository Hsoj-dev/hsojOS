<!-- src/routes/projects/hsojOS/os/apps/Paint.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';

	// The site's mono + blue palette, plus red/green/amber
	const COLORS = ['#181818', '#535353', '#d0d0d0', '#ffffff', '#1a52b8', '#a6d0ff', '#b3261e', '#1f7a3d', '#9a6700'];
	const SIZES = [2, 5, 10, 20];
	const PAPER = '#ffffff';

	let tool = $state<'pen' | 'eraser'>('pen');
	let color = $state('#181818');
	let size = $state(5);

	let wrap: HTMLElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();

	let ctx: CanvasRenderingContext2D | null = null;
	let cssW = 0;
	let cssH = 0;
	let last: { x: number; y: number } | null = null;

	// The drawing surface only ever grows, so shrinking the window never erases anything.
	function ensureSize(w: number, h: number) {
		if (!canvas || w <= 0 || h <= 0 || (w <= cssW && h <= cssH)) return;

		const dpr = window.devicePixelRatio || 1;
		const nw = Math.max(w, cssW);
		const nh = Math.max(h, cssH);

		// Keep what's already drawn
		let old: HTMLCanvasElement | null = null;
		if (cssW > 0 && cssH > 0) {
			old = document.createElement('canvas');
			old.width = canvas.width;
			old.height = canvas.height;
			old.getContext('2d')?.drawImage(canvas, 0, 0);
		}

		canvas.width = Math.round(nw * dpr);
		canvas.height = Math.round(nh * dpr);
		canvas.style.width = `${nw}px`;
		canvas.style.height = `${nh}px`;

		ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.fillStyle = PAPER;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		if (old) ctx.drawImage(old, 0, 0);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		cssW = nw;
		cssH = nh;
	}

	onMount(() => {
		if (!wrap) return;
		const observer = new ResizeObserver(([entry]) => {
			ensureSize(Math.ceil(entry.contentRect.width), Math.ceil(entry.contentRect.height));
		});
		observer.observe(wrap);
		return () => observer.disconnect();
	});

	// ---------- Drawing ----------
	function point(e: PointerEvent) {
		const r = canvas!.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	}

	function stroke(from: { x: number; y: number }, to: { x: number; y: number }) {
		if (!ctx) return;
		ctx.strokeStyle = tool === 'eraser' ? PAPER : color;
		ctx.lineWidth = tool === 'eraser' ? size * 2 : size;
		ctx.beginPath();
		ctx.moveTo(from.x, from.y);
		ctx.lineTo(to.x, to.y);
		ctx.stroke();
	}

	function onDown(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		canvas!.setPointerCapture(e.pointerId);
		last = point(e);
		stroke(last, { x: last.x + 0.01, y: last.y }); // a click makes a dot
	}

	function onMove(e: PointerEvent) {
		if (!last) return;
		// Coalesced events give smooth lines even when the mouse moves fast
		const events = e.getCoalescedEvents?.() ?? [];
		for (const ev of events.length ? events : [e]) {
			const p = point(ev);
			stroke(last, p);
			last = p;
		}
	}

	function onUp() {
		last = null;
	}

	function clearCanvas() {
		if (!ctx || !canvas) return;
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.fillStyle = PAPER;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.restore();
	}

	function exportPng() {
		canvas?.toBlob((blob) => {
			if (!blob) return;
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `hsojos-drawing-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
			a.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		}, 'image/png');
	}

	const toolBtn =
		'cursor-pointer rounded-lg px-2.5 py-1 text-sm transition-colors hover:bg-base-content/10 focus-visible:outline-2 focus-visible:outline-primary aria-pressed:bg-primary aria-pressed:text-primary-content';
</script>

<div class="flex h-full flex-col">
	<div class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-base-content/15 p-2">
		<div class="flex items-center gap-1">
			<button type="button" class={toolBtn} aria-pressed={tool === 'pen'} onclick={() => (tool = 'pen')}>
				Pen
			</button>
			<button type="button" class={toolBtn} aria-pressed={tool === 'eraser'} onclick={() => (tool = 'eraser')}>
				Eraser
			</button>
		</div>

		<div class="flex items-center gap-1.5" role="group" aria-label="Colors">
			{#each COLORS as c}
				<button
					type="button"
					aria-label="Color {c}"
					aria-pressed={tool === 'pen' && color === c}
					onclick={() => {
						color = c;
						tool = 'pen';
					}}
					class="size-5 cursor-pointer rounded-full border border-base-content/30 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-primary aria-pressed:ring-2 aria-pressed:ring-primary aria-pressed:ring-offset-2 aria-pressed:ring-offset-base-100"
					style:background-color={c}
				></button>
			{/each}
			<input
				type="color"
				bind:value={color}
				oninput={() => (tool = 'pen')}
				aria-label="Custom color"
				title="Custom color"
				class="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
			/>
		</div>

		<div class="flex items-center gap-1" role="group" aria-label="Brush size">
			{#each SIZES as s}
				<button
					type="button"
					aria-label="Brush size {s}"
					aria-pressed={size === s}
					onclick={() => (size = s)}
					class="grid size-7 cursor-pointer place-items-center rounded-lg transition-colors hover:bg-base-content/10 focus-visible:outline-2 focus-visible:outline-primary aria-pressed:bg-primary aria-pressed:text-primary-content"
				>
					<span class="rounded-full bg-current" style:width="{Math.min(s, 16)}px" style:height="{Math.min(s, 16)}px"></span>
				</button>
			{/each}
		</div>

		<div class="ml-auto flex items-center gap-1">
			<button type="button" class={toolBtn} onclick={clearCanvas}>Clear</button>
			<button
				type="button"
				onclick={exportPng}
				class="cursor-pointer rounded-lg border-2 border-primary bg-primary px-3 py-1 text-sm font-bold text-primary-content transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			>
				Export PNG
			</button>
		</div>
	</div>

	<div bind:this={wrap} class="relative min-h-0 flex-1 overflow-hidden bg-white">
		<canvas
			bind:this={canvas}
			class="absolute top-0 left-0 touch-none cursor-crosshair"
			onpointerdown={onDown}
			onpointermove={onMove}
			onpointerup={onUp}
			onpointercancel={onUp}
		></canvas>
	</div>
</div>