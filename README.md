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
| `PUBLIC_URL` | Public URL of the site, e.g. `https://valuegrid.kesug.com`. Used for links inside emails. Defaults to `http://localhost:3000` |

## Set your domain (production)

1. Set `PUBLIC_URL` to your real domain (e.g. `https://valuegrid.kesug.com`) in your host's
   environment variables (Render dashboard → your service → Environment).
2. The app will use that domain for all links sent in emails instead of `localhost`.


## Deploy

Click the **Deploy to Render** button above, or use the included `render.yaml` blueprint.
