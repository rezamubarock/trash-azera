# Azera OS - Retro Tool Suite & Custom Temporary Email
<!-- Initialized on 2026-07-14 -->


A premium retro-themed web application simulating a vintage desktop operating system (hybrid of Windows 95 and terminal layouts), featuring a collection of useful tools, including a fully functional, self-hosted, 100% free temporary email service (like Mailnesia) running on your domain `azera.biz.id`.

## Features
- **Azera OS Desktop Environment**: Fully featured floating, draggable, focusable, and resizable window system with themes (Classic 95, Fallout Amber, Fallout Green, and Synthwave).
- **Retro PC Sound FX**: Immersive 8-bit sound effects (key clicks, boot chime, warnings) synthesized dynamically via the Web Audio API (no external asset dependencies, zero network requests).
- **Azera Trash Mail**: Temporary email service. Receive raw and HTML formatted emails, view attachments, delete messages, and auto-refresh. Includes a built-in *Demo Mode* fallback that simulates emails for instant previews when a server is not configured.
- **Developer Utilities**:
  - **Text Encoder**: Base64, URL, and ROT13 encoder/decoder.
  - **JSON Beautifier**: Validator, minifier, and indenter.
  - **Pass Generator**: Cryptographically secure PRNG password generator with entropy strength bars.
  - **System Diagnostics**: Device info, active viewport scale, public IP resolver, and connection monitor.
- **Worker Setup Wizard**: Step-by-step integrated documentation to help you deploy your backend.

---

## Technical Stack & Architecture

```
                       +----------------------------------+
                       |       External Email Sender      |
                       +-----------------+----------------+
                                         |
                                         v Sends Email
                       +-----------------+----------------+
                       |    Cloudflare MX DNS Servers     |
                       +-----------------+----------------+
                                         |
                       Catch-all Route   v (e.g. *@azera.biz.id)
                       +-----------------+----------------+
                       |    Cloudflare Email Routing      |
                       +-----------------+----------------+
                                         |
                                         v Sends to Worker
                       +-----------------+----------------+
                       |    Cloudflare Email Worker       |
                       |       (worker/src/index.js)      |
                       +--------+----------------+--------+
                                |                |
             Parses MIME via    |                | Queries DB for API
             "postal-mime"      v                v
                       +--------+---+        +---+--------+
                       |  D1 SQLite |        |  REST API  |
                       |  Database  |        |  End-point |
                       +------------+        +---+--------+
                                                 ^
                                                 | GET /api/inbox
                                                 | (CORS Enabled)
                                                 |
                       +-------------------------+--------+
                       |        Browser Frontend Client   |
                       |  (GitHub Pages - azera.biz.id)   |
                       +----------------------------------+
```

---

## Deployment & Setup Guide

### 1. Backend Setup (Cloudflare Workers + D1)

1. **Create D1 Database**:
   - Go to your Cloudflare Dashboard > **Workers & Pages** > **D1**.
   - Create a database named `azera-mail-db`.
   - Copy the generated **Database ID**.

2. **Configure Wrangler**:
   - Open `/worker/wrangler.toml` in your editor.
   - Replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` with your Database ID.

3. **Deploy & Initialize Schema**:
   - Open a terminal in the `/worker` directory.
   - Run `npm install` to install dependencies (including `postal-mime` and `wrangler`).
   - Log in to your Cloudflare account:
     ```bash
     npx wrangler login
     ```
   - Execute the SQL schema on your remote database to build the tables:
     ```bash
     npx wrangler d1 execute azera-mail-db --remote --file=./schema.sql
     ```
   - Deploy the Worker to Cloudflare:
     ```bash
     npx wrangler deploy
     ```
   - Once successfully deployed, note the Worker URL (e.g., `https://azera-mail-worker.<your-subdomain>.workers.dev`).

### 2. Cloudflare Email Routing Integration

1. Go to your Cloudflare Dashboard and select the domain **azera.biz.id**.
2. Click **Email** > **Email Routing**.
3. Enable Email Routing (Cloudflare will automatically prompt you to insert the required MX and TXT DNS records; click **Add records**).
4. Click **Routing Rules** > **Create Rule**:
   - **Custom Address**: Select **Catch-all** (so any prefix like `anything@azera.biz.id` works).
   - **Action**: Select **Send to Worker**.
   - **Destination Worker**: Choose `azera-mail-worker`.
5. Save the rule.

---

### 3. Frontend Setup (GitHub Pages)

1. Create a repository on GitHub (e.g., `trash-azera`).
2. Push all the root files (including `CNAME`, `index.html`, `style.css`, `app.js`, and `js/` folder) to the repository.
3. In the repository settings on GitHub, navigate to **Pages**:
   - Set **Source** to **Deploy from a branch** and choose your branch (e.g., `main` / `root`).
   - Under **Custom domain**, verify that it shows `azera.biz.id` (since the `CNAME` file is in the root, it should auto-fill).
4. Save and enable HTTPS.

### 4. Link Frontend to your Cloudflare Worker API

1. Visit your deployed website `https://azera.biz.id`.
2. Open the **Trash Mail** app window.
3. Click the **⚙️ API** configuration gear icon.
4. Input your Cloudflare Worker URL (e.g., `https://azera-mail-worker.<your-subdomain>.workers.dev`).
5. Click **Save Settings**. The client will now interface with your live self-hosted D1 database to receive emails in real time!

---

## Security & Maintenance
- **Expiring Storage**: The Cloudflare Worker has a scheduled handler (Cron trigger) that automatically runs every hour to delete emails older than 24 hours. This keeps database storage usage tiny and always within the free tier boundaries of Cloudflare D1 (5,000,000 read rows / 100,000 write rows per day).
- **Email Sandbox**: Incoming HTML emails are parsed into pure markup bodies and rendered inside a sandboxed `<iframe>` layout. Script execution is entirely blocked, and links are dynamically configured to open in new tabs to prevent clickjacking or state leakage from the parent application workspace.

## License
MIT License. Created by [Reza Mubarock](https://github.com/rezamubarock).
