import path from "node:path";

function isRouteGroupSegment(segment: string): boolean {
  return segment.startsWith("(") && segment.endsWith(")");
}

function normalizeRouteSegment(segment: string): string {
  const catchAll = /^\[\.\.\.(.+)\]$/.exec(segment);
  if (catchAll) return `{${catchAll[1]}}`;

  const dynamic = /^\[(.+)\]$/.exec(segment);
  if (dynamic) return `{${dynamic[1]}}`;

  return segment;
}

export function routeFilePathToRoutePath(
  appRoot: string,
  routeFilePath: string,
) {
  const relativeDir = path.posix.dirname(
    path.relative(appRoot, routeFilePath).split(path.sep).join("/"),
  );
  const segments = relativeDir
    .split("/")
    .filter(Boolean)
    .filter((segment) => !isRouteGroupSegment(segment))
    .map(normalizeRouteSegment);

  return `/${segments.join("/")}`;
}
