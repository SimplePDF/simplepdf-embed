use dashmap::DashMap;
use std::net::IpAddr;
use std::time::Instant;

const MAX_TRACKED_IPS: usize = 10_000;

pub struct RateLimiter {
    max_per_minute: u32,
    buckets: DashMap<IpAddr, Vec<Instant>>,
}

impl RateLimiter {
    pub fn new(max_per_minute: u32) -> Self {
        Self {
            max_per_minute,
            buckets: DashMap::new(),
        }
    }

    pub fn check(&self, ip: IpAddr) -> bool {
        if self.buckets.len() >= MAX_TRACKED_IPS {
            self.evict_stale();
        }

        let now = Instant::now();
        let window = std::time::Duration::from_secs(60);

        let mut entry = self.buckets.entry(ip).or_default();
        let timestamps = entry.value_mut();

        timestamps.retain(|t| now.duration_since(*t) < window);

        if timestamps.len() >= self.max_per_minute as usize {
            return false;
        }

        timestamps.push(now);
        true
    }

    fn evict_stale(&self) {
        let now = Instant::now();
        let window = std::time::Duration::from_secs(60);

        self.buckets.retain(|_, timestamps| {
            timestamps.retain(|t| now.duration_since(*t) < window);
            !timestamps.is_empty()
        });
    }
}
