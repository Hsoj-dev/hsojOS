// src/routes/projects/hsojOS/os/config.ts
// Flip these to change how HsojOS behaves. No other file needs to change.
export const CONFIG = {
	userName: 'hsoj',
	version: '0.1.0',
	/** Shown in Settings > About. Leave empty to hide the link. */
	githubUrl: 'https://github.com/Hsoj-dev/hsojOS',

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

	news: {
		/** Language filter sent to FreeNewsApi */
		language: 'en'
	},

	guestbook: {
		/** From your Guestbooks embed code (the same values the main site uses) */
		id: '6605',
		host: 'https://guestbooks.meadow.cafe',
		/** Longest message a visitor can write */
		maxLength: 500
	},

	/** Your recorded voicemail for the Contact app. Put the file in static/audio/. */
	voicemailUrl: '/audio/voicemail.m4a',

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