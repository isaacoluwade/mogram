export { EditError } from "./session";
export type { EditResult } from "./context";
export {
  addComponent,
  addConnection,
  addContainer,
  addDecoration,
  addGroup,
  addShape,
  autoSize,
  deleteElements,
  isLocked,
  moveElements,
  nestElements,
  renameElement,
  resizeElement,
  setCard,
  setConnectionPath,
  setData,
  setLocked,
  updateElement,
  type AddComponentArgs,
  type AddConnectionArgs,
  type AddContainerArgs,
  type AddShapeArgs,
  type DecorationArgs,
  type Move,
  type PropertyValue,
} from "./elements";
export { planZOrder, reorderZ, type ZOrderMove } from "./z-order";
export { followTerminals } from "./follow";
export { tidyUp } from "./tidy";
export {
  applyStyle,
  createNamedStyle,
  deleteNamedStyle,
  readStyle,
  resetToNamedStyle,
  setNamedStyle,
  styleApplies,
  styleOverrides,
  updateNamedStyle,
  type CopiedStyle,
} from "./style";
export {
  ELEMENT_KEYS,
  readProperties,
  setProperty,
  type PropertyRow as PropertyEntry,
} from "./properties";
export {
  reconnectConnection,
  resetConnectionPath,
  reverseConnection,
  setConnectionRoute,
  setConnectionGeometry,
  setConnectionLook,
  splitConnection,
  type ConnectionGeometry,
  type ConnectionLook,
} from "./connections";
export {
  addScene,
  addTour,
  appendTourStep,
  deleteScene,
  deleteTour,
  removeTourStep,
  renameScene,
  reorderScenes,
  setSceneCapacity,
  setSceneEntry,
  setTourChoices,
  updateTour,
  updateTourStep,
  type ChoiceInput,
  type SceneValue,
  type StepPatch,
} from "./story";
export {
  copySnippet,
  isMogramSnippet,
  moveToFile,
  pasteSnippet,
  pasteSnippetNamed,
  setSetting,
  writeProjectFile,
  type SettingKey,
} from "./files";
export { patchOriginal, detectStyle } from "./patch";
export { restoreElements } from "./restore";
export { insertYaml } from "./insert";
export {
  formatMultiple,
  formatPercent,
  setFlowValue,
  setScale,
  setTrafficPattern,
} from "./capacity";
export { setConcept } from "./concept";
