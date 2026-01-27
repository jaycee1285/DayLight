use std::sync::Mutex;
use std::time::Duration;

use tauri::State;
use tokio::time::timeout;
use tokio::sync::oneshot;
use tiny_http::{ListenAddr, Response, Server};

struct OAuthListenerState {
    receiver: Mutex<Option<oneshot::Receiver<String>>>,
}

fn extract_code(url: &str) -> Option<String> {
    let query = url.split('?').nth(1)?;
    for (key, value) in url::form_urlencoded::parse(query.as_bytes()) {
        if key == "code" {
            return Some(value.into_owned());
        }
    }
    None
}

fn listen_addr_port(addr: ListenAddr) -> Result<u16, String> {
    match addr {
        ListenAddr::IP(address) => Ok(address.port()),
        _ => Err("Unsupported listener address".to_string()),
    }
}

#[tauri::command]
async fn start_oauth_listener(state: State<'_, OAuthListenerState>) -> Result<u16, String> {
    let mut guard = state.receiver.lock().map_err(|_| "Lock poisoned")?;
    if guard.is_some() {
        return Err("OAuth listener already running".to_string());
    }

    let server = Server::http("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listen_addr_port(server.server_addr())?;
    let (tx, rx): (oneshot::Sender<String>, oneshot::Receiver<String>) = oneshot::channel();
    *guard = Some(rx);

    std::thread::spawn(move || {
        for request in server.incoming_requests() {
            if let Some(code) = extract_code(request.url()) {
                let _ = request.respond(Response::from_string(
                    "Authorization complete. You may close this window."
                ));
                let _ = tx.send(code);
                break;
            }
            let _ = request.respond(Response::from_string(
                "Waiting for authorization. You may close this window."
            ));
        }
    });

    Ok(port)
}

#[tauri::command]
async fn await_oauth_code(
    state: State<'_, OAuthListenerState>,
    timeout_ms: u64,
) -> Result<String, String> {
    let rx = {
        let mut guard = state.receiver.lock().map_err(|_| "Lock poisoned")?;
        guard.take().ok_or_else(|| "OAuth listener not started".to_string())?
    };

    let duration = Duration::from_millis(timeout_ms);
    match timeout(duration, rx).await {
        Ok(Ok(code)) => Ok(code),
        Ok(Err(_)) => Err("OAuth listener closed".to_string()),
        Err(_) => Err("OAuth listener timed out".to_string()),
    }
}

#[tauri::command]
async fn fetch_url(url: String) -> Result<String, String> {
    let response = reqwest::get(url)
        .await
        .map_err(|e| e.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("HTTP {}", status.as_u16()));
    }
    response.text().await.map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(OAuthListenerState {
            receiver: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            start_oauth_listener,
            await_oauth_code,
            fetch_url
        ])
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
