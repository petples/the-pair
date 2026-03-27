use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Instant;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;
use tokio::process::Command;

use crate::message_broker::MessageBroker;
use crate::types::PairStatus;

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use uuid::Uuid;

    fn temp_workspace() -> PathBuf {
        let root =
            std::env::temp_dir().join(format!("the-pair-verification-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn build_verification_plan_prefers_package_scripts_in_standard_order() {
        let root = temp_workspace();
        fs::write(
            root.join("package.json"),
            r#"{
  "name": "demo",
  "scripts": {
    "test": "vitest",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "build": "vite build"
  }
}"#,
        )
        .unwrap();

        let plan = build_verification_plan(&root, &[]).expect("plan should build");
        let names: Vec<_> = plan
            .checks
            .iter()
            .map(|check| check.name.as_str())
            .collect();

        assert_eq!(plan.risk_level, VerificationRiskLevel::Low);
        assert_eq!(names, vec!["test", "lint", "typecheck", "build"]);
        assert_eq!(plan.checks[0].command, "npm run test");
        assert_eq!(plan.checks[1].command, "npm run lint");
        assert_eq!(plan.checks[2].command, "npm run typecheck");
        assert_eq!(plan.checks[3].command, "npm run build");

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn classify_change_risk_marks_deletions_and_migrations_as_high() {
        let modified_files = vec![
            crate::types::ModifiedFile {
                path: "src/db/migrations/2026-03-01-add-users.sql".to_string(),
                status: crate::types::FileStatus::M,
                display_path: "src/db/migrations/2026-03-01-add-users.sql".to_string(),
            },
            crate::types::ModifiedFile {
                path: "src/features/old-flow.ts".to_string(),
                status: crate::types::FileStatus::D,
                display_path: "src/features/old-flow.ts".to_string(),
            },
        ];

        assert_eq!(
            classify_change_risk(&modified_files),
            VerificationRiskLevel::High
        );
    }

    #[test]
    fn parse_verification_verdict_accepts_strict_json() {
        let verdict = parse_verification_verdict(
            r#"{"status":"pass","riskLevel":"medium","evidence":["npm run test passed"],"nextAction":"continue","summary":"Checks passed"}"#,
        )
        .expect("verdict should parse");

        assert_eq!(verdict.status, VerificationVerdictStatus::Pass);
        assert_eq!(verdict.risk_level, VerificationRiskLevel::Medium);
        assert_eq!(verdict.evidence, vec!["npm run test passed".to_string()]);
        assert_eq!(verdict.next_action, VerificationNextAction::Continue);
        assert_eq!(verdict.summary, "Checks passed");
    }

    #[test]
    fn parse_verification_verdict_accepts_json_embedded_in_prose() {
        let verdict = parse_verification_verdict(
            "Here is the final verdict:\n{\n  \"status\": \"pass\",\n  \"riskLevel\": \"low\",\n  \"evidence\": [\"npm run test passed\"],\n  \"nextAction\": \"finish\",\n  \"summary\": \"Checks passed\"\n}\nThanks!",
        )
        .expect("verdict should parse from embedded JSON");

        assert_eq!(verdict.status, VerificationVerdictStatus::Pass);
        assert_eq!(verdict.risk_level, VerificationRiskLevel::Low);
        assert_eq!(verdict.evidence, vec!["npm run test passed".to_string()]);
        assert_eq!(verdict.next_action, VerificationNextAction::Finish);
        assert_eq!(verdict.summary, "Checks passed");
    }
}

#[tauri::command]
pub async fn pair_run_verification(
    broker: State<'_, std::sync::Mutex<MessageBroker>>,
    pair_id: String,
) -> Result<VerificationGateReport, String> {
    let (workspace_root, modified_files) = {
        let broker = broker.lock().map_err(|e| e.to_string())?;
        let state = broker
            .get_state(&pair_id)
            .ok_or_else(|| format!("Pair {} not found", pair_id))?;
        (state.directory.clone(), state.modified_files.clone())
    };

    let plan = build_verification_plan(Path::new(&workspace_root), &modified_files)?;

    {
        let broker = broker.lock().map_err(|e| e.to_string())?;
        broker.set_pair_status(
            &pair_id,
            PairStatus::Reviewing,
            Some("Running automated verification checks".to_string()),
        );
    }

    let started_at = now();
    let mut checks = Vec::with_capacity(plan.checks.len());
    for check in &plan.checks {
        checks.push(run_check(Path::new(&workspace_root), check).await);
    }
    let finished_at = now();
    let summary = summarize_checks(&checks);

    let report = VerificationGateReport {
        risk_level: plan.risk_level.clone(),
        checks,
        summary,
        started_at,
        finished_at,
    };

    {
        let broker = broker.lock().map_err(|e| e.to_string())?;
        broker.set_verification_report(&pair_id, report.clone())?;
    }

    Ok(report)
}

pub fn build_verification_plan(
    workspace_root: &Path,
    modified_files: &[crate::types::ModifiedFile],
) -> Result<VerificationPlan, String> {
    let risk_level = classify_change_risk(modified_files);
    let mut checks = Vec::new();

    if risk_level != VerificationRiskLevel::Low {
        checks.push(VerificationCheckPlan::new(
            "diff-check",
            "git",
            vec!["diff".to_string(), "--check".to_string()],
        ));
    }

    if let Some(package_manager) = detect_package_manager(workspace_root) {
        if let Some(scripts) = read_package_scripts(workspace_root)? {
            for script in ["test", "lint", "typecheck", "build"] {
                if scripts.iter().any(|candidate| candidate == script) {
                    checks.push(package_manager.script_check(script));
                }
            }
        }
    }

    if checks.is_empty() {
        if let Some(cargo_manifest) = detect_cargo_manifest(workspace_root) {
            checks.extend([
                VerificationCheckPlan::new(
                    "test",
                    "cargo",
                    vec![
                        "test".to_string(),
                        "--manifest-path".to_string(),
                        cargo_manifest.to_string_lossy().to_string(),
                    ],
                ),
                VerificationCheckPlan::new(
                    "lint",
                    "cargo",
                    vec![
                        "clippy".to_string(),
                        "--manifest-path".to_string(),
                        cargo_manifest.to_string_lossy().to_string(),
                        "--".to_string(),
                        "-D".to_string(),
                        "warnings".to_string(),
                    ],
                ),
                VerificationCheckPlan::new(
                    "typecheck",
                    "cargo",
                    vec![
                        "check".to_string(),
                        "--manifest-path".to_string(),
                        cargo_manifest.to_string_lossy().to_string(),
                    ],
                ),
                VerificationCheckPlan::new(
                    "build",
                    "cargo",
                    vec![
                        "build".to_string(),
                        "--manifest-path".to_string(),
                        cargo_manifest.to_string_lossy().to_string(),
                    ],
                ),
            ]);
        }
    }

    if checks.is_empty() {
        checks.push(VerificationCheckPlan::new(
            "diff-check",
            "git",
            vec!["diff".to_string(), "--check".to_string()],
        ));
    }

    Ok(VerificationPlan { risk_level, checks })
}

pub fn classify_change_risk(
    modified_files: &[crate::types::ModifiedFile],
) -> VerificationRiskLevel {
    let total_files = modified_files.len();
    let has_delete_or_rename = modified_files.iter().any(|file| {
        matches!(
            file.status,
            crate::types::FileStatus::D | crate::types::FileStatus::R
        )
    });
    let has_migrations_or_schema = modified_files.iter().any(|file| {
        let path = file.path.to_lowercase();
        path.contains("migration") || path.contains("migrations") || path.contains("schema")
    });
    let touches_multiple_layers = {
        let mut has_backend = false;
        let mut has_frontend = false;
        for file in modified_files {
            let path = file.path.to_lowercase();
            if path.contains("src-tauri/") || path.ends_with(".rs") {
                has_backend = true;
            }
            if path.contains("src/renderer/") || path.ends_with(".ts") || path.ends_with(".tsx") {
                has_frontend = true;
            }
        }
        has_backend && has_frontend
    };

    if has_delete_or_rename || has_migrations_or_schema || total_files >= 12 {
        return VerificationRiskLevel::High;
    }

    if total_files >= 6 || touches_multiple_layers {
        return VerificationRiskLevel::Medium;
    }

    VerificationRiskLevel::Low
}

pub fn parse_verification_verdict(raw: &str) -> Result<VerificationVerdict, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Verification verdict was empty".to_string());
    }

    let normalized = strip_code_fences(trimmed);
    let mut last_error = match parse_verification_verdict_candidate(normalized) {
        Ok(verdict) => return Ok(verdict),
        Err(error) => error,
    };

    if normalized != trimmed {
        match parse_verification_verdict_candidate(trimmed) {
            Ok(verdict) => return Ok(verdict),
            Err(error) => last_error = error,
        }
    }

    if !normalized.starts_with('{') && !trimmed.starts_with('{') {
        if let Some(verdict) = find_embedded_verification_verdict(trimmed) {
            return Ok(verdict);
        }
    }

    Err(
        format!("Failed to parse verification verdict: {}", last_error),
    )
}

