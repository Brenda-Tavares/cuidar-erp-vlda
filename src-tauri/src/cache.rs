use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Clone)]
pub struct CacheEntry {
    pub data: String,
    pub expires_at: Instant,
}

#[derive(Clone)]
pub struct Cache {
    store: Arc<Mutex<HashMap<String, CacheEntry>>>,
    default_ttl: Duration,
}

impl Cache {
    pub fn new(default_ttl_secs: u64) -> Self {
        Cache {
            store: Arc::new(Mutex::new(HashMap::new())),
            default_ttl: Duration::from_secs(default_ttl_secs),
        }
    }

    pub fn get(&self, key: &str) -> Option<String> {
        let store = self.store.lock().ok()?;

        if let Some(entry) = store.get(key) {
            if entry.expires_at > Instant::now() {
                return Some(entry.data.clone());
            }
        }

        None
    }

    pub fn set(&self, key: String, value: String, ttl: Option<Duration>) {
        if let Ok(mut store) = self.store.lock() {
            let expires_at = Instant::now() + ttl.unwrap_or(self.default_ttl);
            store.insert(key, CacheEntry {
                data: value,
                expires_at,
            });
        }
    }

    #[allow(dead_code)]
    pub fn invalidate(&self, key: &str) {
        if let Ok(mut store) = self.store.lock() {
            store.remove(key);
        }
    }

    pub fn invalidate_pattern(&self, pattern: &str) {
        if let Ok(mut store) = self.store.lock() {
            store.retain(|k, _| !k.contains(pattern));
        }
    }

    pub fn clear(&self) {
        if let Ok(mut store) = self.store.lock() {
            store.clear();
        }
    }

    #[allow(dead_code)]
    pub fn cleanup_expired(&self) {
        if let Ok(mut store) = self.store.lock() {
            let now = Instant::now();
            store.retain(|_, entry| entry.expires_at > now);
        }
    }
}

lazy_static::lazy_static! {
    pub static ref GLOBAL_CACHE: Cache = Cache::new(3600);
}
