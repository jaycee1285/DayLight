use eframe::egui::{self, Color32, Stroke};
use egui_shadcn::ColorPalette;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver};
use std::time::{Duration, SystemTime};

#[derive(Clone, Debug)]
pub struct GtkThemeSnapshot {
    pub colors: HashMap<String, Color32>,
    pub prefer_dark: bool,
    pub theme_path: Option<PathBuf>,
    pub gtk_css_path: Option<PathBuf>,
    pub loaded_at: SystemTime,
}

impl GtkThemeSnapshot {
    pub fn watched_paths(&self) -> Vec<PathBuf> {
        let mut paths = Vec::new();
        if let Some(path) = &self.gtk_css_path {
            paths.push(path.clone());
        }
        if let Some(path) = &self.theme_path {
            paths.push(path.clone());
        }
        if let Some(settings_path) = gtk_settings_path() {
            paths.push(settings_path);
        }
        paths
    }

    pub fn source_label(&self) -> String {
        self.theme_path
            .as_ref()
            .or(self.gtk_css_path.as_ref())
            .map(|path| path.to_string_lossy().into_owned())
            .unwrap_or_else(|| "fallback shadcn dark palette".to_string())
    }
}

pub fn load_gtk_theme_snapshot() -> GtkThemeSnapshot {
    let gtk_css_path = gtk_css_path();
    let theme_path = gtk_css_path
        .as_ref()
        .and_then(|path| resolve_theme_path(path));
    let prefer_dark = read_dark_preference();

    let mut raw_colors = HashMap::new();
    if let Some(path) = &gtk_css_path {
        if let Ok(css) = fs::read_to_string(path) {
            raw_colors.extend(parse_define_colors(&css));
        }
    }
    if let Some(path) = &theme_path {
        if let Ok(css) = fs::read_to_string(path) {
            raw_colors.extend(parse_define_colors(&css));
        }
    }

    let mut colors = HashMap::new();
    for name in raw_colors.keys() {
        if let Some(color) = resolve_color(name, &raw_colors, 0) {
            colors.insert(name.clone(), color);
        }
    }

    GtkThemeSnapshot {
        colors,
        prefer_dark,
        theme_path,
        gtk_css_path,
        loaded_at: SystemTime::now(),
    }
}

pub fn spawn_theme_watcher() -> Receiver<GtkThemeSnapshot> {
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut snapshot = load_gtk_theme_snapshot();
        let _ = tx.send(snapshot.clone());
        let mut mtimes = path_mtimes(&snapshot.watched_paths());

        loop {
            std::thread::sleep(Duration::from_millis(700));
            let watched_paths = snapshot.watched_paths();
            let next_mtimes = path_mtimes(&watched_paths);
            if next_mtimes != mtimes {
                snapshot = load_gtk_theme_snapshot();
                mtimes = path_mtimes(&snapshot.watched_paths());
                let _ = tx.send(snapshot.clone());
            }
        }
    });
    rx
}

