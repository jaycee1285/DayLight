use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
pub struct GtkThemeColors {
    pub colors: HashMap<String, String>,
    pub prefer_dark: bool,
    pub theme_path: Option<String>,
}

/// Resolve the GTK4 theme CSS file by reading ~/.config/gtk-4.0/gtk.css
/// and following any @import url("...") directive.
fn resolve_gtk_theme_path() -> Option<PathBuf> {
    let config_dir = dirs::config_dir()?;
    let gtk_css = config_dir.join("gtk-4.0").join("gtk.css");
    let content = fs::read_to_string(&gtk_css).ok()?;

    // Look for @import url("...") with an absolute path
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("@import") {
            // Extract path from url("...") or url('...')
            if let Some(url_start) = rest.find("url(") {
                let after_url = &rest[url_start + 4..];
                let path_str: String = after_url
                    .chars()
                    .skip_while(|c| *c == '"' || *c == '\'')
                    .take_while(|c| *c != '"' && *c != '\'' && *c != ')')
                    .collect();
                let path = if path_str.starts_with("~/") {
                    if let Some(home) = dirs::home_dir() {
                        home.join(path_str.trim_start_matches("~/"))
                    } else {
                        PathBuf::from(&path_str)
                    }
                } else {
                    PathBuf::from(&path_str)
                };
                let resolved = if path.is_absolute() {
                    path
                } else {
                    gtk_css.parent().unwrap_or(&gtk_css).join(path)
                };
                if resolved.exists() {
                    return Some(resolved);
                }
            }
        }
    }

    // No @import found; if gtk.css itself has @define-color lines, use it directly
    if content.contains("@define-color") {
        return Some(gtk_css);
    }

    None
}

/// Parse all @define-color declarations from a CSS string.
fn parse_define_colors(css: &str) -> HashMap<String, String> {
    let mut colors = HashMap::new();
    for line in css.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("@define-color ") {
            // Format: name value;
            if let Some(space_idx) = rest.find(' ') {
                let name = rest[..space_idx].to_string();
                let value = rest[space_idx + 1..].trim_end_matches(';').trim().to_string();
                colors.insert(name, value);
            }
        }
    }
    colors
}

/// Read gtk-application-prefer-dark-theme from settings.ini.
fn read_dark_preference() -> bool {
    let config_dir = match dirs::config_dir() {
        Some(d) => d,
        None => return false,
    };
    let settings_path = config_dir.join("gtk-4.0").join("settings.ini");
    let content = match fs::read_to_string(&settings_path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("gtk-application-prefer-dark-theme") {
            if let Some(eq_idx) = rest.find('=') {
                let val = rest[eq_idx + 1..].trim().to_lowercase();
                return val == "true" || val == "1";
            }
        }
    }
    false
}

#[tauri::command]
pub fn get_gtk_colors() -> Result<GtkThemeColors, String> {
    let theme_path = resolve_gtk_theme_path();

    let colors = match &theme_path {
        Some(path) => {
            let css =
                fs::read_to_string(path).map_err(|e| format!("Failed to read theme CSS: {e}"))?;
            parse_define_colors(&css)
        }
        None => HashMap::new(),
    };

    Ok(GtkThemeColors {
        colors,
        prefer_dark: read_dark_preference(),
        theme_path: theme_path.map(|p| p.to_string_lossy().into_owned()),
    })
}

/// Start a file watcher on ~/.config/gtk-4.0/ (and the imported theme dir)
/// that emits a "gtk-theme-changed" Tauri event on changes.
pub fn setup_gtk_watcher(app: &AppHandle) {
    let handle = app.clone();

    std::thread::spawn(move || {
        let config_dir = match dirs::config_dir() {
            Some(d) => d,
            None => return,
        };

        let gtk_dir = config_dir.join("gtk-4.0");
        if !gtk_dir.exists() {
            return;
        }

        // Also watch the imported theme's directory
        let theme_dir = resolve_gtk_theme_path().and_then(|p| p.parent().map(|d| d.to_path_buf()));

        let (tx, rx) = std::sync::mpsc::channel();

        let mut watcher = match RecommendedWatcher::new(
            move |res: Result<notify::Event, notify::Error>| {
                if res.is_ok() {
                    let _ = tx.send(());
                }
            },
            Config::default(),
        ) {
            Ok(w) => w,
            Err(_) => return,
        };

        let _ = watcher.watch(&gtk_dir, RecursiveMode::NonRecursive);

        if let Some(ref dir) = theme_dir {
            if *dir != gtk_dir {
                let _ = watcher.watch(dir, RecursiveMode::NonRecursive);
            }
        }

        let debounce = Duration::from_millis(200);
        loop {
            // Block until a change is detected
            if rx.recv().is_err() {
                break;
            }
            // Drain additional events within the debounce window
            let deadline = Instant::now() + debounce;
            while Instant::now() < deadline {
                let remaining = deadline - Instant::now();
                if rx.recv_timeout(remaining).is_err() {
                    break;
                }
            }
            let _ = handle.emit("gtk-theme-changed", ());
        }
    });
}
