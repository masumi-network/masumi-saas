import { proxyRouteDescriptors } from "@/lib/v1-proxy/manifest";

const proxyRoutePaths = new Set(
  proxyRouteDescriptors.map((route) => route.saasPath),
);

export function isPublicDiscoveryPath(routePath: string): boolean {
  return (
    routePath === "/api/v1/agents" ||
    routePath === "/api/v1/agents/{agentId}" ||
    routePath === "/api/v1/agents/verify"
  );
}

export function isExcludedPlatformPath(routePath: string): boolean {
  if (routePath === "/api/openapi" || routePath === "/api/v1/openapi") {
    return true;
  }
  if (routePath.startsWith("/api/admin")) return true;
  if (routePath.startsWith("/api/auth")) return true;
  if (routePath.startsWith("/api/oidc")) return true;
  if (routePath.startsWith("/api/registry-discovery")) return true;
  if (routePath.startsWith("/api/webhooks")) return true;
  if (routePath.startsWith("/api/v1/")) {
    return !isPublicDiscoveryPath(routePath);
  }
  if (routePath === "/pay/api/v1/registry-inbox/agent-identifier") {
    return true;
  }
  return false;
}

export function isPlatformDocumentPath(routePath: string): boolean {
  if (routePath === "/credits") {
    return true;
  }

  return (
    (routePath.startsWith("/api/") &&
      !isPublicDiscoveryPath(routePath) &&
      !isExcludedPlatformPath(routePath)) ||
    (routePath.startsWith("/pay/api/v1/") &&
      !isExcludedPlatformPath(routePath)) ||
    routePath.startsWith("/registry/api/v1/")
  );
}

export function shouldHaveRouteContract(routePath: string): boolean {
  if (proxyRoutePaths.has(routePath)) {
    return false;
  }
  return isPublicDiscoveryPath(routePath) || isPlatformDocumentPath(routePath);
}
