<!-- src\routes\projects\hsojOS\os\ScreenSaver.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	const FONT_SIZE = 18;
	const STEP_MS = 50;
	const CHARS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ0123456789ABCDEF<>/=+*';

	let canvas: HTMLCanvasElement | undefined = $state();

	onMount(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Pull colors from the active theme so the rain matches light/dark and palettes
		const styles = getComputedStyle(document.documentElement);
		const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
		const bg = read('--color-base-300', '#202020');
		const trail = read('--color-primary', '#a6d0ff');
		const head = read('--color-base-content', '#f5f5f5');

		const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

		let width = 0;
		let height = 0;
		let columns = 0;
		let pos: number[] = []; // fractional row of each column's head
		let lastRow: number[] = [];
		let speed: number[] = [];

		const rand = () => CHARS[Math.floor(Math.random() * CHARS.length)];

		function resize() {
			const dpr = window.devicePixelRatio || 1;
			width = window.innerWidth;
			height = window.innerHeight;
			canvas!.width = width * dpr;
			canvas!.height = height * dpr;
			ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx!.fillStyle = bg;
			ctx!.fillRect(0, 0, width, height);

			columns = Math.ceil(width / FONT_SIZE);
			const rows = height / FONT_SIZE;
			pos = Array.from({ length: columns }, () => -Math.random() * rows);
			lastRow = Array.from({ length: columns }, () => -1);
			speed = Array.from({ length: columns }, () => 0.4 + Math.random() * 0.9);
		}

		function step() {
			const c = ctx!;
			// Fade everything a little each step: that's what makes the trails
			c.globalAlpha = 0.12;
			c.fillStyle = bg;
			c.fillRect(0, 0, width, height);
			c.globalAlpha = 1;

			c.font = `${FONT_SIZE}px "JetBrains Mono", monospace`;
			c.textBaseline = 'top';

			for (let i = 0; i < columns; i++) {
				pos[i] += speed[i];
				const row = Math.floor(pos[i]);
				if (row < 0 || row === lastRow[i]) continue;

				const x = i * FONT_SIZE;
				// Last step's bright head becomes a normal trail character
				if (row > 0) {
					c.fillStyle = bg;
					c.fillRect(x, (row - 1) * FONT_SIZE, FONT_SIZE, FONT_SIZE);
					c.fillStyle = trail;
					c.fillText(rand(), x, (row - 1) * FONT_SIZE);
				}
				c.fillStyle = head;
				c.fillText(rand(), x, row * FONT_SIZE);
				lastRow[i] = row;

				if (row * FONT_SIZE > height && Math.random() > 0.97) {
					pos[i] = 0;
					lastRow[i] = -1;
				}
			}
		}

		resize();
		window.addEventListener('resize', resize);

		let raf = 0;
		let lastTime = 0;
		function frame(t: number) {
			raf = requestAnimationFrame(frame);
			if (t - lastTime < STEP_MS) return;
			lastTime = t;
			step();
		}
		// With reduced motion the screen saver is just a plain dark screen
		if (!reduceMotion) raf = requestAnimationFrame(frame);

		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', resize);
		};
	});
</script>

<div
	role="img"
	aria-label="Screen saver. Move the mouse or press a key to wake."
	class="fixed inset-0 z-[9999] cursor-none bg-base-300"
	transition:fade|global={{ duration: 300 }}
>
	<canvas bind:this={canvas} aria-hidden="true" class="size-full"></canvas>
</div>