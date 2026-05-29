mod native_theme;
mod task_store;

use eframe::egui::{self, CentralPanel, Id, RichText, SidePanel, TopBottomPanel, vec2};
use egui_shadcn::{
    ButtonSize, ButtonVariant, ControlSize, ControlVariant, InputConfig, TabItem, TabsProps,
    TabsVariant, Theme, button, input_with_config, tabs,
};
use native_theme::{
    GtkThemeSnapshot, apply_egui_visuals, load_gtk_theme_snapshot, palette_from_snapshot,
    spawn_theme_watcher,
};
use std::sync::mpsc::Receiver;
use task_store::{TaskLoadResult, ViewTask, default_tasks_dir, load_tasks_for_today};

fn main() -> eframe::Result {
    if std::env::args().any(|arg| arg == "--print-counts") {
        let load = load_tasks_for_today(&default_tasks_dir());
        println!("tasks_dir={}", load.tasks_dir.to_string_lossy());
        println!("today={}", load.today);
        println!("now={}", load.grouped.now.len());
        println!("past={}", load.grouped.past.len());
        println!("upcoming={}", load.grouped.upcoming.len());
        println!("wrapped={}", load.grouped.wrapped.len());
        println!("errors={}", load.errors.len());
        println!("files_loaded={}", load.debug.files_loaded);
        println!("recurring_files={}", load.debug.recurring_files);
        println!(
            "recurring_instances_expanded={}",
            load.debug.recurring_instances_expanded
        );
        println!(
            "recurring_past_instances={}",
            load.debug.recurring_past_instances
        );
        println!(
            "recurring_now_instances={}",
            load.debug.recurring_now_instances
        );
        println!("nonrecurring_past={}", load.debug.nonrecurring_past);
        if std::env::args().any(|arg| arg == "--list-past") {
            for task in &load.grouped.past {
                let reason = if task.task.frontmatter.recurrence.is_some() {
                    format!(
                        "recurring instance={} effective={}",
                        task.instance_date.as_deref().unwrap_or("-"),
                        task.effective_date.as_deref().unwrap_or("-")
                    )
                } else {
                    format!(
                        "scheduled={} due={} complete_instances={}",
                        task.task.frontmatter.scheduled.as_deref().unwrap_or("-"),
                        task.task.frontmatter.due.as_deref().unwrap_or("-"),
                        task.task.frontmatter.complete_instances.join(",")
                    )
                };
                println!("PAST\t{}\t{}", task.title(), reason);
            }
        }
        if std::env::args().any(|arg| arg == "--list-upcoming") {
            for task in &load.grouped.upcoming {
                let reason = if task.task.frontmatter.recurrence.is_some() {
                    format!(
                        "recurring instance={} effective={}",
                        task.instance_date.as_deref().unwrap_or("-"),
                        task.effective_date.as_deref().unwrap_or("-")
                    )
                } else {
                    format!(
                        "scheduled={} due={}",
                        task.task.frontmatter.scheduled.as_deref().unwrap_or("-"),
                        task.task.frontmatter.due.as_deref().unwrap_or("-")
                    )
                };
                println!("UPCOMING\t{}\t{}", task.title(), reason);
            }
        }
        return Ok(());
    }

    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("DayLight Desktop")
            .with_inner_size(vec2(1120.0, 760.0))
            .with_min_inner_size(vec2(900.0, 620.0)),
        ..Default::default()
    };

    eframe::run_native(
        "DayLight Desktop",
        options,
        Box::new(|cc| {
            let app = DayLightDesktop::new(&cc.egui_ctx);
            Ok(Box::new(app))
        }),
    )
}

struct DayLightDesktop {
    shadcn_theme: Theme,
    theme_snapshot: GtkThemeSnapshot,
    theme_rx: Receiver<GtkThemeSnapshot>,
    active_tab: String,
    quick_entry: String,
    show_add_dialog: bool,
    task_load: TaskLoadResult,
}

