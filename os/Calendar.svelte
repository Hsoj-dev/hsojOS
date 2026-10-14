<!-- src/routes/projects/hsojOS/os/Calendar.svelte -->
<!-- The date button for the top bar, plus the month popup it opens -->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { sys } from './system.svelte';

	let { label }: { label: string } = $props();

	/** 0 = weeks start on Sunday, 1 = Monday */
	const WEEK_STARTS_ON = 0;

	const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

	let open = $state(false);
	let today = $state(new Date());
	let cursor = $state(firstOfMonth(new Date()));
	let root: HTMLElement | undefined = $state();
	let trigger: HTMLButtonElement | undefined = $state();

	const weekdays = Array.from({ length: 7 }, (_, i) =>
		// Jan 7 2024 was a Sunday
		new Date(2024, 0, 7 + WEEK_STARTS_ON + i)
			.toLocaleDateString('en-GB', { weekday: 'short' })
			.slice(0, 2)
	);

	let title = $derived(cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }));

	// Always 6 rows so the popup doesn't change height between months
	let weeks = $derived.by(() => {
		const offset = (cursor.getDay() - WEEK_STARTS_ON + 7) % 7;
		const y = cursor.getFullYear();
		const m = cursor.getMonth();
		return Array.from({ length: 6 }, (_, w) =>
			Array.from({ length: 7 }, (_, d) => new Date(y, m, 1 - offset + w * 7 + d))
		);
	});

	let onCurrentMonth = $derived(
		cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth()
	);

	const isToday = (d: Date) =>
		d.getFullYear() === today.getFullYear() &&
		d.getMonth() === today.getMonth() &&
		d.getDate() === today.getDate();

	function toggle() {
		if (!open) {
			today = new Date();
			cursor = firstOfMonth(today);
		}
		open = !open;
	}

	function shift(months: number) {
		cursor = new Date(cursor.getFullYear(), cursor.getMonth() + months, 1);
	}

	$effect(() => {
		if (sys.mode !== 'active') open = false;
	});

	function onWindowKeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') {
			open = false;
			trigger?.focus();
		}
	}

	function onWindowPointerDown(e: PointerEvent) {
		if (open && root && !root.contains(e.target as Node)) open = false;
	}

	const navBtn =
		'grid size-8 cursor-pointer place-items-center rounded-lg transition-colors hover:bg-base-content/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary';
</script>

<svelte:window
	onkeydown={onWindowKeydown}
	onpointerdown={onWindowPointerDown}
	onblur={() => (open = false)}
/>

<div bind:this={root} class="relative">
	<button
		bind:this={trigger}
		type="button"
		aria-expanded={open}
		aria-haspopup="dialog"
		onclick={toggle}
		class="cursor-pointer rounded-lg px-1 transition-colors hover:text-primary aria-expanded:text-primary focus-visible:outline-2 focus-visible:outline-primary"
	>
		{label}
	</button>

	{#if open}
		<div
			role="dialog"
			aria-label="Calendar"
			class="absolute top-full right-0 z-50 mt-3 w-72 rounded-2xl border-2 border-base-content/15 bg-base-100/90 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl"
			transition:fly={{ y: -8, duration: 140 }}
		>
			<div class="mb-2 flex items-center justify-between">
				<button type="button" class={navBtn} aria-label="Previous month" onclick={() => shift(-1)}>
					‹
				</button>
				<div class="flex items-center gap-2">
					<span class="font-bold" aria-live="polite">{title}</span>
					{#if !onCurrentMonth}
						<button
							type="button"
							onclick={() => (cursor = firstOfMonth(today))}
							class="cursor-pointer rounded-md border border-primary px-1.5 text-xs text-primary transition-colors hover:bg-primary hover:text-primary-content focus-visible:outline-2 focus-visible:outline-primary"
						>
							Today
						</button>
					{/if}
				</div>
				<button type="button" class={navBtn} aria-label="Next month" onclick={() => shift(1)}>
					›
				</button>
			</div>

			<table class="w-full table-fixed text-center text-sm">
				<thead>
					<tr>
						{#each weekdays as day}
							<th scope="col" class="py-1 text-xs font-normal text-base-content/50">{day}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each weeks as week}
						<tr>
							{#each week as day}
								<td class="p-0.5">
									<span
										aria-current={isToday(day) ? 'date' : undefined}
										class="grid aspect-square place-items-center rounded-lg
											{isToday(day)
											? 'bg-primary font-bold text-primary-content'
											: day.getMonth() === cursor.getMonth()
												? ''
												: 'text-base-content/30'}"
									>
										{day.getDate()}
									</span>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>