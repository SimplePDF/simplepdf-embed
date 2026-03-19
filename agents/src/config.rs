pub struct Config {
    pub s3_endpoint: String,
    pub s3_bucket: String,
    pub s3_region: String,
    pub default_editor_host: String,
    pub rate_limit_per_minute: u32,
    pub trusted_ip_header: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            s3_endpoint: env("S3_ENDPOINT"),
            s3_bucket: env("S3_BUCKET"),
            s3_region: env("S3_REGION"),
            default_editor_host: env("DEFAULT_EDITOR_HOST"),
            rate_limit_per_minute: env("RATE_LIMIT_PER_MIN")
                .parse()
                .expect("RATE_LIMIT_PER_MIN must be a number"),
            trusted_ip_header: env("TRUSTED_IP_HEADER"),
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
