use std::time::{SystemTime, UNIX_EPOCH};

pub fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

pub fn is_mock_mode() -> bool {
    std::env::var("THE_PAIR_E2E_MOCK")
        .map(|v| v == "true")
        .unwrap_or(false)
}

pub fn build_mentor_planning_prompt(task_spec: &str) -> String {
    format!(
        "ROLE: MENTOR. Analyze the following task and provide a detailed PLAN for the EXECUTOR. \
DO NOT execute it yourself. \
DO NOT run commands or edit files. \
Return ONLY a concrete PLAN with numbered executable steps (no intent-only preface).\n\nTASK: {}",
        task_spec
    )
}