const express = require("express");
const app = express();

const events = [];

const port = process.env.PORT ?? "8080";
const companyIdentifier =
  process.env.COMPANY_IDENTIFIER ?? "webhooks-playground";

const pruneOldSubmissions = () => {
  console.log(`Going through ${events.length} submissions...`)
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;

  for (let i = events.length - 1; i >= 0; i--) {
    const submission = events[i].data;

    const submittedAtUTC = Date.parse(submission.submitted_at);

    if (isNaN(submittedAtUTC) || submittedAtUTC < fifteenMinutesAgo) {
      console.log("Pruning submission", JSON.stringify(submission))
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
    <style>
      body {
        font-family: helvetica, sans-serif;
      }
      table {
        border-collapse: collapse;
        width: 100%;
      }

      td, th {
        border: 1px solid #dddddd;
        text-align: left;
        padding: 8px;
      }

      tr:nth-child(even) {
        background-color: #dddddd;
      }
      </style>
    </head>
    <body>
      <h3>Any PDF submitted through
        <a href="https://${companyIdentifier}.simplepdf.com/editor" target="_blank">https://${companyIdentifier}.simplepdf.com/editor</a> will appear below
      </h3>
      <a href="https://github.com/SimplePDF/simplepdf-embed/tree/main/examples/webhooks">Link to the code</a>
      <p><i>Submissions URLs are valid for 15min</i></p>
      <table>
        <tr>
          <th>Submission URL</th>
          <th>Document</th>
          <th>Document ID</th>
          <th>Submission ID</th>
          <th>Submitted at</th>
          <th>Submission context</th>
        </tr>
        ${events
          .map(
            (event) =>
              `
            <tr>
            <td><a href="/submissions/${event.data.submission.id}">URL</a></td>
            <td>${event.data.document.name}</td>
            <td>${event.data.document.id}</td>
            <td>${event.data.submission.id}</td>
            <td>${event.data.submission.submitted_at}</td>
            <td><code>${JSON.stringify(event.data.context)}</code></td>
            </tr>
            `
          )
          .join("")}
      </table>
    </body>
  </html>
  `);
});

app.get("/submissions/:submissionId", (req, res) => {
  const matchingSubmission = events.find(
    (event) => event.data.submission.id === req.params.submissionId
  );

  if (!matchingSubmission) {
    return res.status(404);
  }

  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <style>
      body {
        font-family: helvetica, sans-serif;
      }
      table {
        font-family: arial, sans-serif;
        border-collapse: collapse;
        width: 100%;
      }

      td, th {
        border: 1px solid #dddddd;
        text-align: left;
        padding: 8px;
      }

      tr:nth-child(even) {
        background-color: #dddddd;
      }
      </style>
    </head>
    <body>
      <table>
        <tr>
          <th>Document</th>
          <th>Document ID</th>
          <th>Submission ID</th>
          <th>Submitted at</th>
          <th>Submission context</th>
        </tr>
        <tr>
          <td>${matchingSubmission.data.document.name}</td>
          <td>${matchingSubmission.data.document.id}</td>
          <td>${matchingSubmission.data.submission.id}</td>
          <td>${matchingSubmission.data.submission.submitted_at}</td>
          <td><code>${JSON.stringify(
            matchingSubmission.data.context
          )}</code></td>
        </tr>
      </table>
      <iframe src=https://viewer.simplepdf.com/editor?open=${encodeURIComponent(
        matchingSubmission.data.submission.url
      )} width="100%" height="900px"/>
    </body>
  </html>
  `);
});

app.post("/webhooks", (req, res) => {
  pruneOldSubmissions()
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

app.listen(port);
