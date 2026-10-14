// src/routes/projects/hsojOS/os/apps.ts
import type { Component } from 'svelte';
import Placeholder from './apps/Placeholder.svelte';
import Browser from './apps/Browser.svelte';
import Calculator from './apps/Calculator.svelte';
import Camera from './apps/Camera.svelte';
import Excalidraw from './apps/Excalidraw.svelte';
import Paint from './apps/Paint.svelte';
import Snake from './apps/Snake.svelte';
import Terminal from './apps/Terminal.svelte';
import Timer from './apps/Timer.svelte';
import Welcome from './apps/Welcome.svelte';
import YouTube from './apps/Youtube.svelte';

/**
 * Everything the OS needs to know about an app.
 * To add an app: build a component, add one entry to APPS below.
 */
export type AppSettings = {
	id: string;
	title: string;
	/** Short glyph used in the dock and the title bar */
	glyph: string;
	/** One-line description shown in the Start menu */
	description?: string;
	/** The component rendered inside the window body */
	component: Component<any>;
	/** Props passed to that component */
	props?: Record<string, unknown>;

	defaultWidth: number;
	defaultHeight: number;
	minWidth: number;
	minHeight: number;

	resizable: boolean;
	maximizable: boolean;
	minimizable: boolean;
	/**
	 * Set true for apps that contain an iframe. A click inside an iframe never reaches the
	 * page, so Window shields it while unfocused/dragging so the first click focuses the window.
	 */
	hasIframe: boolean;
	/** Frosted-glass window background instead of a solid one */
	translucent: boolean;
	/** Opening it again focuses the existing window instead of making a new one */
	singleInstance: boolean;
	showInDock: boolean;
};

const DEFAULTS = {
	defaultWidth: 560,
	defaultHeight: 380,
	minWidth: 280,
	minHeight: 160,
	resizable: true,
	maximizable: true,
	minimizable: true,
	translucent: false,
	hasIframe: false,
	singleInstance: true,
	showInDock: true
} as const;

type AppInput = Partial<AppSettings> & Pick<AppSettings, 'id' | 'title' | 'glyph' | 'component'>;

const defineApp = (app: AppInput): AppSettings => ({ ...DEFAULTS, ...app });

export const APPS: AppSettings[] = [
	defineApp({
		id: 'terminal',
		title: 'Terminal',
		description: 'Command line',
		glyph: '>_',
		component: Terminal,
		defaultWidth: 640,
		defaultHeight: 400,
		translucent: true
	}),
	defineApp({
		id: 'files',
		title: 'Files',
		description: 'Browse your files',
		glyph: '▤',
		component: Placeholder,
		props: { label: 'Files' },
		defaultWidth: 720,
    defaultHeight: 460,
		showInDock: false
	}),
	defineApp({
		id: 'browser',
		title: 'Browser',
		description: 'Surf the web',
		glyph: '◎',
		component: Browser,
		hasIframe: true,
		defaultWidth: 900,
		defaultHeight: 560,
		minWidth: 420,
		minHeight: 280
	}),
	defineApp({
		id: 'youtube',
		title: 'YouTube',
		description: 'Search and watch videos',
		glyph: '▷',
		component: YouTube,
		hasIframe: true,
		defaultWidth: 860,
		defaultHeight: 540,
		minWidth: 400,
		minHeight: 300
	}),
	defineApp({
		id: 'excalidraw',
		title: 'Excalidraw',
		description: 'Sketch and diagram',
		glyph: '◇',
		component: Excalidraw,
		hasIframe: true,
		defaultWidth: 960,
		defaultHeight: 600,
		minWidth: 480,
    minHeight: 320,
		showInDock: false
	}),
	defineApp({
		id: 'notes',
		title: 'Notes',
		description: 'Jot things down',
		glyph: '✎',
		component: Placeholder,
		props: { label: 'Notes' },
		defaultWidth: 480,
    defaultHeight: 360,
		showInDock: false
	}),
	defineApp({
		id: 'calculator',
		title: 'Calculator',
		description: 'Basic arithmetic',
		glyph: '▦',
		component: Calculator,
		defaultWidth: 340,
		defaultHeight: 500,
		resizable: false,
    maximizable: false,
		showInDock: false
	}),
	defineApp({
		id: 'timer',
		title: 'Timer',
		description: 'Pomodoro-style countdown',
		glyph: '◴',
		component: Timer,
		defaultWidth: 320,
		defaultHeight: 380,
		resizable: false,
    maximizable: false,
    showInDock: false
	}),
	defineApp({
		id: 'paint',
		title: 'Paint',
		description: 'Doodle and export as PNG',
		glyph: '▨',
		component: Paint,
		defaultWidth: 760,
		defaultHeight: 520,
		minWidth: 420,
		minHeight: 300,
		showInDock: false
	}),
	defineApp({
		id: 'camera',
		title: 'Camera',
		description: 'Take a picture',
		glyph: '◉',
		component: Camera,
		defaultWidth: 640,
		defaultHeight: 500,
		minWidth: 320,
		minHeight: 300,
		showInDock: false
	}),
	defineApp({
		id: 'snake',
		title: 'Snake',
		description: 'Classic arcade game',
		glyph: '∿',
		component: Snake,
		defaultWidth: 400,
		defaultHeight: 500,
		resizable: false,
		maximizable: false,
		showInDock: false
	}),
	defineApp({
		id: 'settings',
		title: 'Settings',
		description: 'Customize HsojOS',
		glyph: '⚙',
		component: Placeholder,
		props: { label: 'Settings' },
		defaultWidth: 420,
		defaultHeight: 320,
		resizable: false,
		maximizable: false
	}),
	defineApp({
		id: 'welcome',
		title: 'Welcome to HsojOS',
		description: 'A quick tour',
		glyph: '◆',
		component: Welcome,
		defaultWidth: 460,
		defaultHeight: 420,
		resizable: false,
		maximizable: false,
		showInDock: false
	})
];

const byId = new Map(APPS.map((a) => [a.id, a]));

export function getApp(id: string): AppSettings {
	const app = byId.get(id);
	if (!app) throw new Error(`Unknown app: ${id}`);
	return app;
}