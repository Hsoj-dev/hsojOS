// src/routes/projects/hsojOS/os/sound.svelte.ts
// System volume. Anything that makes sound should go through here so the slider controls it.
const KEY = 'hsojos:volume';
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

class Sound {
	volume = $state(70);
	muted = $state(false);
	#ctx: AudioContext | null = null;

	/** Effective volume from 0 to 1 (use this for <audio>/<video> volume) */
	get level() {
		return this.muted ? 0 : this.volume / 100;
	}

	/** Restore the saved volume. Call from onMount. */
	load() {
		try {
			const raw = localStorage.getItem(KEY);
			if (!raw) return;
			const saved = JSON.parse(raw);
			const v = Number(saved.volume);
			if (Number.isFinite(v)) this.volume = clamp(Math.round(v), 0, 100);
			this.muted = Boolean(saved.muted);
		} catch {
			/* storage blocked or corrupt: keep defaults */
		}
	}

	setVolume(v: number) {
		this.volume = clamp(Math.round(v), 0, 100);
		if (this.volume > 0) this.muted = false;
		this.#save();
	}

	toggleMute() {
		this.muted = !this.muted;
		if (!this.muted && this.volume === 0) this.volume = 30;
		this.#save();
		this.chime();
	}

	/** Call from a click handler so later sounds (e.g. a timer) are allowed to play */
	prime() {
		try {
			this.#context();
		} catch {
			/* audio unavailable */
		}
	}

	/** Play one beep. `delay` is seconds from now, so you can schedule a pattern. `hold` keeps it at full volume. */
	tone(frequency: number, delay = 0, duration = 0.18, peak = 0.25, hold = false) {
		if (this.level === 0) return;
		try {
			const ctx = this.#context();
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			const t = ctx.currentTime + delay;
			osc.type = 'sine';
			osc.frequency.value = frequency;
			gain.gain.setValueAtTime(0.0001, t);
			const volume = Math.max(peak * this.level, 0.0001);
			gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
			// A held tone stays at full volume (a phone ring) instead of fading like a blip
			if (hold) gain.gain.setValueAtTime(volume, t + Math.max(duration - 0.05, 0.03));
			gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
			osc.connect(gain).connect(ctx.destination);
			osc.start(t);
			osc.stop(t + duration + 0.02);
		} catch {
			/* audio unavailable */
		}
	}

	/** Short blip so the slider gives audible feedback */
	chime() {
		this.tone(660);
	}

	#context() {
		this.#ctx ??= new AudioContext();
		if (this.#ctx.state === 'suspended') void this.#ctx.resume();
		return this.#ctx;
	}

	#save() {
		try {
			localStorage.setItem(KEY, JSON.stringify({ volume: this.volume, muted: this.muted }));
		} catch {
			/* ignore */
		}
	}
}

export const sound = new Sound();