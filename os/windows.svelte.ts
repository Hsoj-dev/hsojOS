// src\routes\projects\hsojOS\os\windows.svelte.ts
import { getApp } from './apps';

export const TITLEBAR_HEIGHT = 36;
/** How much of a window must stay on screen horizontally so it can always be grabbed */
export const MIN_VISIBLE = 96;

const EDGE_MARGIN = 24;
const CASCADE_STEP = 28;
const CASCADE_COUNT = 8;

export type WindowState = {
	id: string;
	appId: string;
	title: string;
	x: number;
	y: number;
	width: number;
	height: number;
	z: number;
	minimized: boolean;
	/** Maximized fills the desktop area. x/y/width/height are kept so restoring is free. */
	maximized: boolean;
};

export type AppStatus = 'closed' | 'minimized' | 'open' | 'active';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

class WindowManager {
	windows = $state<WindowState[]>([]);
	/** Size of the desktop area windows live in (set by the page) */
	bounds = $state({ w: 0, h: 0 });

	#z = 0;
	#n = 0;

	/** The focused window: the highest one that isn't minimized */
	activeId = $derived.by(() => {
		let top: WindowState | undefined;
		for (const w of this.windows) {
			if (!w.minimized && (!top || w.z > top.z)) top = w;
		}
		return top?.id ?? null;
	});

	open(appId: string, opts: { forceNew?: boolean } = {}): string {
		const app = getApp(appId);

		if (app.singleInstance && !opts.forceNew) {
			const existing = this.windows.find((w) => w.appId === appId);
			if (existing) {
				this.restore(existing.id);
				return existing.id;
			}
		}

		const n = this.#n++;
		const { w: bw, h: bh } = this.bounds;
		const width = clamp(app.defaultWidth, app.minWidth, Math.max(app.minWidth, bw - EDGE_MARGIN * 2));
		const height = clamp(app.defaultHeight, app.minHeight, Math.max(app.minHeight, bh - EDGE_MARGIN * 2));

		// Centered, then nudged so each new window cascades a little
		const shift = ((n % CASCADE_COUNT) - CASCADE_COUNT / 2) * CASCADE_STEP;
		const x = clamp(Math.round((bw - width) / 2 + shift), 0, Math.max(0, bw - width));
		const y = clamp(Math.round((bh - height) / 2 + shift), 0, Math.max(0, bh - height));

		const win: WindowState = {
			id: `${appId}-${n}`,
			appId,
			title: app.title,
			x,
			y,
			width,
			height,
			z: ++this.#z,
			minimized: false,
			maximized: false
		};
		this.windows.push(win);
		return win.id;
	}

	focus(id: string) {
		const win = this.#get(id);
		if (win && win.z !== this.#z) win.z = ++this.#z;
	}

	restore(id: string) {
		const win = this.#get(id);
		if (!win) return;
		win.minimized = false;
		this.focus(id);
	}

	minimize(id: string) {
		const win = this.#get(id);
		if (win && getApp(win.appId).minimizable) win.minimized = true;
	}

	toggleMaximize(id: string) {
		const win = this.#get(id);
		if (win && getApp(win.appId).maximizable) {
			win.maximized = !win.maximized;
			this.focus(id);
		}
	}

	close(id: string) {
		this.windows = this.windows.filter((w) => w.id !== id);
	}

	/** Dock click: open, restore, focus, or minimize depending on the app's current state */
	toggle(appId: string) {
		const wins = this.windows.filter((w) => w.appId === appId);
		if (wins.length === 0) {
			this.open(appId);
			return;
		}
		const top = wins.reduce((a, b) => (a.z > b.z ? a : b));
		if (top.minimized) this.restore(top.id);
		else if (this.activeId === top.id) this.minimize(top.id);
		else this.focus(top.id);
	}

	statusOf(appId: string): AppStatus {
		const wins = this.windows.filter((w) => w.appId === appId);
		if (wins.length === 0) return 'closed';
		if (wins.some((w) => w.id === this.activeId)) return 'active';
		return wins.some((w) => !w.minimized) ? 'open' : 'minimized';
	}

	/** Called when the desktop area changes size so no window gets lost off-screen */
	setBounds(w: number, h: number) {
		this.bounds = { w, h };
		if (w === 0 || h === 0) return;
		for (const win of this.windows) {
			const app = getApp(win.appId);
			win.width = Math.min(win.width, Math.max(app.minWidth, w));
			win.height = Math.min(win.height, Math.max(app.minHeight, h));
			win.x = clamp(win.x, MIN_VISIBLE - win.width, w - MIN_VISIBLE);
			win.y = clamp(win.y, 0, Math.max(0, h - TITLEBAR_HEIGHT));
		}
	}

	#get(id: string) {
		return this.windows.find((w) => w.id === id);
	}
}

export const wm = new WindowManager();