# logical-data-lead-agent

## Demo UI

A minimal, framework-free UI is served at the root of the application (`/`).

### How to access

Open your Railway deployment URL in a browser:

```
https://your-app.up.railway.app/
```

### Features

| Section | Description |
|---------|-------------|
| **Status banner** | Fetches `/health` on load and shows service status + a warning banner when Demo Mode is active |
| **API Explorer** | One-click buttons to call `GET /api/leads`, `GET /api/campaigns`, and `GET /api/analytics` — JSON output is displayed inline |
| **Email Test** | Enter any recipient address and click the button to `POST /api/email-settings/test`; shows success or error feedback |

> **Tip:** When `DEMO_MODE=true` the status banner turns yellow and email test calls return `{ ok: true, demo: true }` without hitting a real SMTP server.

## Demo / Simulated Email Send Mode

For presentations or testing without a real SMTP account, you can enable **Demo Mode**.

### How to enable in Railway

In your Railway backend service → **Variables**, add:

```
DEMO_MODE=true
```

Accepted truthy values: `true`, `1`, `yes` (case-insensitive).

### What changes in Demo Mode

| Behaviour | Demo Mode OFF (default) | Demo Mode ON |
|-----------|------------------------|--------------|
| `GET /health` | `{ "status": "UP", "demoMode": false }` | `{ "status": "UP", "demoMode": true }` |
| `GET /api/email-settings` | `configured` reflects real SMTP vars | `configured: true` always; `demo: true` added |
| `POST /api/email-settings/test` | Sends real email via SMTP | Returns `{ ok: true, demo: true }` — **no SMTP call** |
| Server startup log | Normal | Prints `DEMO_MODE: enabled — email sends are simulated` |

### How to verify Demo Mode is active (in your browser)

Open this URL after deploying (replace with your own Railway domain):

```
https://your-app.up.railway.app/health
```

You should see:
```json
{ "status": "UP", "demoMode": true }
```

### Disabling Demo Mode for production

Remove the `DEMO_MODE` variable (or set it to `false`) before going live.  
**Never** leave `DEMO_MODE=true` in production — it will silently skip all real email sends.
