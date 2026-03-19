pub struct Config {
    /// DO Spaces bucket name
    pub bucket: String,
    /// DO Spaces endpoint (e.g. https://ams3.digitaloceanspaces.com)
    pub spaces_endpoint: String,
    /// DO Spaces region (e.g. ams3)
    pub spaces_region: String,
    /// CDN or direct URL prefix for public access
    /// e.g. https://agent-pdf.ams3.cdn.digitaloceanspaces.com
    pub public_url_prefix: String,
    /// SimplePDF base URL
    pub simplepdf_url: String,
    /// Requests per IP per minute
    pub rate_limit_per_minute: u32,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            bucket: env("SPACES_BUCKET"),
            spaces_endpoint: env("SPACES_ENDPOINT"),
            spaces_region: env_or("SPACES_REGION", "nyc3"),
            public_url_prefix: env("SPACES_PUBLIC_URL"),
            simplepdf_url: env_or("SIMPLEPDF_URL", "https://simplepdf.com"),
            rate_limit_per_minute: env_or("RATE_LIMIT_PER_MIN", "30")
                .parse()
                .expect("RATE_LIMIT_PER_MIN must be a number"),
        }
    }
}

fn env(key: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| panic!("{key} must be set"))
}

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}
