<!-- src/routes/projects/hsojOS/os/Window.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { scale } from 'svelte/transition';
	import type { AppSettings } from './apps';
	import { setWindowContext } from './context';
	import { wm, TITLEBAR_HEIGHT, MIN_VISIBLE, type WindowState } from './windows.svelte';

	let {
		win,
		app,
		children
	}: { win: WindowState; app: AppSettings; children: Snippet } = $props();

	// Lets the app inside this window close it (see apps/Welcome.svelte)
	setWindowContext({
		get id() {
			return win.id;
		},
		get active() {
			return active;
		},
		get minimized() {
			return win.minimized;
		},
		close: () => wm.close(win.id),
		focus: () => wm.restore(win.id),
		open: (appId) => {
			wm.open(appId);
		},
		setTitle: (title) => {
			win.title = title;
		}
	});

	type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

	const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

	let active = $derived(wm.activeId === win.id);
	// True while dragging or resizing, so iframes can't swallow pointer events mid-gesture
	let interacting = $state(false);
	let frame = $derived(
		win.maximized
			? 'left:0;top:0;width:100%;height:100%;'
			: `left:${win.x}px;top:${win.y}px;width:${win.width}px;height:${win.height}px;`
	);

	// ---------- Dragging (title bar) ----------
	// Pointer events + pointer capture: works with mouse and touch, and the drag
	// keeps tracking even when the cursor leaves the title bar.
	let drag: { px: number; py: number; x: number; y: number } | null = null;

	function startDrag(e: PointerEvent) {
		if (e.button !== 0 || win.maximized) return;
		if ((e.target as HTMLElement).closest('button')) return;
		drag = { px: e.clientX, py: e.clientY, x: win.x, y: win.y };
		interacting = true;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onDrag(e: PointerEvent) {
		if (!drag) return;
		const { w: bw, h: bh } = wm.bounds;
		win.x = clamp(drag.x + e.clientX - drag.px, MIN_VISIBLE - win.width, bw - MIN_VISIBLE);
		win.y = clamp(drag.y + e.clientY - drag.py, 0, Math.max(0, bh - TITLEBAR_HEIGHT));
	}

	function endDrag() {
		drag = null;
		interacting = false;
	}

	function onTitlebarDblClick(e: MouseEvent) {
		if ((e.target as HTMLElement).closest('button')) return;
		wm.toggleMaximize(win.id);
	}

	// ---------- Resizing (edge and corner handles) ----------
	let resize: { dir: Dir; px: number; py: number; x: number; y: number; w: number; h: number } | null =
		null;

	function startResize(e: PointerEvent, dir: Dir) {
		if (e.button !== 0) return;
		e.preventDefault();
		interacting = true;
		resize = { dir, px: e.clientX, py: e.clientY, x: win.x, y: win.y, w: win.width, h: win.height };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onResize(e: PointerEvent) {
		if (!resize) return;
		const r = resize;
		const dx = e.clientX - r.px;
		const dy = e.clientY - r.py;
		const { w: bw, h: bh } = wm.bounds;

		let { x, y, w, h } = r;

		if (r.dir.includes('e')) {
			w = clamp(r.w + dx, app.minWidth, Math.max(app.minWidth, bw - r.x));
		}
		if (r.dir.includes('s')) {
			h = clamp(r.h + dy, app.minHeight, Math.max(app.minHeight, bh - r.y));
		}
		if (r.dir.includes('w')) {
			x = clamp(r.x + dx, 0, r.x + r.w - app.minWidth);
			w = r.x + r.w - x;
		}
		if (r.dir.includes('n')) {
			y = clamp(r.y + dy, 0, r.y + r.h - app.minHeight);
			h = r.y + r.h - y;
		}

		win.x = x;
		win.y = y;
		win.width = w;
		win.height = h;
	}

	function endResize() {
		resize = null;
		interacting = false;
	}

	const HANDLES: { dir: Dir; cls: string }[] = [
		{ dir: 'n', cls: 'top-0 right-3 left-3 h-1.5 cursor-ns-resize' },
		{ dir: 's', cls: 'right-3 bottom-0 left-3 h-1.5 cursor-ns-resize' },
		{ dir: 'e', cls: 'top-3 right-0 bottom-3 w-1.5 cursor-ew-resize' },
		{ dir: 'w', cls: 'top-3 bottom-3 left-0 w-1.5 cursor-ew-resize' },
		{ dir: 'ne', cls: 'top-0 right-0 size-3 cursor-nesw-resize' },
		{ dir: 'nw', cls: 'top-0 left-0 size-3 cursor-nwse-resize' },
		{ dir: 'se', cls: 'right-0 bottom-0 size-3 cursor-nwse-resize' },
		{ dir: 'sw', cls: 'bottom-0 left-0 size-3 cursor-nesw-resize' }
	];

	// ---------- Styles ----------
	const dotBase =
		'grid size-4 cursor-pointer place-items-center rounded-full border text-[10px] leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-30';
	const dotIdle = 'border-base-content/25 bg-base-content/15 text-base-content';
	const dotClose = 'border-primary bg-primary text-primary-content';
	const dotMinimize = 'border-secondary bg-secondary text-secondary-content';
	const dotMaximize = 'border-primary bg-transparent text-primary';
</script>

{#snippet dot(label: string, glyph: string, color: string, enabled: boolean, onclick: () => void)}
	<button
		type="button"
		class="{dotBase} {active ? color : dotIdle}"
		aria-label={label}
		title={label}
		disabled={!enabled}
		{onclick}
	>
		<span
			aria-hidden="true"
			class="opacity-0 transition-opacity group-focus-within/dots:opacity-100 group-hover/dots:opacity-100"
		>
			{glyph}
		</span>
	</button>
{/snippet}

<div
	role="dialog"
	tabindex="-1"
	aria-label={win.title}
	class="absolute flex outline-none flex-col overflow-hidden rounded-xl border transition-[opacity,translate,scale,box-shadow] duration-150
		{app.translucent ? 'bg-base-100/70 backdrop-blur-xl' : 'bg-base-100'}
		{active ? 'border-primary shadow-2xl shadow-black/40' : 'border-base-content/20 shadow-lg shadow-black/20'}
		{win.minimized ? 'pointer-events-none translate-y-4 scale-95 opacity-0' : ''}"
	style={frame}
	style:z-index={win.z}
	inert={win.minimized}
	onpointerdown={() => wm.focus(win.id)}
	in:scale|global={{ start: 0.96, duration: 140 }}
	out:scale|global={{ start: 0.96, duration: 120 }}
>
	<!-- Title bar -->
	<div
		role="presentation"
		class="relative flex shrink-0 touch-none items-center border-b bg-base-content/5 px-3 select-none
			{active ? 'border-primary/40' : 'border-base-content/15'}"
		style:height="{TITLEBAR_HEIGHT}px"
		onpointerdown={startDrag}
		onpointermove={onDrag}
		onpointerup={endDrag}
		onpointercancel={endDrag}
		ondblclick={onTitlebarDblClick}
	>
		<div class="group/dots flex items-center gap-2">
			{@render dot('Close', '×', dotClose, true, () => wm.close(win.id))}
			{@render dot('Minimize', '−', dotMinimize, app.minimizable, () => wm.minimize(win.id))}
			{@render dot(
				win.maximized ? 'Restore' : 'Maximize',
				win.maximized ? '↙' : '+',
				dotMaximize,
				app.maximizable,
				() => wm.toggleMaximize(win.id)
			)}
		</div>

		<div
			class="pointer-events-none absolute inset-x-24 flex items-center justify-center gap-2 text-sm
				{active ? '' : 'text-base-content/50'}"
		>
			<span aria-hidden="true">{app.glyph}</span>
			<span class="truncate">{win.title}</span>
		</div>
	</div>

	<!-- App content: this is where the app component renders -->
	<div class="min-h-0 flex-1 overflow-auto">
		{@render children()}
	</div>

	<!-- Iframe shield: while unfocused or mid-drag, catch pointer events the iframe would
	     swallow. The first click focuses the window, then this disappears. -->
	{#if app.hasIframe && (!active || interacting)}
		<div
			aria-hidden="true"
			class="absolute inset-x-0 bottom-0 z-5"
			style:top="{TITLEBAR_HEIGHT}px"
		></div>
	{/if}

	<!-- Resize handles -->
	{#if app.resizable && !win.maximized}
		{#each HANDLES as h (h.dir)}
			<div
				role="presentation"
				class="absolute z-10 touch-none {h.cls}"
				onpointerdown={(e) => startResize(e, h.dir)}
				onpointermove={onResize}
				onpointerup={endResize}
				onpointercancel={endResize}
			></div>
		{/each}
	{/if}
</div>