impl DayLightDesktop {
    fn new(ctx: &egui::Context) -> Self {
        let theme_snapshot = load_gtk_theme_snapshot();
        let palette = palette_from_snapshot(&theme_snapshot);
        apply_egui_visuals(ctx, &palette, theme_snapshot.prefer_dark);

        Self {
            shadcn_theme: Theme::new(palette),
            theme_snapshot,
            theme_rx: spawn_theme_watcher(),
            active_tab: "today".to_string(),
            quick_entry: String::new(),
            show_add_dialog: false,
            task_load: load_tasks_for_today(&default_tasks_dir()),
        }
    }

    fn refresh_theme(&mut self, ctx: &egui::Context) {
        let mut changed = false;
        while let Ok(snapshot) = self.theme_rx.try_recv() {
            self.theme_snapshot = snapshot;
            changed = true;
        }
        if changed {
            let palette = palette_from_snapshot(&self.theme_snapshot);
            apply_egui_visuals(ctx, &palette, self.theme_snapshot.prefer_dark);
            self.shadcn_theme = Theme::new(palette);
            ctx.request_repaint();
        }
    }
}

impl eframe::App for DayLightDesktop {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.refresh_theme(ctx);

        TopBottomPanel::top("top_bar").show(ctx, |ui| {
            ui.add_space(8.0);
            ui.horizontal(|ui| {
                ui.heading(RichText::new("DayLight").strong());
                ui.separator();
                ui.label("Rust + EGui migration prototype");
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if button(
                        ui,
                        &self.shadcn_theme,
                        "Quick add",
                        ControlVariant::Primary,
                        ControlSize::Md,
                        true,
                    )
                    .clicked()
                    {
                        self.show_add_dialog = true;
                    }
                    if button(
                        ui,
                        &self.shadcn_theme,
                        "Reload",
                        ControlVariant::Secondary,
                        ControlSize::Md,
                        true,
                    )
                    .clicked()
                    {
                        self.task_load = load_tasks_for_today(&self.task_load.tasks_dir);
                    }
                });
            });
            ui.add_space(8.0);
        });

        SidePanel::left("navigation")
            .resizable(false)
            .exact_width(220.0)
            .show(ctx, |ui| {
                ui.add_space(12.0);
                ui.label(RichText::new("Views").strong());
                ui.add_space(8.0);
                nav_button(ui, &self.shadcn_theme, "Today", true);
                nav_button(ui, &self.shadcn_theme, "Habits (V2)", false);
                nav_button(ui, &self.shadcn_theme, "Calendar (V2)", false);
                ui.add_space(24.0);
                ui.label(RichText::new("Scope").strong());
                ui.label("V1: daily tasks, add/edit, time tracking, quick popup daemon.");
                ui.label("Excluded: planner drag/drop and markdown editor.");
                ui.add_space(24.0);
                ui.label(RichText::new("Task source").strong());
                ui.monospace(self.task_load.tasks_dir.to_string_lossy());
                ui.label(format!("Loaded: {}", self.task_load.grouped.total_len()));
                if !self.task_load.errors.is_empty() {
                    ui.colored_label(
                        self.shadcn_theme.palette.destructive,
                        format!("Errors: {}", self.task_load.errors.len()),
                    );
                }
            });

        CentralPanel::default().show(ctx, |ui| {
            ui.add_space(16.0);
            let tab_items = [
                TabItem::new("today", "Today"),
                TabItem::new("time", "Time"),
                TabItem::new("theme", "Theme"),
            ];
            let props = TabsProps::new(Id::new("main-tabs"), &tab_items, &mut self.active_tab)
                .variant(TabsVariant::Underline)
                .full_width(false);

            tabs(ui, &self.shadcn_theme, props, |ui, active| {
                match active.id.as_str() {
                    "time" => render_time_placeholder(ui, &self.shadcn_theme),
                    "theme" => render_theme_panel(ui, &self.theme_snapshot, &self.shadcn_theme),
                    _ => render_today_view(
                        ui,
                        &self.shadcn_theme,
                        &mut self.quick_entry,
                        &self.task_load,
                    ),
                }
            });
        });

        if self.show_add_dialog {
            egui::Window::new("Add task")
                .collapsible(false)
                .resizable(false)
                .default_width(420.0)
                .show(ctx, |ui| {
                    ui.label("Task title");
                    input_with_config(
                        ui,
                        &self.shadcn_theme,
                        &mut self.quick_entry,
                        "dialog-task-title",
                        InputConfig::default(),
                    );
                    ui.add_space(12.0);
                    ui.horizontal(|ui| {
                        if button(
                            ui,
                            &self.shadcn_theme,
                            "Create",
                            ControlVariant::Primary,
                            ControlSize::Md,
                            true,
                        )
                        .clicked()
                        {
                            self.show_add_dialog = false;
                        }
                        if button(
                            ui,
                            &self.shadcn_theme,
                            "Cancel",
                            ControlVariant::Secondary,
                            ControlSize::Md,
                            true,
                        )
                        .clicked()
                        {
                            self.show_add_dialog = false;
                        }
                    });
                });
        }
    }
}

