use crate::types::PairState;
use sysinfo::{System, Pid};
use std::collections::HashMap;
use tokio::process::Child;
use std::sync::{Arc, Mutex};

pub struct ResourceMonitor;

impl ResourceMonitor {
    pub fn update_state(
        state: &mut PairState, 
        sys: &mut System, 
        active_processes: Arc<Mutex<HashMap<String, Child>>>
    ) {
        sys.refresh_all();
        
        let mut mentor_cpu = 0.0;
        let mut mentor_mem = 0.0;
        let mut executor_cpu = 0.0;
        let mut executor_mem = 0.0;

        let processes = active_processes.lock().unwrap();
        
        // Find mentor process
        let mentor_key = format!("{}-mentor", state.pair_id);
        if let Some(child) = processes.get(&mentor_key) {
            if let Some(pid) = child.id() {
                if let Some(process) = sys.process(Pid::from_u32(pid)) {
                    mentor_cpu = process.cpu_usage() as f64;
                    mentor_mem = process.memory() as f64 / 1024.0 / 1024.0;
                }
            }
        }

        // Find executor process
        let executor_key = format!("{}-executor", state.pair_id);
        if let Some(child) = processes.get(&executor_key) {
            if let Some(pid) = child.id() {
                if let Some(process) = sys.process(Pid::from_u32(pid)) {
                    executor_cpu = process.cpu_usage() as f64;
                    executor_mem = process.memory() as f64 / 1024.0 / 1024.0;
                }
            }
        }

        state.resources.mentor.cpu = mentor_cpu;
        state.resources.mentor.mem_mb = mentor_mem;
        state.resources.executor.cpu = executor_cpu;
        state.resources.executor.mem_mb = executor_mem;
        state.resources.pair_total.cpu = mentor_cpu + executor_cpu;
        state.resources.pair_total.mem_mb = mentor_mem + executor_mem;
    }
}
