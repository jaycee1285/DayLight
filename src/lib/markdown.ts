// Shared markdown render + extended-table detection for the editor.
//
// Parity with ferrinode (src/lib/markdown.ts): preview always renders with the
// best table parser; the editor uses the detector to route extended-table files
// to a raw-text edit surface instead of milkdown WYSIWYG (which would corrupt
// the grammar on reserialization).
//
// marked is on v17. marked-extended-tables declares peer `>=3 <16`, but that is
// the maintainer's stated test ceiling, not a real failure boundary: the
// colspan/rowspan/multi-row/percent grammar is a superset of GFM tables on
// marked's stable extension API, measured PASS on marked 15/16/17.

import { Marked } from 'marked';
import extendedTables from 'marked-extended-tables';

const marked = new Marked({ gfm: true });
marked.use(extendedTables());

/** Render markdown to HTML for the preview pane. */
export function renderMarkdown(markdown: string): string {
	const parsed = marked.parse(markdown, { async: false });
	return typeof parsed === 'string' ? parsed : '';
}

// Detects marked-extended-tables grammar so the editor can route those files to
// a raw-text surface instead of milkdown WYSIWYG:
//   - `|||`  trailing pipe-group  → colspan
//   - `^|`   caret before a pipe  → rowspan
//   - `|-NN%-|`                   → percent column width in a delimiter row
const COLSPAN = /\|\s*\|\s*\|/;
const ROWSPAN = /\^\s*\|/;
const PERCENT_WIDTH = /\|\s*:?-+\s*\d+%\s*-+/;

/** True when the source uses extended-table grammar WYSIWYG would mangle. */
export function hasExtendedTables(markdown: string): boolean {
	return COLSPAN.test(markdown) || ROWSPAN.test(markdown) || PERCENT_WIDTH.test(markdown);
}
