import { SCENE_TRANSITION, easeInOutCubic } from "./transition";

/**
 * Playing scenes in order turns them into a story (SC-9, EX-6). Each scene holds for `hold`
 * seconds (a multiple of 4 keeps every motion loop seamless) and the change into it animates
 * over the first `transition` seconds of its hold.
 */
export interface StoryPosition {
  readonly from: number;
  readonly to: number;
  readonly progress: number;
}

export const STORY_HOLD = 4;
/** Every preset period divides this, so looping any scene for this long is seamless (D-13). */
export const LOOP_SECONDS = 4;

export function storyDuration(sceneCount: number, hold = STORY_HOLD): number {
  return Math.max(1, sceneCount) * hold;
}

export function storyAt(
  t: number,
  sceneCount: number,
  hold = STORY_HOLD,
  transition = SCENE_TRANSITION,
): StoryPosition {
  if (sceneCount <= 1) return { from: 0, to: 0, progress: 1 };
  const total = sceneCount * hold;
  const local = ((t % total) + total) % total;
  const to = Math.floor(local / hold);
  const from = (to - 1 + sceneCount) % sceneCount;
  const progress = easeInOutCubic((local - to * hold) / transition);
  return { from, to, progress };
}

/**
 * The scene before or after `current` in play order: Normal (null) first, then each scene,
 * wrapping round at either end. A scene that no longer exists steps from Normal.
 */
export function stepScene(
  scenes: readonly string[],
  current: string | null,
  by: 1 | -1,
): string | null {
  const order: (string | null)[] = [null, ...scenes];
  const index = Math.max(0, order.indexOf(current));
  return order[(index + by + order.length) % order.length] ?? null;
}
