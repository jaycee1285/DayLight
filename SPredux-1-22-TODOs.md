# UI

* Light/dark button in navbar currently does not switch from Ayu Light to Ayu Dark but from Ayu to Flexoki to Flexoki Dark for some reason  
* Calendar route should gracefully allow for a quick skimming of tasks in a vertical manner, with collapsible panes, for the weekly view. For the monthly view, it should be roughly 10 characters wide per day and include none-recurring tasks and calendar appointments from Google  
* On the left sidebar, the projects and tags should actually go to sub-routes that show the tasks for a project when tapping on the given project name. The same is true for tags  
* In the today view, projects and tags should be visible in a smaller font below the task name and the time spent so far should be visible on the right hand side. Long-tapping (mobile) or right-clicking (desktop) should bring up a context menu that starts with a 5-icon wide row to re-schedule the task for today, tomorrow, in a week, on a specific date, or to delete. Below that, there should be lucide or similar icons and menu options for Mark as Done, Track Time, Add Sub-Task, Toggle Tags and Move to Project.  
* That context menu should be available when viewing the schedule and today views

# Logic

* If not already possible, tasks should be able to have sub-tasks  
* Soft-tapping on a task should bring up a different contextual menu that includes the following fields: sub-tasks, time (this is where the tracking element actually goes), planned for (the same icons from the top of the long-tap context menu plus a date picker when you tap on it), the repeating schedule (and a sub-menu for allowing you to select and change recurrence for future repetitions of the task, as well as a tag entry textbox