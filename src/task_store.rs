use chrono::{Datelike, Duration, Local, NaiveDate, SecondsFormat};
use serde::{Deserialize, Serialize};
use serde_yaml::Mapping;
use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(default)]
pub struct TaskFrontmatter {
    pub status: TaskStatus,
    pub priority: TaskPriority,
    pub scheduled: Option<String>,
    pub due: Option<String>,
    #[serde(rename = "startTime")]
    pub start_time: Option<String>,
    #[serde(rename = "plannedDuration")]
    pub planned_duration: Option<u32>,
    pub tags: Vec<String>,
    pub contexts: Vec<String>,
    pub projects: Vec<String>,
    pub recurrence: Option<String>,
    pub recurrence_anchor: RecurrenceAnchor,
    pub active_instances: Vec<String>,
    pub complete_instances: Vec<String>,
    pub skipped_instances: Vec<String>,
    pub rescheduled_instances: HashMap<String, String>,
    #[serde(rename = "seriesId")]
    pub series_id: Option<String>,
    #[serde(rename = "isSeriesTemplate")]
    pub is_series_template: bool,
    #[serde(rename = "parentId")]
    pub parent_id: Option<String>,
    pub habit_type: Option<String>,
    pub habit_goal: Option<u32>,
    pub habit_unit: Option<String>,
    pub habit_target_days: Option<u32>,
    pub habit_entries: HashMap<String, f64>,
    #[serde(rename = "timeEntries")]
    pub time_entries: Vec<TimeEntry>,
    #[serde(rename = "dateCreated")]
    pub date_created: String,
    #[serde(rename = "dateModified")]
    pub date_modified: String,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<String>,
    #[serde(flatten)]
    pub extra: Mapping,
}

