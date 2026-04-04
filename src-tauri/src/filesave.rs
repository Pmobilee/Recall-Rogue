use std::fs;
use std::path::PathBuf;
use tauri::Manager;

// ── Filename Validation ────────────────────────────────────────────────────────

/// Validates a save filename for path traversal safety.
///
/// Allowed characters: alphanumeric (a-z, A-Z, 0-9), underscore (_), hyphen (-), dot (.).
/// Rejected: any path separator (`/`, `\`), parent-directory component (`..`), or any
/// character outside the allowed set.  An empty filename is also rejected.
///
/// This prevents a caller from escaping the save directory via filenames like
/// `../../etc/passwd` or `..\AppData\system.dat`.
fn validate_filename(filename: &str) -> Result<(), String> {
    if filename.is_empty() {
        return Err("Filename must not be empty".to_string());
    }

    // Reject double-dot sequences regardless of position
    if filename.contains("..") {
        return Err(format!("Invalid filename '{}': must not contain '..'", filename));
    }

    // Reject path separators
    if filename.contains('/') || filename.contains('\\') {
        return Err(format!(
            "Invalid filename '{}': must not contain path separators",
            filename
        ));
    }

    // Allow only safe characters
    let all_valid = filename
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.');

    if !all_valid {
        return Err(format!(
            "Invalid filename '{}': only alphanumeric characters, underscores, hyphens, and dots are allowed",
            filename
        ));
    }

    Ok(())
}

// ── Internal Helper ────────────────────────────────────────────────────────────

/// Returns the platform-correct save directory path, creating it if it doesn't exist.
///
/// Path: `<app_data_dir>/saves/`
///
/// On macOS: `~/Library/Application Support/com.bramblegategames.recallrogue/saves/`
/// On Windows: `%APPDATA%\com.bramblegategames.recallrogue\saves\`
/// On Linux: `~/.local/share/com.bramblegategames.recallrogue/saves/`
fn get_save_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;

    let save_dir = base.join("saves");

    fs::create_dir_all(&save_dir)
        .map_err(|e| format!("Failed to create save dir '{}': {}", save_dir.display(), e))?;

    Ok(save_dir)
}

// ── Tauri IPC Commands ─────────────────────────────────────────────────────────

/// Returns the absolute path of the save directory as a UTF-8 string.
///
/// The directory is created if it does not exist. Callers may use this to display
/// the save location in a settings screen or to pass it to Steam Cloud sync logic.
#[tauri::command]
pub fn fs_get_save_dir(app: tauri::AppHandle) -> Result<String, String> {
    let save_dir = get_save_dir(&app)?;
    Ok(save_dir.to_string_lossy().to_string())
}

/// Writes `data` to `<save_dir>/<filename>` using an atomic write strategy.
///
/// The data is first written to a `.tmp` sibling file, then renamed into place.
/// This prevents partial writes from corrupting an existing save — if the process
/// is killed mid-write, the old file remains intact.
///
/// `filename` is validated before use; see [`validate_filename`] for allowed chars.
#[tauri::command]
pub fn fs_write_save(
    app: tauri::AppHandle,
    filename: String,
    data: String,
) -> Result<(), String> {
    validate_filename(&filename)?;

    let save_dir = get_save_dir(&app)?;
    let target = save_dir.join(&filename);
    let tmp = save_dir.join(format!("{}.tmp", filename));

    fs::write(&tmp, &data)
        .map_err(|e| format!("Failed to write temp file '{}': {}", tmp.display(), e))?;

    fs::rename(&tmp, &target).map_err(|e| {
        // Best-effort cleanup of the .tmp on rename failure; ignore secondary errors
        let _ = fs::remove_file(&tmp);
        format!(
            "Failed to rename '{}' -> '{}': {}",
            tmp.display(),
            target.display(),
            e
        )
    })?;

    println!("[FileSave] Wrote save: {}", filename);
    Ok(())
}

/// Reads the contents of `<save_dir>/<filename>` as a UTF-8 string.
///
/// Returns `None` if the file does not exist (first-run case), or an `Err`
/// if the file exists but cannot be read (permissions, encoding, etc.).
///
/// `filename` is validated before use; see [`validate_filename`] for allowed chars.
#[tauri::command]
pub fn fs_read_save(
    app: tauri::AppHandle,
    filename: String,
) -> Result<Option<String>, String> {
    validate_filename(&filename)?;

    let save_dir = get_save_dir(&app)?;
    let path = save_dir.join(&filename);

    if !path.exists() {
        return Ok(None);
    }

    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read '{}': {}", path.display(), e))?;

    println!("[FileSave] Read save: {} ({} bytes)", filename, contents.len());
    Ok(Some(contents))
}

/// Deletes `<save_dir>/<filename>`.  No-op if the file does not exist.
///
/// `filename` is validated before use; see [`validate_filename`] for allowed chars.
#[tauri::command]
pub fn fs_delete_save(app: tauri::AppHandle, filename: String) -> Result<(), String> {
    validate_filename(&filename)?;

    let save_dir = get_save_dir(&app)?;
    let path = save_dir.join(&filename);

    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete '{}': {}", path.display(), e))?;
        println!("[FileSave] Deleted save: {}", filename);
    }

    Ok(())
}

// ── Unit Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::validate_filename;

    #[test]
    fn valid_filenames_accepted() {
        assert!(validate_filename("save.json").is_ok());
        assert!(validate_filename("rr_save_player1").is_ok());
        assert!(validate_filename("run-checkpoint.json").is_ok());
        assert!(validate_filename("profile_123.json").is_ok());
        assert!(validate_filename("A").is_ok());
    }

    #[test]
    fn empty_filename_rejected() {
        assert!(validate_filename("").is_err());
    }

    #[test]
    fn path_traversal_rejected() {
        assert!(validate_filename("../etc/passwd").is_err());
        assert!(validate_filename("..").is_err());
        assert!(validate_filename("sub/file.json").is_err());
        assert!(validate_filename("sub\\file.json").is_err());
        assert!(validate_filename("..\\AppData\\creds").is_err());
    }

    #[test]
    fn special_chars_rejected() {
        assert!(validate_filename("file name.json").is_err()); // space
        assert!(validate_filename("file;rm -rf /").is_err());
        assert!(validate_filename("file\0null").is_err());
        assert!(validate_filename("file<>.json").is_err());
    }

    #[test]
    fn double_dot_in_name_rejected() {
        // "a..b" has no path sep but is still rejected for clarity
        assert!(validate_filename("a..b").is_err());
    }
}