fn strip_code_fences(raw: &str) -> &str {
    let trimmed = raw.trim();
    if !trimmed.starts_with("```") {
        return trimmed;
    }

    let without_opening = trimmed
        .split_once('\n')
        .map(|(_, rest)| rest.trim())
        .unwrap_or(trimmed);

    if let Some(end) = without_opening.rfind("```") {
        without_opening[..end].trim()
    } else {
        without_opening
    }
}

fn parse_verification_verdict_candidate(
    candidate: &str,
) -> Result<VerificationVerdict, serde_json::Error> {
    let mut deserializer = serde_json::Deserializer::from_str(candidate);
    VerificationVerdict::deserialize(&mut deserializer)
}

fn find_embedded_verification_verdict(raw: &str) -> Option<VerificationVerdict> {
    for (index, ch) in raw.char_indices() {
        if ch != '{' {
            continue;
        }

        if let Ok(verdict) = parse_verification_verdict_candidate(&raw[index..]) {
            return Some(verdict);
        }
    }

    None
}

fn detect_package_manager(workspace_root: &Path) -> Option<PackageManager> {
    let package_json = workspace_root.join("package.json");
    let package_json_content = fs::read_to_string(&package_json).ok()?;
    let parsed: Value = serde_json::from_str(&package_json_content).ok()?;
    if let Some(package_manager) = parsed
        .get("packageManager")
        .and_then(|value| value.as_str())
    {
        if package_manager.starts_with("pnpm") {
            return Some(PackageManager::Pnpm);
        }
        if package_manager.starts_with("yarn") {
            return Some(PackageManager::Yarn);
        }
        if package_manager.starts_with("bun") {
            return Some(PackageManager::Bun);
        }
        if package_manager.starts_with("npm") {
            return Some(PackageManager::Npm);
        }
    }

    if workspace_root.join("pnpm-lock.yaml").exists() {
        return Some(PackageManager::Pnpm);
    }
    if workspace_root.join("yarn.lock").exists() {
        return Some(PackageManager::Yarn);
    }
    if workspace_root.join("bun.lockb").exists() || workspace_root.join("bun.lock").exists() {
        return Some(PackageManager::Bun);
    }
    Some(PackageManager::Npm)
}

