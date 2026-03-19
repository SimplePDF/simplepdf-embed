mod config;
mod error;
mod rate_limit;
mod routes;
mod storage;

use axum::Router;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::limit::RequestBodyLimitLayer;

pub struct AppState {
    pub storage: storage::Storage,
    pub rate_limiter: rate_limit::RateLimiter,
    pub config: config::Config,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let config = config::Config::from_env();
    let storage = storage::Storage::new(&config).await;
    let rate_limiter = rate_limit::RateLimiter::new(config.rate_limit_per_minute);

    let state = Arc::new(AppState {
        storage,
        rate_limiter,
        config,
    });

    tokio::spawn({
        let state = Arc::clone(&state);
        async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(60 * 60));
            interval.tick().await;
            loop {
                interval.tick().await;
                state.storage.cleanup_expired().await;
            }
        }
    });

    let app = Router::new()
        .merge(routes::router())
        .layer(CorsLayer::permissive())
        .layer(RequestBodyLimitLayer::new(50 * 1024 * 1024))
        .with_state(state);

    let addr = "0.0.0.0:8080";
    tracing::info!("listening on {addr}");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}