fn nav_button(ui: &mut egui::Ui, theme: &Theme, label: &str, active: bool) {
    let variant = if active {
        ButtonVariant::Secondary
    } else {
        ButtonVariant::Ghost
    };
    egui_shadcn::Button::new(label)
        .variant(variant)
        .size(ButtonSize::Default)
        .show(ui, theme);
}

fn render_today_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    quick_entry: &mut String,
    task_load: &TaskLoadResult,
) {
    ui.heading("Today");
    ui.label(format!(
        "{} tasks loaded from markdown for {}",
        task_load.grouped.total_len(),
        task_load.today
    ));
    ui.add_space(16.0);
    ui.horizontal(|ui| {
        input_with_config(
            ui,
            theme,
            quick_entry,
            "quick-entry",
            InputConfig::default(),
        );
        button(
            ui,
            theme,
            "Add",
            ControlVariant::Primary,
            ControlSize::Md,
            true,
        );
    });
    ui.add_space(24.0);

    if !task_load.errors.is_empty() {
        ui.group(|ui| {
            ui.colored_label(theme.palette.destructive, "Load errors");
            for error in &task_load.errors {
                ui.monospace(format!("{}: {}", error.filename, error.message));
            }
        });
        ui.add_space(16.0);
    }

    ui.columns(4, |columns| {
        render_task_group(
            &mut columns[0],
            theme,
            "Past",
            &task_load.grouped.past,
            &task_load.today,
        );
        render_task_group(
            &mut columns[1],
            theme,
            "Now",
            &task_load.grouped.now,
            &task_load.today,
        );
        render_task_group(
            &mut columns[2],
            theme,
            "Upcoming",
            &task_load.grouped.upcoming,
            &task_load.today,
        );
        render_task_group(
            &mut columns[3],
            theme,
            "Wrapped",
            &task_load.grouped.wrapped,
            &task_load.today,
        );
    });
}

