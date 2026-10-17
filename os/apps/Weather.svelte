<!-- src/routes/projects/hsojOS/os/apps/Weather.svelte -->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { loc, searchPlaces, type Place } from '../location.svelte';
	import { describe, ICON_PATHS, tips, type Conditions, type IconKind } from './weather-utils';

	type Day = { date: string; code: number; max: number; min: number; rain: number; uv: number };
	type Forecast = {
		updated: Date;
		temp: number;
		feels: number;
		humidity: number;
		wind: number;
		code: number;
		isDay: boolean;
		days: Day[];
	};

	const UNIT_KEY = 'hsojos:weather-unit';

	let weather = $state<Forecast | null>(null);
	let loading = $state(false);
	let error = $state('');
	let useF = $state(false);

	let query = $state('');
	let hits = $state<Place[]>([]);
	let searching = $state(false);
	let searchMessage = $state('');

	let token = 0; // ignore answers from older requests

	onMount(() => {
		try {
			useF = localStorage.getItem(UNIT_KEY) === 'f';
		} catch {
			/* ignore */
		}
		loc.load();
		if (!loc.place) loc.locate();
	});

	// Fetch whenever the place changes
	$effect(() => {
		const place = loc.place;
		if (place) untrack(() => load(place));
	});

	async function load(place: Place) {
		const mine = ++token;
		loading = true;
		error = '';
		try {
			const params = new URLSearchParams({
				latitude: String(place.lat),
				longitude: String(place.lon),
				current:
					'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day',
				daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max',
				timezone: 'auto',
				forecast_days: '6'
			});
			const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
			if (!res.ok) throw new Error(String(res.status));
			const d = await res.json();
			if (mine !== token) return;

			weather = {
				updated: new Date(),
				temp: d.current.temperature_2m,
				feels: d.current.apparent_temperature,
				humidity: d.current.relative_humidity_2m,
				wind: d.current.wind_speed_10m,
				code: d.current.weather_code,
				isDay: d.current.is_day === 1,
				days: d.daily.time.map((date: string, i: number) => ({
					date,
					code: d.daily.weather_code[i],
					max: d.daily.temperature_2m_max[i],
					min: d.daily.temperature_2m_min[i],
					rain: d.daily.precipitation_probability_max[i] ?? 0,
					uv: d.daily.uv_index_max[i] ?? 0
				}))
			};
		} catch {
			if (mine !== token) return;
			error = "Couldn't load the weather. Check your connection and try again.";
		} finally {
			if (mine === token) loading = false;
		}
	}

	// ---------- Display helpers ----------
	const show = (c: number) => `${Math.round(useF ? (c * 9) / 5 + 32 : c)}°`;

	function toggleUnit() {
		useF = !useF;
		try {
			localStorage.setItem(UNIT_KEY, useF ? 'f' : 'c');
		} catch {
			/* ignore */
		}
	}

	const dayName = (date: string, i: number) =>
		i === 0 ? 'Today' : new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' });

	let now = $derived(weather ? describe(weather.code, weather.isDay) : null);

	let advice = $derived.by(() => {
		if (!weather) return [];
		const today = weather.days[0];
		const conditions: Conditions = {
			tempC: weather.temp,
			feelsLikeC: weather.feels,
			maxC: today.max,
			humidity: weather.humidity,
			windKmh: weather.wind,
			code: weather.code,
			rainChance: today.rain,
			uvMax: today.uv
		};
		return tips(conditions);
	});

	// ---------- Searching for a city ----------
	async function onSearch(e: SubmitEvent) {
		e.preventDefault();
		const q = query.trim();
		if (!q) return;
		searching = true;
		searchMessage = '';
		hits = await searchPlaces(q);
		if (hits.length === 0) searchMessage = 'No places found. Try another spelling.';
		searching = false;
	}

	function choose(place: Place) {
		loc.set(place);
		hits = [];
		query = '';
		searchMessage = '';
	}

	const smallBtn =
		'grid h-8 min-w-8 shrink-0 cursor-pointer place-items-center rounded-lg px-2 text-sm transition-colors hover:bg-base-content/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary';
</script>

