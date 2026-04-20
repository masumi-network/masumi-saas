export function createEmptyBrowserRedirectResponse(
  response: Response,
  location?: string,
): Response {
  const headers = new Headers(response.headers);
  if (location) {
    headers.set("location", location);
  }
  headers.delete("content-type");
  headers.set("content-length", "0");

  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