pub fn palette_from_snapshot(snapshot: &GtkThemeSnapshot) -> ColorPalette {
    let mut palette = if snapshot.prefer_dark {
        ColorPalette::dark()
    } else {
        ColorPalette::light()
    };

    let background = pick(
        snapshot,
        &["window_bg_color", "theme_bg_color", "view_bg_color"],
    )
    .unwrap_or(palette.background);
    let foreground = pick(
        snapshot,
        &["window_fg_color", "theme_fg_color", "view_fg_color"],
    )
    .unwrap_or(palette.foreground);
    let card = pick(
        snapshot,
        &[
            "view_bg_color",
            "card_bg_color",
            "popover_bg_color",
            "window_bg_color",
        ],
    )
    .unwrap_or_else(|| adjust(background, if snapshot.prefer_dark { 1.12 } else { 0.97 }));
    let accent = pick(
        snapshot,
        &[
            "accent_color",
            "theme_selected_bg_color",
            "theme_accent_color",
            "link_color",
        ],
    )
    .unwrap_or(palette.primary);
    let accent_fg = pick(
        snapshot,
        &[
            "accent_fg_color",
            "theme_selected_fg_color",
            "theme_fg_color",
            "window_fg_color",
        ],
    )
    .unwrap_or_else(|| readable_on(accent));
    let border = pick(
        snapshot,
        &[
            "borders",
            "border_color",
            "unfocused_borders",
            "theme_unfocused_bg_color",
        ],
    )
    .unwrap_or_else(|| blend(background, foreground, 0.18));
    let muted = pick(
        snapshot,
        &["insensitive_bg_color", "theme_unfocused_bg_color"],
    )
    .unwrap_or_else(|| blend(background, foreground, 0.09));
    let muted_foreground = pick(
        snapshot,
        &["insensitive_fg_color", "theme_unfocused_fg_color"],
    )
    .unwrap_or_else(|| blend(background, foreground, 0.62));
    let destructive =
        pick(snapshot, &["error_color", "destructive_color"]).unwrap_or(palette.destructive);
    let destructive_fg =
        pick(snapshot, &["error_fg_color"]).unwrap_or_else(|| readable_on(destructive));

    palette.background = background;
    palette.foreground = foreground;
    palette.card = card;
    palette.card_foreground = foreground;
    palette.popover = card;
    palette.popover_foreground = foreground;
    palette.border = border;
    palette.input = border;
    palette.ring = accent;
    palette.primary = accent;
    palette.primary_foreground = accent_fg;
    palette.secondary = muted;
    palette.secondary_foreground = foreground;
    palette.accent = blend(background, accent, 0.28);
    palette.accent_foreground = foreground;
    palette.muted = muted;
    palette.muted_foreground = muted_foreground;
    palette.destructive = destructive;
    palette.destructive_foreground = destructive_fg;
    palette.sidebar = adjust(background, if snapshot.prefer_dark { 0.88 } else { 1.03 });
    palette.sidebar_foreground = foreground;
    palette.sidebar_primary = accent;
    palette.sidebar_primary_foreground = accent_fg;
    palette.sidebar_accent = blend(background, accent, 0.18);
    palette.sidebar_accent_foreground = foreground;
    palette.sidebar_border = border;
    palette.sidebar_ring = accent;

    palette
}

pub fn apply_egui_visuals(ctx: &egui::Context, palette: &ColorPalette, prefer_dark: bool) {
    let mut visuals = if prefer_dark {
        egui::Visuals::dark()
    } else {
        egui::Visuals::light()
    };

    visuals.override_text_color = Some(palette.foreground);
    visuals.panel_fill = palette.background;
    visuals.window_fill = palette.popover;
    visuals.faint_bg_color = palette.muted;
    visuals.extreme_bg_color = palette.background;
    visuals.selection.bg_fill = palette.primary;
    visuals.selection.stroke = Stroke::new(1.0, palette.primary_foreground);
    visuals.hyperlink_color = palette.primary;
    visuals.error_fg_color = palette.destructive;
    visuals.warn_fg_color = pick_color_or(palette.chart_4, palette.primary);

    visuals.widgets.noninteractive.bg_fill = palette.background;
    visuals.widgets.noninteractive.fg_stroke.color = palette.foreground;
    visuals.widgets.noninteractive.bg_stroke.color = palette.border;
    visuals.widgets.inactive.bg_fill = palette.card;
    visuals.widgets.inactive.fg_stroke.color = palette.foreground;
    visuals.widgets.inactive.bg_stroke.color = palette.border;
    visuals.widgets.hovered.bg_fill = palette.accent;
    visuals.widgets.hovered.fg_stroke.color = palette.accent_foreground;
    visuals.widgets.hovered.bg_stroke.color = palette.primary;
    visuals.widgets.active.bg_fill = palette.primary;
    visuals.widgets.active.fg_stroke.color = palette.primary_foreground;
    visuals.widgets.active.bg_stroke.color = palette.primary;
    visuals.widgets.open.bg_fill = palette.popover;
    visuals.widgets.open.fg_stroke.color = palette.popover_foreground;
    visuals.widgets.open.bg_stroke.color = palette.border;

    ctx.set_visuals(visuals);
}

