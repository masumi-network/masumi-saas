/** Plain object → `FormData`; booleans become `"true"` / `"false"`. */
export function objectToFormData(
  values: Record<string, string | boolean>,
): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.append(key, typeof value === "boolean" ? String(value) : value);
  }
  return formData;
}
