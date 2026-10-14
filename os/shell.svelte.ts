// src\routes\projects\hsojOS\os\shell.svelte.ts
// Open/closed state for desktop-level overlays that several components need to control.
class Shell {
	launchpadOpen = $state(false);
	powerOpen = $state(false);

	toggleLaunchpad() {
		this.launchpadOpen = !this.launchpadOpen;
	}
}

export const shell = new Shell();