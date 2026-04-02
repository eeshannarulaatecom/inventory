import { config } from "./config.js";

export async function mondayRequest(query, variables = {}) {
  const response = await fetch(config.monday.apiUrl, {
    method: "POST",
    headers: {
      Authorization: config.monday.apiToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `monday.com API request failed (${response.status}): ${
        payload.error_message || payload.error || "Unknown error"
      }`
    );
  }

  if (payload.errors?.length) {
    const message = payload.errors.map((error) => error.message).join("; ");
    throw new Error(`monday.com GraphQL error: ${message}`);
  }

  return payload.data;
}
