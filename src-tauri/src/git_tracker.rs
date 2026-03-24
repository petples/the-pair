use crate::types::{FileStatus, ModifiedFile, PairState};
use std::process::Command;

pub struct GitTracker;

impl GitTracker {
    pub fn update_state(state: &mut PairState) {
        let output = Command::new("git")
            .arg("status")
            .arg("--porcelain")
            .current_dir(&state.directory)
            .output();

        if let Ok(output) = output {
            if output.status.success() {
                state.git_tracking.available = true;
                let stdout = String::from_utf8_lossy(&output.stdout);
                println!("[GitTracker] Git status output: {}", stdout);
                let mut files = Vec::new();
                for line in stdout.lines() {
                    if line.len() > 3 {
                        let status_str = &line[0..2];
                        let path = &line[3..];
                        
                        let status = if status_str.starts_with('?') {
                            FileStatus::Untracked
                        } else if status_str.contains('M') {
                            FileStatus::M
                        } else if status_str.contains('A') {
                            FileStatus::A
                        } else if status_str.contains('D') {
                            FileStatus::D
                        } else if status_str.contains('R') {
                            FileStatus::R
                        } else {
                            FileStatus::Untracked
                        };

                        files.push(ModifiedFile {
                            path: path.to_string(),
                            status,
                            display_path: path.to_string(),
                        });
                    }
                }
                state.modified_files = files;
                println!("[GitTracker] Found {} modified files", state.modified_files.len());
            } else {
                println!("[GitTracker] Git command failed: {}", String::from_utf8_lossy(&output.stderr));
                state.git_tracking.available = false;
            }
        } else {
            println!("[GitTracker] Failed to execute git command");
            state.git_tracking.available = false;
        }
    }
}
