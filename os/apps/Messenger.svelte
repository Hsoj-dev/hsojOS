<!-- src/routes/projects/hsojOS/os/apps/Messenger.svelte -->
<!--
  The guestbook, dressed as a chat app.
  - Reading: we fetch the messages ourselves, so each message keeps its exact time and replies.
  - Writing: the real Guestbooks form + official embed script (same as the main site), so
    validation and any future verification step keep working. It just sits in a Messenger-style pane.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { CONFIG } from '../config';
	import {
		buildThreads,
		chatItems,
		lastMessage,
		type ApiMessage,
		type Thread
	} from './guestbook-threads';

	const { id: GUESTBOOK_ID, host: HOST, maxLength: MAX } = CONFIG.guestbook;
	const MAX_PAGES = 25; // 20 messages per page

	let threads = $state<Thread[]>([]);
	let loading = $state(true);
	let loadError = $state(false);
	let selectedKey = $state<string | null>(null);
	let composing = $state(false);

	// Form state
	let formEl: HTMLFormElement | undefined = $state();
	let chatScroller: HTMLElement | undefined = $state();
	let text = $state('');
	let submitted = false;

	let selected = $derived(threads.find((t) => t.key === selectedKey) ?? null);
	let view = $derived<'compose' | 'chat' | 'none'>(composing ? 'compose' : selected ? 'chat' : 'none');

	// ---------- Reading messages ----------
	async function fetchMessages(): Promise<ApiMessage[]> {
		const all: ApiMessage[] = [];
		for (let page = 1; page <= MAX_PAGES; page++) {
			const res = await fetch(`${HOST}/api/v2/get-guestbook-messages/${GUESTBOOK_ID}?page=${page}&limit=20`);
			if (!res.ok) throw new Error(String(res.status));
			const data = await res.json();
			all.push(...(data.messages ?? []));
			if (!data.pagination?.hasNext) break;
		}
		return all;
	}

	async function refresh() {
		loading = true;
		loadError = false;
		try {
			threads = buildThreads(await fetchMessages());
		} catch {
			loadError = true;
		} finally {
			loading = false;
		}
	}

	// ---------- Navigation ----------
	async function openThread(key: string) {
		composing = false;
		selectedKey = key;
		await tick();
		chatScroller?.scrollTo({ top: chatScroller.scrollHeight });
	}

	function openCompose() {
		composing = true;
		selectedKey = null;
	}

	function backToList() {
		composing = false;
		selectedKey = null;
	}

	// ---------- Sending (handled by the official embed script) ----------
	function onSubmit() {
		submitted = true;
	}

	// Only used if the embed script didn't load: the form then posts into the hidden iframe
	function onFrameLoad() {
		if (!submitted) return;
		submitted = false;
		formEl?.reset();
	}

	onMount(() => {
		refresh();

		// Load the embed script only after the form and containers exist
		const script = document.createElement('script');
		script.src = `${HOST}/resources/js/embed_script/${GUESTBOOK_ID}/script.js`;
		script.async = true;
		document.body.append(script);
		return () => script.remove();
	});

	// ---------- Display helpers ----------
	const dayLabel = (d: Date) =>
		d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	const timeLabel = (d: Date) =>
		d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
	const shortDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	const initial = (name: string) => (Array.from(name)[0] ?? '?').toUpperCase();

	let items = $derived(selected ? chatItems(selected, dayLabel) : []);
	let left = $derived(MAX - text.length);

	const field =
		'w-full rounded-xl border-2 border-base-content/20 bg-base-content/5 px-3 py-2 text-sm outline-none placeholder:text-base-content/40 focus:border-primary';
	const iconBtn =
		'grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg transition-colors hover:bg-base-content/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary';
</script>

<!-- Fallback target so a failed script never navigates the whole OS away -->
<iframe name="guestbook-target" title="Guestbook submission" class="hidden" onload={onFrameLoad}></iframe>

<!-- The embed script writes its own copy of the messages in here. We hide it and use our own list. -->
<div class="hidden" aria-hidden="true">
	<div id="guestbooks___guestbook-messages-container"></div>