fn render_task_group(
    ui: &mut egui::Ui,
    theme: &Theme,
    label: &str,
    tasks: &[ViewTask],
    today: &str,
) {
    ui.group(|ui| {
        ui.label(RichText::new(format!("{label} ({})", tasks.len())).strong());
        ui.separator();
        if tasks.is_empty() {
            ui.label("No tasks.");
            return;
        }
        for task in tasks.iter().take(12) {
            ui.group(|ui| {
                ui.label(RichText::new(task.title()).strong());
                let mut meta = Vec::new();
                if let Some(instance_date) = &task.instance_date {
                    meta.push(format!("instance {instance_date}"));
                }
                if let Some(effective_date) = &task.effective_date {
                    meta.push(format!("effective {effective_date}"));
                } else if let Some(scheduled) = &task.task.frontmatter.scheduled {
                    meta.push(format!("scheduled {scheduled}"));
                }
                if let Some(due) = &task.task.frontmatter.due {
                    meta.push(format!("due {due}"));
                }
                let minutes = task.daily_minutes(today);
                if minutes > 0 {
                    meta.push(format!("{minutes}m today"));
                }
                if !meta.is_empty() {
                    ui.small(meta.join(" | "));
                }
                if !task.task.frontmatter.projects.is_empty() {
                    ui.colored_label(
                        theme.palette.muted_foreground,
                        task.task.frontmatter.projects.join(", "),
                    );
                }
                if let Some(first_line) =
                    task.task.body.lines().find(|line| !line.trim().is_empty())
                {
                    ui.small(first_line.chars().take(96).collect::<String>());
                }
            });
        }
        if tasks.len() > 12 {
            ui.label(format!(
                "{} more hidden in this scaffold.",
                tasks.len() - 12
            ));
        }
    });
}

fn render_time_placeholder(ui: &mut egui::Ui, theme: &Theme) {
    ui.heading("Time");
    ui.label("Time tracking commands and dialogs will be implemented after task persistence.");
    ui.add_space(12.0);
    button(
        ui,
        theme,
        "Start tracking",
        ControlVariant::Outline,
        ControlSize::Md,
        false,
    );
}

fn render_theme_panel(ui: &mut egui::Ui, snapshot: &GtkThemeSnapshot, theme: &Theme) {
    ui.heading("Theme");
    ui.label("GTK 4 colors are mapped into egui-shadcn tokens and polled for hot reload.");
    ui.add_space(12.0);
    ui.group(|ui| {
        ui.label(RichText::new("Source").strong());
        ui.monospace(snapshot.source_label());
        ui.label(format!("Prefer dark: {}", snapshot.prefer_dark));
        ui.label(format!("Resolved GTK colors: {}", snapshot.colors.len()));
        ui.label(format!("Loaded at: {:?}", snapshot.loaded_at));
    });
    ui.add_space(12.0);
    ui.label(RichText::new("State samples").strong());
    ui.horizontal_wrapped(|ui| {
        button(
            ui,
            theme,
            "Default",
            ControlVariant::Primary,
            ControlSize::Md,
            true,
        );
        button(
            ui,
            theme,
            "Secondary",
            ControlVariant::Secondary,
            ControlSize::Md,
            true,
        );
        button(
            ui,
            theme,
            "Outline",
            ControlVariant::Outline,
            ControlSize::Md,
            true,
        );
        button(
            ui,
            theme,
            "Destructive",
            ControlVariant::Destructive,
            ControlSize::Md,
            true,
        );
        button(
            ui,
            theme,
            "Disabled",
            ControlVariant::Primary,
            ControlSize::Md,
            false,
        );
    });
    ui.add_space(12.0);
    ui.label(RichText::new("Common GTK tokens").strong());
    egui::Grid::new("theme-token-grid")
        .num_columns(3)
        .striped(true)
        .show(ui, |ui| {
            for name in [
                "window_bg_color",
                "window_fg_color",
                "view_bg_color",
                "view_fg_color",
                "accent_color",
                "accent_fg_color",
                "borders",
                "error_color",
                "warning_color",
                "success_color",
            ] {
                ui.monospace(name);
                if let Some(color) = snapshot.colors.get(name) {
                    let (rect, _) =
                        ui.allocate_exact_size(egui::vec2(40.0, 18.0), egui::Sense::hover());
                    ui.painter().rect_filled(rect, 3.0, *color);
                    ui.monospace(format!(
                        "#{:02x}{:02x}{:02x}",
                        color.r(),
                        color.g(),
                        color.b()
                    ));
                } else {
                    ui.label("not provided");
                    ui.label("");
                }
                ui.end_row();
            }
        });
}
