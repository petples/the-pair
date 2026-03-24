use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PairStatus {
    Idle,
    Mentoring,
    Executing,
    Reviewing,
    #[serde(rename = "Awaiting Human Review")]
    AwaitingHumanReview,
    Error,
    Finished,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentRole {
    Mentor,
    Executor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageType {
    Plan,
    Feedback,
    Progress,
    Result,
    Question,
    Handoff,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageSender {
    Mentor,
    Executor,
    Human,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActivityPhase {
    Idle,
    Thinking,
    #[serde(rename = "using_tools")]
    UsingTools,
    Responding,
    Waiting,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentActivity {
    pub phase: ActivityPhase,
    pub label: String,
    pub detail: Option<String>,
    #[serde(rename = "startedAt")]
    pub started_at: u64,
    #[serde(rename = "updatedAt")]
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceInfo {
    pub cpu: f64,
    #[serde(rename = "memMb")]
    pub mem_mb: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairResources {
    pub mentor: ResourceInfo,
    pub executor: ResourceInfo,
    #[serde(rename = "pairTotal")]
    pub pair_total: ResourceInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileStatus {
    A,
    M,
    D,
    R,
    #[serde(rename = "??")]
    Untracked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModifiedFile {
    pub path: String,
    pub status: FileStatus,
    #[serde(rename = "displayPath")]
    pub display_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitTracking {
    pub available: bool,
    #[serde(rename = "rootPath")]
    pub root_path: Option<String>,
    pub baseline: Option<String>,
    #[serde(rename = "gitReviewAvailable")]
    pub git_review_available: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub role: AgentRole,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePairInput {
    pub name: String,
    pub directory: String,
    pub spec: String,
    pub mentor: AgentConfig,
    pub executor: AgentConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignTaskInput {
    pub spec: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePairModelsInput {
    #[serde(rename = "mentorModel")]
    pub mentor_model: String,
    #[serde(rename = "executorModel")]
    pub executor_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pair {
    #[serde(rename = "pairId")]
    pub pair_id: String,
    pub name: String,
    pub directory: String,
    pub status: PairStatus,
    #[serde(rename = "mentorModel")]
    pub mentor_model: String,
    #[serde(rename = "executorModel")]
    pub executor_model: String,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub timestamp: u64,
    pub from: MessageSender,
    pub to: String,
    #[serde(rename = "type")]
    pub msg_type: MessageType,
    pub content: String,
    pub iteration: u32,
}
