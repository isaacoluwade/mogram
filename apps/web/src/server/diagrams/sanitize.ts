import "server-only";
import DOMPurify from "isomorphic-dompurify";

/**
 * Uploaded icons are SVG. They are always rendered as images (where scripts never
 * run), and are also sanitised here so a stored file is safe wherever it ends up (AC-7, IC-4).
 */
export function sanitizeSvg(svg: string): string | null {
  const clean = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["foreignObject", "script"],
    ALLOW_DATA_ATTR: false,
  });
  if (!/^\s*<svg[\s>]/i.test(clean)) return null;
  // Only local references (#id) are allowed: no remote images, fonts or stylesheets.
  if (/\b(?:href|src)\s*=\s*["']\s*(?!#)/i.test(clean)) return null;
  if (/@import|url\(\s*["']?\s*(?!#)/i.test(clean)) return null;
  return clean;
}

const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;

/** Dashboard thumbnails: a JPEG, PNG or WebP data URL, nothing else (no SVG, no remote URLs). */
export function isThumbnailDataUrl(value: string): boolean {
  return /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}

/**
 * Cleans every file in a project before it's stored: SVG files are sanitised, binary images must
 * be base64 data URLs, and everything else is text. Returns the reason when a file is refused.
 */
export function sanitizeProjectFiles(
  files: Record<string, string>,
): { files: Record<string, string> } | { error: string } {
  const out: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    const lower = path.toLowerCase();
    if (lower.endsWith(".svg")) {
      const clean = sanitizeSvg(content);
      if (clean === null) return { error: `${path} isn't an SVG Mogram can use.` };
      out[path] = clean;
    } else if (/\.(png|jpe?g|gif|webp)$/.test(lower)) {
      if (!IMAGE_DATA_URL.test(content)) return { error: `${path} isn't a valid image.` };
      out[path] = content;
    } else if (/\.(ya?ml|mogram|md|txt)$/.test(lower)) {
      out[path] = content;
    } else {
      return {
        error: `${path} isn't a file type Mogram stores. Use .mogram.yaml, .md, .svg or images.`,
      };
    }
  }
  return { files: out };
}
