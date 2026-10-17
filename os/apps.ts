// src/routes/projects/hsojOS/os/apps.ts
import type { Component } from 'svelte';
// import Placeholder from './apps/Placeholder.svelte';
import Browser from './apps/Browser.svelte';
import Calculator from './apps/Calculator.svelte';
import Camera from './apps/Camera.svelte';
import Contact from './apps/Contact.svelte';
import Excalidraw from './apps/Excalidraw.svelte';
import ImageViewer from './apps/ImageViewer.svelte';
import Messenger from './apps/Messenger.svelte';
import Music from './apps/Music.svelte';
import News from './apps/News.svelte';
import Notes from './apps/Notes.svelte';
import Paint from './apps/Paint.svelte';
import PdfReader from './apps/PdfReader.svelte';
import Settings from './apps/Settings.svelte';
import Snake from './apps/Snake.svelte';
import Terminal from './apps/Terminal.svelte';
import Timer from './apps/Timer.svelte';
import Todo from './apps/Todo.svelte';
import Weather from './apps/Weather.svelte';
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
		description: 'Write with formatting, save as .md or .txt',
		glyph: '✎',
		component: Notes,
		defaultWidth: 640,
		defaultHeight: 520,
		minWidth: 380,
		minHeight: 300
	}),
	defineApp({
		id: 'todo',
		title: 'To-Do',
		description: 'Simple task list',
		glyph: '✓',
		component: Todo,
		defaultWidth: 380,
		defaultHeight: 520,
		minWidth: 300,
		minHeight: 320
	}),
	defineApp({
		id: 'images',
		title: 'Image Viewer',
		description: 'View photos from your computer',
		glyph: '▣',
		component: ImageViewer,
		defaultWidth: 820,
		defaultHeight: 560,
		minWidth: 380,
		minHeight: 300,
		showInDock: false
	}),
	defineApp({
		id: 'pdf',
		title: 'PDF Reader',
		description: 'Read PDFs from your computer',
		glyph: '▥',
		component: PdfReader,
		hasIframe: true,
		defaultWidth: 760,
		defaultHeight: 600,
		minWidth: 380,
		minHeight: 300,
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
		id: 'guestbook',
		title: 'Messenger (Guestbook)',
		description: 'Read and sign the guestbook',
		glyph: '✉︎',
		component: Messenger,
		defaultWidth: 760,
		defaultHeight: 520,
		minWidth: 340,
		minHeight: 320,
		showInDock: false
	}),
	defineApp({
		id: 'contact',
		title: 'Contact',
		description: 'Give me a call',
		glyph: '☎︎',
		component: Contact,
		defaultWidth: 340,
		defaultHeight: 580,
		resizable: false,
		maximizable: false,
		showInDock: false
	}),
	defineApp({
		id: 'music',
		title: 'Music',
		description: 'Play songs from YouTube or your files',
		glyph: '♪',
		component: Music,
		defaultWidth: 780,
		defaultHeight: 600,
		minWidth: 340,
		minHeight: 420
	}),
	defineApp({
		id: 'weather',
		title: 'Weather',
		description: 'Forecast with what to wear',
		glyph: '☼',
		component: Weather,
		defaultWidth: 460,
		defaultHeight: 640,
		minWidth: 360,
		minHeight: 420,
		showInDock: false
	}),
	defineApp({
		id: 'news',
		title: 'News',
		description: 'Headlines by topic',
		glyph: '≡',
		component: News,
		defaultWidth: 520,
		defaultHeight: 620,
		minWidth: 360,
		minHeight: 360,
		showInDock: false
	}),
	defineApp({
		id: 'settings',
		title: 'Settings',
		description: 'About HsojOS',
		glyph: '⚙',
		component: Settings,
		defaultWidth: 640,
		defaultHeight: 460,
		minWidth: 360,
    minHeight: 320,
		showInDock: false
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