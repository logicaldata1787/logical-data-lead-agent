# logical-data-lead-agent

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
| `GET /api/email-settings` | `configured` reflects real SMTP vars | `configured: true` always; `demo: true` added |
| `POST /api/email-settings/test` | Sends real email via SMTP | Returns `{ ok: true, demo: true }` — **no SMTP call** |
| Server log | Normal | Prints `DEMO_MODE: simulated email send | to="..." subject="..."` |

### Disabling Demo Mode for production

Remove the `DEMO_MODE` variable (or set it to `false`) before going live.  
**Never** leave `DEMO_MODE=true` in production — it will silently skip all real email sends.
