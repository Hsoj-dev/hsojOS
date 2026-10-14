<!-- src/routes/projects/hsojOS/os/apps/Snake.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { getWindowContext } from '../context';

	const win = getWindowContext();

	const GRID = 20;
	const BOARD = 360; // px
	const CELL = BOARD / GRID;
	const BEST_KEY = 'hsojos:snake-best';

	type Cell = { x: number; y: number };
	type Phase = 'ready' | 'playing' | 'paused' | 'over';

	let phase = $state<Phase>('ready');
	let score = $state(0);
	let best = $state(0);
	let canvas: HTMLCanvasElement | undefined = $state();

	// Game state (not shown directly, so no need to be reactive)
	let snake: Cell[] = [];
	let dir: Cell = { x: 1, y: 0 };
	let queue: Cell[] = []; // buffered turns, so fast key presses aren't lost
	let food: Cell = { x: 0, y: 0 };
	let timer: ReturnType<typeof setTimeout> | undefined;
	let ctx: CanvasRenderingContext2D | null = null;
	let swipeStart: { x: number; y: number } | null = null;
	let colors = { bg: '#202020', tint: '#f5f5f5', body: '#a6d0ff', head: '#f5f5f5', food: '#ff8a80' };

	const UP = { x: 0, y: -1 };
	const DOWN = { x: 0, y: 1 };
	const LEFT = { x: -1, y: 0 };
	const RIGHT = { x: 1, y: 0 };

	onMount(() => {
		if (!canvas) return;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = BOARD * dpr;
		canvas.height = BOARD * dpr;
		ctx = canvas.getContext('2d');
		ctx?.scale(dpr, dpr);

		// Use the site's theme colors
		const styles = getComputedStyle(document.documentElement);
		const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
		colors = {
			bg: read('--color-base-300', colors.bg),
			tint: read('--color-base-content', colors.tint),
			body: read('--color-primary', colors.body),
			head: read('--color-base-content', colors.head),
			food: read('--color-error', colors.food)
		};

		try {
			best = Number(localStorage.getItem(BEST_KEY)) || 0;
		} catch {
			/* storage blocked */
		}

		reset();
		return () => clearTimeout(timer);
	});

	// Pause automatically when you switch away
	$effect(() => {
		if ((!win.active || win.minimized) && phase === 'playing') pause();
	});

	// ---------- Game logic ----------
	function reset() {
		snake = [
			{ x: 10, y: 10 },
			{ x: 9, y: 10 },
			{ x: 8, y: 10 }
		];
		dir = RIGHT;
		queue = [];
		score = 0;
		placeFood();
		draw();
	}

	function placeFood() {
		const free: Cell[] = [];
		for (let x = 0; x < GRID; x++) {
			for (let y = 0; y < GRID; y++) {
				if (!snake.some((c) => c.x === x && c.y === y)) free.push({ x, y });
			}
		}
		food = free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 };
	}

	function start() {
		if (phase === 'over') reset();
		phase = 'playing';
		schedule();
	}

	function pause() {
		clearTimeout(timer);
		phase = 'paused';
	}

	function schedule() {
		clearTimeout(timer);
		// Gets faster as you eat, down to a limit
		timer = setTimeout(step, Math.max(65, 125 - score * 3));
	}

	function step() {
		if (phase !== 'playing') return;

		const turn = queue.shift();
		if (turn) dir = turn;

		const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
		const eating = head.x === food.x && head.y === food.y;
		// The tail moves out of the way this step, unless we're growing
		const body = eating ? snake : snake.slice(0, -1);

		const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
		if (hitWall || body.some((c) => c.x === head.x && c.y === head.y)) {
			gameOver();
			return;
		}

		snake = [head, ...(eating ? snake : snake.slice(0, -1))];
		if (eating) {
			score++;
			placeFood();
		}
		draw();
		schedule();
	}

	function gameOver() {
		clearTimeout(timer);
		phase = 'over';
		if (score > best) {
			best = score;
			try {
				localStorage.setItem(BEST_KEY, String(best));
			} catch {
				/* ignore */
			}
		}
		draw();
	}

	function turn(next: Cell) {
		const last = queue.at(-1) ?? dir;
		const opposite = next.x === -last.x && next.y === -last.y;
		const same = next.x === last.x && next.y === last.y;
		if (opposite || same) {
			if (phase !== 'playing') start();
			return;
		}
		if (queue.length < 2) queue.push(next);
		if (phase !== 'playing') start();
	}

	function togglePause() {
		if (phase === 'playing') pause();
		else start();
	}

	// ---------- Drawing ----------
	function draw() {
		const c = ctx;
		if (!c) return;

		c.fillStyle = colors.bg;
		c.fillRect(0, 0, BOARD, BOARD);

		// Faint checkerboard
		c.globalAlpha = 0.05;
		c.fillStyle = colors.tint;
		for (let x = 0; x < GRID; x++) {
			for (let y = 0; y < GRID; y++) {
				if ((x + y) % 2 === 0) c.fillRect(x * CELL, y * CELL, CELL, CELL);
			}
		}
		c.globalAlpha = 1;

		// Food
		c.fillStyle = colors.food;
		c.beginPath();
		c.arc((food.x + 0.5) * CELL, (food.y + 0.5) * CELL, CELL * 0.32, 0, Math.PI * 2);
		c.fill();

		// Snake
		snake.forEach((cell, i) => {
			c.fillStyle = i === 0 ? colors.head : colors.body;
			c.beginPath();
			if (c.roundRect) c.roundRect(cell.x * CELL + 1, cell.y * CELL + 1, CELL - 2, CELL - 2, 4);
			else c.rect(cell.x * CELL + 1, cell.y * CELL + 1, CELL - 2, CELL - 2);
			c.fill();
		});
	}

	// ---------- Input ----------
	function onKeydown(e: KeyboardEvent) {
		if (!win.active || win.minimized || e.ctrlKey || e.metaKey || e.altKey) return;
		if ((e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]')) return;

		const key = e.key.toLowerCase();
		let handled = true;
		if (key === 'arrowup' || key === 'w') turn(UP);
		else if (key === 'arrowdown' || key === 's') turn(DOWN);
		else if (key === 'arrowleft' || key === 'a') turn(LEFT);
		else if (key === 'arrowright' || key === 'd') turn(RIGHT);
		else if (key === ' ' || key === 'p') togglePause();
		else if (key === 'enter' && (phase === 'ready' || phase === 'over')) start();
		else handled = false;

		if (handled) e.preventDefault();
	}

	// Touch: swipe to turn, tap to start
	function onPointerDown(e: PointerEvent) {
		swipeStart = { x: e.clientX, y: e.clientY };
	}

	function onPointerUp(e: PointerEvent) {
		if (!swipeStart) return;
		const dx = e.clientX - swipeStart.x;
		const dy = e.clientY - swipeStart.y;
		swipeStart = null;

		if (Math.max(Math.abs(dx), Math.abs(dy)) >= 24) {
			turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : dy > 0 ? DOWN : UP);
		} else if (phase !== 'playing') {
			start();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="flex h-full flex-col items-center justify-center gap-3 p-3">
	<div class="flex justify-between text-sm" style:width="{BOARD}px">
		<p>Score <span class="font-bold text-primary tabular-nums">{score}</span></p>
		<p class="text-base-content/60">Best <span class="font-bold tabular-nums">{best}</span></p>
	</div>

	<div class="relative overflow-hidden rounded-lg border-2 border-base-content/20">
		<canvas
			bind:this={canvas}
			class="block touch-none"
			style:width="{BOARD}px"
			style:height="{BOARD}px"
			onpointerdown={onPointerDown}
			onpointerup={onPointerUp}
			aria-label="Snake game board"
		></canvas>

		{#if phase !== 'playing'}
			<div class="pointer-events-none absolute inset-0 grid place-items-center bg-base-300/70 p-4 text-center">
				{#if phase === 'ready'}
					<p class="font-bold">Press an arrow key to start</p>
				{:else if phase === 'paused'}
					<div class="space-y-1">
						<p class="text-lg font-bold">Paused</p>
						<p class="text-sm text-base-content/70">Press Space to resume</p>
					</div>
				{:else}
					<div class="space-y-1">
						<p class="text-lg font-bold text-error">Game over</p>
						<p class="text-sm">Score {score}</p>
						<p class="text-sm text-base-content/70">Press Space to play again</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<p class="text-xs text-base-content/50">Arrow keys or WASD to move. Space to pause.</p>
</div>