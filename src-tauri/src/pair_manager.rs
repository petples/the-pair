use crate::types::{CreatePairInput, Pair, PairStatus};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct PairManager {
    pairs: HashMap<String, Pair>,
}

impl PairManager {
    pub fn new() -> Self {
        Self {
            pairs: HashMap::new(),
        }
    }

    pub fn create_pair(&mut self, input: CreatePairInput) -> Result<Pair, String> {
        let pair_id = uuid::Uuid::new_v4().to_string();
        let created_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let pair = Pair {
            pair_id: pair_id.clone(),
            name: input.name,
            directory: input.directory,
            status: PairStatus::Idle,
            mentor_model: input.mentor.model,
            executor_model: input.executor.model,
            created_at,
        };

        self.pairs.insert(pair_id.clone(), pair.clone());
        Ok(pair)
    }

    pub fn list_pairs(&self) -> Vec<Pair> {
        self.pairs.values().cloned().collect()
    }

    pub fn delete_pair(&mut self, pair_id: &str) -> Result<(), String> {
        self.pairs
            .remove(pair_id)
            .ok_or_else(|| format!("Pair {} not found", pair_id))?;
        Ok(())
    }
}

#[tauri::command]
pub fn pair_create(
    state: tauri::State<std::sync::Mutex<PairManager>>,
    input: CreatePairInput,
) -> Result<Pair, String> {
    let mut manager = state.lock().unwrap();
    manager.create_pair(input)
}

#[tauri::command]
pub fn pair_list(state: tauri::State<std::sync::Mutex<PairManager>>) -> Result<Vec<Pair>, String> {
    let manager = state.lock().unwrap();
    Ok(manager.list_pairs())
}

#[tauri::command]
pub fn pair_delete(
    state: tauri::State<std::sync::Mutex<PairManager>>,
    pair_id: String,
) -> Result<(), String> {
    let mut manager = state.lock().unwrap();
    manager.delete_pair(&pair_id)
}
