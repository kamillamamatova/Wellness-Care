# Wellness Care

Quality Wellness Care website with a small Node backend for assisted care assessment requests.

## Run locally

```sh
npm start
```

Then open `http://localhost:3000`.

## Backend

- `GET /` and other page/assets requests serve the static frontend.
- `POST /api/assessments` accepts contact form submissions from the homepage and contact page.
- Submissions are stored locally in `data/submissions.jsonl`.

For a production launch, connect `POST /api/assessments` to email delivery, a CRM, or a database instead of only local file storage.
