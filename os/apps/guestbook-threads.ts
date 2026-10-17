// src/routes/projects/hsojOS/os/apps/guestbook-threads.ts
// Turns the Guestbooks API's flat message list into chat conversations (one per person).

/** What api/v2/get-guestbook-messages returns for each message */
export type ApiMessage = {
	Name: string;
	Text: string;
	CreatedAt: string;
	Website?: string | null;
	ParentMessageID?: unknown;
	Replies?: ApiMessage[] | null;
};

export type Reply = { name: string; text: string; at: Date };
export type Entry = { text: string; at: Date; replies: Reply[] };
export type Thread = {
	key: string;
	name: string;
	website: string | null;
	entries: Entry[];
	lastAt: Date;
};

export type ChatItem =
	| { kind: 'day'; label: string }
	| { kind: 'visitor'; text: string; at: Date }
	| { kind: 'owner'; text: string; at: Date; who: string };

const byTime = (a: { at: Date }, b: { at: Date }) => a.at.getTime() - b.at.getTime();

/** Only real http(s) links are allowed through */
export function safeWebsite(raw?: string | null): string | null {
	if (!raw) return null;
	try {
		const url = new URL(raw);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
	} catch {
		return null;
	}
}

/** Group top-level messages by who wrote them, newest conversation first */
export function buildThreads(messages: ApiMessage[]): Thread[] {
	const threads = new Map<string, Thread>();

	for (const m of messages) {
		if (m.ParentMessageID != null) continue; // replies arrive nested inside their parent
		const name = m.Name.trim() || 'Anonymous';
		const key = name.toLowerCase();
		const at = new Date(m.CreatedAt);

		let thread = threads.get(key);
		if (!thread) {
			thread = { key, name, website: null, entries: [], lastAt: at };
			threads.set(key, thread);
		}
		thread.website ??= safeWebsite(m.Website);

		const replies: Reply[] = (m.Replies ?? [])
			.map((r) => ({ name: r.Name, text: r.Text, at: new Date(r.CreatedAt) }))
			.sort(byTime);
		thread.entries.push({ text: m.Text, at, replies });
	}

	for (const thread of threads.values()) {
		thread.entries.sort(byTime);
		thread.lastAt = lastMessage(thread).at;
	}
	return [...threads.values()].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}

/** The most recent thing said in a conversation, by either side */
export function lastMessage(thread: Thread): { text: string; mine: boolean; at: Date } {
	let latest = { text: '', mine: false, at: new Date(0) };
	for (const entry of thread.entries) {
		if (entry.at >= latest.at) latest = { text: entry.text, mine: false, at: entry.at };
		for (const reply of entry.replies) {
			if (reply.at >= latest.at) latest = { text: reply.text, mine: true, at: reply.at };
		}
	}
	return latest;
}

/** The bubbles for one conversation, oldest first, with a label whenever the day changes */
export function chatItems(thread: Thread, dayLabel: (d: Date) => string): ChatItem[] {
	const items: ChatItem[] = [];
	let lastDay = '';

	const addDay = (at: Date) => {
		const day = at.toDateString();
		if (day !== lastDay) {
			items.push({ kind: 'day', label: dayLabel(at) });
			lastDay = day;
		}
	};

	for (const entry of thread.entries) {
		addDay(entry.at);
		items.push({ kind: 'visitor', text: entry.text, at: entry.at });
		for (const reply of entry.replies) {
			addDay(reply.at);
			items.push({ kind: 'owner', text: reply.text, at: reply.at, who: reply.name });
		}
	}
	return items;
}