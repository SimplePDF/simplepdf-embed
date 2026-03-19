use aws_sdk_s3::presigning::PresigningConfig;
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::Client;
use std::time::Duration;
use uuid::Uuid;

use crate::config::Config;
use crate::error::AppError;

const PRESIGN_EXPIRY: Duration = Duration::from_secs(24 * 60 * 60);
const LIFECYCLE_EXPIRY_DAYS: i32 = 1;

pub struct Storage {
    client: Client,
    bucket: String,
}

pub struct UploadResult {
    pub presigned_url: String,
}

impl Storage {
    pub async fn new(config: &Config) -> Self {
        let creds = aws_sdk_s3::config::Credentials::new(
            std::env::var("S3_KEY").expect("S3_KEY must be set"),
            std::env::var("S3_SECRET").expect("S3_SECRET must be set"),
            None,
            None,
            "env",
        );

        let s3_config = aws_sdk_s3::Config::builder()
            .behavior_version_latest()
            .endpoint_url(&config.s3_endpoint)
            .region(aws_sdk_s3::config::Region::new(config.s3_region.clone()))
            .credentials_provider(creds)
            .force_path_style(false)
            .build();

        Self {
            client: Client::from_conf(s3_config),
            bucket: config.s3_bucket.clone(),
        }
    }

    pub async fn upload(
        &self,
        bytes: Vec<u8>,
        original_filename: Option<&str>,
    ) -> Result<UploadResult, AppError> {
        if bytes.len() < 5 || &bytes[..5] != b"%PDF-" {
            return Err(AppError::BadRequest("Not a valid PDF file".into()));
        }

        let hash = &Uuid::new_v4().to_string()[..8];
        let key = build_key(original_filename, hash);

        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(&key)
            .body(ByteStream::from(bytes))
            .content_type("application/pdf")
            .content_disposition("attachment")
            .send()
            .await
            .map_err(|e| AppError::StorageFailed(e.to_string()))?;

        let presign_config = PresigningConfig::expires_in(PRESIGN_EXPIRY)
            .map_err(|e| AppError::StorageFailed(e.to_string()))?;

        let presigned_url = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(&key)
            .presigned(presign_config)
            .await
            .map_err(|e| AppError::StorageFailed(e.to_string()))?
            .uri()
            .to_string();

        Ok(UploadResult { presigned_url })
    }

    pub async fn ensure_lifecycle_policy(&self) {
        use aws_sdk_s3::types::{
            BucketLifecycleConfiguration, ExpirationStatus, LifecycleExpiration, LifecycleRule,
            LifecycleRuleFilter,
        };

        let rule = LifecycleRule::builder()
            .id("expire-uploads-24h")
            .status(ExpirationStatus::Enabled)
            .filter(LifecycleRuleFilter::builder().prefix("uploads/").build())
            .expiration(
                LifecycleExpiration::builder()
                    .days(LIFECYCLE_EXPIRY_DAYS)
                    .build(),
            )
            .build()
            .expect("valid lifecycle rule");

        let config = BucketLifecycleConfiguration::builder()
            .rules(rule)
            .build()
            .expect("valid lifecycle config");

        match self
            .client
            .put_bucket_lifecycle_configuration()
            .bucket(&self.bucket)
            .lifecycle_configuration(config)
            .send()
            .await
        {
            Ok(_) => tracing::info!(
                "lifecycle policy set: uploads/ expire after {LIFECYCLE_EXPIRY_DAYS} day(s)"
            ),
            Err(e) => tracing::error!("failed to set lifecycle policy: {e}"),
        }
    }
}

fn build_key(original_filename: Option<&str>, hash: &str) -> String {
    let stem_and_ext = original_filename
        .filter(|name| !name.is_empty())
        .map(|name| {
            let name = name
                .rsplit('/')
                .next()
                .unwrap_or(name)
                .rsplit('\\')
                .next()
                .unwrap_or(name);

            match name.rsplit_once('.') {
                Some((stem, ext)) => (stem.to_string(), format!(".{ext}")),
                None => (name.to_string(), String::new()),
            }
        });

    match stem_and_ext {
        Some((stem, ext)) => format!("uploads/{stem}-{hash}{ext}"),
        None => format!("uploads/{hash}.pdf"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_key_with_filename() {
        assert_eq!(
            build_key(Some("invoice.pdf"), "a1b2c3d4"),
            "uploads/invoice-a1b2c3d4.pdf"
        );
    }

    #[test]
    fn test_build_key_with_path() {
        assert_eq!(
            build_key(Some("path/to/report.pdf"), "a1b2c3d4"),
            "uploads/report-a1b2c3d4.pdf"
        );
    }

    #[test]
    fn test_build_key_without_extension() {
        assert_eq!(
            build_key(Some("document"), "a1b2c3d4"),
            "uploads/document-a1b2c3d4"
        );
    }

    #[test]
    fn test_build_key_none() {
        assert_eq!(build_key(None, "a1b2c3d4"), "uploads/a1b2c3d4.pdf");
    }

    #[test]
    fn test_build_key_empty() {
        assert_eq!(build_key(Some(""), "a1b2c3d4"), "uploads/a1b2c3d4.pdf");
    }
}
