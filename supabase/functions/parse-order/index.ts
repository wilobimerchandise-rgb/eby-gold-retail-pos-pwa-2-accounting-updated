import { z } from "npm:zod@4.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_MESSAGE_LENGTH = 5000;
const MAX_INVENTORY_ITEMS = 500;

const requestBodySchema = z.object({
  message: z.string().min(1).max(MAX_MESSAGE_LENGTH),
  inventory: z.array(
    z.object({
      name: z.string().min(1).max(200),
      sku: z.string().min(1).max(50),
    }),
  ).max(MAX_INVENTORY_ITEMS),
});

const aiResponseSchema = z.object({
  customer: z.object({
    name: z.string().max(200).optional(),
    phone: z.string().max(50).optional(),
  }),
  items: z.array(
    z.object({
      name: z.string().min(1).max(200),
      quantity: z.number().int().positive(),
    }),
  ).max(100),
  unmatchedItems: z.array(z.string().max(200)).max(100),
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const rawBody: unknown = await req.json();
    const parsedBody = requestBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return errorResponse("Invalid request: message and inventory are required", 400);
    }

    const { message, inventory } = parsedBody.data;

    const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!apiKey) {
      return errorResponse("AI service is not configured", 503);
    }

    const inventoryList = inventory
      .map((i) => `- ${i.name} (SKU: ${i.sku})`)
      .join("\n");

    const systemPrompt = `You are an order parser for a Nigerian retail store. Your ONLY job is to extract order information from WhatsApp messages.

Return ONLY valid JSON with this exact structure:
{
  "customer": { "name": "string or null", "phone": "string or null" },
  "items": [{ "name": "string", "quantity": number }],
  "unmatchedItems": ["string"]
}

Rules:
- Match items to the store inventory below. Use the inventory product name as the "name" field for matched items.
- If a customer mentions a product that does not closely match any inventory item, add it to "unmatchedItems" as the customer's original text.
- Quantities must be positive integers. If the customer says "3 peak", quantity is 3.
- If quantity is unclear, default to 1.
- Do NOT include prices. Do NOT invent prices.
- Extract customer name and phone if mentioned in the message.
- Return ONLY the JSON object, no markdown, no explanation.

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
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof DOMException && err.name === "AbortError") {
        return errorResponse("AI service timed out. Please try again.", 504);
      }
      return errorResponse("Could not reach the AI service", 502);
    } finally {
      clearTimeout(timeout);
    }

    if (!deepseekResponse.ok) {
      return errorResponse("AI service returned an error. Please try again.", 502);
    }

    const deepseekData = await deepseekResponse.json();
    const content: string | undefined = deepseekData?.choices?.[0]?.message?.content;
    if (!content) {
      return errorResponse("AI returned an empty response", 502);
    }

    let aiJson: unknown;
    try {
      aiJson = JSON.parse(content);
    } catch {
      return errorResponse("AI returned malformed data. Please try again.", 502);
    }

    const validated = aiResponseSchema.safeParse(aiJson);
    if (!validated.success) {
      return errorResponse("AI returned invalid order data. Please try again.", 502);
    }

    return jsonResponse(validated.data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred";
    return errorResponse(msg, 500);
  }
});
