"use client";

import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { JobInputSchemaType } from "@/lib/schemas/job-input-schema";
import { getDefaultValue } from "@/lib/schemas/job-input-schema";

import JobInputRenderer from "./JobInputRenderer";

interface JobInputsFormRendererProps {
  jobInputSchemas: JobInputSchemaType[];
}

export default function JobInputsFormRenderer({
  jobInputSchemas,
}: JobInputsFormRendererProps) {
  const initialFormData = useMemo(() => {
    const data: Record<string, string | number | boolean | string[]> = {};
    for (const schema of jobInputSchemas) {
      data[schema.id] = getDefaultValue(schema);
    }
    return data;
  }, [jobInputSchemas]);

  const [formData, setFormData] = useState(initialFormData);

  const handleFieldChange = useCallback(
    (id: string, value: string | number | boolean | string[]) => {
      setFormData((prev) => ({ ...prev, [id]: value }));
    },
    [],
  );

  const handleClear = useCallback(() => {
    setFormData(initialFormData);
  }, [initialFormData]);

  return (
    <Card className="bg-muted/20">
      <CardHeader>
        <CardTitle className="text-base">{"Rendered Form"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {"This is how the form will appear in Sokosumi"}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          {jobInputSchemas.map((schema, index) => (
            <div key={schema.id}>
              <JobInputRenderer
                jobInputSchema={schema}
                value={formData[schema.id] ?? getDefaultValue(schema)}
                onChange={(value) => handleFieldChange(schema.id, value)}
              />
              {index < jobInputSchemas.length - 1 && (
                <Separator className="mt-4" />
              )}
            </div>
          ))}
        </form>
        <div className="flex items-center justify-between pt-2 border-t">
          <Button variant="outline" size="sm" onClick={handleClear}>
            {"Clear Form"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {jobInputSchemas.length} {"fields"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
