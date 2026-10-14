<!-- src/routes/projects/hsojOS/os/apps/Timer.svelte -->
<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { getWindowContext } from '../context';
	import { sound } from '../sound.svelte';

	const win = getWindowContext();

	const DEFAULT_SECONDS = 25 * 60; // pomodoro
	const MAX_SECONDS = 999 * 60 + 59;
	const RING_REPEATS = 20; // about 30 seconds of ringing unless stopped
	const RADIUS = 44;
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

	let total = $state(DEFAULT_SECONDS);
	let remaining = $state(DEFAULT_SECONDS);
	let running = $state(false);
	let finished = $state(false);
	let ringing = $state(false);

	let editing = $state(false);
	let draft = $state('');
	let invalid = $state(false);
	let editInput: HTMLInputElement | undefined = $state();

	let endAt = 0;
	let ringTimer: ReturnType<typeof setInterval> | undefined;

	let progress = $derived(total > 0 ? remaining / total : 0);

	const pad = (n: number) => String(n).padStart(2, '0');
	const format = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

	/** "25" means minutes, "1:30" means 1 minute 30 seconds */
	function parseDuration(text: string): number | null {
		const t = text.trim();
		let seconds: number;
		if (/^\d+$/.test(t)) {
			seconds = Number(t) * 60;
		} else {
			const m = t.match(/^(\d+):([0-5]?\d)$/);
			if (!m) return null;
			seconds = Number(m[1]) * 60 + Number(m[2]);
		}
		return seconds >= 1 && seconds <= MAX_SECONDS ? seconds : null;
	}

	// ---------- Counting down ----------
	$effect(() => {
		if (!running) return;
		const id = setInterval(() => {
			remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
			if (remaining === 0) finish();
		}, 250);
		return () => clearInterval(id);
	});

	function start() {
		sound.prime(); // we're in a click, so the alarm is allowed to play later
		if (finished || remaining <= 0) {
			stopRinging();
			finished = false;
			remaining = total;
		}
		endAt = Date.now() + remaining * 1000;
		running = true;
	}

	function pause() {
		running = false;
	}

	function reset() {
		stopRinging();
		running = false;
		finished = false;
		remaining = total;
	}

	function finish() {
		running = false;
		finished = true;
		startRinging();
		win.focus(); // pop the window up even if it was minimized
	}

	// ---------- Ringing ----------
	function burst() {
		// three quick beeps
		sound.tone(880, 0, 0.14);
		sound.tone(880, 0.22, 0.14);
		sound.tone(880, 0.44, 0.14);
	}

	function startRinging() {
		stopRinging();
		ringing = true;
		burst();
		let count = 1;
		ringTimer = setInterval(() => {
			if (++count > RING_REPEATS) stopRinging();
			else burst();
		}, 1600);
	}

	function stopRinging() {
		clearInterval(ringTimer);
		ringTimer = undefined;
		ringing = false;
	}

	onDestroy(stopRinging);

	// ---------- Editing the time ----------
	function beginEdit() {
		if (running) pause();
		stopRinging();
		draft = format(remaining);
		invalid = false;
		editing = true;
	}

	$effect(() => {
		if (editing) {
			tick().then(() => {
				editInput?.focus();
				editInput?.select();
			});
		}
	});

	function commit(): boolean {
		const seconds = parseDuration(draft);
		if (seconds === null) {
			invalid = true;
			return false;
		}
		total = seconds;
		remaining = seconds;
		finished = false;
		editing = false;
		invalid = false;
		return true;
	}

	function cancelEdit() {
		editing = false;
		invalid = false;
	}

	function onEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancelEdit();
		}
	}

	// Show the countdown in the title bar too
	$effect(() => {
		win.setTitle(finished ? "Time's up" : running ? `Timer ${format(remaining)}` : 'Timer');
	});

	const btn =
		'cursor-pointer rounded-xl border-2 px-5 py-1.5 text-sm font-bold transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
</script>

<div class="grid h-full place-items-center p-4">
	<div class="flex flex-col items-center gap-5">
		<div class="relative grid size-48 place-items-center">
			<svg viewBox="0 0 100 100" class="absolute inset-0 size-full -rotate-90" aria-hidden="true">
				<circle cx="50" cy="50" r={RADIUS} fill="none" stroke-width="4" class="stroke-base-content/15" />
				<circle
					cx="50"
					cy="50"
					r={RADIUS}
					fill="none"
					stroke-width="4"
					stroke-linecap="round"
					stroke-dasharray={CIRCUMFERENCE}
					stroke-dashoffset={CIRCUMFERENCE * (1 - progress)}
					class="transition-[stroke-dashoffset] duration-300 {finished
						? 'stroke-error motion-safe:animate-pulse'
						: 'stroke-primary'}"
				/>
			</svg>

			{#if editing}
				<div class="relative flex flex-col items-center gap-1">
					<input
						bind:this={editInput}
						bind:value={draft}
						oninput={() => (invalid = false)}
						onkeydown={onEditKeydown}
						onblur={() => (parseDuration(draft) === null ? cancelEdit() : commit())}
						type="text"
						inputmode="numeric"
						aria-label="New time in minutes, or minutes:seconds"
						aria-invalid={invalid}
						autocomplete="off"
						class="w-32 border-b-2 bg-transparent text-center text-4xl font-bold tabular-nums outline-none {invalid
							? 'border-error text-error'
							: 'border-primary'}"
					/>
					<p class="text-xs {invalid ? 'text-error' : 'text-base-content/50'}">
						{invalid ? 'Try 25 or 1:30' : 'minutes or mm:ss'}
					</p>
				</div>
			{:else}
				<button
					type="button"
					onclick={beginEdit}
					aria-label="Edit time, currently {format(remaining)}"
					title="Click to change the time"
					class="relative cursor-pointer rounded-lg px-2 text-4xl font-bold tabular-nums transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary {finished
						? 'text-error'
						: ''}"
				>
					{format(remaining)}
				</button>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			{#if ringing}
				<button type="button" onclick={stopRinging} class="{btn} border-error bg-error text-error-content">
					Stop
				</button>
			{:else if running}
				<button type="button" onclick={pause} class="{btn} border-primary text-primary hover:bg-primary hover:text-primary-content">
					Pause
				</button>
			{:else}
				<button type="button" onclick={start} class="{btn} border-primary bg-primary text-primary-content">
					{remaining < total && remaining > 0 ? 'Resume' : 'Start'}
				</button>
			{/if}
			<button
				type="button"
				onclick={reset}
				class="{btn} border-base-content/20 hover:border-primary hover:text-primary"
			>
				Reset
			</button>
		</div>

		<p class="text-xs text-base-content/50" aria-live="polite">
			{finished ? "Time's up!" : 'Click the time to change it'}
		</p>
	</div>
</div>