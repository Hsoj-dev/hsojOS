// src/routes/projects/hsojOS/os/system.svelte.ts
import { getApp } from './apps';
import { CONFIG } from './config';
import { wm } from './windows.svelte';

export type SystemMode = 'active' | 'screensaver' | 'locked' | 'shutdown';

/** Ignore input for a moment after sleeping so the click that chose Sleep doesn't wake it */
const WAKE_GRACE_MS = 800;
/** How far the mouse must travel to wake the screen saver (ignores tiny jitters) */
const WAKE_MOVE_PX = 24;

const INPUT_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;

class System {
	mode = $state<SystemMode>('active');

	#last = 0;
	#sleptAt = 0;
	#anchor: { x: number; y: number } | null = null;

	/** Start idle tracking. Returns a cleanup function. Call from onMount. */
	start() {
		this.#last = Date.now();

		const onInput = (e: Event) => this.#onInput(e);
		for (const ev of INPUT_EVENTS) {
			window.addEventListener(ev, onInput, { passive: true, capture: true });
		}

		const tick = setInterval(() => {
			// Typing or moving inside an iframe is invisible to us, so a focused iframe app
			// (video, drawing, browsing) counts as activity
			if (this.mode === 'active' && this.#iframeAppFocused()) this.#last = Date.now();

			const idleMs = CONFIG.idleMinutes * 60_000;
			if (this.mode === 'active' && Date.now() - this.#last >= idleMs) {
				this.#startScreenSaver();
			}
		}, 1000);

		return () => {
			clearInterval(tick);
			for (const ev of INPUT_EVENTS) {
				window.removeEventListener(ev, onInput, { capture: true });
			}
		};
	}

	/** Start menu: Sleep */
	sleep() {
		this.#startScreenSaver();
	}

	/** Start menu: Restart */
	restart() {
		location.reload();
	}

	/**
	 * Start menu: Shut Down.
	 * Browsers only let a script close tabs the script opened, so window.close() usually
	 * does nothing. The shutdown screen is the fallback.
	 */
	shutDown() {
		this.mode = 'shutdown';
		window.close();
	}

	/** Leave the screen saver: lock screen if enabled, otherwise straight to the desktop */
	wake() {
		this.#last = Date.now();
		this.mode = CONFIG.lockScreenEnabled ? 'locked' : 'active';
	}

	/** Returns true (and unlocks) if the password matches */
	unlock(password: string): boolean {
		if (password !== CONFIG.lockPassword) return false;
		this.#last = Date.now();
		this.mode = 'active';
		return true;
	}

	#iframeAppFocused() {
		const win = wm.windows.find((w) => w.id === wm.activeId);
		return !!win && getApp(win.appId).hasIframe;
	}

	#startScreenSaver() {
		this.#sleptAt = Date.now();
		this.#anchor = null;
		this.mode = 'screensaver';
	}

	#onInput(e: Event) {
		const now = Date.now();

		if (this.mode === 'active') {
			this.#last = now;
			return;
		}
		if (this.mode !== 'screensaver') return;
		if (now - this.#sleptAt < WAKE_GRACE_MS) return;

		if (e.type === 'pointermove') {
			const { clientX: x, clientY: y } = e as PointerEvent;
			this.#anchor ??= { x, y };
			if (Math.hypot(x - this.#anchor.x, y - this.#anchor.y) < WAKE_MOVE_PX) return;
		}
		this.wake();
	}
}

export const sys = new System();