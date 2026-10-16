<!-- src/routes/projects/hsojOS/os/apps/Notes.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { htmlToText } from './notes-export';

	const KEY = 'hsojos:notes';

	type Format = {
		bold: boolean;
		italic: boolean;
		block: '' | 'h1' | 'h2';
		list: '' | 'ul' | 'ol' | 'task';
	};

	let editor: HTMLElement | undefined = $state();
	let empty = $state(true);
	let saving = $state(false);
	let fmt = $state<Format>({ bold: false, italic: false, block: '', list: '' });

	let saveTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		// Make Enter create <p> instead of <div>
		document.execCommand('defaultParagraphSeparator', false, 'p');

		try {
			const saved = localStorage.getItem(KEY);
			if (saved && editor) editor.innerHTML = saved;
		} catch {
			/* storage blocked */
		}
		refreshEmpty();

		document.addEventListener('selectionchange', updateFormat);
		return () => {
			document.removeEventListener('selectionchange', updateFormat);
			if (saveTimer) save(); // don't lose the last keystrokes
		};
	});

	// ---------- Saving ----------
	function scheduleSave() {
		saving = true;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(save, 400);
	}

	function save() {
		clearTimeout(saveTimer);
		saveTimer = undefined;
		try {
			if (editor) localStorage.setItem(KEY, editor.innerHTML);
		} catch {
			/* storage blocked or full */
		}
		saving = false;
	}

	function refreshEmpty() {
		empty = !editor || ((editor.textContent ?? '').trim() === '' && !editor.querySelector('li'));
	}

	function changed() {
		refreshEmpty();
		scheduleSave();
		updateFormat();
	}

	// ---------- Which formats are active at the cursor ----------
	function cursorElement(): HTMLElement | null {
		const sel = window.getSelection();
		const node = sel?.anchorNode;
		if (!editor || !node || !editor.contains(node)) return null;
		return node instanceof HTMLElement ? node : node.parentElement;
	}

	function updateFormat() {
		const el = cursorElement();
		if (!el) return;
		fmt = {
			bold: document.queryCommandState('bold'),
			italic: document.queryCommandState('italic'),
			block: el.closest('h1') ? 'h1' : el.closest('h2') ? 'h2' : '',
			list: el.closest('ul[data-task]') ? 'task' : el.closest('ul') ? 'ul' : el.closest('ol') ? 'ol' : ''
		};
	}

	// ---------- Toolbar commands ----------
	function run(command: string, value?: string) {
		editor?.focus();
		document.execCommand(command, false, value);
		changed();
	}

	const heading = (tag: 'h1' | 'h2') => run('formatBlock', fmt.block === tag ? '<p>' : `<${tag}>`);

	function bulletList() {
		editor?.focus();
		if (fmt.list === 'task') {
			// Task list to plain bullets
			cursorElement()?.closest('ul')?.removeAttribute('data-task');
			changed();
			return;
		}
		run('insertUnorderedList');
	}

	function taskList() {
		editor?.focus();
		if (fmt.list === 'task') {
			document.execCommand('insertUnorderedList'); // toggles the list off
		} else {
			if (fmt.list !== 'ul') document.execCommand('insertUnorderedList');
			cursorElement()?.closest('ul')?.setAttribute('data-task', '');
		}
		changed();
	}

	// ---------- Editor events ----------
	function onInput(e: Event) {
		// A new task line shouldn't be born ticked
		if ((e as InputEvent).inputType === 'insertParagraph') {
			const li = cursorElement()?.closest('li');
			if (li?.parentElement?.matches('ul[data-task]')) li.removeAttribute('data-checked');
		}
		changed();
	}

	// Clicking the box at the left of a task line ticks it
	function onEditorClick(e: MouseEvent) {
		const li = (e.target as HTMLElement).closest('li');
		if (!li || !li.parentElement?.matches('ul[data-task]')) return;
		if (e.clientX - li.getBoundingClientRect().left > 28) return;

		if (li.hasAttribute('data-checked')) li.removeAttribute('data-checked');
		else li.setAttribute('data-checked', '');
		changed();
	}

	function onKeydown(e: KeyboardEvent) {
		// Tab indents list items. Outside a list it keeps its normal job (moving focus).
		if (e.key === 'Tab' && cursorElement()?.closest('li')) {
			e.preventDefault();
			run(e.shiftKey ? 'outdent' : 'indent');
		}
	}

	// Paste as plain text so notes never pick up odd formatting
	function onPaste(e: ClipboardEvent) {
		e.preventDefault();
		document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '');
	}

	// ---------- Export ----------
	function download(ext: 'md' | 'txt') {
		if (!editor) return;
		const markdown = ext === 'md';
		const text = htmlToText(editor, markdown);

		// File name from the first line of the note
		const firstLine = text.split('\n').find((l) => l.trim()) ?? '';
		const slug = firstLine
			.replace(/[^\p{L}\p{N}]+/gu, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40)
			.toLowerCase();

		const blob = new Blob([text], { type: markdown ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${slug || 'note'}.${ext}`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	const tool =
		'grid h-8 min-w-8 cursor-pointer place-items-center rounded-lg px-1.5 text-sm transition-colors hover:bg-base-content/10 focus-visible:outline-2 focus-visible:outline-primary aria-pressed:bg-primary aria-pressed:text-primary-content';
	const svgProps = {
		viewBox: '0 0 24 24',
		fill: 'none',
		stroke: 'currentColor',
		'stroke-width': 2,
		'stroke-linecap': 'round' as const,
		'stroke-linejoin': 'round' as const
	};
</script>

<div class="flex h-full flex-col">
	<!-- mousedown preventDefault keeps the text selection while you click toolbar buttons -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="flex shrink-0 flex-wrap items-center gap-1 border-b border-base-content/15 p-1.5"
		role="toolbar"
		aria-label="Formatting"
		tabindex="-1"
		onmousedown={(e) => {
			if ((e.target as HTMLElement).closest('button')) e.preventDefault();
		}}
	>
		<button type="button" class="{tool} font-bold" aria-pressed={fmt.block === 'h1'} onclick={() => heading('h1')} title="Heading 1" aria-label="Heading 1">H1</button>
		<button type="button" class="{tool} font-bold" aria-pressed={fmt.block === 'h2'} onclick={() => heading('h2')} title="Heading 2" aria-label="Heading 2">H2</button>

		<span class="mx-1 h-5 w-px bg-base-content/15" aria-hidden="true"></span>

		<button type="button" class="{tool} font-bold" aria-pressed={fmt.bold} onclick={() => run('bold')} title="Bold" aria-label="Bold">B</button>
		<button type="button" class="{tool} italic" aria-pressed={fmt.italic} onclick={() => run('italic')} title="Italic" aria-label="Italic">I</button>

		<span class="mx-1 h-5 w-px bg-base-content/15" aria-hidden="true"></span>

		<button type="button" class={tool} aria-pressed={fmt.list === 'ul'} onclick={bulletList} title="Bulleted list" aria-label="Bulleted list">
			<svg {...svgProps} class="size-4" aria-hidden="true">
				<path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" />
				<path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />
			</svg>
		</button>
		<button type="button" class={tool} aria-pressed={fmt.list === 'ol'} onclick={() => run('insertOrderedList')} title="Numbered list" aria-label="Numbered list">
			<svg {...svgProps} class="size-4" aria-hidden="true">
				<path d="M10 6h11" /><path d="M10 12h11" /><path d="M10 18h11" />
				<path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
			</svg>
		</button>
		<button type="button" class={tool} aria-pressed={fmt.list === 'task'} onclick={taskList} title="Task list" aria-label="Task list">
			<svg {...svgProps} class="size-4" aria-hidden="true">
				<path d="m3 17 2 2 4-4" /><path d="m3 7 2 2 4-4" />
				<path d="M13 6h8" /><path d="M13 12h8" /><path d="M13 18h8" />
			</svg>
		</button>

		<div class="ml-auto flex items-center gap-1">
			<span class="px-1 text-xs text-base-content/50" aria-live="polite">{saving ? 'Saving…' : 'Saved'}</span>
			<button type="button" class="{tool} px-2.5" onclick={() => download('md')}>Save .md</button>
			<button type="button" class="{tool} px-2.5" onclick={() => download('txt')}>Save .txt</button>
		</div>
	</div>

	<div class="relative min-h-0 flex-1 overflow-y-auto">
		{#if empty}
			<p class="pointer-events-none absolute top-3 left-4 text-sm text-base-content/40">Start writing…</p>
		{/if}
		<div
			bind:this={editor}
			contenteditable="true"
			role="textbox"
			aria-multiline="true"
			aria-label="Note"
			tabindex="0"
			class="notes prose prose-sm min-h-full max-w-none px-4 py-3 outline-none"
			style="--tw-prose-body: var(--color-base-content); --tw-prose-headings: var(--color-base-content); --tw-prose-bold: var(--color-base-content); --tw-prose-counters: var(--color-base-content); --tw-prose-bullets: var(--color-base-content); --tw-prose-links: var(--color-primary);"
			oninput={onInput}
			onclick={onEditorClick}
			onkeydown={onKeydown}
			onpaste={onPaste}
		></div>
	</div>
</div>

<style>
	/* Task lists: a ticked-box look made from CSS, so it works inside contenteditable */
	.notes :global(ul[data-task]) {
		list-style: none;
		padding-left: 0;
	}
	.notes :global(ul[data-task] > li) {
		position: relative;
		padding-left: 1.75rem;
	}
	.notes :global(ul[data-task] > li::before) {
		content: '';
		position: absolute;
		left: 0;
		top: 0.3em;
		width: 1rem;
		height: 1rem;
		border: 2px solid var(--color-base-content);
		border-radius: 0.25rem;
		opacity: 0.7;
		cursor: pointer;
	}
	.notes :global(ul[data-task] > li[data-checked]::before) {
		background: var(--color-primary);
		border-color: var(--color-primary);
		opacity: 1;
	}
	.notes :global(ul[data-task] > li[data-checked]::after) {
		content: '';
		position: absolute;
		left: 0.33rem;
		top: 0.42em;
		width: 0.28rem;
		height: 0.55rem;
		border: solid var(--color-primary-content);
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}
	.notes :global(ul[data-task] > li[data-checked]) {
		text-decoration: line-through;
		opacity: 0.6;
	}
</style>