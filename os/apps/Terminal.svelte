<!-- src/routes/projects/hsojOS/os/apps/Terminal.svelte -->
<script lang="ts">
	import { tick } from 'svelte';
	import { CONFIG } from '../config';
	import { getWindowContext } from '../context';

	const win = getWindowContext();

	const HOST = 'hsojos';
	const PROMPT = `${CONFIG.userName}@${HOST}:~$`;
	const LOGO = ['##    ##', '##    ##', '########', '##    ##', '##    ##'].join('\n');
	const HELP = [
		'Available commands:',
		'  help        Show this list',
		'  echo        Print text',
		'  hsojfetch   Show system info',
		'  whoami      Print the current user',
		'  date        Print today\'s date',
		'  time        Print the current time',
		'  clear       Clear the screen'
	].join('\n');

	type Entry =
		| { kind: 'cmd'; text: string }
		| { kind: 'out'; text: string }
		| { kind: 'err'; text: string }
		| { kind: 'fetch'; rows: [string, string][] };

	let entries = $state<Entry[]>([{ kind: 'out', text: "HsojOS terminal. Type 'help' to get started." }]);
	let input = $state('');
	let inputEl: HTMLInputElement | undefined = $state();
	let scroller: HTMLElement | undefined = $state();

	// Arrow up/down walks through earlier commands
	let past: string[] = [];
	let pastIndex = -1; // -1 means "not browsing"
	let draft = '';

	// Keep the newest output in view
	$effect(() => {
		void entries.length;
		tick().then(() => scroller?.scrollTo({ top: scroller.scrollHeight }));
	});

	// Typing should work as soon as the window is focused
	$effect(() => {
		if (win.active) inputEl?.focus();
	});

	function focusInput() {
		if (!getSelection()?.toString()) inputEl?.focus();
	}

	// ---------- Commands ----------
	function browserName() {
		const ua = navigator.userAgent;
		if (/Edg\//.test(ua)) return 'Edge';
		if (/OPR\//.test(ua)) return 'Opera';
		if (/Firefox\//.test(ua)) return 'Firefox';
		if (/Chrome\//.test(ua)) return 'Chrome';
		if (/Safari\//.test(ua)) return 'Safari';
		return 'Unknown';
	}

	function uptime() {
		const total = Math.floor(performance.now() / 1000);
		const h = Math.floor(total / 3600);
		const m = Math.floor((total % 3600) / 60);
		const s = total % 60;
		return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
	}

	function fetchRows(): [string, string][] {
		const nav = navigator as Navigator & { deviceMemory?: number };
		const dark = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		const palette = document.documentElement.dataset.palette;
		return [
			['OS', 'HsojOS'],
			['Host', location.host || 'localhost'],
			['Shell', 'hsojsh'],
			['Uptime', uptime()],
			['Resolution', `${innerWidth}x${innerHeight}`],
			['Theme', palette ? `${dark} / ${palette}` : dark],
			['Browser', browserName()],
			['CPU', `${navigator.hardwareConcurrency ?? '?'} threads`],
			['Memory', nav.deviceMemory ? `~${nav.deviceMemory} GB` : 'unknown']
		];
	}

	function execute(raw: string) {
		const line = raw.trim();
		entries.push({ kind: 'cmd', text: line });
		if (!line) return;

		const name = line.split(/\s+/)[0];
		const args = line.slice(name.length).trim();

		switch (name) {
			case 'help':
				entries.push({ kind: 'out', text: HELP });
				break;
			case 'echo': {
				// Strip one pair of surrounding quotes, like a real shell would
				const quoted = /^(["'])(.*)\1$/.exec(args);
				entries.push({ kind: 'out', text: quoted ? quoted[2] : args });
				break;
			}
			case 'hsojfetch':
				entries.push({ kind: 'fetch', rows: fetchRows() });
				break;
			case 'whoami':
				entries.push({ kind: 'out', text: CONFIG.userName });
				break;
			case 'date':
				entries.push({
					kind: 'out',
					text: new Date().toLocaleDateString('en-GB', {
						weekday: 'long',
						day: 'numeric',
						month: 'long',
						year: 'numeric'
					})
				});
				break;
			case 'time':
				entries.push({
					kind: 'out',
					text: new Date().toLocaleTimeString('en-US', {
						hour: 'numeric',
						minute: '2-digit',
						second: '2-digit',
						hour12: true
					})
				});
				break;
			case 'clear':
				entries = [];
				break;
			default:
				entries.push({ kind: 'err', text: `hsojsh: command not found: ${name}` });
		}
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const line = input;
		if (line.trim()) past.push(line.trim());
		pastIndex = -1;
		draft = '';
		input = '';
		execute(line);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowUp' && past.length > 0) {
			e.preventDefault();
			if (pastIndex === -1) {
				draft = input;
				pastIndex = past.length - 1;
			} else if (pastIndex > 0) {
				pastIndex--;
			}
			input = past[pastIndex];
		} else if (e.key === 'ArrowDown' && pastIndex !== -1) {
			e.preventDefault();
			pastIndex++;
			if (pastIndex >= past.length) {
				pastIndex = -1;
				input = draft;
			} else {
				input = past[pastIndex];
			}
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div
	bind:this={scroller}
	role="log"
	aria-live="polite"
	class="h-full overflow-auto p-3 text-sm"
	onclick={focusInput}
>
	{#each entries as entry}
		{#if entry.kind === 'cmd'}
			<p class="break-all"><span class="text-primary">{PROMPT}</span> {entry.text}</p>
		{:else if entry.kind === 'out'}
			<pre class="font-[inherit] break-words whitespace-pre-wrap">{entry.text}</pre>
		{:else if entry.kind === 'err'}
			<pre class="font-[inherit] break-words whitespace-pre-wrap text-error">{entry.text}</pre>
		{:else}
			<div class="my-2 flex flex-wrap gap-x-6 gap-y-2">
				<pre class="font-[inherit] leading-tight font-bold text-primary">{LOGO}</pre>
				<div>
					<p class="font-bold">
						<span class="text-primary">{CONFIG.userName}</span>@<span class="text-primary">{HOST}</span>
					</p>
					<p class="text-base-content/40">{'-'.repeat(CONFIG.userName.length + HOST.length + 1)}</p>
					{#each entry.rows as [label, value]}
						<p><span class="inline-block w-24 font-bold text-primary">{label}</span>{value}</p>
					{/each}
					<div class="mt-2 flex" aria-hidden="true">
						<span class="h-4 w-6 bg-primary"></span>
						<span class="h-4 w-6 bg-secondary"></span>
						<span class="h-4 w-6 bg-info"></span>
						<span class="h-4 w-6 bg-success"></span>
						<span class="h-4 w-6 bg-warning"></span>
						<span class="h-4 w-6 bg-error"></span>
					</div>
				</div>
			</div>
		{/if}
	{/each}

	<form class="flex items-center gap-2" onsubmit={submit}>
		<label for="terminal-input" class="shrink-0 text-primary">{PROMPT}</label>
		<input
			id="terminal-input"
			bind:this={inputEl}
			bind:value={input}
			onkeydown={onKeydown}
			type="text"
			autocomplete="off"
			autocapitalize="none"
			spellcheck="false"
			class="min-w-0 flex-1 bg-transparent caret-primary outline-none"
		/>
	</form>
</div>