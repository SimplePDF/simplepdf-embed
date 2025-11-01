const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000;

const getCompanyIdentifier = (env) => {
  return env.COMPANY_IDENTIFIER ?? "webhooks-playground";
};

const pruneOldSubmissions = async (env) => {
  console.log("Starting pruning process...");
  const fifteenMinutesAgo = Date.now() - FIFTEEN_MINUTES_IN_MS;

  const listResult = await env.SIMPLEPDF_WEBHOOKS_KV.list();
  const keys = listResult.keys;

  console.log(`Found ${keys.length} submissions to check...`);

  for (const key of keys) {
    if (!key.name.startsWith("submission:")) continue;

    const eventJson = await env.SIMPLEPDF_WEBHOOKS_KV.get(key.name);
    if (!eventJson) continue;

    const event = JSON.parse(eventJson);
    const submittedAtUTC = Date.parse(event.data.submission.submitted_at);

    if (submittedAtUTC < fifteenMinutesAgo) {
      console.log("Pruning submission", JSON.stringify(event.data.submission));
      await env.SIMPLEPDF_WEBHOOKS_KV.delete(key.name);
    }
  }
};

const getAllEvents = async (env) => {
  const listResult = await env.SIMPLEPDF_WEBHOOKS_KV.list({ prefix: "submission:" });
  const events = [];

  for (const key of listResult.keys) {
    const eventJson = await env.SIMPLEPDF_WEBHOOKS_KV.get(key.name);
    if (eventJson) {
      events.push(JSON.parse(eventJson));
    }
  }

  return events;
};

