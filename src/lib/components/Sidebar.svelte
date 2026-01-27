<script lang="ts">
	import { page } from '$app/stores';
	import IconSun from '~icons/lucide/sun';
	import IconCalendar from '~icons/lucide/calendar';
	import IconRepeat from '~icons/lucide/repeat';
	import IconBarChart2 from '~icons/lucide/bar-chart-2';
	import IconSettings from '~icons/lucide/settings';
	import IconChevronRight from '~icons/lucide/chevron-right';
	import IconMoreVertical from '~icons/lucide/more-vertical';
	import IconX from '~icons/lucide/x';
	import IconPlus from '~icons/lucide/plus';

	interface Props {
		open: boolean;
		onclose: () => void;
		projects: string[];
		tags: string[];
		onprojectclick?: (project: string) => void;
		ontagclick?: (tag: string) => void;
		onaddproject?: () => void;
		onaddtag?: () => void;
		onprojectmenu?: (project: string, event: MouseEvent) => void;
		ontagmenu?: (tag: string, event: MouseEvent) => void;
	}

	let {
		open,
		onclose,
		projects,
		tags,
		onprojectclick,
		ontagclick,
		onaddproject,
		onaddtag,
		onprojectmenu,
		ontagmenu
	}: Props = $props();

	let projectsExpanded = $state(true);
	let tagsExpanded = $state(true);

	function isActive(href: string): boolean {
		return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
	}

	function handleBackdropClick() {
		onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="sidebar-backdrop" onclick={handleBackdropClick}></div>

	<!-- Sidebar panel -->
	<aside class="sidebar">
		<div class="sidebar-header">
			<h2 class="text-lg font-semibold">Menu</h2>
			<button type="button" class="close-btn" onclick={onclose} aria-label="Close menu">
				<IconX width="20" height="20" />
			</button>
		</div>

		<nav class="sidebar-nav">
			<!-- Main navigation items -->
			<a
				href="/today-bases"
				class="nav-item"
				class:active={isActive('/today-bases')}
				onclick={onclose}
			>
				<span class="nav-icon"><IconSun width="18" height="18" /></span>
				<span>Today</span>
			</a>

			<a
				href="/calendar"
				class="nav-item"
				class:active={isActive('/calendar')}
				onclick={onclose}
			>
				<span class="nav-icon"><IconCalendar width="18" height="18" /></span>
				<span>Calendar</span>
			</a>

			<a
				href="/recurring-bases"
				class="nav-item"
				class:active={isActive('/recurring-bases')}
				onclick={onclose}
			>
				<span class="nav-icon"><IconRepeat width="18" height="18" /></span>
				<span>Recurring</span>
			</a>

			<hr class="nav-divider" />

			<!-- Projects section -->
			<div class="nav-section">
				<button
					type="button"
					class="section-header"
					onclick={() => (projectsExpanded = !projectsExpanded)}
				>
					<span class="caret" class:expanded={projectsExpanded}><IconChevronRight width="12" height="12" /></span>
					<span class="section-title">Projects</span>
					<span class="section-count">{projects.length}</span>
				</button>

				{#if projectsExpanded}
					<div class="section-content">
						{#each projects as project}
							<div class="section-item">
								<a
									href="/projects/{encodeURIComponent(project)}"
									class="section-item-btn"
									class:active={isActive(`/projects/${encodeURIComponent(project)}`)}
									onclick={onclose}
								>
									<span class="item-indicator project-indicator"></span>
									<span class="item-label">{project}</span>
								</a>
								{#if onprojectmenu}
									<button
										type="button"
										class="item-menu-btn"
										onclick={(e) => {
											e.stopPropagation();
											onprojectmenu?.(project, e);
										}}
										aria-label="Project options"
									>
										<IconMoreVertical width="14" height="14" />
									</button>
								{/if}
							</div>
						{/each}

						{#if onaddproject}
							<button type="button" class="add-item-btn" onclick={onaddproject}>
								<IconPlus width="14" height="14" /><span>Add project</span>
							</button>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Tags section -->
			<div class="nav-section">
				<button
					type="button"
					class="section-header"
					onclick={() => (tagsExpanded = !tagsExpanded)}
				>
					<span class="caret" class:expanded={tagsExpanded}><IconChevronRight width="12" height="12" /></span>
					<span class="section-title">Tags</span>
					<span class="section-count">{tags.length}</span>
				</button>

				{#if tagsExpanded}
					<div class="section-content">
						{#each tags as tag}
							<div class="section-item">
								<a
									href="/tags/{encodeURIComponent(tag)}"
									class="section-item-btn"
									class:active={isActive(`/tags/${encodeURIComponent(tag)}`)}
									onclick={onclose}
								>
									<span class="item-indicator tag-indicator"></span>
									<span class="item-label">{tag}</span>
								</a>
								{#if ontagmenu}
									<button
										type="button"
										class="item-menu-btn"
										onclick={(e) => {
											e.stopPropagation();
											ontagmenu?.(tag, e);
										}}
										aria-label="Tag options"
									>
										<IconMoreVertical width="14" height="14" />
									</button>
								{/if}
							</div>
						{/each}

						{#if onaddtag}
							<button type="button" class="add-item-btn" onclick={onaddtag}>
								<IconPlus width="14" height="14" /><span>Add tag</span>
							</button>
						{/if}
					</div>
				{/if}
			</div>

			<hr class="nav-divider" />

			<a
				href="/reports"
				class="nav-item"
				class:active={isActive('/reports')}
				onclick={onclose}
			>
				<span class="nav-icon"><IconBarChart2 width="18" height="18" /></span>
				<span>Reports</span>
			</a>

			<a
				href="/settings"
				class="nav-item"
				class:active={isActive('/settings')}
				onclick={onclose}
			>
				<span class="nav-icon"><IconSettings width="18" height="18" /></span>
				<span>Settings</span>
			</a>
		</nav>
	</aside>
{/if}

<style>
	.sidebar-backdrop {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.4);
		z-index: 100;
	}

	.sidebar {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		width: 280px;
		max-width: 85vw;
		background-color: rgb(var(--color-surface-100));
		z-index: 101;
		display: flex;
		flex-direction: column;
		box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
	}

	:global([data-theme='flexoki-dark']) .sidebar,
	:global([data-theme='ayu-dark']) .sidebar {
		background-color: rgb(var(--color-surface-800));
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid rgb(var(--color-surface-200));
	}

	:global([data-theme='flexoki-dark']) .sidebar-header,
	:global([data-theme='ayu-dark']) .sidebar-header {
		border-bottom-color: rgb(var(--color-surface-600));
	}

	.close-btn {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		border: none;
		background: transparent;
		font-size: 1.5rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgb(var(--color-surface-600));
	}

	.close-btn:hover {
		background-color: rgb(var(--color-surface-200));
	}

	:global([data-theme='flexoki-dark']) .close-btn:hover,
	:global([data-theme='ayu-dark']) .close-btn:hover {
		background-color: rgb(var(--color-surface-700));
	}

	.sidebar-nav {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem 0;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		text-decoration: none;
		color: rgb(var(--body-text-color));
		transition: background-color 0.15s;
	}

	.nav-item:hover {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-theme='flexoki-dark']) .nav-item:hover,
	:global([data-theme='ayu-dark']) .nav-item:hover {
		background-color: rgb(var(--color-surface-700));
	}

	.nav-item.active {
		background-color: rgb(var(--color-primary-100));
		color: rgb(var(--color-primary-700));
	}

	:global([data-theme='flexoki-dark']) .nav-item.active,
	:global([data-theme='ayu-dark']) .nav-item.active {
		background-color: rgb(var(--color-primary-900) / 0.5);
		color: rgb(var(--color-primary-300));
	}

	.nav-icon {
		font-size: 1.125rem;
	}

	.nav-divider {
		margin: 0.5rem 1rem;
		border: none;
		border-top: 1px solid rgb(var(--color-surface-200));
	}

	:global([data-theme='flexoki-dark']) .nav-divider,
	:global([data-theme='ayu-dark']) .nav-divider {
		border-top-color: rgb(var(--color-surface-600));
	}

	.nav-section {
		margin: 0.25rem 0;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 1rem;
		border: none;
		background: transparent;
		cursor: pointer;
		text-align: left;
		color: rgb(var(--color-surface-500));
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.section-header:hover {
		color: rgb(var(--body-text-color));
	}

	.caret {
		font-size: 0.625rem;
		transition: transform 0.15s;
	}

	.caret.expanded {
		transform: rotate(90deg);
	}

	.section-title {
		flex: 1;
	}

	.section-count {
		font-size: 0.625rem;
		background-color: rgb(var(--color-surface-200));
		padding: 0.125rem 0.375rem;
		border-radius: 9999px;
	}

	:global([data-theme='flexoki-dark']) .section-count,
	:global([data-theme='ayu-dark']) .section-count {
		background-color: rgb(var(--color-surface-600));
	}

	.section-content {
		padding: 0.25rem 0;
	}

	.section-item {
		display: flex;
		align-items: center;
	}

	.section-item-btn {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem 0.5rem 2rem;
		border: none;
		background: transparent;
		cursor: pointer;
		text-align: left;
		color: rgb(var(--body-text-color));
		font-size: 0.875rem;
		text-decoration: none;
	}

	.section-item-btn:hover {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-theme='flexoki-dark']) .section-item-btn:hover,
	:global([data-theme='ayu-dark']) .section-item-btn:hover {
		background-color: rgb(var(--color-surface-700));
	}

	.section-item-btn.active {
		background-color: rgb(var(--color-primary-100));
		color: rgb(var(--color-primary-700));
	}

	:global([data-theme='flexoki-dark']) .section-item-btn.active,
	:global([data-theme='ayu-dark']) .section-item-btn.active {
		background-color: rgb(var(--color-primary-900) / 0.5);
		color: rgb(var(--color-primary-300));
	}

	.item-indicator {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
	}

	.project-indicator {
		background-color: rgb(var(--color-tertiary-500));
	}

	.tag-indicator {
		background-color: rgb(var(--color-primary-500));
	}

	.item-label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-menu-btn {
		padding: 0.25rem 0.5rem;
		margin-right: 0.5rem;
		border: none;
		background: transparent;
		cursor: pointer;
		color: rgb(var(--color-surface-400));
		font-size: 1rem;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.section-item:hover .item-menu-btn {
		opacity: 1;
	}

	.item-menu-btn:hover {
		color: rgb(var(--body-text-color));
	}

	.add-item-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem 0.5rem 2rem;
		width: 100%;
		border: none;
		background: transparent;
		cursor: pointer;
		text-align: left;
		color: rgb(var(--color-surface-500));
		font-size: 0.875rem;
	}

	.add-item-btn:hover {
		color: rgb(var(--color-primary-500));
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-theme='flexoki-dark']) .add-item-btn:hover,
	:global([data-theme='ayu-dark']) .add-item-btn:hover {
		background-color: rgb(var(--color-surface-700));
	}
</style>
