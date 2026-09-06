DayLight is the SvelteKit/Tauri renderer of MD/Yaml files found at ~/syncthing/DayLight (the operating folder) and more specifically in ~/syncthing/DayLight/Tasks, where currently written files are.

The contract is render-on-match without validation. The files may contain thousands of lines of information. DayLight's contract are only against the sections, and indeed matched segments of an enumerated entry.

That means that commonly conceived tasks are not actually complex asks within the system. The creation of an entirely new MD at ~/syncthing/DayLight is non-opped by the rest of the renderer.

More importantly: the data layer is only responsible to the view: while a date may be passed from one view to another, the entire rest of the contract is derived from the date as held by state within the route and
derived through components and subsequent children. A component that lives in routea/ does not have to answer to the contract in any other route until it is placed there, and currently, all routes agree on what
is provided to child components.

Goals for the next session:
1) create a standard ~/syncthing/DayLight/context.md that mirrors Task entries in a reverse chronological order: the only data requiring enumeration is a date (MM-DD) and a string (entry).
2) a modal as component should be created as a display/edit surface. It renders the context.md entry for the date as given by DayLight as a populated text area, allow for edits, entry of non-entries, and a save
button, using existing components for guidance on CSS framing (don't list every /components item and read them all, pick like three).
3) The component should be a "ghost" component in that it is only accessible by either long pressing the add/task button signified by the plus button in the global overlay that points to the add task component.
4) The human smoke test for this will be simple: if a context.md entry for the date as given by the surface exists at today-bases, a warning colored circle will appear next to the today date picker component in
the top left of the top bar
5) recurrence.ts will be refactored so that it is less shitty: rather than writing ahead at an arbitrary rate (see, e.g. ~/syncthing/DayLight/Tasks/Flownotes dedup.md and its populated entries), it will re-render
on tick based on system time.
6) /calendar will actually become useful: past events are currently rendered correctly. Future events will render calculated state against MD surfaces, and since they aren't being written to, calculate them.
This creates a potentially more long-winded surface, but it's also increasingly easy to create a "recurring.json" and "future.json" within tasks. No agent has ever thought of the simple indexing hack.
on the weekly tab, things are close to where they should be. On the monthly tab on mobile, non-recurring events (ones with a single future active instance), should be rendered on top. This feels obvious but
provides an intuitive framing: one isn't curious about the thing they do every day magically appearing every day later, they review a month ahead to see what *different* events are coming.
7) The data and rendering contract provides a final layer of refactoring that requires a single addition to an entry: all tasks in ~/DayLight/Tasks/ have a status field: active or closed. This is valuable:
it prevents clobbering when someone schedules or completes an infrequent event on a non-regular interval. For example, one might go to a specific store that might sell junk food. It is worth knowing when they go
collectively, even if it is 4, 7, 9 and 3 days apart. The file name and the non-clobbering is the signal.
8) But, because the render contract is on-match, calendar can become useful by not creating a new field, but by simplying adding a new status entry: float. In compsci terms this means something completely different:
here, it just means that the task is floating without another status. And when done so, it allows for tasks to be scheduled agentically or programmatically and then scheduled by the user at another date. It 
becomes the entire "Unplanned this week" rail.
9) The planner itself is re-factored. No calendar is currently used within this app. The render should follow the rest of 6) in posting a list of non-recurring scheduled events, scheduled events and capping at 7
items per column, if not fewer. Then the move is to simply append. A drag with either a finger or the mouse to a day columng simply adds an entry to the task stating the date that it's active. Because of the
risk of a person existing on the final day of a 7-week period and wanting to plan for the next week exists, simple arrows at the day-date top row level re-render the planner across future weeks.
