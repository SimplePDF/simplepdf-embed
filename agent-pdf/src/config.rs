pub struct Config {
    pub s3_endpoint: String,
    pub s3_bucket: String,
    pub s3_region: String,
    pub s3_public_url: String,
    pub default_editor_host: String,
    pub rate_limit_per_minute: u32,
    pub trust_proxy: bool,
}

impl Config {
    pub fn from_env() -> Self {
        let s3_endpoint = env("S3_ENDPOINT");
        let s3_bucket = env("S3_BUCKET");

        Self {
            s3_region: env_or("S3_REGION", "us-east-1"),
            s3_public_url: env_or("S3_PUBLIC_URL", &s3_endpoint),
            s3_endpoint,
            s3_bucket,
            default_editor_host: env_or("DEFAULT_EDITOR_HOST", "ai.simplepdf.com"),
            rate_limit_per_minute: env_or("RATE_LIMIT_PER_MIN", "30")
                .parse()
                .expect("RATE_LIMIT_PER_MIN must be a number"),
            trust_proxy: env_or("TRUST_PROXY", "false") == "true",
        }
    }

    pub fn editor_base_url(&self, company_identifier: Option<&str>) -> String {
        match company_identifier {
            Some(company_identifier) => format!("https://{company_identifier}.simplepdf.com"),
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
