import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@4.4.3";

const allowedOrigins = new Set([
  "http://localhost:5173",
  "https://ebygoldretailpospwa2accounting-mwq4--5173--f8d6b2be.local-credentialless.webcontainer.io",
  ...(Deno.env.get("APP_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

const MAX_MESSAGE_LENGTH = 5000;
const MAX_INVENTORY_ITEMS = 500;
const MAX_REQUEST_BYTES = 256 * 1024;
const MAX_ORDER_ITEMS = 100;
const MAX_QUANTITY = 10000;

const requestBodySchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  inventory: z.array(
    z.object({
      name: z.string().trim().min(1).max(200),
      sku: z.string().trim().min(1).max(50),
    }),
  ).max(MAX_INVENTORY_ITEMS),
});

const aiResponseSchema = z.object({
  customer: z.object({
    name: z.string().max(200).nullable().optional(),
    phone: z.string().max(50).nullable().optional(),
  }),
  items: z.array(
    z.object({
      name: z.string().trim().min(1).max(200),
      quantity: z.number().int().positive().max(MAX_QUANTITY),
    }),
  ).max(MAX_ORDER_ITEMS),
  unmatchedItems: z.array(z.string().trim().min(1).max(200))
    .max(MAX_ORDER_ITEMS),
});

interface DeepSeekResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
}

function getCorsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Client-Info, Apikey",
    "Vary": "Origin",
  };

  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...Object.fromEntries(new Headers(corsHeaders).entries()),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function errorResponse(
  message: string,
  status: number,
  corsHeaders: HeadersInit,
): Response {
  return jsonResponse({ error: message }, status, corsHeaders);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (origin && !allowedOrigins.has(origin)) {
    return errorResponse("Origin not allowed", 403, corsHeaders);
  }

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  try {
    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return errorResponse("Authentication required", 401, corsHeaders);
    }

    const accessToken = authorization.slice("Bearer ".length).trim();

    if (!accessToken) {
      return errorResponse("Authentication required", 401, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return errorResponse(
        "Authentication service is not configured",
        503,
        corsHeaders,
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return errorResponse("Your session is invalid or expired", 401, corsHeaders);
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return errorResponse(
        "Could not verify your staff profile",
        500,
        corsHeaders,
      );
    }

    if (!profile) {
      return errorResponse(
        "You do not have an Eby-Gold staff profile",
        403,
        corsHeaders,
      );
    }

    const contentLength = Number(req.headers.get("Content-Length") ?? "0");

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_REQUEST_BYTES
    ) {
      return errorResponse("Request is too large", 413, corsHeaders);
    }

    const rawBody = await req.text();
    const actualSize = new TextEncoder().encode(rawBody).byteLength;

    if (actualSize > MAX_REQUEST_BYTES) {
      return errorResponse("Request is too large", 413, corsHeaders);
    }

    let bodyData: unknown;

    try {
      bodyData = JSON.parse(rawBody);
    } catch {
      return errorResponse("Request body must contain valid JSON", 400, corsHeaders);
    }

    const parsedBody = requestBodySchema.safeParse(bodyData);

    if (!parsedBody.success) {
      return errorResponse(
        "Invalid request: message and inventory are required",
        400,
        corsHeaders,
      );
    }

    const { message, inventory } = parsedBody.data;

    if (inventory.length === 0) {
      return errorResponse("Store inventory is empty", 400, corsHeaders);
    }

    const apiKey = Deno.env.get("DEEPSEEK_API_KEY");

    if (!apiKey) {
      return errorResponse("AI service is not configured", 503, corsHeaders);
    }

    const inventoryList = inventory
      .map((item) => `- ${item.name} (SKU: ${item.sku})`)
      .join("\n");

    const systemPrompt = `You are an order parser for a Nigerian retail store. Your ONLY job is to extract order information from WhatsApp messages.

Return ONLY valid JSON with this exact structure:
{
  "customer": { "name": "string or null", "phone": "string or null" },
  "items": [{ "name": "string", "quantity": number }],
  "unmatchedItems": ["string"]
}

Rules:
- Match items to the store inventory below.
- For matched items, use the exact inventory product name in the "name" field.
- If a customer mentions a product that does not closely match an inventory item, add the customer's original product text to "unmatchedItems".
- Quantities must be positive integers. If the customer says "3 peak", quantity is 3.
- If quantity is unclear, default to 1.
- Do NOT include prices. Do NOT invent prices.
- Extract customer name and phone if mentioned.
- Use null for customer name or phone when not provided.
- Return ONLY the JSON object, no markdown or explanation.

Store inventory:
${inventoryList}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let deepseekResponse: Response;

    try {
      deepseekResponse = await fetch(
        "https://api.deepseek.com/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message },
            ],
            temperature: 0,
            max_tokens: 2000,
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return errorResponse(
          "AI service timed out. Please try again.",
          504,
          corsHeaders,
        );
      }

      return errorResponse(
        "Could not reach the AI service",
        502,
        corsHeaders,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!deepseekResponse.ok) {
      console.error("DeepSeek API request failed", {
        status: deepseekResponse.status,
        statusText: deepseekResponse.statusText,
      });
    
      return errorResponse(
        "AI service returned an error. Please try again.",
        502,
        corsHeaders,
      );
    }
    let deepseekData: unknown;

    try {
      deepseekData = await deepseekResponse.json();
    } catch {
      return errorResponse(
        "AI service returned an invalid response",
        502,
        corsHeaders,
      );
    }

    const providerResponse = deepseekData as DeepSeekResponse;
    const content = providerResponse.choices?.[0]?.message?.content;

    if (typeof content !== "string" || !content.trim()) {
      return errorResponse("AI returned an empty response", 502, corsHeaders);
    }

    let aiJson: unknown;

    try {
      aiJson = JSON.parse(content);
    } catch {
      return errorResponse(
        "AI returned malformed data. Please try again.",
        502,
        corsHeaders,
      );
    }

    const validated = aiResponseSchema.safeParse(aiJson);

    if (!validated.success) {
      return errorResponse(
        "AI returned invalid order data. Please try again.",
        502,
        corsHeaders,
      );
    }

    const inventoryByName = new Map(
      inventory.map((item) => [item.name.toLowerCase(), item.name]),
    );

    const matchedItems: Array<{ name: string; quantity: number }> = [];
    const unmatchedItems = [...validated.data.unmatchedItems];

    for (const item of validated.data.items) {
      const inventoryName = inventoryByName.get(item.name.toLowerCase());

      if (inventoryName) {
        matchedItems.push({
          name: inventoryName,
          quantity: item.quantity,
        });
      } else {
        unmatchedItems.push(item.name);
      }
    }

    const customer: {
      name?: string;
      phone?: string;
    } = {};

    if (validated.data.customer.name) {
      customer.name = validated.data.customer.name;
    }

    if (validated.data.customer.phone) {
      customer.phone = validated.data.customer.phone;
    }

    return jsonResponse(
      {
        customer,
        items: matchedItems,
        unmatchedItems: [...new Set(unmatchedItems)],
      },
      200,
      corsHeaders,
    );
  } catch {
    return errorResponse(
      "An unexpected error occurred while processing the order",
      500,
      corsHeaders,
    );
  }
});
