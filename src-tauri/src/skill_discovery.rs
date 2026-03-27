use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub source: String,
}

#[derive(Debug, Deserialize)]
struct SkillFrontmatter {
    name: String,
    description: String,
}

fn parse_skill_md(path: &Path) -> Option<SkillInfo> {
    let content = fs::read_to_string(path).ok()?;
    let lines: Vec<&str> = content.lines().collect();

    if lines.first()? != &"---" {
        return None;
    }

    let end = lines.iter().skip(1).position(|&line| line == "---")?;
    let yaml_content = lines[1..=end].join("\n");

    let frontmatter: SkillFrontmatter = serde_yaml::from_str(&yaml_content).ok()?;

    Some(SkillInfo {
        name: frontmatter.name,
        description: frontmatter.description,
        source: path.parent()?.to_string_lossy().to_string(),
    })
}

fn scan_skills_dir(dir: PathBuf) -> Vec<SkillInfo> {
    let mut skills = Vec::new();

    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let skill_md = entry.path().join("SKILL.md");
                if skill_md.exists() {
                    if let Some(skill) = parse_skill_md(&skill_md) {
                        skills.push(skill);
                    }
                }
            }
        }
    }

    skills
}

fn discover_skills_impl(project_dir: Option<&str>) -> Vec<SkillInfo> {
    let mut all_skills = Vec::new();

    if let Some(home) = dirs::home_dir() {
        for subdir in [
            ".config/opencode/skills",
            ".claude/skills",
            ".agents/skills",
        ] {
            let dir = home.join(subdir);
            all_skills.extend(scan_skills_dir(dir));
        }
    }

    if let Some(dir) = project_dir {
        let project_path = PathBuf::from(dir);
        for subdir in [".opencode/skills", ".claude/skills", ".agents/skills"] {
            let dir = project_path.join(subdir);
            all_skills.extend(scan_skills_dir(dir));
        }
    }

    all_skills
}

#[tauri::command]
pub fn discover_skills(project_dir: Option<String>) -> Vec<SkillInfo> {
    discover_skills_impl(project_dir.as_deref())
}
