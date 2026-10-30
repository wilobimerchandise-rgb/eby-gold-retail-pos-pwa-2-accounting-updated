import {
  aiResponseSchema,
  type ParseOrderRequest,
  type ParseOrderResponse,
} from "./schema";

export async function parseOrder(
  message: string,
  inventory: { name: string; sku: string }[],
): Promise<ParseOrderResponse> {
  const body: ParseOrderRequest = {
    message,
    inventory,
  };

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-order`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  };

  let response: Response;

  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Could not reach the AI service. Check your internet connection.",
    );
  }

  if (!response.ok) {
    let errMsg = `Request failed (${response.status})`;

    try {
      const errBody = await response.json();

      if (errBody?.error) {
        errMsg = errBody.error;
      }
    } catch {
      // Response body was not JSON.
    }

    throw new Error(errMsg);
  }

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Received an invalid response from the AI service",
    );
  }

  const parsed = aiResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error(
      "AI returned malformed data. Please try again.",
    );
  }

  return {
    customer: parsed.data.customer,
    items: parsed.data.items,
    unmatchedItems: parsed.data.unmatchedItems,
  };
}