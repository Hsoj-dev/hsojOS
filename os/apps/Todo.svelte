<!-- src/routes/projects/hsojOS/os/apps/Todo.svelte -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { flip } from 'svelte/animate';

	type Todo = { id: string; text: string; done: boolean };
	const KEY = 'hsojos:todos';

	/** Load saved to-dos. Open ones always come first, done ones last. */
	function load(): Todo[] {
		try {
			const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
			const parsed = raw ? JSON.parse(raw) : [];
			if (!Array.isArray(parsed)) return [];
			const items: Todo[] = parsed
				.filter((t) => t && typeof t.id === 'string' && typeof t.text === 'string')
				.map((t) => ({ id: t.id, text: t.text, done: Boolean(t.done) }));
			return [...items.filter((t) => !t.done), ...items.filter((t) => t.done)];
		} catch {
			return [];
		}
	}

	let todos = $state<Todo[]>(load());
	let draft = $state('');
	let editingId = $state<string | null>(null);
	let editText = $state('');
	let draggingId = $state<string | null>(null);
	let animMs = $state(150);

	let list: HTMLElement | undefined = $state();
	let editInput: HTMLInputElement | undefined = $state();

	// `todos` is always [open items..., done items...]
	let open = $derived(todos.filter((t) => !t.done));
	let done = $derived(todos.filter((t) => t.done));

	// Save every change
	$effect(() => {
		try {
			localStorage.setItem(KEY, JSON.stringify(todos));
		} catch {
			/* storage blocked or full */
		}
	});

	onMount(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) animMs = 0;
	});

	const newId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

	// ---------- Add, finish, edit, delete ----------
	function add(e: SubmitEvent) {
		e.preventDefault();
		const text = draft.trim();
		if (!text) return;
		todos = [...open, { id: newId(), text, done: false }, ...done];
		draft = '';
	}

	function toggle(id: string) {
		const item = todos.find((t) => t.id === id);
		if (!item) return;
		const rest = todos.filter((t) => t.id !== id);

		if (!item.done) {
			// Finished: goes to the very bottom
			todos = [...rest, { ...item, done: true }];
		} else {
			// Un-finished: goes to the bottom of the open items
			const firstDone = rest.findIndex((t) => t.done);
			const revived = { ...item, done: false };
			todos =
				firstDone === -1 ? [...rest, revived] : [...rest.slice(0, firstDone), revived, ...rest.slice(firstDone)];
		}
	}

	function remove(id: string) {
		todos = todos.filter((t) => t.id !== id);
		if (editingId === id) editingId = null;
	}

	async function startEdit(todo: Todo) {
		editingId = todo.id;
		editText = todo.text;
		await tick();
		editInput?.focus();
		editInput?.select();
	}

	function commitEdit() {
		if (editingId === null) return;
		const text = editText.trim();
		// An empty edit keeps the old text instead of wiping the item
		if (text) todos = todos.map((t) => (t.id === editingId ? { ...t, text } : t));
		editingId = null;
	}

	function onEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commitEdit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			editingId = null;
		}
	}

	// ---------- Reordering ----------
	/** Move an open item to a new position among the open items */
	function move(id: string, toIndex: number) {
		const from = open.findIndex((t) => t.id === id);
		if (from === -1 || toIndex === from) return;
		const next = [...open];
		const [item] = next.splice(from, 1);
		next.splice(Math.max(0, Math.min(next.length, toIndex)), 0, item);
		todos = [...next, ...done];
	}

	function startDrag(e: PointerEvent, id: string) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		e.preventDefault();
		draggingId = id;
		// Capture on the list (which never moves) so the drag survives re-ordering
		list?.setPointerCapture(e.pointerId);
	}

	function onDragMove(e: PointerEvent) {
		if (!draggingId || !list) return;
		// The new index is how many OTHER rows have their middle above the pointer
		let target = 0;
		for (const row of list.querySelectorAll<HTMLElement>('[data-row]')) {
			if (row.dataset.row === draggingId) continue;
			const r = row.getBoundingClientRect();
			if (e.clientY > r.top + r.height / 2) target++;
		}
		move(draggingId, target);
	}

	function endDrag() {
		draggingId = null;
	}

	async function onGripKeydown(e: KeyboardEvent, id: string) {
		if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
		e.preventDefault();
		const i = open.findIndex((t) => t.id === id);
		move(id, i + (e.key === 'ArrowUp' ? -1 : 1));
		await tick();
		// Moving the row in the DOM drops focus, so put it back
		list?.querySelector<HTMLElement>(`[data-grip="${id}"]`)?.focus();
	}

	const iconBtn =
		'grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg opacity-60 transition-all hover:bg-base-content/10 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-primary';
