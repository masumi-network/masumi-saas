import { z } from "zod";

import { exampleOutputSchema } from "@/lib/schemas/agent";

function isEmpty(output: z.infer<typeof exampleOutputSchema>): boolean {
  return !output.name.trim() && !output.url.trim() && !output.mimeType.trim();
}

export const editAgentExampleOutputsSchema = z
  .array(
    z.object({
      name: z.string(),
      url: z.string(),
      mimeType: z.string(),
    }),
  )
  .superRefine((outputs, ctx) => {
    outputs.forEach((output, index) => {
      if (isEmpty(output)) return;
      const result = exampleOutputSchema.safeParse(output);
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({ ...issue, path: [index, ...issue.path] });
        }
      }
    });
  })
  .transform((outputs) => outputs.filter((output) => !isEmpty(output)));
