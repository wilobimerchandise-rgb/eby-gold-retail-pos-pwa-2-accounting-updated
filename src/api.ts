import {
  aiResponseSchema,
  type ParseOrderRequest,
  type ParseOrderResponse,
} from "./schema";
import { supabase } from "@/lib/supabase";

export async function parseOrder(
  message: string,
  inventory: { name: string; sku: string }[],
): Promise<ParseOrderResponse> {
  const body: ParseOrderRequest = { message, inventory };

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error("Could not verify your login. Please sign in again.");
  }

  if (!session?.access_token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("The AI service is not configured correctly.");
  }

  let response: Response;

  try {
    response = await fetch(
      `${supabaseUrl}/functions/v1/parse-order`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      },
    );
  } catch {
    throw new Error(
      "Could not reach the AI service. Check your internet connection.",
    );
  }

  let responseData: unknown;

  try {
    responseData = await response.json();
  } catch {
    throw new Error("The AI service returned an invalid response.");
  }

  if (!response.ok) {
    if (
      typeof responseData === "object" &&
      responseData !== null &&
      "error" in responseData &&
      typeof responseData.error === "string"
    ) {
      throw new Error(responseData.error);
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Your login could not be verified. Please sign in again.",
      );
    }

    throw new Error("The AI service could not process this order.");
  }

  const parsed = aiResponseSchema.safeParse(responseData);

  if (!parsed.success) {
    throw new Error("AI returned malformed data. Please try again.");
  }

  return {
    customer: parsed.data.customer,
    items: parsed.data.items,
    unmatchedItems: parsed.data.unmatchedItems,
  };
}
