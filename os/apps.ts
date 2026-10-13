// src\routes\projects\hsojOS\os\apps.ts
import type { Component } from 'svelte';
import Placeholder from './apps/Placeholder.svelte';

/**
 * Everything the OS needs to know about an app.
 * To add an app: build a component, add one entry to APPS below.
 */
export type AppSettings = {
	id: string;
	title: string;
	/** Short glyph used in the dock and the title bar */
	glyph: string;
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
	singleInstance: true,
	showInDock: true
} as const;

type AppInput = Partial<AppSettings> & Pick<AppSettings, 'id' | 'title' | 'glyph' | 'component'>;

const defineApp = (app: AppInput): AppSettings => ({ ...DEFAULTS, ...app });

export const APPS: AppSettings[] = [
	defineApp({
		id: 'terminal',
		title: 'Terminal',
		glyph: '>_',
		component: Placeholder,
		props: { label: 'Terminal' },
		defaultWidth: 640,
		defaultHeight: 400,
		translucent: true
	}),
	defineApp({
		id: 'files',
		title: 'Files',
		glyph: '▤',
		component: Placeholder,
		props: { label: 'Files' },
		defaultWidth: 720,
		defaultHeight: 460
	}),
	defineApp({
		id: 'browser',
		title: 'Browser',
		glyph: '◎',
		component: Placeholder,
		props: { label: 'Browser' },
		defaultWidth: 900,
		defaultHeight: 560,
		minWidth: 420,
		minHeight: 280
	}),
	defineApp({
		id: 'notes',
		title: 'Notes',
		glyph: '✎',
		component: Placeholder,
		props: { label: 'Notes' },
		defaultWidth: 480,
		defaultHeight: 360
	}),
	defineApp({
		id: 'settings',
		title: 'Settings',
		glyph: '⚙',
		component: Placeholder,
		props: { label: 'Settings' },
		defaultWidth: 420,
		defaultHeight: 320,
		resizable: false,
		maximizable: false
	})
];

const byId = new Map(APPS.map((a) => [a.id, a]));

export function getApp(id: string): AppSettings {
	const app = byId.get(id);
	if (!app) throw new Error(`Unknown app: ${id}`);
	return app;
}