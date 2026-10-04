export { EditError } from "./session";
export type { EditResult } from "./context";
export {
  addComponent,
  addConnection,
  addContainer,
  addDecoration,
  addGroup,
  autoSize,
  deleteElements,
  moveElements,
  renameElement,
  resizeElement,
  setCard,
  setConnectionPath,
  updateElement,
  type AddComponentArgs,
  type AddConnectionArgs,
  type AddContainerArgs,
  type DecorationArgs,
  type Move,
  type PropertyValue,
} from "./elements";
export { planZOrder, reorderZ, type ZOrderMove } from "./z-order";
export {
  addScene,
  addTour,
  appendTourStep,
  deleteScene,
  deleteTour,
  removeTourStep,
  renameScene,
  reorderScenes,
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
  setSetting,
  writeProjectFile,
  type SettingKey,
} from "./files";
export { patchOriginal, detectStyle } from "./patch";