{#snippet icon(kind: IconKind, className: string)}
	<svg
		viewBox="0 0 24 24"
		class={className}
		fill="none"
		stroke="currentColor"
		stroke-width="1.75"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#each ICON_PATHS[kind] as d}
			<path {d} />
		{/each}
	</svg>
{/snippet}

<div class="flex h-full flex-col">
	<!-- Search and controls -->
	<form class="relative flex shrink-0 items-center gap-1 border-b border-base-content/15 p-1.5" onsubmit={onSearch}>
		<input
			bind:value={query}
			type="text"
			placeholder="Search a city"
			aria-label="Search a city"
			autocomplete="off"
			class="min-w-0 flex-1 rounded-lg border border-base-content/20 bg-base-content/5 px-3 py-1 text-sm outline-none placeholder:text-base-content/40 focus:border-primary"
		/>
		<button type="submit" class={smallBtn} disabled={searching}>{searching ? '…' : 'Search'}</button>
		<button
			type="button"
			class={smallBtn}
			aria-label="Use my location"
			title="Use my location"
			disabled={loc.status === 'locating'}
			onclick={() => loc.locate()}
		>
			<svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<circle cx="12" cy="12" r="3" /><path d="M12 2v3" /><path d="M12 19v3" /><path d="M2 12h3" /><path d="M19 12h3" />
			</svg>
		</button>
		<button type="button" class="{smallBtn} w-9 tabular-nums" aria-label="Switch between Celsius and Fahrenheit" onclick={toggleUnit}>
			{useF ? '°F' : '°C'}
		</button>

		{#if hits.length > 0}
			<ul class="absolute top-full right-1.5 left-1.5 z-10 mt-1 overflow-hidden rounded-xl border-2 border-base-content/15 bg-base-100 shadow-xl shadow-black/30">
				{#each hits as hit}
					<li>
						<button type="button" onclick={() => choose(hit)} class="w-full cursor-pointer px-3 py-2 text-left text-sm transition-colors hover:bg-primary hover:text-primary-content focus-visible:bg-primary focus-visible:text-primary-content focus-visible:outline-none">
							{hit.name}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</form>

	<div class="min-h-0 flex-1 overflow-y-auto p-4">
		{#if searchMessage}
			<p class="mb-3 text-sm text-base-content/60">{searchMessage}</p>
		{/if}

		{#if weather && now}
			<!-- Right now -->
			<section class="flex items-center gap-4" aria-label="Current weather">
				{@render icon(now.icon, 'size-20 shrink-0 text-primary')}
				<div class="min-w-0">
					<p class="truncate text-sm text-base-content/60">{loc.place?.name}</p>
					<p class="text-5xl font-bold tabular-nums">{show(weather.temp)}</p>
					<p class="text-sm">{now.label}, feels like {show(weather.feels)}</p>
				</div>
			</section>

			<dl class="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
				{#each [['Humidity', `${Math.round(weather.humidity)}%`], ['Wind', `${Math.round(weather.wind)} km/h`], ['Rain today', `${weather.days[0].rain}%`], ['UV today', weather.days[0].uv.toFixed(0)]] as [label, value]}
					<div class="rounded-xl border border-base-content/15 p-2">
						<dt class="text-xs text-base-content/60">{label}</dt>
						<dd class="font-bold tabular-nums">{value}</dd>
					</div>
				{/each}
			</dl>

			<!-- Tips -->
			<section class="mt-4 rounded-xl border-2 border-primary/40 bg-primary/5 p-3" aria-label="What to wear and bring">
				<h2 class="mb-2 text-sm font-bold">What to wear and bring</h2>
				<ul class="space-y-1.5 text-sm">
					{#each advice as tip}
						<li class="flex gap-2">
							<span class="w-16 shrink-0 text-xs font-bold {tip.kind === 'Heads up' ? 'text-warning' : 'text-primary'}">{tip.kind}</span>
							<span>{tip.text}</span>
						</li>
					{/each}
				</ul>
			</section>

			<!-- Forecast -->
			<section class="mt-4" aria-label="Forecast">
				<h2 class="mb-1 text-sm font-bold">Next days</h2>
				<ul class="divide-y divide-base-content/10">
					{#each weather.days as day, i (day.date)}
						{@const info = describe(day.code)}
						<li class="flex items-center gap-3 py-2 text-sm">
							<span class="w-12 shrink-0">{dayName(day.date, i)}</span>
							{@render icon(info.icon, 'size-6 shrink-0')}
							<span class="min-w-0 flex-1 truncate text-base-content/60">{info.label}</span>
							<span class="w-10 shrink-0 text-right text-xs text-info tabular-nums">{day.rain}%</span>
							<span class="w-20 shrink-0 text-right tabular-nums">
								<span class="font-bold">{show(day.max)}</span>
								<span class="text-base-content/50">{show(day.min)}</span>
							</span>
						</li>
					{/each}
				</ul>
			</section>

			<p class="mt-3 flex items-center justify-between text-xs text-base-content/50">
				<span>
					Updated {weather.updated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
					{#if loading}(refreshing…){/if}
				</span>
				<span>Weather data by Open-Meteo</span>
			</p>
		{:else if loc.status === 'locating' || loading}
			<p class="grid h-full place-items-center text-sm text-base-content/60">
				{loc.status === 'locating' ? 'Finding your location…' : 'Loading the weather…'}
			</p>
		{:else if error}
			<div class="grid h-full place-items-center text-center">
				<div class="space-y-3">
					<p role="alert" class="text-sm text-error">{error}</p>
					{#if loc.place}
						<button type="button" onclick={() => load(loc.place!)} class="cursor-pointer rounded-xl border-2 border-primary bg-primary px-4 py-1.5 text-sm font-bold text-primary-content">
							Try again
						</button>
					{/if}
				</div>
			</div>
		{:else}
			<div class="grid h-full place-items-center text-center">
				<div class="max-w-xs space-y-3">
					<p class="text-2xl font-bold">Weather</p>
					<p class="text-sm text-base-content/60">
						{loc.status === 'denied'
							? "Location access is blocked. Search for a city above, or allow location in your browser's site settings."
							: loc.status === 'unavailable'
								? "Couldn't get your location. Search for a city above."
								: 'Search for a city, or use your location.'}
					</p>
					<button type="button" onclick={() => loc.locate()} class="cursor-pointer rounded-xl border-2 border-primary bg-primary px-4 py-1.5 text-sm font-bold text-primary-content">
						Use my location
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>