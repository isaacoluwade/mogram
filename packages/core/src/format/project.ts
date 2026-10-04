import type { DiagramMode, ProjectFiles } from "../model/types";
import {
  LAYOUT_FILE,
  SETTINGS_FILE,
  basename,
  dirname,
  filesInFolder,
  isMogramFile,
} from "../model/paths";

export interface DiagramFileSet {
  readonly folder: string;
  readonly mode: DiagramMode;
  /** Settings file first, then other files alphabetically, layout file last. */
  readonly files: readonly string[];
  readonly settingsFile: string;
}

/** Folders that contain at least one Mogram file — each is a diagram (FI-7, FI-11). */
export function findDiagramFolders(files: ProjectFiles): string[] {
  const folders = new Set<string>();
  for (const path of Object.keys(files)) {
    if (isMogramFile(path)) folders.add(dirname(path));
  }
  return [...folders].sort((a, b) => a.length - b.length || a.localeCompare(b));
}

/**
 * The Mogram files of the diagram in `folder`, and whether it is single-file or folder mode.
 * Folder mode: `mogram.yaml` plus other Mogram files, or a `layout.mogram.yaml` (FI-7, FI-10).
 */
export function diagramFileSet(files: ProjectFiles, folder: string): DiagramFileSet | null {
  const mogramFiles = filesInFolder(Object.keys(files), folder).filter(isMogramFile);
  if (mogramFiles.length === 0) return null;

  const settingsPath = folder.length > 0 ? `${folder}/${SETTINGS_FILE}` : SETTINGS_FILE;
  const layoutPath = folder.length > 0 ? `${folder}/${LAYOUT_FILE}` : LAYOUT_FILE;
  const hasSettingsFile = mogramFiles.includes(settingsPath);
  const hasLayoutFile = mogramFiles.includes(layoutPath);

  const mode: DiagramMode = mogramFiles.length > 1 || hasLayoutFile ? "folder" : "single";
  const settingsFile = hasSettingsFile
    ? settingsPath
    : ([...mogramFiles].sort(compareFiles)[0] ?? settingsPath);

  const ordered = [...mogramFiles].sort((a, b) => {
    if (a === settingsFile) return -1;
    if (b === settingsFile) return 1;
    if (a === layoutPath) return 1;
    if (b === layoutPath) return -1;
    return compareFiles(a, b);
  });

  return { folder, mode, files: ordered, settingsFile };
}

function compareFiles(a: string, b: string): number {
  return basename(a).localeCompare(basename(b));
}

/** Where layout lives or should be written (FI-10). */
export function layoutFileFor(set: DiagramFileSet, filesWithLayoutKey: readonly string[]): string {
  const layoutPath = set.folder.length > 0 ? `${set.folder}/${LAYOUT_FILE}` : LAYOUT_FILE;
  if (set.files.includes(layoutPath)) return layoutPath;
  const existing = filesWithLayoutKey[0];
  if (existing !== undefined) return existing;
  return set.mode === "single" ? set.settingsFile : layoutPath;
}
