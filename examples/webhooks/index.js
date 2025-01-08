const express = require("express");

const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000;
const app = express();

const events = [];

const port = process.env.PORT ?? "8080";
const companyIdentifier =
  process.env.COMPANY_IDENTIFIER ?? "webhooks-playground";

setInterval(() => {
  pruneOldSubmissions();
}, FIFTEEN_MINUTES_IN_MS);

const pruneOldSubmissions = () => {
  console.log(`Going through ${events.length} submissions...`);
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;

  for (let i = events.length - 1; i >= 0; i--) {
    const submission = events[i].data.submission;

    const submittedAtUTC = Date.parse(submission.submitted_at);

    if (submittedAtUTC < fifteenMinutesAgo) {
      console.log("Pruning submission", JSON.stringify(submission));
      events.splice(i, 1);
    }
  }
};

app.use(express.json());

app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>PDF Submissions</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="font-sans bg-gray-100 min-h-screen p-4">
    <div class="max-w-4xl mx-auto">
      <h3 class="text-xl font-semibold mb-4">
        Any PDF submitted through
        <a href="https://${companyIdentifier}.simplepdf.com/editor" target="_blank" class="text-blue-600 hover:text-blue-800 underline">https://${companyIdentifier}.simplepdf.com/editor</a> will appear below
      </h3>
      <a href="https://github.com/SimplePDF/simplepdf-embed/tree/main/examples/webhooks" class="text-blue-600 hover:text-blue-800 underline mb-4 block">Link to the code</a>
      <table class="w-full text-left text-sm font-light">
        <thead class="border-b font-medium bg-gray-200">
          <tr>
            <th class="px-6 py-4">Submission URL</th>
            <th class="px-6 py-4">Document</th>
            <th class="px-6 py-4">Document ID</th>
            <th class="px-6 py-4">Submission ID</th>
            <th class="px-6 py-4">Submitted at</th>
            <th class="px-6 py-4">Submission context</th>
          </tr>
        </thead>
        <tbody>
          ${events
            .map(
              (event) => `
                <tr class="bg-white border-b">
                  <td class="px-6 py-4"><a href="/submissions/${event.data.submission.id}" class="text-blue-600 hover:text-blue-800 underline">URL</a></td>
                  <td class="px-6 py-4">${event.data.document.name}</td>
                  <td class="px-6 py-4">${event.data.document.id}</td>
                  <td class="px-6 py-4">${event.data.submission.id}</td>
                  <td class="px-6 py-4">${event.data.submission.submitted_at}</td>
                  <td class="px-6 py-4"><code class="text-xs">${JSON.stringify(event.data.context)}</code></td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  </body>
  </html>
  `);
});

app.get("/submissions/:submissionId", (req, res) => {
  const matchingSubmission = events.find(
    (event) => event.data.submission.id === req.params.submissionId,
  );

  if (!matchingSubmission) {
    return res.status(404);
  }

  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Document Details</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="font-sans bg-gray-100 min-h-screen p-4">
    <div class="max-w-4xl mx-auto">
      <table class="w-full text-left text-sm font-light">
        <thead class="border-b font-medium bg-gray-200">
          <tr>
            <th class="px-6 py-4">Document</th>
            <th class="px-6 py-4">Document ID</th>
            <th class="px-6 py-4">Submission ID</th>
            <th class="px-6 py-4">Submitted at</th>
            <th class="px-6 py-4">Submission context</th>
          </tr>
        </thead>
        <tbody>
          <tr class="bg-white border-b">
            <td class="px-6 py-4 font-medium">${matchingSubmission.data.document.name}</td>
            <td class="px-6 py-4">${matchingSubmission.data.document.id}</td>
            <td class="px-6 py-4">${matchingSubmission.data.submission.id}</td>
            <td class="px-6 py-4">${matchingSubmission.data.submission.submitted_at}</td>
            <td class="px-6 py-4"><code class="text-xs">${JSON.stringify(matchingSubmission.data.context)}</code></td>
          </tr>
        </tbody>
      </table>
      <div class="mt-6">
        <iframe
          src="https://viewer.simplepdf.com/editor?open=${encodeURIComponent(matchingSubmission.data.submission.url)}"
          class="w-full h-[900px] border border-gray-300 rounded"
        ></iframe>
      </div>
    </div>
  </body>
  </html>
  `);
});

app.post("/webhooks", (req, res) => {
  pruneOldSubmissions();
  const eventType = req.body.type;
  switch (eventType) {
    case "submission.created":
      events.push(req.body);
      return res.status(200).end();
    default:
      console.log(`Unhandled event type: ${eventType}`);
      return res.status(200).end();
  }
});

app.listen(port, () => console.log(`Listening on port ${port}`));