fn gtk_css_path() -> Option<PathBuf> {
    config_dir().map(|dir| dir.join("gtk-4.0").join("gtk.css"))
}

fn gtk_settings_path() -> Option<PathBuf> {
    config_dir().map(|dir| dir.join("gtk-4.0").join("settings.ini"))
}

fn config_dir() -> Option<PathBuf> {
    std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))
}

fn resolve_theme_path(gtk_css: &Path) -> Option<PathBuf> {
    let content = fs::read_to_string(gtk_css).ok()?;
    for line in content.lines() {
        let trimmed = line.trim();
        let Some(rest) = trimmed.strip_prefix("@import") else {
            continue;
        };
        let Some(url_start) = rest.find("url(") else {
            continue;
        };
        let after_url = &rest[url_start + 4..];
        let path_str: String = after_url
            .chars()
            .skip_while(|c| *c == '"' || *c == '\'')
            .take_while(|c| *c != '"' && *c != '\'' && *c != ')')
            .collect();
        if path_str.is_empty() {
            continue;
        }
        let imported = expand_path(&path_str);
        let resolved = if imported.is_absolute() {
            imported
        } else {
            gtk_css.parent().unwrap_or(gtk_css).join(imported)
        };
        if resolved.exists() {
            return Some(resolved);
        }
    }

    if content.contains("@define-color") {
        Some(gtk_css.to_path_buf())
    } else {
        None
    }
}

fn expand_path(path: &str) -> PathBuf {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home).join(rest);
        }
    }
    PathBuf::from(path)
}

fn parse_define_colors(css: &str) -> HashMap<String, String> {
    let mut colors = HashMap::new();
    for line in css.lines() {
        let trimmed = line.trim();
        let Some(rest) = trimmed.strip_prefix("@define-color ") else {
            continue;
        };
        if let Some(space_idx) = rest.find(' ') {
            let name = rest[..space_idx].trim().to_string();
            let value = rest[space_idx + 1..]
                .trim_end_matches(';')
                .trim()
                .to_string();
            colors.insert(name, value);
        }
    }
    colors
}

fn read_dark_preference() -> bool {
    let Some(settings_path) = gtk_settings_path() else {
        return true;
    };
    let Ok(content) = fs::read_to_string(settings_path) else {
        return true;
    };
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("gtk-application-prefer-dark-theme") {
            if let Some(eq_idx) = rest.find('=') {
                let value = rest[eq_idx + 1..].trim().to_lowercase();
                return value == "true" || value == "1";
            }
        }
    }
    true
}

fn resolve_color(
    name: &str,
    raw_colors: &HashMap<String, String>,
    depth: usize,
) -> Option<Color32> {
    if depth > 8 {
        return None;
    }
    let value = raw_colors.get(name)?.trim();
    parse_color_value(value, raw_colors, depth + 1)
}

fn parse_color_value(
    value: &str,
    raw_colors: &HashMap<String, String>,
    depth: usize,
) -> Option<Color32> {
    let value = value.trim().trim_end_matches(';').trim();
    if let Some(hex) = value.strip_prefix('#') {
        return parse_hex(hex);
    }
    if let Some(name) = value.strip_prefix('@') {
        return resolve_color(name, raw_colors, depth + 1);
    }
    if let Some(inner) = function_arg(value, "alpha") {
        return parse_first_color_arg(inner, raw_colors, depth);
    }
    if let Some(inner) = function_arg(value, "shade") {
        let (color_expr, factor) = split_color_number(inner)?;
        let color = parse_color_value(color_expr, raw_colors, depth)?;
        return Some(adjust(color, factor));
    }
    if value.starts_with("rgb(") || value.starts_with("rgba(") {
        return parse_rgb_function(value);
    }
    resolve_color(value, raw_colors, depth + 1)
}

