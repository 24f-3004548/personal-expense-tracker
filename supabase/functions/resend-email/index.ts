import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

const GMAIL_USER = Deno.env.get("GMAIL_USER");
const GMAIL_PASS = Deno.env.get("GMAIL_PASS");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!GMAIL_USER || !GMAIL_PASS) {
    return jsonResponse({ error: "Missing Gmail credentials" }, 500);
  }

  // 🔐 AUTH: extract JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  // 🔐 AUTH: validate user
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: "Invalid user" }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid or empty JSON body" }, 400);
  }

  const { subject, html, attachments } = payload ?? {};

  if (!subject || !html) {
    return jsonResponse({ error: "Missing required fields: subject, html" }, 400);
  }

  // Always send to authenticated user
  const to = user.email;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Spendly" <${GMAIL_USER}>`,
      to,
      subject,
      html,
      attachments: Array.isArray(attachments)
        ? attachments.map((a: any) => ({
            filename: a.filename,
            content: a.content,
            encoding: "base64",
          }))
        : [],
    });
  } catch (err) {
    return jsonResponse({ error: "Gmail send failed", details: String(err) }, 500);
  }

  return jsonResponse({ ok: true }, 200);
});