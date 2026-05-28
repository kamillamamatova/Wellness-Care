# Wellness Care

Quality Wellness Care website with a small Node backend for assisted care assessment requests.

## Run locally

```sh
npm start
```

Then open `http://localhost:3000`.

## Email setup

Create a `.env` file or export these environment variables before running the server:

```sh
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
CONTACT_EMAIL_TO=contact@qualitywellnesscare.com
CONTACT_EMAIL_FROM=your-smtp-username
```

Then run:

```sh
npm start
```

For Gmail, use `smtp.gmail.com`, port `587`, `SMTP_SECURE=false`, your Gmail address as `SMTP_USER`, and a Google App Password as `SMTP_PASS`.

## Backend

- `GET /` and other page/assets requests serve the static frontend.
- `POST /api/assessments` accepts contact form submissions from the homepage and contact page, then emails them when SMTP is configured.
- Submissions are stored locally in `data/submissions.jsonl`.

For a production launch, use an SMTP account or email service approved for your business needs.
