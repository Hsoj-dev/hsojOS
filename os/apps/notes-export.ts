// src/routes/projects/hsojOS/os/apps/notes-export.ts
// Turns the Notes editor's HTML into Markdown or plain text.

const INDENT = '   ';

/** Wrap text in ** or *, keeping surrounding spaces outside the marks (Markdown needs that) */
function wrapMarks(s: string, mark: string) {
	const lead = /^\s*/.exec(s)![0];
	const trail = /\s*$/.exec(s)![0];
	const core = s.trim();
	return core ? `${lead}${mark}${core}${mark}${trail}` : s;
}

/** Inline text of an element. Nested lists are skipped; listLines handles those. */
function inline(node: Node, markdown: boolean): string {
	let out = '';
	for (const child of Array.from(node.childNodes)) {
		if (child.nodeType === Node.TEXT_NODE) {
			out += child.textContent ?? '';
			continue;
		}
		if (!(child instanceof HTMLElement)) continue;

		const tag = child.tagName;
		if (tag === 'UL' || tag === 'OL') continue;
		if (tag === 'BR') {
			out += '\n';
			continue;
		}

		const inner = inline(child, markdown);
		if (markdown && (tag === 'STRONG' || tag === 'B')) out += wrapMarks(inner, '**');
		else if (markdown && (tag === 'EM' || tag === 'I')) out += wrapMarks(inner, '*');
		else out += inner;
	}
	return out;
}

function listLines(list: HTMLElement, markdown: boolean, depth: number, lines: string[]) {
	const ordered = list.tagName === 'OL';
	const task = list.hasAttribute('data-task');
	let n = 1;

	for (const li of Array.from(list.children)) {
		if (!(li instanceof HTMLElement) || li.tagName !== 'LI') continue;

		let marker: string;
		if (task) {
			const box = li.hasAttribute('data-checked') ? 'x' : ' ';
			marker = markdown ? `- [${box}] ` : `[${box}] `;
		} else {
			marker = ordered ? `${n++}. ` : '- ';
		}

		const text = inline(li, markdown).replace(/\n+$/, '').replace(/\n/g, ' ').trim();
		lines.push(`${INDENT.repeat(depth)}${marker}${text}`);

		for (const nested of Array.from(li.children)) {
			if (nested.tagName === 'UL' || nested.tagName === 'OL') {
				listLines(nested as HTMLElement, markdown, depth + 1, lines);
			}
		}
	}
}

export function htmlToText(root: HTMLElement, markdown: boolean): string {
	const lines: string[] = [];

	for (const node of Array.from(root.childNodes)) {
		if (node.nodeType === Node.TEXT_NODE) {
			const t = (node.textContent ?? '').trim();
			if (t) lines.push(t, '');
			continue;
		}
		if (!(node instanceof HTMLElement)) continue;

		const tag = node.tagName;
		if (/^H[1-6]$/.test(tag)) {
			const text = inline(node, markdown).replace(/\n/g, ' ').trim();
			if (text) lines.push(markdown ? `${'#'.repeat(Number(tag[1]))} ${text}` : text, '');
		} else if (tag === 'UL' || tag === 'OL') {
			listLines(node, markdown, 0, lines);
			lines.push('');
		} else {
			// Paragraphs (and the <div>s some browsers make for new lines)
			let text = inline(node, markdown).replace(/\n+$/, '').trim();
			if (markdown) text = text.replace(/\n/g, '  \n'); // Markdown hard line break
			lines.push(text, '');
		}
	}

	const result = lines
		.join('\n')
		.replace(/\u00a0/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	return result ? `${result}\n` : '';
}