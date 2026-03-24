use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub path: String,
    #[serde(rename = "type")]
    pub file_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileListOptions {
    pub pair_id: Option<String>,
    pub directory: Option<String>,
}

const EXCLUDED_DIRS: &[&str] = &[
    ".git", ".svn", ".hg", "node_modules", "dist", "build", "out",
    ".next", ".nuxt", ".svelte-kit", "__pycache__", ".venv", "venv",
    ".cache", ".parcel-cache", ".turbo", ".pair", ".opencode"
];

const EXCLUDED_FILES: &[&str] = &[
    ".DS_Store", "Thumbs.db", "package-lock.json", "yarn.lock",
    "pnpm-lock.yaml", "*.log"
];

pub fn should_exclude_dir(name: &str) -> bool {
    EXCLUDED_DIRS.contains(&name) || name.starts_with('.')
}

pub fn should_exclude_file(name: &str) -> bool {
    EXCLUDED_FILES.contains(&name) || name.ends_with(".log")
}

pub fn scan_directory(directory: &Path, base_dir: &Path) -> Result<Vec<FileEntry>, String> {
    let mut results = Vec::new();
    
    if !directory.exists() {
        return Ok(results);
    }

    let entries = fs::read_dir(directory)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let file_name = match entry.file_name().to_str() {
            Some(name) => name.to_string(),
            None => continue,
        };

        if should_exclude_file(&file_name) {
            continue;
        }

        let full_path = entry.path();
        let relative_path = match full_path.strip_prefix(base_dir) {
            Ok(p) => p.to_string_lossy().to_string(),
            Err(_) => continue,
        };

        if full_path.is_dir() {
            if should_exclude_dir(&file_name) {
                continue;
            }
            
            results.push(FileEntry {
                path: relative_path.clone(),
                file_type: "directory".to_string(),
            });

            let sub_files = scan_directory(&full_path, base_dir)?;
            results.extend(sub_files);
        } else if full_path.is_file() {
            results.push(FileEntry {
                path: relative_path,
                file_type: "file".to_string(),
            });
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn file_list_files(
    app: tauri::AppHandle,
    options: FileListOptions,
) -> Result<Vec<FileEntry>, String> {
    let directory = if let Some(pair_id) = options.pair_id {
        let pair_manager = app.state::<std::sync::Mutex<crate::pair_manager::PairManager>>();
        let manager = pair_manager.lock().map_err(|e| e.to_string())?;
        let pairs = manager.list_pairs();
        pairs.iter()
            .find(|p| p.pair_id == pair_id)
            .map(|p| p.directory.clone())
            .ok_or_else(|| format!("Pair {} not found", pair_id))?
    } else if let Some(dir) = options.directory {
        dir
    } else {
        return Err("Either pair_id or directory must be provided".to_string());
    };

    let dir_path = Path::new(&directory);
    if !dir_path.exists() {
        return Err(format!("Directory does not exist: {}", directory));
    }

    scan_directory(dir_path, dir_path)
}

#[tauri::command]
pub async fn file_parse_mentions(
    _app: tauri::AppHandle,
    _pair_id: String,
    spec: String,
) -> Result<String, String> {
    // For now, return the spec as-is
    // TODO: Implement mention parsing to inject file contents
    Ok(spec)
}