impl Default for TaskFrontmatter {
    fn default() -> Self {
        let now = now_iso();
        Self {
            status: TaskStatus::Open,
            priority: TaskPriority::None,
            scheduled: None,
            due: None,
            start_time: None,
            planned_duration: None,
            tags: Vec::new(),
            contexts: Vec::new(),
            projects: Vec::new(),
            recurrence: None,
            recurrence_anchor: RecurrenceAnchor::Scheduled,
            active_instances: Vec::new(),
            complete_instances: Vec::new(),
            skipped_instances: Vec::new(),
            rescheduled_instances: HashMap::new(),
            series_id: None,
            is_series_template: false,
            parent_id: None,
            habit_type: None,
            habit_goal: None,
            habit_unit: None,
            habit_target_days: None,
            habit_entries: HashMap::new(),
            time_entries: Vec::new(),
            date_created: now.clone(),
            date_modified: now,
            completed_at: None,
            extra: Mapping::new(),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Open,
    Done,
    Cancelled,
}

impl Default for TaskStatus {
    fn default() -> Self {
        Self::Open
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TaskPriority {
    None,
    Low,
    Normal,
    High,
}

impl Default for TaskPriority {
    fn default() -> Self {
        Self::None
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RecurrenceAnchor {
    Scheduled,
    Completion,
}

impl Default for RecurrenceAnchor {
    fn default() -> Self {
        Self::Scheduled
    }
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(default)]
pub struct TimeEntry {
    pub date: String,
    pub minutes: u32,
    pub note: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Clone, Debug)]
pub struct TaskFile {
    pub filename: String,
    pub path: PathBuf,
    pub frontmatter: TaskFrontmatter,
    pub body: String,
}

impl TaskFile {
    pub fn title(&self) -> String {
        self.path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or(&self.filename)
            .to_string()
    }

    pub fn daily_minutes(&self, date: &str) -> u32 {
        self.frontmatter
            .time_entries
            .iter()
            .filter(|entry| entry.date == date)
            .map(|entry| entry.minutes)
            .sum()
    }
}

#[derive(Clone, Debug)]
pub struct ViewTask {
    pub task: TaskFile,
    pub date_group: DateGroup,
    pub urgency_score: i32,
    pub instance_date: Option<String>,
    pub effective_date: Option<String>,
}

impl ViewTask {
    pub fn title(&self) -> String {
        self.task.title()
    }

    pub fn daily_minutes(&self, date: &str) -> u32 {
        self.task.daily_minutes(date)
    }
}

#[derive(Clone, Debug)]
pub struct LoadError {
    pub filename: String,
    pub message: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MarkdownFileState {
    pub hash: String,
    pub modified: Option<SystemTime>,
}

#[derive(Clone, Debug)]
#[allow(dead_code)]
pub enum SaveOutcome {
    Saved {
        state: MarkdownFileState,
    },
    Conflict {
        current: MarkdownFileState,
        archive_path: PathBuf,
    },
}

#[derive(Clone, Debug, Default)]
pub struct GroupedTasks {
    pub past: Vec<ViewTask>,
    pub now: Vec<ViewTask>,
    pub upcoming: Vec<ViewTask>,
    pub wrapped: Vec<ViewTask>,
}

#[derive(Clone, Debug, Default)]
pub struct DebugCounts {
    pub files_loaded: usize,
    pub recurring_files: usize,
    pub recurring_instances_expanded: usize,
    pub recurring_past_instances: usize,
    pub recurring_now_instances: usize,
    pub nonrecurring_past: usize,
}

impl GroupedTasks {
    pub fn total_len(&self) -> usize {
        self.past.len() + self.now.len() + self.upcoming.len() + self.wrapped.len()
    }
}

#[derive(Clone, Debug)]
pub struct TaskLoadResult {
    pub tasks_dir: PathBuf,
    pub today: String,
    pub grouped: GroupedTasks,
    pub errors: Vec<LoadError>,
    pub debug: DebugCounts,
}

pub fn default_tasks_dir() -> PathBuf {
    if let Some(path) = std::env::var_os("DAYLIGHT_TASKS_DIR") {
        return PathBuf::from(path);
    }
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        let syncthing = home.join("syncthing").join("TaskNotes").join("Tasks");
        if syncthing.exists() {
            return syncthing;
        }
        return home
            .join(".local")
            .join("share")
            .join("DayLight")
            .join("Tasks");
    }
    PathBuf::from("Tasks")
}

pub fn load_tasks_for_today(tasks_dir: &Path) -> TaskLoadResult {
    let today = std::env::var("DAYLIGHT_TODAY").unwrap_or_else(|_| today_string());
    let mut grouped = GroupedTasks::default();
    let mut errors = Vec::new();
    let mut debug = DebugCounts::default();

    match load_all_tasks(tasks_dir) {
        Ok((tasks, load_errors)) => {
            errors.extend(load_errors);
            let (view_tasks, next_debug) = create_view_tasks(tasks, &today);
            debug = next_debug;
            for view_task in view_tasks {
                match view_task.date_group {
                    DateGroup::Past => grouped.past.push(view_task),
                    DateGroup::Now => grouped.now.push(view_task),
                    DateGroup::Upcoming => grouped.upcoming.push(view_task),
                    DateGroup::Wrapped => grouped.wrapped.push(view_task),
                    DateGroup::Skip => {}
                }
            }
        }
        Err(error) => errors.push(LoadError {
            filename: tasks_dir.to_string_lossy().into_owned(),
            message: error.to_string(),
        }),
    }

    sort_group(&mut grouped.past, &today);
    sort_group(&mut grouped.now, &today);
    sort_group(&mut grouped.upcoming, &today);
    sort_group(&mut grouped.wrapped, &today);

    TaskLoadResult {
        tasks_dir: tasks_dir.to_path_buf(),
        today,
        grouped,
        errors,
        debug,
    }
}

pub fn load_all_tasks(tasks_dir: &Path) -> io::Result<(Vec<TaskFile>, Vec<LoadError>)> {
    if !tasks_dir.exists() {
        return Ok((Vec::new(), Vec::new()));
    }

    let mut tasks = Vec::new();
    let mut errors = Vec::new();
    for entry in fs::read_dir(tasks_dir)? {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                errors.push(LoadError {
                    filename: tasks_dir.to_string_lossy().into_owned(),
                    message: error.to_string(),
                });
                continue;
            }
        };
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(filename) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if !filename.ends_with(".md") || filename.contains(".sync-conflict-") {
            continue;
        }
        match fs::read_to_string(&path) {
            Ok(content) => {
                if let Some(parsed) = parse_markdown(&content) {
                    tasks.push(TaskFile {
                        filename: filename.to_string(),
                        path,
                        frontmatter: parsed.frontmatter,
                        body: parsed.body,
                    });
                } else {
                    errors.push(LoadError {
                        filename: filename.to_string(),
                        message: "invalid or missing YAML frontmatter".to_string(),
                    });
                }
            }
            Err(error) => errors.push(LoadError {
                filename: filename.to_string(),
                message: error.to_string(),
            }),
        }
    }
    Ok((tasks, errors))
}

pub fn create_view_tasks(mut tasks: Vec<TaskFile>, today: &str) -> (Vec<ViewTask>, DebugCounts) {
    process_recurring_instances(&mut tasks, today);
    let window_start = parse_date(today)
        .map(|today| today - Duration::days(7))
        .map(|date| date.format("%Y-%m-%d").to_string());

    let mut view_tasks = Vec::new();
    let mut debug = DebugCounts {
        files_loaded: tasks.len(),
        ..Default::default()
    };
    for task in tasks {
        if task.frontmatter.tags.iter().any(|tag| tag == "habit") {
            view_tasks.push(ViewTask {
                urgency_score: urgency_score(&task.frontmatter, today),
                effective_date: None,
                instance_date: None,
                date_group: DateGroup::Wrapped,
                task,
            });
            continue;
        }

        if !task.frontmatter.tags.iter().any(|tag| tag == "task") {
            continue;
        }

        if task.frontmatter.recurrence.is_some() {
            debug.recurring_files += 1;
            let series_rescheduled = task
                .frontmatter
                .scheduled
                .as_ref()
                .filter(|scheduled| scheduled.as_str() > today)
                .cloned();

            let instances_to_show: Vec<(String, String)> = task
                .frontmatter
                .active_instances
                .iter()
                .filter_map(|date| {
                    if task.frontmatter.complete_instances.contains(date)
                        || task.frontmatter.skipped_instances.contains(date)
                    {
                        return None;
                    }

                    let effective_date = task
                        .frontmatter
                        .rescheduled_instances
                        .get(date)
                        .unwrap_or(date);

                    if effective_date.as_str() != today {
                        return None;
                    }

                    if series_rescheduled.is_some()
                        && !task.frontmatter.rescheduled_instances.contains_key(date)
                    {
                        return None;
                    }

                    Some((date.clone(), effective_date.clone()))
                })
                .collect();

            if instances_to_show.is_empty() {
                let uncompleted: Vec<(String, String)> = task
                    .frontmatter
                    .active_instances
                    .iter()
                    .filter_map(|date| {
                        if task.frontmatter.complete_instances.contains(date)
                            || task.frontmatter.skipped_instances.contains(date)
                        {
                            return None;
                        }
                        let effective = task
                            .frontmatter
                            .rescheduled_instances
                            .get(date)
                            .unwrap_or(date);
                        Some((date.clone(), effective.clone()))
                    })
                    .collect();
                let past_count = uncompleted
                    .iter()
                    .filter(|(_, effective)| effective.as_str() < today)
                    .count();
                let latest_past = uncompleted
                    .iter()
                    .filter(|(_, effective)| effective.as_str() < today)
                    .map(|(_, effective)| effective.as_str())
                    .max();
                let next_future = uncompleted
                    .iter()
                    .filter(|(_, effective)| effective.as_str() > today)
                    .map(|(_, effective)| effective.as_str())
                    .min();
                let tomorrow = parse_date(today)
                    .map(|date| date + Duration::days(1))
                    .map(|date| date.format("%Y-%m-%d").to_string());

                let date_group = if past_count == 1
                    && latest_past
                        .zip(window_start.as_deref())
                        .is_some_and(|(latest, window_start)| latest < window_start)
                    && task
                        .frontmatter
                        .recurrence
                        .as_deref()
                        .is_some_and(|rrule| rrule.contains("FREQ=MONTHLY"))
                {
                    Some(DateGroup::Past)
                } else if past_count <= 1
                    || (past_count == 1
                        && next_future
                            .zip(tomorrow.as_deref())
                            .is_some_and(|(next, tomorrow)| next <= tomorrow))
                {
                    Some(DateGroup::Upcoming)
                } else {
                    None
                };

                if let Some(date_group) = date_group {
                    let also_wrapped = date_group == DateGroup::Past;
                    view_tasks.push(ViewTask {
                        urgency_score: urgency_score(&task.frontmatter, today),
                        effective_date: next_future
                            .map(str::to_string)
                            .or_else(|| task.frontmatter.scheduled.clone()),
                        instance_date: None,
                        date_group,
                        task: task.clone(),
                    });
                    if also_wrapped {
                        view_tasks.push(ViewTask {
                            urgency_score: urgency_score(&task.frontmatter, today),
                            effective_date: next_future.map(str::to_string),
                            instance_date: None,
                            date_group: DateGroup::Wrapped,
                            task,
                        });
                    }
                } else {
                    let should_surface_upcoming = past_count == 2
                        && next_future
                            .and_then(parse_date)
                            .zip(parse_date(today))
                            .is_some_and(|(next, today)| next <= today + Duration::days(4));

                    if should_surface_upcoming {
                        view_tasks.push(ViewTask {
                            urgency_score: urgency_score(&task.frontmatter, today),
                            effective_date: next_future.map(str::to_string),
                            instance_date: None,
                            date_group: DateGroup::Upcoming,
                            task: task.clone(),
                        });
                    }

                    view_tasks.push(ViewTask {
                        urgency_score: urgency_score(&task.frontmatter, today),
                        effective_date: next_future.map(str::to_string),
                        instance_date: None,
                        date_group: DateGroup::Wrapped,
                        task,
                    });
                }
            } else {
                for (instance_date, effective_date) in instances_to_show {
                    debug.recurring_instances_expanded += 1;
                    let date_group = if effective_date.as_str() < today {
                        DateGroup::Past
                    } else {
                        DateGroup::Now
                    };
                    view_tasks.push(ViewTask {
                        urgency_score: urgency_score_for_instance(
                            &task.frontmatter,
                            &effective_date,
                            today,
                        ),
                        effective_date: Some(effective_date),
                        instance_date: Some(instance_date),
                        date_group,
                        task: task.clone(),
                    });
                }
                view_tasks.push(ViewTask {
                    urgency_score: urgency_score(&task.frontmatter, today),
                    effective_date: None,
                    instance_date: None,
                    date_group: DateGroup::Wrapped,
                    task,
                });
            }
        } else {
            let date_group = categorize(&task.frontmatter, today);
            view_tasks.push(ViewTask {
                urgency_score: urgency_score(&task.frontmatter, today),
                effective_date: task.frontmatter.scheduled.clone(),
                instance_date: None,
                date_group,
                task,
            });
        }
    }

    for view_task in &view_tasks {
        match (
            view_task.task.frontmatter.recurrence.is_some(),
            view_task.date_group,
        ) {
            (true, DateGroup::Past) => debug.recurring_past_instances += 1,
            (true, DateGroup::Now) => debug.recurring_now_instances += 1,
            (false, DateGroup::Past) => debug.nonrecurring_past += 1,
            _ => {}
        }
    }

    (view_tasks, debug)
}

fn process_recurring_instances(tasks: &mut [TaskFile], today: &str) {
    let Some(today_date) = parse_date(today) else {
        return;
    };
    let window_start = today_date - Duration::days(7);
    let window_end = today_date + Duration::days(30);

    for task in tasks {
        let Some(rrule) = &task.frontmatter.recurrence else {
            continue;
        };
        let Some(recurrence) = Recurrence::from_rrule(rrule) else {
            continue;
        };
        let occurrences = recurrence.generate_occurrences(window_start, window_end);
        let mut updated = false;
        for occurrence in occurrences {
            if !task.frontmatter.active_instances.contains(&occurrence) {
                task.frontmatter.active_instances.push(occurrence);
                updated = true;
            }
        }
        if updated {
            task.frontmatter.active_instances.sort();
        }
    }
}

pub struct ParsedMarkdown {
    pub frontmatter: TaskFrontmatter,
    pub body: String,
}

pub fn parse_markdown(content: &str) -> Option<ParsedMarkdown> {
    let trimmed = content.trim_start();
    let rest = trimmed.strip_prefix("---")?;
    let close_pos = rest.find("\n---")?;
    let yaml = &rest[..close_pos];
    let body = rest[close_pos + 4..].trim().to_string();
    let frontmatter = serde_yaml::from_str::<TaskFrontmatter>(yaml).ok()?;
    Some(ParsedMarkdown { frontmatter, body })
}

#[allow(dead_code)]
pub fn serialize_markdown(task: &TaskFile) -> Result<String, serde_yaml::Error> {
    let yaml = serde_yaml::to_string(&task.frontmatter)?;
    let body = task.body.trim();
    if body.is_empty() {
        Ok(format!("---\n{yaml}---\n"))
    } else {
        Ok(format!("---\n{yaml}---\n{body}\n"))
    }
}

#[allow(dead_code)]
pub fn save_task_atomic(task: &TaskFile) -> io::Result<()> {
    let content = serialize_markdown(task).map_err(io::Error::other)?;
    atomic_write(&task.path, content.as_bytes())
}

#[allow(dead_code)]
pub fn save_task_checked(task: &TaskFile, expected_hash: Option<&str>) -> io::Result<SaveOutcome> {
    if let Some(expected_hash) = expected_hash {
        if let Some(current) = markdown_file_state(&task.path)? {
            if current.hash != expected_hash {
                return Ok(SaveOutcome::Conflict {
                    current,
                    archive_path: conflict_archive_path(&task.path),
                });
            }
        }
    }

    save_task_atomic(task)?;
    let state = markdown_file_state(&task.path)?.unwrap_or(MarkdownFileState {
        hash: String::new(),
        modified: None,
    });
    Ok(SaveOutcome::Saved { state })
}

#[allow(dead_code)]
pub fn markdown_file_state(path: &Path) -> io::Result<Option<MarkdownFileState>> {
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read(path)?;
    let modified = fs::metadata(path).and_then(|meta| meta.modified()).ok();
    Ok(Some(MarkdownFileState {
        hash: simple_hash(&content),
        modified,
    }))
}

#[allow(dead_code)]
pub fn conflict_archive_path(path: &Path) -> PathBuf {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let data_root = parent.parent().unwrap_or(parent);
    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Untitled.md");
    let stem = filename.strip_suffix(".md").unwrap_or(filename);
    let timestamp = Local::now().format("%Y%m%d-%H%M%S");
    data_root
        .join("conflicts")
        .join(format!("{stem}.conflict-{timestamp}.md"))
}

#[allow(dead_code)]
pub fn generate_task_filename(title: &str) -> String {
    let mut sanitized = title
        .trim()
        .trim_end_matches(".md")
        .chars()
        .filter(|c| !matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'))
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    if sanitized.is_empty() {
        sanitized = "Untitled".to_string();
    }
    sanitized.truncate(200);
    format!("{sanitized}.md")
}

#[allow(dead_code)]
fn atomic_write(path: &Path, bytes: &[u8]) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("md.tmp");
    fs::write(&tmp, bytes)?;
    fs::rename(tmp, path)
}

fn simple_hash(bytes: &[u8]) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DateGroup {
    Past,
    Now,
    Upcoming,
    Wrapped,
    Skip,
}

pub fn categorize(fm: &TaskFrontmatter, today: &str) -> DateGroup {
    if !fm.tags.iter().any(|tag| tag == "task" || tag == "habit") {
        return DateGroup::Skip;
    }

    if fm.status == TaskStatus::Done {
        return DateGroup::Wrapped;
    }

    if fm.complete_instances.iter().any(|date| date == today)
        && (fm.recurrence.is_some() || fm.scheduled.as_deref() != Some(today))
    {
        return DateGroup::Wrapped;
    }

    if fm.recurrence.is_some() {
        if has_past_uncompleted_instances(fm, today) {
            return DateGroup::Past;
        }
        if is_active_today(fm, today) || fm.scheduled.as_deref() == Some(today) {
            return DateGroup::Now;
        }
        return DateGroup::Upcoming;
    }

    if fm.scheduled.as_deref() == Some(today) || fm.due.as_deref() == Some(today) {
        return DateGroup::Now;
    }

    if let Some(scheduled) = &fm.scheduled {
        if scheduled.as_str() < today {
            return if fm.complete_instances.contains(scheduled) {
                DateGroup::Wrapped
            } else {
                DateGroup::Past
            };
        }
    }

    if let Some(due) = &fm.due {
        if due.as_str() < today {
            return if fm.complete_instances.contains(due) {
                DateGroup::Wrapped
            } else {
                DateGroup::Past
            };
        }
    }

    if fm
        .scheduled
        .as_ref()
        .is_some_and(|scheduled| scheduled.as_str() > today)
        || fm.due.as_ref().is_some_and(|due| due.as_str() > today)
    {
        return DateGroup::Upcoming;
    }

    DateGroup::Wrapped
}

fn is_active_today(fm: &TaskFrontmatter, today: &str) -> bool {
    fm.active_instances.iter().any(|date| {
        if fm.complete_instances.contains(date) || fm.skipped_instances.contains(date) {
            return false;
        }
        fm.rescheduled_instances.get(date).unwrap_or(date) == today
    })
}

fn has_past_uncompleted_instances(fm: &TaskFrontmatter, today: &str) -> bool {
    if fm
        .scheduled
        .as_ref()
        .is_some_and(|scheduled| scheduled.as_str() > today)
    {
        return false;
    }

    fm.active_instances.iter().any(|date| {
        if fm.complete_instances.contains(date) || fm.skipped_instances.contains(date) {
            return false;
        }
        fm.rescheduled_instances.get(date).unwrap_or(date).as_str() < today
    })
}

fn sort_group(tasks: &mut [ViewTask], _today: &str) {
    tasks.sort_by(|a, b| {
        b.urgency_score
            .cmp(&a.urgency_score)
            .then_with(|| a.effective_date.cmp(&b.effective_date))
            .then_with(|| a.title().cmp(&b.title()))
    });
}

fn urgency_score(fm: &TaskFrontmatter, today: &str) -> i32 {
    let priority = match fm.priority {
        TaskPriority::High => 3,
        TaskPriority::Normal => 2,
        TaskPriority::Low => 1,
        TaskPriority::None => 0,
    };
    let Some(next) = next_date(fm) else {
        return priority;
    };
    if next < today {
        return priority + 10;
    }
    priority
}

fn urgency_score_for_instance(fm: &TaskFrontmatter, instance_date: &str, today: &str) -> i32 {
    let priority = match fm.priority {
        TaskPriority::High => 3,
        TaskPriority::Normal => 2,
        TaskPriority::Low => 1,
        TaskPriority::None => 0,
    };
    let Some(today_date) = parse_date(today) else {
        return priority;
    };
    let Some(instance) = parse_date(instance_date) else {
        return priority;
    };
    let days_diff = (instance - today_date).num_days();
    if days_diff < 0 {
        priority + 10 + days_diff.unsigned_abs() as i32
    } else {
        priority + 10
    }
}

fn next_date(fm: &TaskFrontmatter) -> Option<&str> {
    match (fm.scheduled.as_deref(), fm.due.as_deref()) {
        (Some(a), Some(b)) => Some(a.min(b)),
        (Some(a), None) => Some(a),
        (None, Some(b)) => Some(b),
        (None, None) => None,
    }
}

#[derive(Clone, Debug)]
struct Recurrence {
    frequency: RecurrenceFrequency,
    interval: i64,
    week_days: Vec<u32>,
    day_of_month: Option<u32>,
    nth_weekday: Option<i32>,
    weekday_for_nth: Option<u32>,
    start_date: NaiveDate,
    end_date: Option<NaiveDate>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum RecurrenceFrequency {
    Daily,
    Weekly,
    Monthly,
    Yearly,
}

impl Recurrence {
    fn from_rrule(rrule: &str) -> Option<Self> {
        let mut props = HashMap::new();
        for part in rrule.split(';') {
            if let Some((key, value)) = part.split_once(':') {
                props.insert(key.to_string(), value.to_string());
            } else if let Some((key, value)) = part.split_once('=') {
                props.insert(key.to_string(), value.to_string());
            }
        }

        let start_date = props
            .get("DTSTART")
            .and_then(|date| parse_compact_date(date))
            .unwrap_or_else(|| Local::now().date_naive());

        let frequency = match props.get("FREQ").map(String::as_str) {
            Some("WEEKLY") => RecurrenceFrequency::Weekly,
            Some("MONTHLY") => RecurrenceFrequency::Monthly,
            Some("YEARLY") => RecurrenceFrequency::Yearly,
            _ => RecurrenceFrequency::Daily,
        };

        let interval = props
            .get("INTERVAL")
            .and_then(|value| value.parse::<i64>().ok())
            .filter(|value| *value > 0)
            .unwrap_or(1);

        let mut recurrence = Self {
            frequency,
            interval,
            week_days: Vec::new(),
            day_of_month: None,
            nth_weekday: None,
            weekday_for_nth: None,
            start_date,
            end_date: props.get("UNTIL").and_then(|date| parse_compact_date(date)),
        };

        if let Some(byday) = props.get("BYDAY") {
            if let Some((nth, weekday)) = parse_nth_weekday(byday) {
                recurrence.nth_weekday = Some(nth);
                recurrence.weekday_for_nth = Some(weekday);
            } else {
                recurrence.week_days = byday.split(',').filter_map(parse_weekday).collect();
            }
        }

        if let Some(month_day) = props
            .get("BYMONTHDAY")
            .and_then(|value| value.parse::<u32>().ok())
        {
            recurrence.day_of_month = Some(month_day);
        }

        if recurrence.frequency == RecurrenceFrequency::Weekly && recurrence.week_days.is_empty() {
            recurrence
                .week_days
                .push(recurrence.start_date.weekday().num_days_from_sunday());
        }

        Some(recurrence)
    }

    fn generate_occurrences(&self, window_start: NaiveDate, window_end: NaiveDate) -> Vec<String> {
        let mut occurrences = Vec::new();
        let end = self.end_date.unwrap_or(window_end).min(window_end);
        let mut current = self.start_date.max(window_start);
        let mut iterations = 0;

        while current <= window_end && current <= end && iterations < 5000 {
            iterations += 1;
            if current >= window_start && current >= self.start_date && self.is_occurrence(current)
            {
                occurrences.push(current.format("%Y-%m-%d").to_string());
            }
            current += Duration::days(1);
        }

        occurrences
    }

    fn is_occurrence(&self, date: NaiveDate) -> bool {
        match self.frequency {
            RecurrenceFrequency::Daily => {
                let days = (date - self.start_date).num_days();
                days >= 0 && days % self.interval == 0
            }
            RecurrenceFrequency::Weekly => {
                if !self
                    .week_days
                    .contains(&date.weekday().num_days_from_sunday())
                {
                    return false;
                }
                let weeks = (date - self.start_date).num_days() / 7;
                weeks >= 0 && weeks % self.interval == 0
            }
            RecurrenceFrequency::Monthly => {
                let months = (date.year() - self.start_date.year()) * 12
                    + (date.month() as i32 - self.start_date.month() as i32);
                if months < 0 || months % self.interval as i32 != 0 {
                    return false;
                }
                if let (Some(nth), Some(weekday)) = (self.nth_weekday, self.weekday_for_nth) {
                    return is_nth_weekday_of_month(date, nth, weekday);
                }
                self.day_of_month.is_some_and(|day| date.day() == day)
            }
            RecurrenceFrequency::Yearly => {
                let years = date.year() - self.start_date.year();
                years >= 0
                    && years % self.interval as i32 == 0
                    && date.month() == self.start_date.month()
                    && date.day() == self.start_date.day()
            }
        }
    }
}

fn is_nth_weekday_of_month(date: NaiveDate, nth: i32, weekday: u32) -> bool {
    if date.weekday().num_days_from_sunday() != weekday {
        return false;
    }
    if nth == -1 {
        let next_week = date + Duration::days(7);
        return next_week.month() != date.month();
    }
    let occurrence = ((date.day() - 1) / 7 + 1) as i32;
    occurrence == nth
}

fn parse_nth_weekday(value: &str) -> Option<(i32, u32)> {
    if value.len() < 3 || value.contains(',') {
        return None;
    }
    let (prefix, day) = value.split_at(value.len() - 2);
    let nth = prefix.parse::<i32>().ok()?;
    Some((nth, parse_weekday(day)?))
}

fn parse_weekday(value: &str) -> Option<u32> {
    match value {
        "SU" => Some(0),
        "MO" => Some(1),
        "TU" => Some(2),
        "WE" => Some(3),
        "TH" => Some(4),
        "FR" => Some(5),
        "SA" => Some(6),
        _ => None,
    }
}

fn parse_compact_date(value: &str) -> Option<NaiveDate> {
    if value.len() < 8 {
        return None;
    }
    let year = value[0..4].parse::<i32>().ok()?;
    let month = value[4..6].parse::<u32>().ok()?;
    let day = value[6..8].parse::<u32>().ok()?;
    NaiveDate::from_ymd_opt(year, month, day)
}

fn parse_date(value: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d").ok()
}

fn today_string() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn now_iso() -> String {
    Local::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn task(scheduled: Option<&str>, due: Option<&str>) -> TaskFrontmatter {
        TaskFrontmatter {
            tags: vec!["task".to_string()],
            scheduled: scheduled.map(str::to_string),
            due: due.map(str::to_string),
            ..Default::default()
        }
    }

    #[test]
    fn parses_frontmatter_with_defaults() {
        let parsed = parse_markdown(
            "---\nstatus: open\ntags:\n  - task\nscheduled: 2026-04-30\n---\nBody\n",
        )
        .expect("frontmatter parses");
        assert_eq!(parsed.frontmatter.status, TaskStatus::Open);
        assert_eq!(parsed.frontmatter.priority, TaskPriority::None);
        assert_eq!(parsed.frontmatter.scheduled.as_deref(), Some("2026-04-30"));
        assert_eq!(parsed.body, "Body");
    }

    #[test]
    fn groups_now_past_upcoming_and_wrapped() {
        assert_eq!(
            categorize(&task(Some("2026-04-30"), None), "2026-04-30"),
            DateGroup::Now
        );
        assert_eq!(
            categorize(&task(Some("2026-04-29"), None), "2026-04-30"),
            DateGroup::Past
        );
        assert_eq!(
            categorize(&task(Some("2026-05-01"), None), "2026-04-30"),
            DateGroup::Upcoming
        );
        assert_eq!(
            categorize(&task(None, None), "2026-04-30"),
            DateGroup::Wrapped
        );
    }

    #[test]
    fn generates_safe_filename() {
        assert_eq!(generate_task_filename("A / B: C.md"), "A B C.md");
        assert_eq!(generate_task_filename("   "), "Untitled.md");
    }

    #[test]
    fn conflict_archive_path_uses_data_root_conflicts_dir() {
        let path = PathBuf::from("/tmp/TaskNotes/Tasks/Example.md");
        let archive = conflict_archive_path(&path);
        assert!(archive.starts_with("/tmp/TaskNotes/conflicts"));
        assert!(archive.to_string_lossy().contains("Example.conflict-"));
    }
}