fn parse_hex(hex: &str) -> Option<Color32> {
    match hex.len() {
        3 => {
            let r = u8::from_str_radix(&hex[0..1].repeat(2), 16).ok()?;
            let g = u8::from_str_radix(&hex[1..2].repeat(2), 16).ok()?;
            let b = u8::from_str_radix(&hex[2..3].repeat(2), 16).ok()?;
            Some(Color32::from_rgb(r, g, b))
        }
        6 => {
            let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
            let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
            let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
            Some(Color32::from_rgb(r, g, b))
        }
        _ => None,
    }
}

fn parse_rgb_function(value: &str) -> Option<Color32> {
    let start = value.find('(')? + 1;
    let end = value.rfind(')')?;
    let channels: Vec<&str> = value[start..end]
        .split([',', ' '])
        .map(str::trim)
        .filter(|part| !part.is_empty() && *part != "/")
        .collect();
    if channels.len() < 3 {
        return None;
    }
    let r = parse_channel(channels[0])?;
    let g = parse_channel(channels[1])?;
    let b = parse_channel(channels[2])?;
    Some(Color32::from_rgb(r, g, b))
}

fn parse_channel(value: &str) -> Option<u8> {
    let value = value.trim_end_matches('%');
    let parsed = value.parse::<f32>().ok()?;
    let scaled = if parsed <= 1.0 {
        parsed * 255.0
    } else {
        parsed
    };
    Some(scaled.round().clamp(0.0, 255.0) as u8)
}

fn function_arg<'a>(value: &'a str, name: &str) -> Option<&'a str> {
    let prefix = format!("{name}(");
    if !value.starts_with(&prefix) {
        return None;
    }
    let start = prefix.len();
    let end = value.rfind(')')?;
    Some(&value[start..end])
}

fn parse_first_color_arg(
    value: &str,
    raw_colors: &HashMap<String, String>,
    depth: usize,
) -> Option<Color32> {
    let color_expr = value.split(',').next()?.trim();
    parse_color_value(color_expr, raw_colors, depth + 1)
}

fn split_color_number(value: &str) -> Option<(&str, f32)> {
    let mut parts = value.split(',').map(str::trim);
    let color = parts.next()?;
    let factor = parts.next()?.parse::<f32>().ok()?;
    Some((color, factor))
}

fn pick(snapshot: &GtkThemeSnapshot, names: &[&str]) -> Option<Color32> {
    names
        .iter()
        .find_map(|name| snapshot.colors.get(*name).copied())
}

fn blend(a: Color32, b: Color32, t: f32) -> Color32 {
    let t = t.clamp(0.0, 1.0);
    let lerp = |x: u8, y: u8| x as f32 + (y as f32 - x as f32) * t;
    Color32::from_rgb(
        lerp(a.r(), b.r()).round() as u8,
        lerp(a.g(), b.g()).round() as u8,
        lerp(a.b(), b.b()).round() as u8,
    )
}

fn adjust(color: Color32, factor: f32) -> Color32 {
    let scale = |channel: u8| (channel as f32 * factor).round().clamp(0.0, 255.0) as u8;
    Color32::from_rgb(scale(color.r()), scale(color.g()), scale(color.b()))
}

fn readable_on(color: Color32) -> Color32 {
    let luminance =
        0.2126 * color.r() as f32 + 0.7152 * color.g() as f32 + 0.0722 * color.b() as f32;
    if luminance > 150.0 {
        Color32::from_rgb(16, 15, 15)
    } else {
        Color32::from_rgb(255, 252, 240)
    }
}

fn pick_color_or(color: Color32, fallback: Color32) -> Color32 {
    if color == Color32::TRANSPARENT {
        fallback
    } else {
        color
    }
}

fn path_mtimes(paths: &[PathBuf]) -> Vec<(PathBuf, Option<SystemTime>)> {
    paths
        .iter()
        .map(|path| {
            let modified = fs::metadata(path).and_then(|meta| meta.modified()).ok();
            (path.clone(), modified)
        })
        .collect()
}
