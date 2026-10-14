// src/routes/projects/hsojOS/os/config.ts
// Flip these to change how HsojOS behaves. No other file needs to change.
export const CONFIG = {
	userName: 'hsoj',

	/**
	 * Lock screen on/off.
	 * true  = waking from the screen saver asks for the password
	 * false = waking from the screen saver goes straight back to the desktop
	 */
	lockScreenEnabled: true,

	/** Hardcoded password. It ships in the page's JS, so treat it as a toy lock, not security. */
	lockPassword: 'hsoj',

	/** Minutes of inactivity before the screen saver starts (use 0.1 to test quickly) */
	idleMinutes: 3,

	browser: {
		/** Where the Browser app's search bar goes. %s becomes the search text. */
		/** It must allow iframes: Google and DuckDuckGo do not. */
		searchUrl: 'https://en.wikipedia.org/w/index.php?search=%s',
		/** Shown in the search placeholder */
		searchName: 'Wikipedia'
	},

	/** localStorage key remembering that the Welcome window was already shown */
	welcomeStorageKey: 'hsojos:welcomed'
};