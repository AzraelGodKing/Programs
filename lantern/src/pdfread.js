// Reads a PDF in this browser. The file never leaves the page. pdf.js loads
// only when someone picks a PDF, from Lantern's own copy in /vendor/pdfjs.

import { itemsToLines } from "./library.js";

let loading = null;

async function pdfjs() {
  if (!loading) {
    loading = import("../vendor/pdfjs/pdf.min.mjs").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
      return lib;
    });
  }
  return loading;
}

export const PDF_BYTES = 25 * 1024 * 1024;

/** Returns { lines, fields, pages }. Lines are in reading order. Fields come from a fillable form. */
export async function readPdf(file) {
  if (!file) throw new Error("Pick a PDF first.");
  if (file.size > PDF_BYTES) throw new Error("That PDF is over 25 MB.");
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  try {
    const lines = [];
    for (let number = 1; number <= Math.min(doc.numPages, 200); number += 1) {
      const page = await doc.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items.map((item) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
      }));
      lines.push(...itemsToLines(items, viewport.width));
    }
    const fields = {};
    try {
      const objects = await doc.getFieldObjects();
      for (const [name, list] of Object.entries(objects || {})) {
        const value = (list || []).map((entry) => entry.value).find((entry) => typeof entry === "string" && entry.trim());
        if (value) fields[name] = value;
      }
    } catch {
      // A PDF without a form still has its text.
    }
    return { lines, fields, pages: doc.numPages };
  } finally {
    void doc.destroy();
  }
}

/** True when the PDF looks like a scan: pages but almost no text. */
export function looksScanned({ lines, fields, pages }) {
  return pages > 0 && lines.join(" ").length < 40 * pages && !Object.keys(fields).length;
}
