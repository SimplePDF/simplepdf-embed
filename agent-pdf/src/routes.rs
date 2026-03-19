use axum::extract::{ConnectInfo, Multipart, State};
use axum::response::Json;
use axum::routing::{get, post};
use axum::Router;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;

use crate::error::AppError;
use crate::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/agents", post(handle_agents))
        .route("/health", get(|| async { "ok" }))
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

impl AgentResponse {
    fn new(id: String, pdf_url: &str, simplepdf_base: &str) -> Self {
        let url = format!("{simplepdf_base}/editor?open={pdf_url}");
        let iframe = format!(
            r#"<iframe src="{url}" width="100%" height="800" frameborder="0"></iframe>"#
        );
        let react = format!(r#"<SimplePDF src="{pdf_url}" />"#);

        Self {
            id,
            url,
            iframe,
            react,
        }
    }
}

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

    let base = &state.config.simplepdf_url;

    if content_type.starts_with("multipart/form-data") {
        let pdf_bytes = extract_multipart(request).await?;
        let result = state.storage.upload(pdf_bytes).await?;

        Ok(Json(AgentResponse::new(result.id, &result.public_url, base)))
    } else {
        let body = axum::body::to_bytes(request.into_body(), 1024 * 1024)
            .await
            .map_err(|_| AppError::BadRequest("Invalid request body".into()))?;

        let input: UrlInput = serde_json::from_slice(&body)
            .map_err(|_| {
                AppError::BadRequest("Expected JSON with 'url' field or multipart upload".into())
            })?;

        Ok(Json(AgentResponse::new("url-passthrough".into(), &input.url, base)))
    }
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
