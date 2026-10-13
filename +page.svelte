<!-- src\routes\projects\hsojOS\+page.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
    import { untrack } from 'svelte';
    import Window from './os/Window.svelte';
    import { APPS, getApp } from './os/apps';
    import { wm } from './os/windows.svelte';

    const DOCK_APPS = APPS.filter((a) => a.showInDock);
    
    // Size of the desktop area, so windows can't be dragged or resized out of it
    let areaW = $state(0);
    let areaH = $state(0);
    $effect(() => {
    	const w = areaW;
    	const h = areaH;
    	untrack(() => wm.setBounds(w, h));
    });
    
    const dockDot = {
    	closed: '',
    	minimized: 'w-1.5 border border-base-content/60',
    	open: 'w-1.5 bg-base-content/60',
    	active: 'w-4 bg-primary'
    };

    // CONFIG
    const USER_NAME = 'hsoj';
    const WORKSPACES = [1, 2, 3, 4, 5];

    // STATE
    let now = $state<Date | null>(null);
    let activeWs = $state(1);
    let online = $state(true);

   	const pad = (n: number) => String(n).padStart(2, '0');

    let hh = $derived(now ? pad(now.getHours() % 12 || 12) : '--');
    let meridiem = $derived(now ? (now.getHours() < 12 ? 'AM' : 'PM') : '');
	let mm = $derived(now ? pad(now.getMinutes()) : '--');
	let ss = $derived(now ? pad(now.getSeconds()) : '--');
	let date = $derived(
		now
			? now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
			: '-- --- ----'
	);
	let weekday = $derived(
		now ? now.toLocaleDateString('en-GB', { weekday: 'long' }).toLowerCase() : ''
	);
	let greeting = $derived.by(() => {
		if (!now) return 'hello';
		const h = now.getHours();
		if (h < 5) return 'still up';
		if (h < 12) return 'good morning';
		if (h < 18) return 'good afternoon';
		return 'good evening';
	});
 
	onMount(() => {
		now = new Date();
		online = navigator.onLine;
 
		const clock = setInterval(() => (now = new Date()), 1000);
 
		const up = () => (online = true);
		const down = () => (online = false);
		window.addEventListener('online', up);
		window.addEventListener('offline', down);
 
		return () => {
			clearInterval(clock);
			window.removeEventListener('online', up);
			window.removeEventListener('offline', down);
		};
	});
 
	// SHARED STYLES
	const pill = 'flex items-center gap-3 rounded-2xl border-2 border-base-content/15 bg-base-100/80 px-3 py-1.5 text-sm backdrop-blur-md';
	const dim = 'text-base-content/60';
</script>
 
<main 
    class="relative flex h-dvh w-full flex-col gap-3 overflow-hidden bg-base-200 p-3 text-base-content"
    style="background-image: radial-gradient(color-mix(in oklab, var(--color-base-content) 14%, transparent) 1px, transparent 1px); background-size: 24px 24px;"
>

    <!-- TOP BAR -->
    <header class="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <!-- LEFT -->
        <nav class="{pill} justify-self-start" aria-label="Workspaces">
            {#each WORKSPACES as ws}
                <button 
                    type="button" 
                    onclick={() => (activeWs = ws)}
                    aria-current={activeWs === ws ? 'true' : undefined}
                    class="grid size-6 place-items-center rounded-lg text-xs transition-colors focus-visible:outline-2 focus-visible:outline-primary {activeWs === ws ? 'bg-primary font-bold text-primary-content' : 'text-base-content/60 hover:bg-base-content/10'}"
                >
                    {ws}
                </button>
            {/each}
        </nav>

        <!-- CENTER -->
        <div class="{pill} justify-self-center font-bold">
            <span class="size-2 rounded-full bg-primary"></span>
            HsojOS
        </div>

        <!-- RIGHT -->
        <div class="{pill} justify-self-end">
            <!-- <span class="hidden sm:inline"><span class="{dim}">net</span> {online ? 'up' : 'down'} </span>
            <span class="hidden h-4 w-0.5 bg-base-content/15 sm:block"></span> -->
            <span>{date}</span>
        </div>
    </header>

    <!-- WALLPAPER -->
    <section class="relative grow">
    	<div class="absolute inset-0 grid place-items-center">
	        <div class="pointer-events-none absolute size-80 rounded-full bg-primary/15 blur-3xl sm:size-125"></div>
        
    		<div class="relative flex flex-col items-center gap-4 text-center">
    			<h1 class="flex items-baseline text-7xl font-bold tracking-tighter tabular-nums sm:text-9xl" aria-label="Current time {hh}:{mm}">
    				{hh} <span class="mx-1 text-primary motion-safe:animate-pulse">:</span> {mm}
    				<span class="ml-3 flex flex-col gap-1 text-left font-normal tracking-normal text-base-content/50">
    					<span class="text-2xl leading-none sm:text-3xl">{ss}</span>
    					<span class="text-sm leading-none sm:text-base">{meridiem}</span>
    				</span>
    			</h1>
            
    			<p class="text-lg sm:text-xl">
    				<span class="text-primary">~ $</span>
    				{greeting}, {USER_NAME}<span class="motion-safe:animate-pulse"></span>
    			</p>
            
    			<p class="text-sm {dim}">{weekday}</p>
    		</div>
    	</div>
        
    	<div class="absolute inset-0" bind:clientWidth={areaW} bind:clientHeight={areaH}>
    		{#each wm.windows as win (win.id)}
    			{@const app = getApp(win.appId)}
    			{@const AppView = app.component}
    			<Window {win} {app}>
    				<AppView {...app.props} />
    			</Window>
    		{/each}
    	</div>
    </section>

    <!-- BOTTOM BAR -->
    <footer class="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <!-- LEFT -->
        <button
            type="button"
            class="{pill} cursor-pointer justify-self-start border-primary bg-primary font-bold text-primary-content transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
            <span aria-hidden="true">◆</span>
            Start
        </button>

        <!-- CENTER -->
        <nav class="{pill} justify-self-center gap-2 px-2" aria-label="Apps">
            {#each DOCK_APPS as app (app.id)}
            	{@const status = wm.statusOf(app.id)}
            	<button
            		type="button"
            		title={app.title}
            		aria-label={app.title}
            		onclick={() => wm.toggle(app.id)}
            		class="relative grid size-10 cursor-pointer place-items-center rounded-xl text-lg transition-all hover:-translate-y-1 hover:bg-primary hover:text-primary-content focus-visible:outline-2 focus-visible:outline-primary"
            	>
            		{app.glyph}
            		{#if status !== 'closed'}
            			<span
            				class="absolute bottom-0.5 left-1/2 h-1.5 -translate-x-1/2 rounded-full transition-all {dockDot[status]}"
            			></span>
            		{/if}
            	</button>
            {/each}
		</nav>

		<!-- RIGHT -->
		<div class="{pill} justify-self-end">
		    <!-- TODO: remove hardcoded volume -->
			<span class="hidden sm:inline"><span class={dim}>vol</span> 70%</span>
			<span class="hidden sm:inline"><span class={dim}>wifi</span> {online ? 'on' : 'off'}</span>
			<span class="hidden h-4 w-0.5 bg-base-content/15 sm:block"></span>
			<button type="button" class="cursor-pointer hover:text-primary">System</button>
		</div>
    </footer>
    
</main>