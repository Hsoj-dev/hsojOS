// src/routes/projects/hsojOS/os/apps/youtube-api.ts
// Loads YouTube's IFrame Player API once, and describes the small part of it we use.

export type YTPlayer = {
	loadVideoById(videoId: string): void;
	playVideo(): void;
	pauseVideo(): void;
	seekTo(seconds: number, allowSeekAhead: boolean): void;
	setVolume(volume: number): void;
	getCurrentTime(): number;
	getDuration(): number;
	destroy(): void;
};

type PlayerEvents = {
	onReady?: (e: { target: YTPlayer }) => void;
	onStateChange?: (e: { data: number }) => void;
	onError?: (e: { data: number }) => void;
};

declare global {
	interface Window {
		YT?: {
			Player: new (
				element: HTMLElement,
				options: {
					host?: string;
					videoId?: string;
					playerVars?: Record<string, string | number>;
					events?: PlayerEvents;
				}
			) => YTPlayer;
		};
		onYouTubeIframeAPIReady?: () => void;
	}
}

/** Values of the `data` field in onStateChange */
export const PlayerState = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

let loading: Promise<void> | null = null;

export function loadYouTubeApi(): Promise<void> {
	if (window.YT?.Player) return Promise.resolve();

	loading ??= new Promise<void>((resolve, reject) => {
		const previous = window.onYouTubeIframeAPIReady;
		window.onYouTubeIframeAPIReady = () => {
			previous?.();
			resolve();
		};
		const script = document.createElement('script');
		script.src = 'https://www.youtube.com/iframe_api';
		script.async = true;
		script.onerror = () => {
			loading = null; // allow a retry later
			reject(new Error("Couldn't load the YouTube player"));
		};
		document.head.append(script);
	});
	return loading;
}