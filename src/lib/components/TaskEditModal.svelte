<script lang="ts">
	import type { ViewTask } from '$lib/services/ViewService';
	import type { Recurrence } from '$lib/domain/recurrence';
	import { rruleToRecurrence, recurrenceToRRule } from '$lib/storage/frontmatter';
	import { formatLocalDate } from '$lib/domain/task';
	import { formatRecurrenceShort } from '$lib/domain/recurrence';
	import { updateTaskWithBody } from '$lib/stores/markdown-store.svelte';
	import RecurrenceEditor from './RecurrenceEditor.svelte';
	import Sheet from './Sheet.svelte';

	import IconX from '~icons/lucide/x';
	import IconPlus from '~icons/lucide/plus';

	interface Props {
		task: ViewTask;
		open: boolean;
		onclose: () => void;
	}

	let { task, open, onclose }: Props = $props();

	// Local state for editing
	let taskInfo = $state('');
	let tags = $state<string[]>([]);
	let projects = $state<string[]>([]);
	let newTagInput = $state('');
	let newProjectInput = $state('');
	let showTagInput = $state(false);
	let showProjectInput = $state(false);
	let showRecurrenceEditor = $state(false);

	// Recurrence state
	const existingRecurrence = $derived.by(() => {
		if (!task.frontmatter.recurrence) return null;
		return rruleToRecurrence(task.frontmatter.recurrence);
	});
	let editedRecurrence = $state<Recurrence | null>(null);

	// Reset state when modal opens or task changes
	$effect(() => {
		if (open) {
			taskInfo = task.body || '';
			tags = [...task.frontmatter.tags.filter(t => t !== 'task')];
			projects = [...task.frontmatter.projects];
			editedRecurrence = null;
			showRecurrenceEditor = false;
			newTagInput = '';
			newProjectInput = '';
			showTagInput = false;
			showProjectInput = false;
		}
	});

	const recurrenceLabel = $derived.by(() => {
		const rec = editedRecurrence || existingRecurrence;
		return rec ? formatRecurrenceShort(rec) : 'Not repeating';
	});

	function removeTag(tag: string) {
		tags = tags.filter(t => t !== tag);
	}

	function addTag() {
		const trimmed = newTagInput.trim().toLowerCase();
		if (trimmed && !tags.includes(trimmed)) {
			tags = [...tags, trimmed];
		}
		newTagInput = '';
		showTagInput = false;
	}

	function removeProject(project: string) {
		projects = projects.filter(p => p !== project);
	}

	function addProject() {
		const trimmed = newProjectInput.trim();
		if (trimmed && !projects.includes(trimmed)) {
			projects = [...projects, trimmed];
		}
		newProjectInput = '';
		showProjectInput = false;
	}

	function handleRecurrenceChange(rec: Recurrence) {
		editedRecurrence = rec;
	}

	async function handleSave() {
		const updates: Record<string, unknown> = {
			tags: ['task', ...tags],
			projects
		};

		// If recurrence was edited, update it
		if (editedRecurrence) {
			updates.recurrence = recurrenceToRRule(editedRecurrence);
			updates.recurrence_anchor = 'scheduled';
		}

		await updateTaskWithBody(task.filename, updates, taskInfo);
		onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}
</script>

