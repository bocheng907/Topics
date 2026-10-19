/** Use effective width so larger accessibility text gets fewer columns. */
export function getHomeLayout(width: number, fontScale: number) {
  const effectiveWidth = width / Math.max(fontScale, 1);
  return {
    vitalWidth: effectiveWidth < 280 ? "100%" as const : effectiveWidth < 600 ? "48%" as const : "23%" as const,
    stackedActions: effectiveWidth < 390,
    narrowCards: effectiveWidth < 360,
  };
}
