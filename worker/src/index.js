import PostalMime from 'postal-mime';

export default {
  // 1. HTTP API Handler (fetch)
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(request);

    // Handle CORS preflight options request
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    try {
      // Endpoint: GET /api/inbox?inbox=username
      if (url.pathname === '/api/inbox' && request.method === 'GET') {
        let inbox = url.searchParams.get('inbox') || url.searchParams.get('address');
        if (!inbox) {
          return new Response(JSON.stringify({ error: 'Missing inbox parameter' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Clean and extract inbox name
        inbox = cleanInboxName(inbox);

        // Fetch emails from D1 database
        const { results } = await env.DB.prepare(
          'SELECT id, sender, sender_name, subject, received_at FROM emails WHERE inbox = ? ORDER BY received_at DESC LIMIT 50'
        )
        .bind(inbox)
        .all();

        return new Response(JSON.stringify(results), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Endpoint: GET /api/email?id=uuid&inbox=username
      if (url.pathname === '/api/email' && request.method === 'GET') {
        const id = url.searchParams.get('id');
        let inbox = url.searchParams.get('inbox');

        if (!id || !inbox) {
          return new Response(JSON.stringify({ error: 'Missing id or inbox parameter' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        inbox = cleanInboxName(inbox);

        // Retrieve the full email details
        const email = await env.DB.prepare(
          'SELECT * FROM emails WHERE id = ? AND inbox = ?'
        )
        .bind(id, inbox)
        .first();

        if (!email) {
          return new Response(JSON.stringify({ error: 'Email not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        return new Response(JSON.stringify(email), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Endpoint: DELETE /api/email?id=uuid&inbox=username
      if (url.pathname === '/api/email' && request.method === 'DELETE') {
        const id = url.searchParams.get('id');
        let inbox = url.searchParams.get('inbox');

        if (!id || !inbox) {
          return new Response(JSON.stringify({ error: 'Missing id or inbox parameter' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        inbox = cleanInboxName(inbox);

        await env.DB.prepare(
          'DELETE FROM emails WHERE id = ? AND inbox = ?'
        )
        .bind(id, inbox)
        .run();

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Simple root response / Health check
      return new Response(JSON.stringify({
        status: 'online',
        service: 'Azera Temp Mail API',
        domain: 'azera.biz.id'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  },

  // 2. Cloudflare Email Routing Handler (email)
  async email(message, env, ctx) {
    const rawRecipient = message.to;
    const inbox = cleanInboxName(rawRecipient);

    if (!inbox) {
      console.error(`Could not parse inbox name from recipient: ${rawRecipient}`);
      return;
    }

    try {
      // Parse raw email content
      const rawEmail = await new Response(message.raw).arrayBuffer();
      const parser = new PostalMime();
      const parsed = await parser.parse(rawEmail);

      const id = crypto.randomUUID();
      const sender = message.from || (parsed.from ? parsed.from.address : 'unknown@sender.com');
      const senderName = parsed.from ? parsed.from.name : '';
      const subject = parsed.subject || '(No Subject)';
      const bodyText = parsed.text || '';
      const bodyHtml = parsed.html || '';
      const receivedAt = Date.now();

      // Store parsed email in D1 database
      await env.DB.prepare(
        'INSERT INTO emails (id, inbox, sender, sender_name, subject, body_text, body_html, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(id, inbox, sender, senderName, subject, bodyText, bodyHtml, receivedAt)
      .run();

      console.log(`Successfully stored email in D1: ${id} for inbox: ${inbox}`);
    } catch (e) {
      console.error(`Error saving email for inbox ${inbox}: ${e.message}`);
    }
  },

  // 3. Cron Job Scheduler (scheduled)
  async scheduled(event, env, ctx) {
    // Delete emails older than 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    try {
      const result = await env.DB.prepare(
        'DELETE FROM emails WHERE received_at < ?'
      )
      .bind(oneDayAgo)
      .run();
      console.log(`Cron Cleaned Expired Emails. Rows affected: ${result.meta.rows_written}`);
    } catch (err) {
      console.error(`Failed to clean expired emails in D1: ${err.message}`);
    }
  }
};

// --- Helper Functions ---

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function cleanInboxName(emailAddress) {
  if (!emailAddress) return '';
  let address = emailAddress.trim().toLowerCase();
  
  // Extract local part of email if complete address was passed
  // Match characters before @ sign
  const match = address.match(/(?:<|^)([^@<\s]+)@/);
  if (match) {
    address = match[1];
  }
  
  // Clean special characters but keep letters, numbers, dots, hyphens, and underscores
  return address.replace(/[^a-z0-9._-]/g, '');
}
