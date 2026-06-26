type CursorKey = string | number;

const toCursorKey = (value: CursorKey | null | undefined): string | null => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return null;
};

export function appendInclusiveCursorPage<T>(
  existingItems: readonly T[],
  nextPageItems: readonly T[],
  getKey: (item: T) => CursorKey | null | undefined,
): T[] {
  const seenKeys = new Set(
    existingItems
      .map((item) => toCursorKey(getKey(item)))
      .filter((key): key is string => key !== null),
  );

  const mergedItems = [...existingItems];

  nextPageItems.forEach((item) => {
    const key = toCursorKey(getKey(item));
    if (key === null) {
      mergedItems.push(item);
      return;
    }
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    mergedItems.push(item);
  });

  return mergedItems;
}

export function flattenInclusiveCursorPages<T>(
  pages: readonly (readonly T[])[],
  getKey: (item: T) => CursorKey | null | undefined,
): T[] {
  return pages.reduce<T[]>(
    (allItems, pageItems) =>
      appendInclusiveCursorPage(allItems, pageItems, getKey),
    [],
  );
}
