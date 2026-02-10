"use client";

import "swagger-ui-react/swagger-ui.css";
import "@/../public/swagger-custom.css";

import dynamic from "next/dynamic";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function DocsPage() {
  return (
    <>
      <div style={{ minHeight: "100vh" }}>
        <SwaggerUI
          url="/api/v1/openapi"
          persistAuthorization={true}
          tryItOutEnabled={true}
          displayRequestDuration={true}
        />
      </div>
    </>
  );
}
