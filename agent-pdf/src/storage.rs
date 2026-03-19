use aws_sdk_s3::Client;
use aws_sdk_s3::primitives::ByteStream;
use uuid::Uuid;

use crate::config::Config;
use crate::error::AppError;

pub struct Storage {
    client: Client,
    bucket: String,
    public_url_prefix: String,
}

/// Result of a successful upload.
pub struct UploadResult {
    pub id: String,
    pub public_url: String,
}

impl Storage {
    pub async fn new(config: &Config) -> Self {
        let creds = aws_sdk_s3::config::Credentials::new(
            std::env::var("SPACES_KEY").expect("SPACES_KEY must be set"),
            std::env::var("SPACES_SECRET").expect("SPACES_SECRET must be set"),
            None,
            None,
            "env",
        );

        let s3_config = aws_sdk_s3::Config::builder()
            .endpoint_url(&config.spaces_endpoint)
            .region(aws_sdk_s3::config::Region::new(
                config.spaces_region.clone(),
            ))
            .credentials_provider(creds)
            .force_path_style(false)
            .build();

        Self {
            client: Client::from_conf(s3_config),
            bucket: config.bucket.clone(),
            public_url_prefix: config.public_url_prefix.clone(),
        }
    }

    /// Upload raw PDF bytes. Returns the file ID and public URL.
    pub async fn upload(&self, bytes: Vec<u8>) -> Result<UploadResult, AppError> {
        // Basic PDF validation: check magic bytes
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
            .acl(aws_sdk_s3::types::ObjectCannedAcl::PublicRead)
            .send()
            .await
            .map_err(|e| AppError::StorageFailed(e.to_string()))?;

        let public_url = format!("{}/{key}", self.public_url_prefix);

        Ok(UploadResult { id, public_url })
    }
}
