pub struct Config {
    pub bucket: String,
    pub spaces_endpoint: String,
    pub spaces_region: String,
    pub public_url_prefix: String,
    pub default_editor_host: String,
    pub rate_limit_per_minute: u32,
    pub trust_proxy: bool,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            bucket: env("SPACES_BUCKET"),
            spaces_endpoint: env("SPACES_ENDPOINT"),
            spaces_region: env_or("SPACES_REGION", "nyc3"),
            public_url_prefix: env("SPACES_PUBLIC_URL"),
            default_editor_host: env_or("DEFAULT_EDITOR_HOST", "ai.simplepdf.com"),
            rate_limit_per_minute: env_or("RATE_LIMIT_PER_MIN", "30")
                .parse()
                .expect("RATE_LIMIT_PER_MIN must be a number"),
            trust_proxy: env_or("TRUST_PROXY", "false") == "true",
        }
    }

    pub fn editor_base_url(&self, company_identifier: Option<&str>) -> String {
        match company_identifier {
            Some(id) => format!("https://{id}.simplepdf.com"),
            None => format!("https://{}", self.default_editor_host),
        }
    }
}

fn env(key: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| panic!("{key} must be set"))
}

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}
