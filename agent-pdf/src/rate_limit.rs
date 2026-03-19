use dashmap::DashMap;
use std::net::IpAddr;
use std::time::Instant;

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

    /// Returns true if the request should be allowed.
    pub fn check(&self, ip: IpAddr) -> bool {
        let now = Instant::now();
        let window = std::time::Duration::from_secs(60);

        let mut entry = self.buckets.entry(ip).or_default();
        let timestamps = entry.value_mut();

        // Prune old entries
        timestamps.retain(|t| now.duration_since(*t) < window);

        if timestamps.len() >= self.max_per_minute as usize {
            return false;
        }

        timestamps.push(now);
        true
    }
}
