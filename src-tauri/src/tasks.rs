use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// Minimal frontmatter fields needed for categorization.
/// All fields optional — missing YAML keys just become None/empty.
#[derive(Debug, Deserialize, Default)]
#[serde(default)]
struct RawFrontmatter {
    status: Option<String>,
    scheduled: Option<String>,
    due: Option<String>,
    tags: Vec<String>,
    recurrence: Option<String>,
    active_instances: Vec<String>,
    complete_instances: Vec<String>,
    skipped_instances: Vec<String>,
    rescheduled_instances: HashMap<String, String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct TaskFile {
    pub filename: String,
    pub content: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct TaskFileError {
    pub filename: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct GroupedTaskFiles {
    pub now: Vec<TaskFile>,
    pub past: Vec<TaskFile>,
    pub upcoming: Vec<TaskFile>,
    pub wrapped: Vec<TaskFile>,
    pub errors: Vec<TaskFileError>,
}

/// Extract YAML frontmatter from markdown content delimited by `---`.
fn extract_frontmatter(content: &str) -> Option<RawFrontmatter> {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return None;
    }

    // Find the closing `---` after the opening one
    let after_open = &trimmed[3..];
    let close_pos = after_open.find("\n---")?;
    let yaml_block = &after_open[..close_pos];

    serde_yaml::from_str(yaml_block).ok()
}

/// Port of `isActiveToday` from RecurringInstanceService.ts
fn is_active_today(fm: &RawFrontmatter, today: &str) -> bool {
    for date in &fm.active_instances {
        if fm.complete_instances.contains(date) {
            continue;
        }
        if fm.skipped_instances.contains(date) {
            continue;
        }
        let effective = fm.rescheduled_instances.get(date).unwrap_or(date);
        if effective == today {
            return true;
        }
    }
    false
}

/// Port of `hasPastUncompletedInstances` from RecurringInstanceService.ts
fn has_past_uncompleted_instances(fm: &RawFrontmatter, today: &str) -> bool {
    // If task has been rescheduled to the future (series-level), ignore past instances
    if let Some(ref scheduled) = fm.scheduled {
        if scheduled.as_str() > today {
            return false;
        }
    }

    for date in &fm.active_instances {
        if fm.complete_instances.contains(date) {
            continue;
        }
        if fm.skipped_instances.contains(date) {
            continue;
        }
        let effective = fm.rescheduled_instances.get(date).unwrap_or(date);
        if effective.as_str() < today {
            return true;
        }
    }
    false
}

/// Port of `getTaskDateGroup` from RecurringInstanceService.ts:267-336.
/// Returns "now", "past", "upcoming", "wrapped", or "skip" (for non-task/habit files).
fn categorize(fm: &RawFrontmatter, today: &str) -> &'static str {
    // Gate: must have "task" or "habit" tag
    if !fm.tags.iter().any(|t| t == "task" || t == "habit") {
        return "skip";
    }

    // 1. status == "done" → wrapped
    if fm.status.as_deref() == Some("done") {
        return "wrapped";
    }

    // 2. Completed today → wrapped (with exception for non-recurring re-scheduled for today)
    if fm.complete_instances.iter().any(|d| d == today) {
        let has_recurrence = fm.recurrence.is_some();
        let scheduled_is_today = fm.scheduled.as_deref() == Some(today);
        if has_recurrence || !scheduled_is_today {
            return "wrapped";
        }
    }

    // 3. Recurring task logic
    if fm.recurrence.is_some() {
        if has_past_uncompleted_instances(fm, today) {
            return "past";
        }
        if is_active_today(fm, today) {
            return "now";
        }
        if fm.scheduled.as_deref() == Some(today) {
            return "now";
        }
        return "upcoming";
    }

    // 4. Non-recurring: due or scheduled today → now
    if fm.scheduled.as_deref() == Some(today) || fm.due.as_deref() == Some(today) {
        return "now";
    }

    // 5. Non-recurring: past scheduled date
    if let Some(ref scheduled) = fm.scheduled {
        if scheduled.as_str() < today {
            if fm.complete_instances.iter().any(|d| d == scheduled) {
                return "wrapped";
            }
            return "past";
        }
    }

    // 6. Non-recurring: past due date
    if let Some(ref due) = fm.due {
        if due.as_str() < today {
            if fm.complete_instances.iter().any(|d| d == due) {
                return "wrapped";
            }
            return "past";
        }
    }

    // 7. Non-recurring: future scheduled or due → upcoming
    if let Some(ref scheduled) = fm.scheduled {
        if scheduled.as_str() > today {
            return "upcoming";
        }
    }
    if let Some(ref due) = fm.due {
        if due.as_str() > today {
            return "upcoming";
        }
    }

    // 8. Everything else → wrapped (quiet backlog)
    "wrapped"
}

/// Syncthing conflict pattern: contains `.sync-conflict-`
fn is_syncthing_conflict(filename: &str) -> bool {
    filename.contains(".sync-conflict-")
}

#[tauri::command]
pub fn load_grouped_tasks(
    tasks_dir: String,
    today: String,
) -> Result<GroupedTaskFiles, String> {
    let dir_path = Path::new(&tasks_dir);

    if !dir_path.exists() {
        return Ok(GroupedTaskFiles {
            now: vec![],
            past: vec![],
            upcoming: vec![],
            wrapped: vec![],
            errors: vec![],
        });
    }

    let entries = fs::read_dir(dir_path).map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut now = Vec::new();
    let mut past = Vec::new();
    let mut upcoming = Vec::new();
    let mut wrapped = Vec::new();
    let mut errors = Vec::new();

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                errors.push(TaskFileError {
                    filename: String::new(),
                    message: format!("Failed to read directory entry: {}", e),
                });
                continue;
            }
        };

        let filename = entry.file_name().to_string_lossy().to_string();

        // Skip non-.md files
        if !filename.ends_with(".md") {
            continue;
        }

        // Skip Syncthing conflict files
        if is_syncthing_conflict(&filename) {
            continue;
        }

        // Skip directories
        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        if !file_type.is_file() {
            continue;
        }

        let content = match fs::read_to_string(entry.path()) {
            Ok(c) => c,
            Err(e) => {
                errors.push(TaskFileError {
                    filename: filename.clone(),
                    message: format!("Failed to read file: {}", e),
                });
                continue;
            }
        };

        let fm = match extract_frontmatter(&content) {
            Some(fm) => fm,
            None => {
                errors.push(TaskFileError {
                    filename: filename.clone(),
                    message: "Invalid markdown frontmatter".to_string(),
                });
                continue;
            }
        };

        let task_file = TaskFile {
            filename: filename.clone(),
            content,
        };

        match categorize(&fm, &today) {
            "now" => now.push(task_file),
            "past" => past.push(task_file),
            "upcoming" => upcoming.push(task_file),
            "wrapped" => wrapped.push(task_file),
            "skip" => {
                // Files without task/habit tag — still include them so the store has them
                // (they may be needed for other views like reports)
                wrapped.push(task_file);
            }
            _ => wrapped.push(task_file),
        }
    }

    Ok(GroupedTaskFiles {
        now,
        past,
        upcoming,
        wrapped,
        errors,
    })
}
