<!-- src\routes\projects\hsojOS\os\PowerMenu.svelte -->
<!-- Full-screen power menu. Render OUTSIDE <main>, next to the other overlays. -->
<script lang="ts">
	import { tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { shell } from './shell.svelte';
	import { sys } from './system.svelte';

	const OPTIONS = [
		{ id: 'shutdown', label: 'Shut Down', run: () => sys.shutDown() },
		{ id: 'restart', label: 'Restart', run: () => sys.restart() },
		{ id: 'sleep', label: 'Sleep', run: () => sys.sleep() }
	] as const;

	let root: HTMLElement | undefined = $state();
	let opener: HTMLElement | null = null;

	$effect(() => {
		if (shell.powerOpen) {
			opener = document.activeElement as HTMLElement | null;
			tick().then(() => root?.querySelector<HTMLButtonElement>('[data-tile]')?.focus());
		}
	});

	$effect(() => {
		if (sys.mode !== 'active') shell.powerOpen = false;
	});

	function cancel() {
		shell.powerOpen = false;
		opener?.focus();
	}

	function choose(run: () => void) {
		shell.powerOpen = false;
		run();
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (!shell.powerOpen || !root) return;
		if (e.key === 'Escape') {
			cancel();
			return;
		}

		const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')];
		const i = buttons.indexOf(document.activeElement as HTMLButtonElement);

		if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
			e.preventDefault();
			const step = e.key === 'ArrowRight' ? 1 : -1;
			buttons[(i + step + buttons.length) % buttons.length]?.focus();
		} else if (e.key === 'Tab') {
			// Keep focus inside the dialog
			if (e.shiftKey && i <= 0) {
				e.preventDefault();
				buttons.at(-1)?.focus();
			} else if (!e.shiftKey && i === buttons.length - 1) {
				e.preventDefault();
				buttons[0]?.focus();
			}
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if shell.powerOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={root}
		role="dialog"
		aria-modal="true"
		aria-label="Power options"
		tabindex="-1"
		class="fixed inset-0 outline-none z-[9000] grid place-items-center bg-base-300/70 p-4 backdrop-blur-2xl"
		onclick={(e) => {
			if (e.target === e.currentTarget) cancel();
		}}
		transition:fade={{ duration: 150 }}
	>
		<div class="w-full max-w-xl">
			<div class="grid grid-cols-3 gap-2">
				{#each OPTIONS as option (option.id)}
					<button
						type="button"
						data-tile
						onclick={() => choose(option.run)}
						class="flex h-44 cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-base-content/15 bg-base-100 transition-colors hover:border-primary hover:text-primary focus-visible:border-primary focus-visible:text-primary focus-visible:outline-none sm:h-56"
					>
						<svg
							viewBox="0 0 24 24"
							class="size-10 sm:size-12"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							{#if option.id === 'shutdown'}
								<path d="M12 3v9" />
								<path d="M6.3 6.8a8 8 0 1 0 11.4 0" />
							{:else if option.id === 'restart'}
								<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
								<path d="M3 3v5h5" />
							{:else}
								<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
							{/if}
						</svg>
						<span class="text-sm">{option.label}</span>
					</button>
				{/each}
			</div>

			<button
				type="button"
				onclick={cancel}
				class="mt-2 w-full cursor-pointer rounded-xl border-2 border-base-content/15 bg-base-100 py-3 text-sm text-error transition-colors hover:bg-error hover:text-error-content focus-visible:bg-error focus-visible:text-error-content focus-visible:outline-none"
			>
				Cancel
			</button>
		</div>
	</div>
{/if}