import { parsePointer } from "../assets/pointer";
import { listingOf } from "../code/listing";
import type { Component, Diagram, ProjectFiles } from "../model/types";
import { resolveFromFolder } from "../model/paths";
import type { DiagnosticSink } from "./diagnostics";
import { didYouMean } from "./suggest";

/**
 * What images and code show (D-102, D-103), once the whole project is known: the file a
 * picture or a listing names, its lines, the picture's own size. A reader sees one file at a
 * time, so this is done after.
 */

/** Pictures Mogram can show, by extension. */
const PICTURE = /\.(?:png|jpe?g|webp|gif|svg)$/i;

/** The written path of a project file as seen from a diagram's folder. */
function written(folder: string, path: string): string {
  return folder !== "" && path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : path;
}

/** A picture's own size, from its pointer or, for an SVG, its width and height or view box. */
export function naturalSize(text: string): { width: number; height: number } | null {
  const pointer = parsePointer(text);
  if (pointer !== null)
    return pointer.width === undefined || pointer.height === undefined
      ? null
      : { width: pointer.width, height: pointer.height };
  const svg = /<svg\b[^>]*>/i.exec(text)?.[0];
  if (svg === undefined) return null;
  const number = (name: string) => {
    const value = new RegExp(`\\b${name}\\s*=\\s*["']\\s*([\\d.]+)(?:px)?\\s*["']`, "i").exec(svg);
    return value === null ? null : Number(value[1]);
  };
  const width = number("width");
  const height = number("height");
  if (width !== null && height !== null && width > 0 && height > 0) return { width, height };
  const box =
    /\bviewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i.exec(svg);
  if (box === null) return null;
  const [w, h] = [Number(box[1]), Number(box[2])];
  return w > 0 && h > 0 ? { width: w, height: h } : null;
}

function resolveImage(
  files: ProjectFiles,
  folder: string,
  component: Component,
  sink: DiagnosticSink,
): Component {
  const image = component.image;
  if (image === null || image.src === "") return component;
  const at = component.source;
  // A picture written in place (`data:`) needs no file.
  if (image.src.startsWith("data:image/")) return component;
  const path = resolveFromFolder(folder, image.src);
  if (path === null) {
    sink.add(
      "error",
      at.file,
      at.line,
      1,
      `"${component.name}" shows "${image.src}", which is outside the project.`,
    );
    return component;
  }
  if (!PICTURE.test(path)) {
    sink.add(
      "error",
      at.file,
      at.line,
      1,
      `"${component.name}" shows "${image.src}", which isn't a picture Mogram can show. Use PNG, JPEG, WebP, GIF or SVG.`,
    );
    return { ...component, image: { ...image, path: null } };
  }
  const text = files[path];
  if (text === undefined) {
    const pictures = Object.keys(files)
      .filter((each) => PICTURE.test(each))
      .map((each) => written(folder, each));
    sink.add(
      "error",
      at.file,
      at.line,
      1,
      `"${component.name}" shows "${image.src}", but there is no such file.${didYouMean(image.src, pictures)}`,
    );
    return component;
  }
  return { ...component, image: { ...image, path, natural: naturalSize(text) } };
}

function resolveCode(
  files: ProjectFiles,
  folder: string,
  component: Component,
  sink: DiagnosticSink,
): Component {
  const code = component.code;
  if (code === null) return component;
  const at = component.source;
  let listing = code.listing;
  let path: string | null = null;
  if (code.file !== null) {
    path = resolveFromFolder(folder, code.file);
    const text = path === null ? undefined : files[path];
    if (text === undefined) {
      if (path !== null) {
        const texts = Object.keys(files)
          .filter((each) => !/\.mogram(\.yaml)?$|\/mogram\.yaml$|^mogram\.yaml$/.test(each))
          .map((each) => written(folder, each));
        sink.add(
          "error",
          at.file,
          at.line,
          1,
          `"${component.name}" shows "${code.file}", but there is no such file.${didYouMean(code.file, texts)}`,
        );
      }
      path = null;
    } else listing = listingOf(text, code.language, code.slice);
  }
  const named = code.file === null ? "its text" : `"${code.file}"`;
  const count = (n: number) => `${n} ${n === 1 ? "line" : "lines"}`;
  if (!listing.missing && code.slice !== null && code.slice[1] > listing.lines.length)
    sink.add(
      "warning",
      at.file,
      at.line,
      1,
      `"${component.name}" shows lines ${code.slice[0]}-${code.slice[1]} of ${named}, which has ${count(listing.lines.length)}.`,
    );
  if (!listing.missing)
    for (const part of component.parts.values()) {
      if (part.kind !== "lines" || part.last <= listing.lines.length) continue;
      const lines =
        part.first === part.last ? `line ${part.first}` : `lines ${part.first}-${part.last}`;
      sink.add(
        "warning",
        part.source.file,
        part.source.line,
        1,
        `Part "${part.name}" of "${component.name}" is ${lines}, but ${named} has ${count(listing.lines.length)}.`,
      );
    }
  return { ...component, code: { ...code, path, listing } };
}

/** The diagram with every image's picture and every listing's lines found in the project. */
export function resolveMedia(files: ProjectFiles, diagram: Diagram, sink: DiagnosticSink): Diagram {
  let changed = false;
  const components = new Map(diagram.components);
  for (const [name, component] of diagram.components) {
    if (component.image === null && component.code === null) continue;
    const resolved = resolveCode(
      files,
      diagram.folder,
      resolveImage(files, diagram.folder, component, sink),
      sink,
    );
    components.set(name, resolved);
    changed = true;
  }
  return changed ? { ...diagram, components } : diagram;
}