fn read_package_scripts(workspace_root: &Path) -> Result<Option<Vec<String>>, String> {
    let package_json = workspace_root.join("package.json");
    if !package_json.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(&package_json)
        .map_err(|error| format!("Failed to read package.json: {}", error))?;
    let parsed: Value = serde_json::from_str(&raw)
        .map_err(|error| format!("Failed to parse package.json: {}", error))?;
    let scripts = parsed
        .get("scripts")
        .and_then(|value| value.as_object())
        .map(|scripts| scripts.keys().cloned().collect::<Vec<_>>());
    Ok(scripts)
}

fn detect_cargo_manifest(workspace_root: &Path) -> Option<PathBuf> {
    let direct = workspace_root.join("Cargo.toml");
    if direct.exists() {
        return Some(direct);
    }

    let tauri_manifest = workspace_root.join("src-tauri").join("Cargo.toml");
    if tauri_manifest.exists() {
        return Some(tauri_manifest);
    }

    None
}

async fn run_check(workspace_root: &Path, check: &VerificationCheckPlan) -> VerificationCheckRun {
    let started = Instant::now();
    let output = Command::new(&check.program)
        .args(&check.args)
        .current_dir(workspace_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await;

    match output {
        Ok(output) => {
            let stdout = trim_output(&String::from_utf8_lossy(&output.stdout), 4_000);
            let stderr = trim_output(&String::from_utf8_lossy(&output.stderr), 4_000);
            let status = if output.status.success() {
                VerificationCheckStatus::Passed
            } else {
                VerificationCheckStatus::Failed
            };

            VerificationCheckRun {
                name: check.name.clone(),
                command: check.command.clone(),
                status,
                exit_code: output.status.code(),
                duration_ms: started.elapsed().as_millis() as u64,
                stdout,
                stderr,
                summary: summarize_check_output(check, output.status.success()),
            }
        }
        Err(error) => VerificationCheckRun {
            name: check.name.clone(),
            command: check.command.clone(),
            status: VerificationCheckStatus::Failed,
            exit_code: None,
            duration_ms: started.elapsed().as_millis() as u64,
            stdout: String::new(),
            stderr: error.to_string(),
            summary: format!("{} could not start", check.name),
        },
    }
}

fn summarize_check_output(check: &VerificationCheckPlan, passed: bool) -> String {
    if passed {
        format!("{} passed", check.name)
    } else {
        format!("{} failed", check.name)
    }
}

fn summarize_checks(checks: &[VerificationCheckRun]) -> String {
    let passed = checks
        .iter()
        .filter(|check| matches!(check.status, VerificationCheckStatus::Passed))
        .count();
    let failed = checks
        .iter()
        .filter(|check| matches!(check.status, VerificationCheckStatus::Failed))
        .count();
    let skipped = checks
        .iter()
        .filter(|check| matches!(check.status, VerificationCheckStatus::Skipped))
        .count();

    format!("{} passed, {} failed, {} skipped", passed, failed, skipped)
}

fn trim_output(text: &str, max_chars: usize) -> String {
    let trimmed = text.trim();
    let chars: Vec<char> = trimmed.chars().collect();
    if chars.len() <= max_chars {
        return trimmed.to_string();
    }

    chars[chars.len() - max_chars..].iter().collect()
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VerificationPlan {
    pub risk_level: VerificationRiskLevel,
    pub checks: Vec<VerificationCheckPlan>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VerificationCheckPlan {
    pub name: String,
    pub command: String,
    pub program: String,
    pub args: Vec<String>,
}

impl VerificationCheckPlan {
    fn new(name: impl Into<String>, program: impl Into<String>, args: Vec<String>) -> Self {
        let program = program.into();
        let command = std::iter::once(program.clone())
            .chain(args.iter().cloned())
            .collect::<Vec<_>>()
            .join(" ");
        Self {
            name: name.into(),
            command,
            program,
            args,
        }
    }
}

#[derive(Debug, Clone)]
enum PackageManager {
    Npm,
    Pnpm,
    Yarn,
    Bun,
}

impl PackageManager {
    fn script_check(&self, script: &str) -> VerificationCheckPlan {
        match self {
            PackageManager::Npm => VerificationCheckPlan::new(
                script,
                "npm",
                vec!["run".to_string(), script.to_string()],
            ),
            PackageManager::Pnpm => {
                VerificationCheckPlan::new(script, "pnpm", vec![script.to_string()])
            }
            PackageManager::Yarn => {
                VerificationCheckPlan::new(script, "yarn", vec![script.to_string()])
            }
            PackageManager::Bun => VerificationCheckPlan::new(
                script,
                "bun",
                vec!["run".to_string(), script.to_string()],
            ),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VerificationRiskLevel {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerificationVerdict {
    pub status: VerificationVerdictStatus,
    pub risk_level: VerificationRiskLevel,
    pub evidence: Vec<String>,
    pub next_action: VerificationNextAction,
    pub summary: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VerificationVerdictStatus {
    Pass,
    Fail,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VerificationNextAction {
    Continue,
    Finish,
    HumanReview,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerificationGateReport {
    pub risk_level: VerificationRiskLevel,
    pub checks: Vec<VerificationCheckRun>,
    pub summary: String,
    pub started_at: u64,
    pub finished_at: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VerificationCheckStatus {
    Passed,
    Failed,
    Skipped,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerificationCheckRun {
    pub name: String,
    pub command: String,
    pub status: VerificationCheckStatus,
    pub exit_code: Option<i32>,
    pub duration_ms: u64,
    pub stdout: String,
    pub stderr: String,
    pub summary: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VerificationPhase {
    Idle,
    Running,
    AwaitingVerdict,
    Passed,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerificationState {
    pub phase: VerificationPhase,
    pub risk_level: VerificationRiskLevel,
    pub report: Option<VerificationGateReport>,
    pub verdict: Option<VerificationVerdict>,
    pub raw_verdict: Option<String>,
    pub error: Option<String>,
    pub started_at: Option<u64>,
    pub updated_at: u64,
}

impl VerificationState {
    pub fn idle() -> Self {
        Self {
            phase: VerificationPhase::Idle,
            risk_level: VerificationRiskLevel::Low,
            report: None,
            verdict: None,
            raw_verdict: None,
            error: None,
            started_at: None,
            updated_at: 0,
        }
    }
}

impl Default for VerificationState {
    fn default() -> Self {
        Self::idle()
    }
}
