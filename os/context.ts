// src/routes/projects/hsojOS/os/context.ts
// Lets an app component talk to the window it is rendered in.
import { getContext, setContext } from 'svelte';

const KEY = Symbol('hsojos-window');

export type WindowContext = {
	readonly id: string;
	/** True when this is the focused window (use it to ignore keyboard input otherwise) */
	readonly active: boolean;
	readonly minimized: boolean;
	close: () => void;
	/** Restore if minimized and bring to the front */
	focus: () => void;
	/** Change the title shown in the title bar */
	setTitle: (title: string) => void;
};

export const setWindowContext = (ctx: WindowContext) => setContext(KEY, ctx);
export const getWindowContext = () => getContext<WindowContext>(KEY);