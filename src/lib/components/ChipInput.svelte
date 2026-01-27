<script lang="ts">
	import {
		parseShortcodes,
		findPartialShortcode,
		completeShortcode,
		type PartialShortcode
	} from '$lib/shortcode/parser';

	export interface Chip {
		type: 'tag' | 'context' | 'project';
		value: string;
	}

	interface Props {
		value: string;
		placeholder?: string;
		suggestions?: string[];
		oninput?: (value: string) => void;
		onparsed?: (parsed: { title: string; tags: string[]; contexts: string[]; project: string | null }) => void;
	}

	let {
		value = $bindable(''),
		placeholder = 'Enter text with #tags @contexts +project',
		suggestions = [],
		oninput,
		onparsed
	}: Props = $props();

	let inputElement: HTMLInputElement | null = $state(null);
	let cursorPosition = $state(0);
	let showSuggestions = $state(false);
	let selectedSuggestionIndex = $state(0);

	// Parse shortcodes from input value
	let parsed = $derived(parseShortcodes(value));

	// Derive chips from parsed shortcodes
	let chips = $derived.by(() => {
		const result: Chip[] = [];

		for (const tag of parsed.tags) {
			result.push({ type: 'tag', value: tag });
		}

		for (const context of parsed.contexts) {
			result.push({ type: 'context', value: context });
		}

		if (parsed.project) {
			result.push({ type: 'project', value: parsed.project });
		}

		return result;
	});

	// Find partial shortcode at cursor for autocomplete
	let partialShortcode = $derived(findPartialShortcode(value, cursorPosition));

	// Filter suggestions based on partial shortcode
	let filteredSuggestions = $derived.by(() => {
		if (!partialShortcode || !suggestions.length) {
			return [];
		}

		return suggestions
			.filter((s) => s.toLowerCase().startsWith(partialShortcode.partial))
			.slice(0, 5);
	});

	$effect(() => {
		// Notify parent of parsed changes
		onparsed?.(parsed);
	});

	$effect(() => {
		// Show suggestions when we have matches
		showSuggestions = filteredSuggestions.length > 0;
		selectedSuggestionIndex = 0;
	});

	function getChipClass(type: Chip['type']): string {
		switch (type) {
			case 'tag':
				return 'chip-tag';
			case 'context':
				return 'chip-context';
			case 'project':
				return 'chip-project';
			default:
				return '';
		}
	}

	function getChipPrefix(type: Chip['type']): string {
		switch (type) {
			case 'tag':
				return '#';
			case 'context':
				return '@';
			case 'project':
				return '+';
			default:
				return '';
		}
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;
		cursorPosition = target.selectionStart ?? 0;
		oninput?.(value);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!showSuggestions) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				selectedSuggestionIndex = Math.min(
					selectedSuggestionIndex + 1,
					filteredSuggestions.length - 1
				);
				break;
			case 'ArrowUp':
				e.preventDefault();
				selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, 0);
				break;
			case 'Enter':
			case 'Tab':
				if (filteredSuggestions.length > 0) {
					e.preventDefault();
					selectSuggestion(filteredSuggestions[selectedSuggestionIndex]);
				}
				break;
			case 'Escape':
				showSuggestions = false;
				break;
		}
	}

	function selectSuggestion(suggestion: string) {
		if (!partialShortcode) return;

		value = completeShortcode(value, partialShortcode, suggestion);
		showSuggestions = false;

		// Set cursor position after the completed shortcode
		setTimeout(() => {
			if (inputElement) {
				const newPosition = partialShortcode.startIndex + suggestion.length + 2; // +2 for prefix and space
				inputElement.setSelectionRange(newPosition, newPosition);
				cursorPosition = newPosition;
			}
		}, 0);

		oninput?.(value);
	}

	function handleClick(e: MouseEvent) {
		const target = e.target as HTMLInputElement;
		cursorPosition = target.selectionStart ?? 0;
	}
</script>