</script>

{#snippet actions(todo: Todo)}
	<button type="button" class={iconBtn} aria-label="Edit {todo.text}" title="Edit" onclick={() => startEdit(todo)}>
		<svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M12 20h9" />
			<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
		</svg>
	</button>
	<button type="button" class="{iconBtn} hover:text-error" aria-label="Delete {todo.text}" title="Delete" onclick={() => remove(todo.id)}>
		<svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
			<path d="M18 6 6 18" />
			<path d="m6 6 12 12" />
		</svg>
	</button>
{/snippet}

{#snippet todoText(todo: Todo)}
	{#if editingId === todo.id}
		<input
			bind:this={editInput}
			bind:value={editText}
			onkeydown={onEditKeydown}
			onblur={commitEdit}
			type="text"
			aria-label="Edit to-do"
			class="min-w-0 flex-1 rounded border border-primary bg-transparent px-1.5 py-0.5 text-sm outline-none"
		/>
	{:else}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<span
			class="min-w-0 flex-1 text-sm break-words {todo.done ? 'text-base-content/50 line-through' : ''}"
			ondblclick={() => startEdit(todo)}
		>
			{todo.text}
		</span>
	{/if}
{/snippet}

<div class="flex h-full flex-col">
	<form class="flex shrink-0 gap-2 border-b border-base-content/15 p-2" onsubmit={add}>
		<input
			bind:value={draft}
			type="text"
			placeholder="Add a to-do"
			aria-label="New to-do"
			autocomplete="off"
			class="min-w-0 flex-1 rounded-lg border border-base-content/20 bg-base-content/5 px-3 py-1.5 text-sm outline-none placeholder:text-base-content/40 focus:border-primary"
		/>
		<button
			type="submit"
			class="shrink-0 cursor-pointer rounded-lg border-2 border-primary bg-primary px-3 py-1 text-sm font-bold text-primary-content transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
		>
			Add
		</button>
	</form>

	<div class="min-h-0 flex-1 overflow-y-auto p-2">
		{#if todos.length === 0}
			<p class="grid h-full place-items-center p-6 text-center text-sm text-base-content/50">
				Nothing to do yet. Add something above.
			</p>
		{/if}

		<ul
			bind:this={list}
			class="space-y-1"
			onpointermove={onDragMove}
			onpointerup={endDrag}
			onpointercancel={endDrag}
		>
			{#each open as todo (todo.id)}
				<li
					data-row={todo.id}
					animate:flip={{ duration: animMs }}
					class="flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors {draggingId === todo.id
						? 'border-primary bg-primary/10 shadow-lg'
						: 'border-transparent hover:bg-base-content/5'}"
				>
					<button
						type="button"
						data-grip={todo.id}
						class="grid size-6 shrink-0 cursor-grab touch-none place-items-center rounded text-base-content/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing"
						aria-label="Reorder {todo.text}. Drag, or use the up and down arrow keys."
						onpointerdown={(e) => startDrag(e, todo.id)}
						onkeydown={(e) => onGripKeydown(e, todo.id)}
					>
						<svg viewBox="0 0 24 24" class="size-4" fill="currentColor" aria-hidden="true">
							{#each [8, 16] as cx}
								{#each [6, 12, 18] as cy}
									<circle {cx} {cy} r="1.5" />
								{/each}
							{/each}
						</svg>
					</button>
					<input
						type="checkbox"
						checked={todo.done}
						onchange={() => toggle(todo.id)}
						aria-label="Mark {todo.text} as done"
						class="size-4 shrink-0 cursor-pointer accent-primary"
					/>
					{@render todoText(todo)}
					{@render actions(todo)}
				</li>
			{/each}
		</ul>

		{#if done.length > 0}
			<h2 class="px-2 pt-4 pb-1 text-xs text-base-content/50">Done ({done.length})</h2>
			<ul class="space-y-1">
				{#each done as todo (todo.id)}
					<li
						animate:flip={{ duration: animMs }}
						class="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 hover:bg-base-content/5"
					>
						<span class="size-6 shrink-0" aria-hidden="true"></span>
						<input
							type="checkbox"
							checked={todo.done}
							onchange={() => toggle(todo.id)}
							aria-label="Mark {todo.text} as not done"
							class="size-4 shrink-0 cursor-pointer accent-primary"
						/>
						{@render todoText(todo)}
						{@render actions(todo)}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
