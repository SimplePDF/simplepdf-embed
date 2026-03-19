use axum::extract::{ConnectInfo, FromRequest, Multipart, Query, State};
use axum::http::header;
use axum::response::{IntoResponse, Json};
use axum::routing::get;
use axum::Router;
use serde::{Deserialize, Serialize};
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;

use crate::error::AppError;
use crate::AppState;

const SKILL_MD: &str = include_str!("../SKILL.md");

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(handle_get).post(handle_upload))
        .route("/health", get(|| async { "ok" }))
}

#[derive(Deserialize)]
struct GetQuery {
    url: Option<String>,
    #[serde(rename = "companyIdentifier")]
    company_identifier: Option<String>,
}

#[derive(Deserialize)]
struct UploadQuery {
    #[serde(rename = "companyIdentifier")]
    company_identifier: Option<String>,
}

#[derive(Serialize)]
struct AgentResponse {
    id: String,
    url: String,
    iframe: String,
    react: String,
}

impl AgentResponse {
    fn new(id: String, pdf_url: &str, editor_base: &str, company_identifier: Option<&str>) -> Self {
        let encoded_pdf_url = url_encode(pdf_url);
        let url = format!("{editor_base}/editor?open={encoded_pdf_url}");
        let escaped_url = escape_html(&url);
        let iframe = format!(
            r#"<iframe src="{escaped_url}" width="100%" height="800" frameborder="0"></iframe>"#
        );
        let escaped_pdf_url = escape_html(pdf_url);
        let react = match company_identifier {
            Some(id) => {
                let escaped_id = escape_html(id);
                format!(
                    r#"<EmbedPDF mode="inline" companyIdentifier="{escaped_id}" documentURL="{escaped_pdf_url}" />"#
                )
            }
            None => format!(r#"<EmbedPDF mode="inline" documentURL="{escaped_pdf_url}" />"#),
        };

        Self {
            id,
            url,
            iframe,
            react,
        }
    }
}

async fn handle_get(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Query(query): Query<GetQuery>,
    request: axum::extract::Request,
) -> Result<axum::response::Response, AppError> {
    let pdf_url = match query.url {
        None => {
            return Ok((
                [(header::CONTENT_TYPE, "text/markdown; charset=utf-8")],
                SKILL_MD,
            )
                .into_response());
        }
        Some(url) => url,
    };

    let ip = client_ip(&request, addr.ip(), state.config.trust_proxy);
    if !state.rate_limiter.check(ip) {
        return Err(AppError::RateLimited);
    }

    if !is_valid_url(&pdf_url) {
        return Err(AppError::BadRequest(
            "url must start with http:// or https://".into(),
        ));
    }

    let company_identifier = validate_company_identifier(query.company_identifier.as_deref())?;
    let editor_base = state.config.editor_base_url(company_identifier);

    Ok(Json(AgentResponse::new(
        "url-passthrough".into(),
        &pdf_url,
        &editor_base,
        company_identifier,
    ))
    .into_response())
}

async fn handle_upload(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Query(query): Query<UploadQuery>,
    request: axum::extract::Request,
) -> Result<Json<AgentResponse>, AppError> {
    let ip = client_ip(&request, addr.ip(), state.config.trust_proxy);
    if !state.rate_limiter.check(ip) {
        return Err(AppError::RateLimited);
    }

    let company_identifier = validate_company_identifier(query.company_identifier.as_deref())?;
    let editor_base = state.config.editor_base_url(company_identifier);

    let multipart = Multipart::from_request(request, &state)
        .await
        .map_err(|_| {
            AppError::BadRequest("Expected multipart/form-data with a 'file' field".into())
        })?;
    let pdf_bytes = extract_multipart(multipart).await?;
    let result = state.storage.upload(pdf_bytes).await?;

    Ok(Json(AgentResponse::new(
        result.id,
        &result.public_url,
        &editor_base,
        company_identifier,
    )))
}

async fn extract_multipart(mut multipart: Multipart) -> Result<Vec<u8>, AppError> {
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

    Err(AppError::BadRequest(
        "No 'file' field in multipart upload".into(),
    ))
}

fn client_ip(request: &axum::extract::Request, fallback: IpAddr, trust_proxy: bool) -> IpAddr {
    if !trust_proxy {
        return fallback;
    }

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

fn escape_html(input: &str) -> String {
    let mut escaped = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&#x27;"),
            _ => escaped.push(ch),
        }
    }
    escaped
}

fn is_valid_subdomain(identifier: &str) -> bool {
    !identifier.is_empty()
        && identifier.len() <= 63
        && identifier
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-')
        && !identifier.starts_with('-')
        && !identifier.ends_with('-')
}

fn is_valid_url(url: &str) -> bool {
    url.starts_with("https://") || url.starts_with("http://")
}

fn validate_company_identifier(identifier: Option<&str>) -> Result<Option<&str>, AppError> {
    match identifier {
        Some(id) if !is_valid_subdomain(id) => Err(AppError::BadRequest(
            "companyIdentifier must be alphanumeric with hyphens (max 63 chars)".into(),
        )),
        other => Ok(other),
    }
}
