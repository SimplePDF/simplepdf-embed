use axum::extract::{ConnectInfo, Multipart, Query, State};
use axum::http::header;
use axum::response::{IntoResponse, Json};
use axum::routing::{get, post};
use axum::Router;
use serde::{Deserialize, Serialize};
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;

use crate::error::AppError;
use crate::AppState;

const SKILL_MD: &str = include_str!("../SKILL.md");

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(serve_skill).post(handle_agents))
        .route("/health", get(|| async { "ok" }))
}

async fn serve_skill() -> impl IntoResponse {
    ([(header::CONTENT_TYPE, "text/markdown; charset=utf-8")], SKILL_MD)
}

fn client_ip(request: &axum::extract::Request, fallback: IpAddr) -> IpAddr {
    request
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .and_then(|v| v.trim().parse::<IpAddr>().ok())
        .unwrap_or(fallback)
}

fn url_encode(input: &str) -> String {
    let mut encoded = String::with_capacity(input.len());
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            _ => {
                encoded.push_str(&format!("%{byte:02X}"));
            }
        }
    }
    encoded
}

#[derive(Deserialize)]
struct AgentsQuery {
    #[serde(rename = "companyIdentifier")]
    company_identifier: Option<String>,
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
    fn new(id: String, pdf_url: &str, editor_base: &str) -> Self {
        let encoded_pdf_url = url_encode(pdf_url);
        let url = format!("{editor_base}/editor?open={encoded_pdf_url}");
        let iframe = format!(
            r#"<iframe src="{url}" width="100%" height="800" frameborder="0"></iframe>"#
        );
        let react = format!(
            r#"<EmbedPDF mode="inline" documentURL="{pdf_url}" />"#
        );

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
    Query(query): Query<AgentsQuery>,
    request: axum::extract::Request,
) -> Result<Json<AgentResponse>, AppError> {
    let ip = client_ip(&request, addr.ip());

    if !state.rate_limiter.check(ip) {
        return Err(AppError::RateLimited);
    }

    let content_type = request
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let editor_base = state
        .config
        .editor_base_url(query.company_identifier.as_deref());

    if content_type.starts_with("multipart/form-data") {
        let pdf_bytes = extract_multipart(request).await?;
        let result = state.storage.upload(pdf_bytes).await?;

        Ok(Json(AgentResponse::new(result.id, &result.public_url, &editor_base)))
    } else {
        let body = axum::body::to_bytes(request.into_body(), 1024 * 1024)
            .await
            .map_err(|_| AppError::BadRequest("Invalid request body".into()))?;

        let input: UrlInput = serde_json::from_slice(&body)
            .map_err(|_| {
                AppError::BadRequest("Expected JSON with 'url' field or multipart upload".into())
            })?;

        Ok(Json(AgentResponse::new("url-passthrough".into(), &input.url, &editor_base)))
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
