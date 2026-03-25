use std::process::Command;

#[cfg(any(target_os = "macos", target_os = "linux"))]
pub fn refresh_path_from_login_shell() {
    if let Some(path) = capture_login_shell_path() {
        std::env::set_var("PATH", path);
    }
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn refresh_path_from_login_shell() {}

#[cfg(any(target_os = "macos", target_os = "linux"))]
pub fn capture_login_shell_path() -> Option<String> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| {
        if cfg!(target_os = "macos") {
            "/bin/zsh".to_string()
        } else {
            "/bin/bash".to_string()
        }
    });

    let output = Command::new(shell)
        .arg("-lc")
        .arg("printf '%s' \"$PATH\"")
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let path = String::from_utf8(output.stdout).ok()?;
    let trimmed = path.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn capture_login_shell_path() -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capture_login_shell_path_returns_a_value_on_unix_desktops() {
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            let path = capture_login_shell_path().expect("expected login shell PATH");
            assert!(!path.trim().is_empty());
            assert!(path.contains('/'));
        }
    }
}
