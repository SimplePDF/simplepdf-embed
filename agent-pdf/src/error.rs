use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

#[derive(Debug)]
pub enum AppError {
    /// PDF too large or invalid
    BadRequest(String),
    /// Rate limit exceeded
    RateLimited,
    /// Failed to fetch URL
    FetchFailed(String),
    /// Storage error
    StorageFailed(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::RateLimited => (
                StatusCode::TOO_MANY_REQUESTS,
                "Rate limit exceeded. Try again shortly.".into(),
            ),
            AppError::FetchFailed(msg) => (StatusCode::BAD_GATEWAY, msg.clone()),
            AppError::StorageFailed(msg) => {
                tracing::error!("storage error: {msg}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Upload failed. Try again.".into(),
                )
            }
        };

        let body = axum::Json(json!({ "error": message }));
        (status, body).into_response()
    }
}
