import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname) {
  const workerUrl = new URL(
    "../.vercel/output/functions/__server.func/index.mjs",
    import.meta.url,
  );
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      waitUntil() {},
    },
  );
}

for (const table of ["1", "2", "3"]) {
  test(`server-renders the Table ${table} menu`, async () => {
    const response = await render(`/menu/${table}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

    const html = await response.text();
    assert.match(html, /YAPA/);
    assert.match(html, new RegExp(`Table\\s*(?:<!-- -->)?\\s*${table}`));
    assert.match(html, /Classic Tea/);
    assert.match(html, /Turkish Coffee/);
    assert.match(html, /Yapa Café/);
    assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
  });
}

test("rejects an invalid table route", async () => {
  const response = await render("/menu/99");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Invalid table/);
  assert.doesNotMatch(html, /Classic Tea/);
});

test("server-renders the staff dashboard", async () => {
  const response = await render("/staff");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Yapa Staff/);
  assert.match(html, /Live service/);
  assert.match(html, /غير مدفوع/);
  assert.match(html, /مدفوع/);
  assert.match(html, /Yapa Café/);
  assert.doesNotMatch(html, /Starter Project|codex-preview/i);
});

test("server-renders all three QR codes", async () => {
  const response = await render("/qr");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Table 1/);
  assert.match(html, /Table 2/);
  assert.match(html, /Table 3/);
  assert.match(html, /\/menu\/1/);
  assert.match(html, /\/menu\/2/);
  assert.match(html, /\/menu\/3/);
  assert.match(html, /table_qr_token=/);
  assert.match(html, /••••••••/);
  assert.doesNotMatch(html, /table_qr_token=[A-Za-z0-9_-]{32,}/);
});
