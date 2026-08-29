export function parseMenuEntryUrl(href: string) {
  const url = new URL(href);
  const tableQrToken = url.searchParams.get("table_qr_token");

  return {
    tableQrToken,
    shouldCleanUrl: Boolean(tableQrToken) || url.searchParams.has("qr"),
    cleanUrl: url.pathname,
  };
}
