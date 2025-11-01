# Webhooks example

[How to configure webhooks to get notified of new PDF form submissions](https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions)

This example showcases the use of a Node.js server to handle incoming webhooks from SimplePDF.

It saves in memory all "`submission.created`" events and surfaces the submission in a table view.

Clicking on each submission URL opens up the SimplePDF viewer for this specific submission

A live demo can be seen here: https://webhooks.simplepdf.com


---


## Deployment Guide

_This guide explains how to deploy the SimplePDF webhooks example to Cloudflare Workers (Free Plan compatible)._

### Prerequisites

- Node.js installed
- Cloudflare account (free plan works)
- Wrangler CLI installed

### Setup Steps

#### 1. Install Dependencies

```bash
npm install
```

#### 2. Login to Cloudflare

```bash
npx wrangler login
```

This will open a browser window to authenticate with your Cloudflare account.

#### 3. Create KV Namespace

Create a KV namespace to store webhook events:

```bash
npx wrangler kv:namespace create "SIMPLEPDF_WEBHOOKS_KV"
```

This will output something like:
```
Created namespace with id "abc123def456"
```

Copy the namespace ID and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "SIMPLEPDF_WEBHOOKS_KV"
id = "YOUR_KV_NAMESPACE_ID"  # Replace with your actual ID
```

#### 4. Configure Environment Variables (Optional)

Edit `wrangler.toml` to customize the company identifier:

```toml
[vars]
COMPANY_IDENTIFIER = "your-company-name"
```

#### 5. Deploy to Cloudflare

```bash
npm run deploy
```

Your worker will be deployed and you'll receive a URL like:
```
https://simplepdf-webhooks.YOUR_SUBDOMAIN.workers.dev
```

### Testing Locally

Run the worker locally for testing:

```bash
npm run dev
```

This will start a local development server at `http://localhost:8787`

### Configuration

#### Cron Schedule

The worker automatically cleans up submissions older than 15 minutes. The cron schedule is configured in `wrangler.toml`:

```toml
[triggers]
crons = ["*/15 * * * *"]  # Runs every 15 minutes
```

#### Environment Variables

Available environment variables in `wrangler.toml`:

- `COMPANY_IDENTIFIER`: Your SimplePDF company identifier (default: "webhooks-playground")

### Differences from Express Version

The Cloudflare Workers version has these key differences:

1. **Storage**: Uses Cloudflare KV instead of in-memory arrays
2. **Cleanup**: Uses Cron Triggers instead of setInterval
3. **Runtime**: Uses Service Worker API instead of Express
4. **Stateless**: Each request is independent, no shared state

### Architecture

#### Request Handling

- `GET /` - Lists all submissions
- `GET /submissions/:id` - View specific submission details
- `POST /webhooks` - Receive webhook events from SimplePDF
- `GET /flush` - Clear all submissions

#### Storage Schema

Events are stored in KV with keys: `submission:{submissionId}`

Each value is a JSON string containing the full webhook event payload.

#### Scheduled Cleanup

A cron trigger runs every 15 minutes to delete submissions older than 15 minutes.