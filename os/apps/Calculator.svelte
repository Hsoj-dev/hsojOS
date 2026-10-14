<!-- src/routes/projects/hsojOS/os/apps/Calculator.svelte -->
<script lang="ts">
	import { getWindowContext } from '../context';

	const win = getWindowContext();

	type Op = '+' | '−' | '×' | '÷';
	const MAX_DIGITS = 16;

	// Shown on screen
	let current = $state('0'); // the big number (raw text, no commas)
	let expression = $state(''); // the small line above it
	let error = $state<string | null>(null);

	// Calculator memory (not shown directly)
	let acc: number | null = null; // left-hand number of the pending operation
	let op: Op | null = null; // pending operator
	let typing = false; // digits are being typed (so the next digit appends)
	let entered = false; // `current` can be used as the right-hand number
	let justEvaluated = false; // last action was "="
	let lastOp: Op | null = null; // for repeating "=": 5 + 3 = = gives 11
	let lastB = 0;

	// ---------- Formatting ----------
	/** Round away floating point noise (0.1 + 0.2 becomes 0.3) */
	const fmt = (n: number) => String(parseFloat(n.toPrecision(15)));

	function group(s: string) {
		const neg = s.startsWith('-');
		const [int, frac] = (neg ? s.slice(1) : s).split('.');
		const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		return (neg ? '-' : '') + grouped + (frac !== undefined ? `.${frac}` : '');
	}

	/** Number as it appears in the small expression line */
	const f = (n: number) => group(fmt(n));

	let shown = $derived(error ?? group(current));
	// Shrink long numbers so they always fit
	let fontSize = $derived(shown.length <= 10 ? 3 : shown.length <= 13 ? 2.4 : shown.length <= 17 ? 1.9 : 1.5);

	// ---------- Math ----------
	function compute(a: number, o: Op, b: number): number | string {
		let r: number;
		if (o === '+') r = a + b;
		else if (o === '−') r = a - b;
		else if (o === '×') r = a * b;
		else {
			if (b === 0) return a === 0 ? 'Result is undefined' : 'Cannot divide by zero';
			r = a / b;
		}
		return Number.isFinite(r) ? r : 'Overflow';
	}

	function setError(message: string) {
		error = message;
		current = '0';
		acc = null;
		op = null;
		typing = false;
		entered = false;
		justEvaluated = false;
		lastOp = null;
	}

	// ---------- Actions ----------
	function clearAll() {
		current = '0';
		expression = '';
		error = null;
		acc = null;
		op = null;
		typing = false;
		entered = false;
		justEvaluated = false;
		lastOp = null;
	}

	function clearEntry() {
		if (error) return clearAll();
		current = '0';
		typing = false;
		entered = false;
		if (justEvaluated) {
			expression = '';
			justEvaluated = false;
			lastOp = null;
		} else if (op && acc !== null) {
			expression = `${f(acc)} ${op}`;
		}
	}

	function startNewCalculationIfNeeded() {
		if (justEvaluated) {
			expression = '';
			justEvaluated = false;
			lastOp = null;
		}
	}

	function digit(d: string) {
		if (error) clearAll();
		startNewCalculationIfNeeded();
		if (!typing) {
			current = d;
			typing = true;
		} else if (current === '0') {
			current = d;
		} else if (current.replace(/[-.]/g, '').length < MAX_DIGITS) {
			current += d;
		}
		entered = true;
	}

	function decimal() {
		if (error) clearAll();
		startNewCalculationIfNeeded();
		if (!typing) {
			current = '0.';
			typing = true;
		} else if (!current.includes('.')) {
			current += '.';
		}
		entered = true;
	}

	function backspace() {
		if (error) return clearAll();
		if (!typing) return;
		current = current.length <= 1 || (current.length === 2 && current.startsWith('-')) ? '0' : current.slice(0, -1);
	}

	function negate() {
		if (error || current === '0') return;
		current = current.startsWith('-') ? current.slice(1) : `-${current}`;
		if (!typing) entered = true;
	}

	function operator(next: Op) {
		if (error) return;

		// Pressing a second operator in a row just swaps the first one
		if (op && acc !== null && !entered) {
			op = next;
			expression = `${f(acc)} ${next}`;
			return;
		}

		const value = Number(current);
		if (op && acc !== null) {
			const r = compute(acc, op, value);
			if (typeof r === 'string') return setError(r);
			acc = r;
			current = fmt(r);
		} else {
			acc = value;
		}
		op = next;
		expression = `${f(acc)} ${next}`;
		typing = false;
		entered = false;
		justEvaluated = false;
		lastOp = null;
	}

	function equals() {
		if (error) return;

		if (op && acc !== null) {
			const b = Number(current);
			const r = compute(acc, op, b);
			if (typeof r === 'string') return setError(r);
			// The sum slides up small, the answer takes over the big display
			expression = `${f(acc)} ${op} ${f(b)} =`;
			lastOp = op;
			lastB = b;
			current = fmt(r);
			op = null;
			acc = null;
		} else if (lastOp && justEvaluated) {
			// Pressing = again repeats the last operation
			const a = Number(current);
			const r = compute(a, lastOp, lastB);
			if (typeof r === 'string') return setError(r);
			expression = `${f(a)} ${lastOp} ${f(lastB)} =`;
			current = fmt(r);
		} else {
			expression = `${f(Number(current))} =`;
		}
		typing = false;
		entered = true;
		justEvaluated = true;
	}

	function unary(kind: 'inverse' | 'square' | 'root') {
		if (error) return;
		const v = Number(current);
		let r: number;
		let label: string;

		if (kind === 'inverse') {
			if (v === 0) return setError(v === 0 ? 'Cannot divide by zero' : '');
			r = 1 / v;
			label = `1/(${f(v)})`;
		} else if (kind === 'square') {
			r = v * v;
			label = `sqr(${f(v)})`;
		} else {
			if (v < 0) return setError('Invalid input');
			r = Math.sqrt(v);
			label = `√(${f(v)})`;
		}
		if (!Number.isFinite(r)) return setError('Overflow');

		expression = op && acc !== null ? `${f(acc)} ${op} ${label}` : label;
		current = fmt(r);
		typing = false;
		entered = true;
		justEvaluated = false;
		lastOp = null;
	}

	function percent() {
		if (error) return;
		const v = Number(current);
		if (op && acc !== null) {
			// 200 + 10% means 200 + 20, but 200 × 10% means 200 × 0.1
			const r = op === '+' || op === '−' ? (acc * v) / 100 : v / 100;
			expression = `${f(acc)} ${op} ${f(r)}`;
			current = fmt(r);
		} else {
			current = '0';
			expression = '0';
		}
		typing = false;
		entered = true;
		justEvaluated = false;
	}

	// ---------- Keypad layout (matches the reference image) ----------
	type Key = { id: string; label: string; aria: string; kind: 'num' | 'fn' | 'eq'; run: () => void };
	const KEYS: Key[] = [
		{ id: 'percent', label: '%', aria: 'Percent', kind: 'fn', run: percent },
		{ id: 'ce', label: 'CE', aria: 'Clear entry', kind: 'fn', run: clearEntry },
		{ id: 'c', label: 'C', aria: 'Clear', kind: 'fn', run: clearAll },
		{ id: 'back', label: '', aria: 'Backspace', kind: 'fn', run: backspace },
		{ id: 'inverse', label: '1/x', aria: 'One over x', kind: 'fn', run: () => unary('inverse') },
		{ id: 'square', label: 'x²', aria: 'Square', kind: 'fn', run: () => unary('square') },
		{ id: 'root', label: '√x', aria: 'Square root', kind: 'fn', run: () => unary('root') },
		{ id: 'div', label: '÷', aria: 'Divide', kind: 'fn', run: () => operator('÷') },
		{ id: '7', label: '7', aria: '7', kind: 'num', run: () => digit('7') },
		{ id: '8', label: '8', aria: '8', kind: 'num', run: () => digit('8') },
		{ id: '9', label: '9', aria: '9', kind: 'num', run: () => digit('9') },
		{ id: 'mul', label: '×', aria: 'Multiply', kind: 'fn', run: () => operator('×') },
		{ id: '4', label: '4', aria: '4', kind: 'num', run: () => digit('4') },
		{ id: '5', label: '5', aria: '5', kind: 'num', run: () => digit('5') },
		{ id: '6', label: '6', aria: '6', kind: 'num', run: () => digit('6') },
		{ id: 'sub', label: '−', aria: 'Subtract', kind: 'fn', run: () => operator('−') },
		{ id: '1', label: '1', aria: '1', kind: 'num', run: () => digit('1') },
		{ id: '2', label: '2', aria: '2', kind: 'num', run: () => digit('2') },
		{ id: '3', label: '3', aria: '3', kind: 'num', run: () => digit('3') },
		{ id: 'add', label: '+', aria: 'Add', kind: 'fn', run: () => operator('+') },
		{ id: 'neg', label: '+/−', aria: 'Negate', kind: 'fn', run: negate },
		{ id: '0', label: '0', aria: '0', kind: 'num', run: () => digit('0') },
		{ id: 'dot', label: '.', aria: 'Decimal point', kind: 'num', run: decimal },
		{ id: 'eq', label: '=', aria: 'Equals', kind: 'eq', run: equals }
	];

	const KIND_CLASS = {
		num: 'bg-base-content/15 hover:bg-base-content/25',
		fn: 'bg-base-content/8 hover:bg-base-content/20',
		eq: 'bg-primary text-primary-content hover:brightness-110'
	};

	// ---------- Keyboard ----------
	function onKeydown(e: KeyboardEvent) {
		if (!win.active || e.ctrlKey || e.metaKey || e.altKey) return;
		if ((e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]')) return;

		const k = e.key;
		let handled = true;
		if (/^[0-9]$/.test(k)) digit(k);
		else if (k === '.' || k === ',') decimal();
		else if (k === '+') operator('+');
		else if (k === '-') operator('−');
		else if (k === '*' || k === 'x' || k === 'X') operator('×');
		else if (k === '/') operator('÷');
		else if (k === 'Enter' || k === '=') equals();
		else if (k === 'Backspace') backspace();
		else if (k === 'Escape') clearAll();
		else if (k === 'Delete') clearEntry();
		else if (k === '%') percent();
		else handled = false;

		// Also stops Enter from "clicking" whichever keypad button was last clicked
		if (handled) e.preventDefault();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="flex h-full flex-col gap-2 p-2">
	<div class="flex min-h-24 flex-col items-end justify-end gap-1 overflow-hidden px-2 pb-1">
		<p class="h-5 max-w-full truncate text-sm text-base-content/60" aria-label="Calculation">
			{expression}
		</p>
		<p
			class="max-w-full truncate leading-tight font-bold tabular-nums"
			style:font-size="{fontSize}rem"
			aria-live="polite"
			aria-label="Result"
		>
			{shown}
		</p>
	</div>

	<div class="grid flex-1 grid-cols-4 grid-rows-6 gap-1">
		{#each KEYS as key (key.id)}
			<button
				type="button"
				aria-label={key.aria}
				onclick={key.run}
				class="cursor-pointer rounded-lg text-lg transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary motion-reduce:transition-none {KIND_CLASS[key.kind]}"
			>
				{#if key.id === 'back'}
					<svg
						viewBox="0 0 24 24"
						class="mx-auto size-5"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
						<path d="m18 9-6 6" />
						<path d="m12 9 6 6" />
					</svg>
				{:else}
					{key.label}
				{/if}
			</button>
		{/each}
	</div>
</div>