<div class="chip-input-container relative">
	{#if chips.length > 0}
		<div class="chips-display flex flex-wrap gap-1 mb-2">
			{#each chips as chip}
				<span class="chip {getChipClass(chip.type)}">
					<span class="chip-prefix">{getChipPrefix(chip.type)}</span>
					{chip.value}
				</span>
			{/each}
		</div>
	{/if}
	<input
		bind:this={inputElement}
		type="text"
		{placeholder}
		{value}
		oninput={handleInput}
		onkeydown={handleKeydown}
		onclick={handleClick}
		class="chip-input w-full p-3 rounded-lg border"
		autocomplete="off"
	/>
	{#if showSuggestions && filteredSuggestions.length > 0}
		<ul class="suggestions-dropdown absolute left-0 right-0 mt-1 rounded-lg shadow-lg z-50 overflow-hidden">
			{#each filteredSuggestions as suggestion, index}
				<li>
					<button
						type="button"
						class="suggestion-item w-full text-left px-3 py-2"
						class:selected={index === selectedSuggestionIndex}
						onclick={() => selectSuggestion(suggestion)}
					>
						{#if partialShortcode}
							<span class="suggestion-prefix">
								{partialShortcode.type === 'tag' ? '#' : partialShortcode.type === 'context' ? '@' : '+'}
							</span>
						{/if}
						{suggestion}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.chip-input {
		background-color: rgb(var(--color-surface-50));
		border-color: rgb(var(--color-surface-300));
		color: rgb(var(--body-text-color));
	}

	:global([data-theme='flexoki-dark']) .chip-input,
	:global([data-theme='ayu-dark']) .chip-input {
		background-color: rgb(var(--color-surface-700));
		border-color: rgb(var(--color-surface-600));
	}

	.chip-input:focus {
		outline: none;
		border-color: rgb(var(--color-primary-500));
		box-shadow: 0 0 0 2px rgb(var(--color-primary-500) / 0.2);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.chip-tag {
		background-color: rgb(var(--color-primary-100));
		color: rgb(var(--color-primary-700));
	}

	:global([data-theme='flexoki-dark']) .chip-tag,
	:global([data-theme='ayu-dark']) .chip-tag {
		background-color: rgb(var(--color-primary-900));
		color: rgb(var(--color-primary-300));
	}

	.chip-context {
		background-color: rgb(var(--color-secondary-100));
		color: rgb(var(--color-secondary-700));
	}

	:global([data-theme='flexoki-dark']) .chip-context,
	:global([data-theme='ayu-dark']) .chip-context {
		background-color: rgb(var(--color-secondary-900));
		color: rgb(var(--color-secondary-300));
	}

	.chip-project {
		background-color: rgb(var(--color-tertiary-100));
		color: rgb(var(--color-tertiary-700));
	}

	:global([data-theme='flexoki-dark']) .chip-project,
	:global([data-theme='ayu-dark']) .chip-project {
		background-color: rgb(var(--color-tertiary-900));
		color: rgb(var(--color-tertiary-300));
	}

	.chip-prefix {
		opacity: 0.7;
	}

	.chip-remove {
		opacity: 0.6;
		cursor: pointer;
	}

	.suggestions-dropdown {
		background-color: rgb(var(--color-surface-50));
		border: 1px solid rgb(var(--color-surface-200));
		list-style: none;
		padding: 0;
		margin: 0;
	}

	:global([data-theme='flexoki-dark']) .suggestions-dropdown,
	:global([data-theme='ayu-dark']) .suggestions-dropdown {
		background-color: rgb(var(--color-surface-700));
		border-color: rgb(var(--color-surface-600));
	}

	.suggestion-item {
		background: none;
		border: none;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.suggestion-item:hover,
	.suggestion-item.selected {
		background-color: rgb(var(--color-surface-200));
	}

	:global([data-theme='flexoki-dark']) .suggestion-item:hover,
	:global([data-theme='flexoki-dark']) .suggestion-item.selected,
	:global([data-theme='ayu-dark']) .suggestion-item:hover,
	:global([data-theme='ayu-dark']) .suggestion-item.selected {
		background-color: rgb(var(--color-surface-600));
	}

	.suggestion-prefix {
		opacity: 0.6;
		margin-right: 0.125rem;
	}
</style>
