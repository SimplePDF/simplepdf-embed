use axum::extract::{ConnectInfo, Multipart, State};
use axum::response::Json;
use axum::routing::post;
use axum::Router;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;

use crate::error::AppError;
use crate::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/agents", post(handle_agents))
        .route("/health", axum::routing::get(|| async { "ok" }))
}

#[derive(Deserialize)]
struct UrlInput {
    url: String,
}

#[derive(Serialize)]
struct AgentResponse {
    id: String,
    url: String,
    iframe: String,
    react: String,
}

/// POST /agents
/// Accepts either:
///   - JSON body: { "url": "https://..." }
///   - Multipart form: file field with PDF binary
///
/// Returns embed codes for the editor.
async fn handle_agents(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    request: axum::extract::Request,
) -> Result<Json<AgentResponse>, AppError> {
    if !state.rate_limiter.check(addr.ip()) {
        return Err(AppError::RateLimited);
    }

    let content_type = request
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let pdf_bytes = if content_type.starts_with("multipart/form-data") {
        extract_multipart(request).await?
    } else {
        let body = axum::body::to_bytes(request.into_body(), 1024 * 64)
            .await
            .map_err(|_| AppError::BadRequest("Invalid request body".into()))?;

        let input: UrlInput = serde_json::from_slice(&body)
            .map_err(|_| AppError::BadRequest("Expected JSON with 'url' field or multipart upload".into()))?;

        fetch_pdf(&input.url).await?
    };

    let result = state.storage.upload(pdf_bytes).await?;
    let base = &state.config.simplepdf_url;

    let url = format!("{base}/editor?open={}", result.public_url);
    let iframe = format!(
        r#"<iframe src="{url}" width="100%" height="800" frameborder="0"></iframe>"#
    );
    let react = format!(r#"<SimplePDF src="{}" />"#, result.public_url);

    Ok(Json(AgentResponse {
        id: result.id,
        url,
        iframe,
        react,
    }))
}

async fn extract_multipart(request: axum::extract::Request) -> Result<Vec<u8>, AppError> {
    let mut multipart = Multipart::from_request(request, &())
        .await
        .map_err(|_| AppError::BadRequest("Invalid multipart data".into()))?;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| AppError::BadRequest("Failed to read multipart field".into()))?
    {
        if field.name() == Some("file") {
            let bytes = field
                .bytes()
                .await
                .map_err(|_| AppError::BadRequest("Failed to read file".into()))?;
            return Ok(bytes.to_vec());
        }
    }

    Err(AppError::BadRequest("No 'file' field in multipart upload".into()))
}

async fn fetch_pdf(url: &str) -> Result<Vec<u8>, AppError> {
    let response = reqwest::get(url)
        .await
        .map_err(|e| AppError::FetchFailed(format!("Failed to fetch URL: {e}")))?;

    if !response.status().is_success() {
        return Err(AppError::FetchFailed(format!(
            "URL returned status {}",
            response.status()
        )));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| AppError::FetchFailed(format!("Failed to read response: {e}")))?;

    if bytes.len() > 50 * 1024 * 1024 {
        return Err(AppError::BadRequest("PDF exceeds 50MB limit".into()));
    }

    Ok(bytes.to_vec())
}