</div>

<div class="@container h-full">
	<div class="flex h-full">
		<!-- Conversations -->
		<aside
			class="min-h-0 w-full flex-col border-base-content/15 @md:flex @md:w-64 @md:shrink-0 @md:border-r {view === 'none' ? 'flex' : 'hidden'}"
			aria-label="Conversations"
		>
			<div class="flex shrink-0 items-center justify-between border-b border-base-content/15 px-3 py-2">
				<h1 class="text-lg font-bold">Chats</h1>
				<div class="flex">
					<button type="button" class={iconBtn} aria-label="Refresh" title="Refresh" onclick={refresh}>
						<svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
						</svg>
					</button>
					<button type="button" class={iconBtn} aria-label="New message" title="New message" onclick={openCompose}>
						<svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
						</svg>
					</button>
				</div>
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto">
				{#if loading && threads.length === 0}
					<p class="p-4 text-sm text-base-content/60">Loading messages…</p>
				{:else if loadError && threads.length === 0}
					<div class="space-y-3 p-4">
						<p role="alert" class="text-sm text-error">Couldn't load the messages.</p>
						<button type="button" onclick={refresh} class="cursor-pointer rounded-xl border-2 border-base-content/20 px-3 py-1 text-sm font-bold hover:border-primary hover:text-primary">
							Try again
						</button>
					</div>
				{:else if threads.length === 0}
					<p class="p-4 text-sm text-base-content/60">No messages yet. Be the first to write one.</p>
				{:else}
					<ul>
						{#each threads as thread (thread.key)}
							{@const last = lastMessage(thread)}
							<li>
								<button
									type="button"
									onclick={() => openThread(thread.key)}
									aria-current={selectedKey === thread.key ? 'true' : undefined}
									class="flex w-full cursor-pointer items-center gap-3 border-l-4 border-transparent px-3 py-2.5 text-left transition-colors hover:bg-base-content/5 focus-visible:bg-base-content/5 focus-visible:outline-none aria-[current=true]:border-primary aria-[current=true]:bg-primary/10"
								>
									<span aria-hidden="true" class="grid size-10 shrink-0 place-items-center rounded-full border-2 border-base-content/20 font-bold">
										{initial(thread.name)}
									</span>
									<span class="min-w-0 flex-1">
										<span class="flex items-baseline justify-between gap-2">
											<span class="truncate text-sm font-bold">{thread.name}</span>
											<span class="shrink-0 text-[11px] text-base-content/50">{shortDate(last.at)}</span>
										</span>
										<span class="block truncate text-xs text-base-content/60">
											{last.mine ? 'You: ' : ''}{last.text}
										</span>
									</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</aside>

		<!-- Main pane -->
		<div class="min-h-0 min-w-0 flex-1 flex-col @md:flex {view === 'none' ? 'hidden' : 'flex'}">
			<!-- Nothing selected (wide windows only) -->
			{#if view === 'none'}
				<div class="grid flex-1 place-items-center p-6 text-center">
					<div class="max-w-xs space-y-3">
						<p class="text-lg font-bold">Messenger (Guestbook)</p>
						<p class="text-sm text-base-content/60">Pick a conversation, or write a new message.</p>
						<button type="button" onclick={openCompose} class="cursor-pointer rounded-xl border-2 border-primary bg-primary px-4 py-1.5 text-sm font-bold text-primary-content">
							New message
						</button>
					</div>
				</div>
			{/if}

			<!-- A conversation -->
			{#if view === 'chat' && selected}
				<header class="flex shrink-0 items-center gap-3 border-b border-base-content/15 px-3 py-2">
					<button type="button" class="{iconBtn} @md:hidden" aria-label="Back to chats" onclick={backToList}>←</button>
					<span aria-hidden="true" class="grid size-9 shrink-0 place-items-center rounded-full border-2 border-base-content/20 font-bold">
						{initial(selected.name)}
					</span>
					<div class="min-w-0">
						<h2 class="truncate text-sm font-bold">{selected.name}</h2>
						{#if selected.website}
							<a href={selected.website} target="_blank" rel="ugc nofollow noopener noreferrer" class="block truncate text-xs text-primary underline underline-offset-2 hover:no-underline">
								{selected.website}
							</a>
						{/if}
					</div>
				</header>

				<div bind:this={chatScroller} class="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-4">
					{#each items as item}
						{#if item.kind === 'day'}
							<p class="py-2 text-center text-xs text-base-content/50">{item.label}</p>
						{:else}
							<div class="flex flex-col {item.kind === 'owner' ? 'items-end' : 'items-start'}">
								<p
									class="max-w-[80%] rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap {item.kind === 'owner'
										? 'rounded-br-md bg-primary text-primary-content'
										: 'rounded-bl-md bg-base-content/10'}"
								>
									{item.text}
								</p>
								<span class="mt-0.5 px-1 text-[11px] text-base-content/50">
									{item.kind === 'owner' ? `${item.who} · ` : ''}{timeLabel(item.at)}
								</span>
							</div>
						{/if}
					{/each}
				</div>

				<footer class="shrink-0 border-t border-base-content/15 p-2 text-center">
					<button type="button" onclick={openCompose} class="cursor-pointer rounded-xl px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary">
						Write your own message
					</button>
				</footer>
			{/if}

			<!-- The real Guestbooks form. It must stay in the page so the embed script can find it,
			     so it is hidden with CSS instead of being removed. -->
			<section class="min-h-0 flex-1 flex-col {view === 'compose' ? 'flex' : 'hidden'}" aria-label="New message">
				<header class="flex shrink-0 items-center gap-3 border-b border-base-content/15 px-3 py-2">
					<button type="button" class="{iconBtn} @md:hidden" aria-label="Back to chats" onclick={backToList}>←</button>
					<h2 class="text-sm font-bold">New message</h2>
				</header>

				<div class="min-h-0 flex-1 overflow-y-auto p-4">
					<div id="guestbooks___guestbook-form-container" class="mx-auto max-w-md">
						<form
							bind:this={formEl}
							id="guestbooks___guestbook-form"
							action="{HOST}/guestbook/{GUESTBOOK_ID}/submit"
							method="post"
							target="guestbook-target"
							onsubmit={onSubmit}
							onreset={() => (text = '')}
							class="flex flex-col gap-3"
						>
							<input type="text" name="name" placeholder="Your name" aria-label="Your name" required class={field} />
							<input type="url" name="website" placeholder="Website (optional)" aria-label="Website (optional)" class={field} />

							<div id="guestbooks___challenge-answer-container"></div>

							<div>
								<textarea
									name="text"
									rows="5"
									maxlength={MAX}
									placeholder="Write your message… (plain text only)"
									aria-label="Your message"
									required
									bind:value={text}
									class="{field} resize-y"
								></textarea>
								<p class="mt-1 text-right text-xs {left < 50 ? 'text-warning' : 'text-base-content/60'}">
									{text.length}/{MAX}
								</p>
							</div>

							<p class="text-xs text-base-content/60">
								All messages are reviewed and approved before they show up in the guestbook.
							</p>

							<div id="guestbooks___pow-status" class="text-sm"></div>

							<div id="guestbooks___feedback-container" hidden>
								<div id="guestbooks___error-message" class="text-sm text-error"></div>
								<div id="guestbooks___success-message" class="text-sm text-success" hidden></div>
							</div>

							<button
								type="submit"
								class="cursor-pointer rounded-xl border-2 border-primary bg-primary px-4 py-2 text-sm font-bold text-primary-content transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-50"
							>
								Send message
							</button>
						</form>

						<p class="mt-4 text-right text-xs text-base-content/50">
							Powered by <a href={HOST} target="_blank" rel="noopener noreferrer" class="underline hover:text-primary">Guestbooks</a>
						</p>
					</div>
				</div>
			</section>
		</div>
	</div>
</div>