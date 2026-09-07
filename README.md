# ValueGrid

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Manthan01-create/ValueGrid)

Full-stack ValueGrid web app (Node.js + Express + Nodemailer).

## Run locally

```bash
npm install
cp .env.example .env   # then fill in SMTP_USER and SMTP_PASS
npm start
```

Open http://localhost:3000

## Environment variables

| Key | Description |
|---|---|
| `SMTP_USER` | Gmail address used to send emails |
| `SMTP_PASS` | Gmail App Password (https://myaccount.google.com/apppasswords) |

## Deploy

Click the **Deploy to Render** button above, or use the included `render.yaml` blueprint.
