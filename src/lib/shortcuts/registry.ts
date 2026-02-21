export type ShortcutScope = 'global' | 'page' | 'task-row' | 'menu' | 'modal';

export interface ShortcutCombo {
	key: string;
	ctrlOrMeta?: boolean;
	ctrl?: boolean;
	meta?: boolean;
	alt?: boolean;
	shift?: boolean;
}

export interface ShortcutCommand {
	id: string;
	description: string;
	combo: ShortcutCombo;
	scope: ShortcutScope;
	allowInInput?: boolean;
	run: () => void | boolean;
}

function normalizeKey(key: string): string {
	if (key === 'Esc') return 'Escape';
	return key.length === 1 ? key.toLowerCase() : key;
}

function keyFromCode(code: string, shiftPressed: boolean): string | null {
	if (!code) return null;

	if (code.startsWith('Key') && code.length === 4) {
		return code[3].toLowerCase();
	}

	if (code.startsWith('Digit') && code.length === 6) {
		return code[5];
	}

	if (/^F\d{1,2}$/.test(code)) {
		return code;
	}

	const codeMap: Record<string, [string, string]> = {
		Escape: ['Escape', 'Escape'],
		Slash: ['/', '?'],
		Backslash: ['\\', '|'],
		Backquote: ['`', '~'],
		Minus: ['-', '_'],
		Equal: ['=', '+'],
		Comma: [',', '<'],
		Period: ['.', '>'],
		Semicolon: [';', ':'],
		Quote: ["'", '"'],
		BracketLeft: ['[', '{'],
		BracketRight: [']', '}']
	};

	const mapped = codeMap[code];
	if (!mapped) return null;
	return shiftPressed ? mapped[1] : mapped[0];
}

function eventKeyForMatching(event: KeyboardEvent): string {
	const normalizedEventKey = normalizeKey(event.key);
	if (normalizedEventKey !== 'Unidentified') return normalizedEventKey;
	const fallbackKey = keyFromCode(event.code, event.shiftKey);
	if (!fallbackKey) return normalizedEventKey;
	return normalizeKey(fallbackKey);
}

function keyFromLegacyCode(event: KeyboardEvent): string | null {
	const legacyCode =
		event.keyCode || (event as KeyboardEvent & { which?: number }).which || 0;
	if (legacyCode >= 65 && legacyCode <= 90) {
		return String.fromCharCode(legacyCode).toLowerCase();
	}
	if (legacyCode >= 48 && legacyCode <= 57) {
		return String.fromCharCode(legacyCode);
	}
	return null;
}

export function eventMatchesKey(event: KeyboardEvent, key: string): boolean {
	const normalizedTargetKey = normalizeKey(key);
	const eventKey = eventKeyForMatching(event);
	if (eventKey === normalizedTargetKey) return true;
	if (normalizedTargetKey === '?' && eventKey === '/') return true;

	const fallbackLegacyKey = keyFromLegacyCode(event);
	return fallbackLegacyKey !== null && normalizeKey(fallbackLegacyKey) === normalizedTargetKey;
}

function matchesCombo(event: KeyboardEvent, combo: ShortcutCombo, isMac: boolean): boolean {
	const keyMatches = eventMatchesKey(event, combo.key);
	if (!keyMatches) return false;

	if ((combo.shift ?? false) !== event.shiftKey) return false;
	if ((combo.alt ?? false) !== event.altKey) return false;

	if (combo.ctrlOrMeta) {
		const primaryPressed = isMac ? event.metaKey : event.ctrlKey;
		if (!primaryPressed) return false;
		if (isMac ? event.ctrlKey : event.metaKey) return false;
	} else {
		if ((combo.ctrl ?? false) !== event.ctrlKey) return false;
		if ((combo.meta ?? false) !== event.metaKey) return false;
	}

	return true;
}

export function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;

	if (target.isContentEditable) return true;

	const tag = target.tagName.toLowerCase();
	if (tag === 'textarea' || tag === 'select') return true;

	if (tag === 'input') {
		const input = target as HTMLInputElement;
		const type = input.type?.toLowerCase() ?? 'text';
		return type !== 'checkbox' && type !== 'radio' && type !== 'button' && type !== 'submit' && type !== 'reset';
	}

	return false;
}

export function resolveShortcutCommand(
	commands: ShortcutCommand[],
	event: KeyboardEvent,
	currentScope: ShortcutScope,
	isMac: boolean
): ShortcutCommand | null {
	const target = event.target;
	const editableTarget = isEditableTarget(target);
	const scopePriority: Record<ShortcutScope, ShortcutScope[]> = {
		modal: ['modal', 'global'],
		menu: ['menu', 'page', 'global'],
		'task-row': ['task-row', 'page', 'global'],
		page: ['page', 'global'],
		global: ['global']
	};

	const scopesToCheck = scopePriority[currentScope] ?? ['page', 'global'];

	for (const scope of scopesToCheck) {
		const scopedCommands = commands.filter((command) => command.scope === scope);
		for (const command of scopedCommands) {
			if (editableTarget && !command.allowInInput) continue;
			if (matchesCombo(event, command.combo, isMac)) {
				return command;
			}
		}
	}

	return null;
}

export function formatAriaKeyShortcuts(combo: ShortcutCombo): string {
	const key = combo.key.length === 1 ? combo.key.toUpperCase() : combo.key;

	if (combo.ctrlOrMeta) {
		const modifiers = `${combo.shift ? 'Shift+' : ''}${combo.alt ? 'Alt+' : ''}`;
		return `${modifiers}Control+${key} ${modifiers}Meta+${key}`;
	}

	const parts: string[] = [];
	if (combo.ctrl) parts.push('Control');
	if (combo.meta) parts.push('Meta');
	if (combo.alt) parts.push('Alt');
	if (combo.shift) parts.push('Shift');
	parts.push(key);
	return parts.join('+');
}
