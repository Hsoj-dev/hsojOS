// src/routes/projects/hsojOS/os/apps/music-utils.ts
export type Repeat = 'off' | 'all' | 'one';

/** 187 becomes "3:07" */
export function clock(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
	const s = Math.floor(seconds);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Things like "(Official Video)" or "[Lyrics]" that clutter a title
const NOISE =
	/\s*[(\[][^)\]]*\b(?:official|video|audio|lyrics?|visuali[sz]er|hd|hq|4k|remaster(?:ed)?|mv|m\/v)\b[^)\]]*[)\]]/gi;
const TRAILING_NOISE = /\s*[|\-–—]\s*(?:official|lyrics?|audio|video)[^|]*$/i;

/**
 * YouTube has no "artist" field. Titles are usually "Artist - Song (Official Video)",
 * so split on that, and fall back to the channel name ("Artist - Topic", "ArtistVEVO").
 */
export function parseTrack(rawTitle: string, channel: string, fallbackArtist = 'Unknown artist') {
	const cleaned = rawTitle.replace(NOISE, '').replace(TRAILING_NOISE, '').replace(/\s{2,}/g, ' ').trim();

	const split = /^(.+?)\s+[-–—]\s+(.+)$/.exec(cleaned);
	if (split) return { artist: split[1].trim(), title: split[2].trim() };

	const channelName = channel.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();
	return { title: cleaned || rawTitle, artist: channelName || fallbackArtist };
}

/** The order to play a queue in. When shuffling, `first` plays first and the rest are random. */
export function makeOrder(length: number, shuffle: boolean, first: number): number[] {
	const order = Array.from({ length }, (_, i) => i);
	if (!shuffle) return order;

	const rest = order.filter((i) => i !== first);
	for (let i = rest.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[rest[i], rest[j]] = [rest[j], rest[i]];
	}
	return [first, ...rest];
}

/** Next position in the order, or null at the end (when not wrapping) */
export function nextPosition(pos: number, length: number, wrap: boolean): number | null {
	if (pos + 1 < length) return pos + 1;
	return wrap ? 0 : null;
}

export function prevPosition(pos: number, length: number, wrap: boolean): number {
	if (pos > 0) return pos - 1;
	return wrap ? length - 1 : 0;
}