<Sheet {open} onclose={onclose} title={task.title || 'Edit Task'}>
	<div class="task-edit-modal">
		<!-- Task Title (read-only) -->
		<div class="section mb-4">
			<span class="section-label">Task</span>
			<div class="task-title-display">{task.title}</div>
		</div>

		<!-- Task Info (body - editable) -->
		<div class="section mb-4">
			<span class="section-label">Notes</span>
			<textarea
				class="task-info-input"
				placeholder="Add notes..."
				bind:value={taskInfo}
				rows="3"
			></textarea>
		</div>

		<!-- Tags (chips) -->
		<div class="section mb-4">
			<span class="section-label">Tags</span>
			<div class="chips-container">
				{#each tags as tag}
					<button
						type="button"
						class="chip chip-tag"
						onclick={() => removeTag(tag)}
						title="Click to remove"
					>
						#{tag}
						<span class="chip-remove"><IconX width="12" height="12" /></span>
					</button>
				{/each}
				{#if showTagInput}
					<input
						type="text"
						class="chip-input"
						placeholder="tag name"
						bind:value={newTagInput}
						onkeydown={(e) => {
							if (e.key === 'Enter') addTag();
							if (e.key === 'Escape') { showTagInput = false; newTagInput = ''; }
						}}
						onblur={addTag}
					/>
				{:else}
					<button
						type="button"
						class="add-chip-btn"
						onclick={() => showTagInput = true}
					>
						<IconPlus width="14" height="14" />
					</button>
				{/if}
			</div>
		</div>

		<!-- Projects (chips) -->
		<div class="section mb-4">
			<span class="section-label">Projects</span>
			<div class="chips-container">
				{#each projects as project}
					<button
						type="button"
						class="chip chip-project"
						onclick={() => removeProject(project)}
						title="Click to remove"
					>
						+{project}
						<span class="chip-remove"><IconX width="12" height="12" /></span>
					</button>
				{/each}
				{#if showProjectInput}
					<input
						type="text"
						class="chip-input"
						placeholder="project name"
						bind:value={newProjectInput}
						onkeydown={(e) => {
							if (e.key === 'Enter') addProject();
							if (e.key === 'Escape') { showProjectInput = false; newProjectInput = ''; }
						}}
						onblur={addProject}
					/>
				{:else}
					<button
						type="button"
						class="add-chip-btn"
						onclick={() => showProjectInput = true}
					>
						<IconPlus width="14" height="14" />
					</button>
				{/if}
			</div>
		</div>

		<!-- Recurrence -->
		<div class="section mb-4">
			<div class="section-header">
				<span class="section-label">Recurrence</span>
				<button
					type="button"
					class="recurrence-toggle"
					onclick={() => showRecurrenceEditor = !showRecurrenceEditor}
				>
					{recurrenceLabel}
				</button>
			</div>
			{#if showRecurrenceEditor}
				<div class="recurrence-editor-wrapper">
					<RecurrenceEditor
						startDate={task.frontmatter.scheduled || formatLocalDate(new Date())}
						initialRecurrence={editedRecurrence || existingRecurrence}
						inline={true}
						onchange={handleRecurrenceChange}
					/>
				</div>
			{/if}
		</div>

		<!-- Action buttons -->
		<div class="actions">
			<button type="button" class="cancel-btn" onclick={onclose}>
				Cancel
			</button>
			<button type="button" class="save-btn" onclick={handleSave}>
				Save
			</button>
		</div>
	</div>
</Sheet>

<style>
	.task-edit-modal {
		padding: 0.5rem 0;
	}

	.section {
		padding: 0.5rem 0;
	}

	.section-label {
		display: block;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.6;
		margin-bottom: 0.5rem;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.task-title-display {
		font-size: 1rem;
		font-weight: 500;
		padding: 0.5rem;
		background-color: rgb(var(--color-surface-100));
		border-radius: 0.5rem;
	}

	:global([data-mode='dark']) .task-title-display {
		background-color: rgb(var(--color-surface-700));
	}

	.task-info-input {
		width: 100%;
		padding: 0.75rem;
		font-size: 0.875rem;
		border-radius: 0.5rem;
		border: 1px solid rgb(var(--color-surface-300));
		background-color: rgb(var(--color-surface-100));
		resize: vertical;
		min-height: 4rem;
	}

	:global([data-mode='dark']) .task-info-input {
		background-color: rgb(var(--color-surface-700));
		border-color: rgb(var(--color-surface-600));
	}

	.task-info-input:focus {
		outline: none;
		border-color: rgb(var(--color-primary-500));
	}

	.chips-container {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		border: none;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.chip:hover {
		opacity: 0.8;
	}

	.chip-tag {
		background-color: rgb(var(--color-primary-100));
		color: rgb(var(--color-primary-700));
	}

	:global([data-mode='dark']) .chip-tag {
		background-color: rgb(var(--color-primary-900));
		color: rgb(var(--color-primary-300));
	}

	.chip-project {
		background-color: rgb(var(--color-tertiary-100));
		color: rgb(var(--color-tertiary-700));
	}

	:global([data-mode='dark']) .chip-project {
		background-color: rgb(var(--color-tertiary-900));
		color: rgb(var(--color-tertiary-300));
	}

	.chip-remove {
		display: flex;
		align-items: center;
		opacity: 0.6;
	}

	.chip:hover .chip-remove {
		opacity: 1;
	}

	.add-chip-btn {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		border: 1px dashed rgb(var(--color-surface-400));
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgb(var(--color-surface-500));
		transition: all 0.15s;
	}

	.add-chip-btn:hover {
		border-color: rgb(var(--color-primary-500));
		color: rgb(var(--color-primary-500));
	}

	.chip-input {
		padding: 0.25rem 0.5rem;
		font-size: 0.875rem;
		border-radius: 9999px;
		border: 1px solid rgb(var(--color-primary-500));
		background-color: rgb(var(--color-surface-100));
		width: 8rem;
	}

	:global([data-mode='dark']) .chip-input {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.chip-input:focus {
		outline: none;
	}

	.recurrence-toggle {
		padding: 0.375rem 0.75rem;
		font-size: 0.875rem;
		border-radius: 0.5rem;
		border: none;
		background-color: rgb(var(--color-hover-bg));
		color: rgb(var(--color-primary-600));
		cursor: pointer;
		transition: background-color 0.15s;
	}

	:global([data-mode='dark']) .recurrence-toggle {
		background-color: rgb(var(--color-hover-bg-strong));
		color: rgb(var(--color-primary-400));
	}

	.recurrence-toggle:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .recurrence-toggle:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.recurrence-editor-wrapper {
		margin-top: 0.75rem;
		padding: 0.75rem;
		background-color: rgb(var(--color-surface-100));
		border-radius: 0.5rem;
	}

	:global([data-mode='dark']) .recurrence-editor-wrapper {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid rgb(var(--color-surface-200));
	}

	:global([data-mode='dark']) .actions {
		border-top-color: rgb(var(--color-surface-600));
	}

	.cancel-btn {
		padding: 0.625rem 1.25rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		border: none;
		background-color: rgb(var(--color-hover-bg));
		cursor: pointer;
		transition: background-color 0.15s;
	}

	:global([data-mode='dark']) .cancel-btn {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.cancel-btn:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .cancel-btn:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.save-btn {
		padding: 0.625rem 1.25rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		border: none;
		background-color: rgb(var(--color-primary-500));
		color: white;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.save-btn:hover {
		background-color: rgb(var(--color-primary-600));
	}
</style>
