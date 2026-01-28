/**
 * SimplePDF MCP App
 *
 * Interactive PDF editor using SimplePDF iframe embed.
 * - Uses SimplePDF's iframe API for PDF viewing and annotation
 * - Listens to iframe events (EDITOR_READY, DOCUMENT_LOADED, PAGE_FOCUSED)
 * - Updates model context with current page info
 */
import {
  App,
  type McpUiHostContext,
  applyDocumentTheme,
  applyHostStyleVariables,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./global.css";
import "./mcp-app.css";

const SIMPLEPDF_EMBED_ORIGIN = "https://embed.simplepdf.com";

const log = {
  info: console.log.bind(console, "[SIMPLEPDF]"),
  error: console.error.bind(console, "[SIMPLEPDF]"),
};

// State
let pdfUrl = "";
let currentPage = 1;
let totalPages = 0;
let documentId: string | null = null;

// DOM Elements
const mainEl = document.querySelector(".main") as HTMLElement;
const loadingEl = document.getElementById("loading")!;
const errorEl = document.getElementById("error")!;
const errorMessageEl = document.getElementById("error-message")!;
const editorEl = document.getElementById("editor")!;
const iframeEl = document.getElementById(
  "simplepdf-iframe",
) as HTMLIFrameElement;

// Track current display mode
let currentDisplayMode: "inline" | "fullscreen" = "inline";

// Create app instance
const app = new App(
  { name: "SimplePDF Editor", version: "1.0.0" },
  {},
  { autoResize: false },
);

// UI State functions
const showError = (message: string): void => {
  errorMessageEl.textContent = message;
  loadingEl.style.display = "none";
  errorEl.style.display = "block";
  editorEl.style.display = "none";
};

const showEditor = (): void => {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  editorEl.style.display = "flex";
};

// Update model context with current document state
const updateModelContext = (): void => {
  const toolId = app.getHostContext()?.toolInfo?.id;
  const header = [
    `SimplePDF editor${toolId ? ` (${toolId})` : ""}`,
    `URL: ${pdfUrl}`,
    `Page: ${currentPage}/${totalPages}`,
  ].join(" | ");

  const contextText = `${header}\n\nDocument loaded in SimplePDF editor. Use postMessage API for programmatic control.`;

  app.updateModelContext({ content: [{ type: "text", text: contextText }] });
};

// Handle messages from SimplePDF iframe
const handleIframeMessage = (event: MessageEvent): void => {
  if (event.origin !== SIMPLEPDF_EMBED_ORIGIN) {
    return;
  }

  try {
    const payload = JSON.parse(event.data);
    log.info("Iframe event:", payload.type, payload.data);

    switch (payload.type) {
      case "EDITOR_READY":
        log.info("SimplePDF editor ready");
        break;

      case "DOCUMENT_LOADED":
        documentId = payload.data?.document_id ?? null;
        log.info("Document loaded:", documentId);
        showEditor();
        updateModelContext();
        break;

      case "PAGE_FOCUSED":
        currentPage = payload.data?.current_page ?? 1;
        totalPages = payload.data?.total_pages ?? 0;
        log.info("Page focused:", currentPage, "/", totalPages);
        updateModelContext();
        break;

      case "SUBMISSION_SENT":
        log.info(
          "Submission sent:",
          payload.data?.submission_id,
          "for document:",
          payload.data?.document_id,
        );
        break;
    }
  } catch {
    // Ignore non-JSON messages
  }
};

// Parse tool result
const parseToolResult = (
  result: CallToolResult,
): { url: string; page: number } | null => {
  return result.structuredContent as { url: string; page: number } | null;
};

// Handle tool result (load_pdf invocation)
app.ontoolresult = (result): void => {
  log.info("Received tool result:", result);

  const parsed = parseToolResult(result);
  if (!parsed) {
    showError("Invalid tool result");
    return;
  }

  pdfUrl = parsed.url;
  currentPage = parsed.page;
  totalPages = 0;
  documentId = null;

  log.info("Loading PDF:", pdfUrl, "starting at page:", currentPage);

  // Construct SimplePDF iframe URL with page parameter
  const encodedUrl = encodeURIComponent(pdfUrl);
  const iframeSrc = `${SIMPLEPDF_EMBED_ORIGIN}/editor?open=${encodedUrl}&page=${currentPage}`;

  log.info("Setting iframe src:", iframeSrc);
  iframeEl.src = iframeSrc;

  // Show editor immediately - don't wait for iframe events
  // (iframe events may not reach us due to origin restrictions in MCP app context)
  showEditor();
  updateModelContext();
};

app.onerror = (error): void => {
  log.error("App error:", error);
  showError(error instanceof Error ? error.message : String(error));
};

const handleHostContextChanged = (ctx: McpUiHostContext): void => {
  log.info("Host context changed:", ctx);

  // Apply theme from host
  if (ctx.theme) {
    applyDocumentTheme(ctx.theme);
  }

  // Apply host CSS variables
  if (ctx.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
  }

  // Apply safe area insets
  if (ctx.safeAreaInsets) {
    mainEl.style.paddingTop = `${ctx.safeAreaInsets.top}px`;
    mainEl.style.paddingRight = `${ctx.safeAreaInsets.right}px`;
    mainEl.style.paddingBottom = `${ctx.safeAreaInsets.bottom}px`;
    mainEl.style.paddingLeft = `${ctx.safeAreaInsets.left}px`;
  }

  // Handle display mode changes
  if (ctx.displayMode) {
    currentDisplayMode = ctx.displayMode as "inline" | "fullscreen";
    mainEl.classList.toggle("fullscreen", currentDisplayMode === "fullscreen");
    log.info(
      currentDisplayMode === "fullscreen"
        ? "Fullscreen mode enabled"
        : "Inline mode",
    );
  }
};

app.onhostcontextchanged = handleHostContextChanged;

// Set up iframe message listener
window.addEventListener("message", handleIframeMessage);

// Connect to host
app.connect().then(() => {
  log.info("Connected to host");
  const ctx = app.getHostContext();
  if (ctx) {
    handleHostContextChanged(ctx);
  }
});
