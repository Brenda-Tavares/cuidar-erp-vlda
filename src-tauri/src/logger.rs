use chrono::Local;
use log::{Level, LevelFilter, Metadata, Record};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

pub struct FileLogger {
    log_file: Mutex<Option<std::fs::File>>,
    log_dir: PathBuf,
}

impl FileLogger {
    pub fn new(log_dir: PathBuf) -> Self {
        fs::create_dir_all(&log_dir).ok();
        FileLogger {
            log_file: Mutex::new(None),
            log_dir,
        }
    }

    fn get_log_file(&self) -> std::fs::File {
        let date = Local::now().format("%Y-%m-%d");
        let log_path = self.log_dir.join(format!("vila-do-aprender_{}.log", date));
        OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_path)
            .expect("Falha ao abrir arquivo de log")
    }
}

impl log::Log for FileLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= Level::Info
    }

    fn log(&self, record: &Record) {
        if self.enabled(record.metadata()) {
            let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
            let level = record.level();
            let target = record.target();
            let message = record.args();
            let log_line = format!("[{}] [{}] [{}] {}\n", timestamp, level, target, message);
            eprint!("{}", log_line);
            if let Ok(mut file_lock) = self.log_file.lock() {
                if file_lock.is_none() {
                    *file_lock = Some(self.get_log_file());
                }
                if let Some(ref mut file) = *file_lock {
                    let _ = file.write_all(log_line.as_bytes());
                }
            }
        }
    }

    fn flush(&self) {}
}

pub fn init_logger(app_data_dir: PathBuf) {
    let log_dir = app_data_dir.join("logs");
    let logger = FileLogger::new(log_dir);
    log::set_boxed_logger(Box::new(logger)).expect("Falha ao configurar logger");
    #[cfg(debug_assertions)]
    log::set_max_level(LevelFilter::Debug);
    #[cfg(not(debug_assertions))]
    log::set_max_level(LevelFilter::Info);
}

pub fn limpar_logs_antigos(app_data_dir: PathBuf) {
    let log_dir = app_data_dir.join("logs");
    if !log_dir.exists() {
        return;
    }
    let agora = Local::now();
    let trinta_dias_atras = agora - Duration::from_secs(30 * 24 * 60 * 60);
    if let Ok(entries) = fs::read_dir(&log_dir) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    let modified_time: chrono::DateTime<Local> = modified.into();
                    if modified_time < trinta_dias_atras {
                        let _ = fs::remove_file(entry.path());
                        log::info!(target: "system", "[LIMPEZA] Log antigo removido: {:?}", entry.path());
                    }
                }
            }
        }
    }
}

#[macro_export]
macro_rules! log_info {
    ($operation:expr, $context:expr, $message:expr) => {
        log::info!(target: $operation, "[{}] {}", $context, $message)
    };
}

#[macro_export]
macro_rules! log_error {
    ($operation:expr, $context:expr, $message:expr) => {
        log::error!(target: $operation, "[{}] {}", $context, $message)
    };
}

#[macro_export]
macro_rules! log_warn {
    ($operation:expr, $context:expr, $message:expr) => {
        log::warn!(target: $operation, "[{}] {}", $context, $message)
    };
}
