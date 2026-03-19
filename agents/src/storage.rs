use aws_sdk_s3::presigning::PresigningConfig;
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::Client;
use std::time::Duration;
use uuid::Uuid;

use crate::config::Config;
use crate::error::AppError;

const PRESIGN_EXPIRY: Duration = Duration::from_secs(24 * 60 * 60);

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

    pub async fn upload(&self, bytes: Vec<u8>) -> Result<UploadResult, AppError> {
        if bytes.len() < 5 || &bytes[..5] != b"%PDF-" {
            return Err(AppError::BadRequest("Not a valid PDF file".into()));
        }

        let id = Uuid::new_v4().to_string();
        let key = format!("uploads/{id}.pdf");

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
}