const renderHTML = (viewType, params) => {
  const baseLayout = (title, description, content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">

  <!-- Favicon -->
  <link rel="icon" href="/favicon.ico" type="image/x-icon">
  <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon">

  <!-- Open Graph / Social Media -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="https://cdn.simplepdf.com/simple-pdf/assets/help/meta-webhooks-configuration-simplepdf-form-submissions.png">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="https://cdn.simplepdf.com/simple-pdf/assets/help/meta-webhooks-configuration-simplepdf-form-submissions.png">

  <!-- Google Fonts - Inter -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --primary: rgb(54, 101, 225);
      --secondary: rgb(41, 220, 167);
    }
    body {
      font-family: 'Inter', sans-serif;
    }
    .title-gradient {
      font-size: 80px;
      font-weight: 700;
      line-height: 1.06;
      letter-spacing: -4px;
      background-image: linear-gradient(282deg, #6a6d85, #0c0f23);
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .bg-primary { background-color: var(--primary); }
    .text-primary { color: var(--primary); }
    .border-primary { border-color: var(--primary); }
    .bg-secondary { background-color: var(--secondary); }
    .text-secondary { color: var(--secondary); }
    .hover\:bg-primary-dark:hover { background-color: rgb(44, 84, 186); }
    .hover\:text-primary-dark:hover { color: rgb(44, 84, 186); }
  </style>
</head>
<body class="min-h-screen p-4" style="background-color: #f3f7fa;">
  <div class="max-w-7xl mx-auto">
    ${content}
  </div>
</body>
</html>
  `;

  switch (viewType) {
    case "home": {
      const { events, companyIdentifier } = params;
      const sortedEvents = events.sort((eventA, eventB) => {
        const dateA = new Date(eventA.data.submission.submitted_at);
        const dateB = new Date(eventB.data.submission.submitted_at);
        return dateB.getTime() - dateA.getTime();
      });

      const submissionsRows = sortedEvents
        .map(
          (event) => `
          <tr class="border-b hover:bg-blue-50 transition-colors">
            <td class="px-6 py-4"><a href="/submissions/${event.data.submission.id}" class="text-primary hover:text-primary-dark underline font-medium">View submission</a></td>
            <td class="px-6 py-4">${event.data.document.name}</td>
            <td class="px-6 py-4">${event.data.submission.submitted_at}</td>
            <td class="px-6 py-4"><code class="text-xs bg-gray-100 px-2 py-1 rounded">${JSON.stringify(event.data.context)}</code></td>
          </tr>
        `
        )
        .join("");

      const content = `
        <div class="mb-8">
          <h1 class="title-gradient mb-4 py-6">SimplePDF Webhooks Demo</h1>

          <div class="rounded-lg p-6 mb-6" style="background-color: rgba(41, 220, 167, 0.1); border: 1px solid rgb(41, 220, 167);">
            <p class="text-gray-700 mb-2">
              <strong class="text-secondary text-lg">Try it yourself:</strong> Submit a document at
              <a href="https://${companyIdentifier}.simplepdf.com/editor" target="_blank" class="text-primary hover:text-primary-dark underline font-medium">https://${companyIdentifier}.simplepdf.com/editor</a>
              and watch it appear below in real-time.
            </p>
            <p class="text-gray-600 text-sm mb-3">
              All submissions from the last 15 minutes are displayed here, and you can view each one using SimplePDF's viewer.
            </p>
            <p class="text-gray-600 italic text-sm">
              You can also test webhooks by using <code class="px-2 py-1 rounded" style="background-color: rgba(16, 185, 129, 0.15);">webhooks-playground</code> as the company identifier in the
              <a href="https://github.com/SimplePDF/simplepdf-embed/blob/main/react/README.md" target="_blank" class="text-primary hover:text-primary-dark underline">React</a> and
              <a href="https://github.com/SimplePDF/simplepdf-embed/tree/main/web" target="_blank" class="text-primary hover:text-primary-dark underline">Web</a> integrations.
            </p>
          </div>

          <div class="bg-white rounded-lg p-6 mb-6" style="border: 1px solid #e5e7eb;">
            <p class="text-gray-700 mb-4">
              This demo shows how easy it is to integrate SimplePDF into your workflow:
            </p>
            <ul class="list-disc list-inside space-y-2 text-gray-700" style="margin: 0;">
              <li><strong class="text-primary">Embed SimplePDF</strong> anywhere - your website, a direct link, or an iframe</li>
              <li><strong class="text-primary">Get instant notifications</strong> via webhooks whenever someone submits a document</li>
              <li><strong class="text-primary">Access complete submission data</strong> including document details, timestamps, and custom context</li>
            </ul>
          </div>
          <div class="flex gap-4 mb-6">
            <a href="https://github.com/SimplePDF/simplepdf-embed/tree/main/examples/webhooks" target="_blank" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark font-medium transition-colors">View source code</a>
            <a href="https://simplepdf.com/help/how-to/configure-webhooks-pdf-form-submissions" target="_blank" class="bg-white text-primary px-4 py-2 rounded-lg font-medium" style="border: 1px solid rgb(54, 101, 225);">Webhooks documentation</a>
          </div>
        </div>

        <h3 class="text-lg font-semibold mb-3 text-primary">Recent Submissions (Last 15 minutes)</h3>
        <div class="bg-white rounded-lg" style="border: 1px solid #e5e7eb;">
          <table class="w-full text-left text-sm font-light">
            <thead class="bg-primary text-white font-medium">
              <tr>
                <th class="px-6 py-4">Submission</th>
                <th class="px-6 py-4">Document</th>
                <th class="px-6 py-4">Submitted at</th>
                <th class="px-6 py-4">Submission context</th>
              </tr>
            </thead>
            <tbody>
              ${submissionsRows}
            </tbody>
          </table>
        </div>
      `;

      return baseLayout(
        "SimplePDF Webhooks Demo - Real-Time PDF Form Submission Notifications & Integration",
        "See SimplePDF webhooks in action with live PDF form submissions. Learn how to integrate instant webhook notifications for document submissions into your website. View real-time webhook data, embed SimplePDF forms, and automate your PDF workflow with our easy-to-use API.",
        content
      );
    }

    case "submission": {
      const { submission } = params;
      const content = `
        <div class="mb-6">
          <a href="/" class="text-primary hover:text-primary-dark underline font-medium">&larr; Back to all submissions</a>
        </div>

        <div class="mb-6">
          <h1 class="text-2xl font-bold mb-3 text-primary">Submission Details</h1>
          <p class="text-gray-600">
            This is the data your webhook received when this document was submitted. Below, you can view the actual submitted PDF using SimplePDF's viewer embedded right here.
          </p>
        </div>

        <table class="w-full text-left text-sm font-light mb-6 bg-white rounded-lg overflow-hidden" style="border: 1px solid #e5e7eb;">
          <thead class="bg-primary text-white font-medium">
            <tr>
              <th class="px-6 py-4">Document</th>
              <th class="px-6 py-4">Document ID</th>
              <th class="px-6 py-4">Submission ID</th>
              <th class="px-6 py-4">Submitted at</th>
              <th class="px-6 py-4">Submission context</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="px-6 py-4 font-medium">${submission.data.document.name}</td>
              <td class="px-6 py-4 text-gray-600">${submission.data.document.id}</td>
              <td class="px-6 py-4 text-gray-600">${submission.data.submission.id}</td>
              <td class="px-6 py-4">${submission.data.submission.submitted_at}</td>
              <td class="px-6 py-4"><code class="text-xs bg-gray-100 px-2 py-1 rounded">${JSON.stringify(submission.data.context)}</code></td>
            </tr>
          </tbody>
        </table>

        <div class="bg-white rounded-lg p-6 mb-4" style="border: 1px solid #e5e7eb;">
          <h2 class="text-lg font-semibold mb-2 text-primary">View Submitted Document</h2>
          <p class="text-gray-600 text-sm mb-4">
            The SimplePDF viewer is embedded below, showing the exact document that was submitted. This demonstrates how you can integrate document viewing directly into your own application.
          </p>
        </div>

        <div class="mt-6">
          <iframe
            src="https://viewer.simplepdf.com/editor?open=${encodeURIComponent(submission.data.submission.url)}"
            class="w-full h-[900px] rounded-lg"
            style="border: 1px solid #e5e7eb;"
          ></iframe>
        </div>
      `;

      return baseLayout(
        `SimplePDF - PDF Submission Details | ${submission.data.document.name}`,
        "View complete webhook payload data and submitted PDF document details. This example demonstrates how SimplePDF webhooks deliver real-time form submission notifications with full document metadata, timestamps, and embedded viewer integration.",
        content
      );
    }

    default:
      throw new Error(`Unknown view type: ${viewType}`);
  }
};

const handleRequest = async (request, env) => {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/" && request.method === "GET") {
    const events = await getAllEvents(env);
    const companyIdentifier = getCompanyIdentifier(env);
    return new Response(
      renderHTML("home", { events, companyIdentifier }),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (path.startsWith("/submissions/") && request.method === "GET") {
    const submissionId = path.split("/submissions/")[1];
    const events = await getAllEvents(env);
    const matchingSubmission = events.find(
      (event) => event.data.submission.id === submissionId
    );

    if (!matchingSubmission) {
      return new Response("Not Found", { status: 404 });
    }

    return new Response(
      renderHTML("submission", { submission: matchingSubmission }),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (path === "/webhooks" && request.method === "POST") {
    await pruneOldSubmissions(env);
    const body = await request.json();
    const eventType = body.type;

    switch (eventType) {
      case "submission.created":
        const submissionId = body.data.submission.id;
        await env.SIMPLEPDF_WEBHOOKS_KV.put(
          `submission:${submissionId}`,
          JSON.stringify(body)
        );
        return new Response(null, { status: 200 });
      default:
        console.log(`Unhandled event type: ${eventType}`);
        return new Response(null, { status: 200 });
    }
  }

  if (path === "/flush" && request.method === "GET") {
    const listResult = await env.SIMPLEPDF_WEBHOOKS_KV.list({ prefix: "submission:" });
    for (const key of listResult.keys) {
      await env.SIMPLEPDF_WEBHOOKS_KV.delete(key.name);
    }
    return new Response(null, {
      status: 302,
      headers: { Location: "/" },
    });
  }

  return new Response("Not Found", { status: 404 });
};

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  },

  async scheduled(event, env, ctx) {
    console.log("Running scheduled cleanup...");
    await pruneOldSubmissions(env);
  },
};
