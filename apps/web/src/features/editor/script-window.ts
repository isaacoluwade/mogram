import { useEffect } from "react";
import { prompterChannel, withChanges, type PrompterMessage } from "@/features/prompter/channel";
import type { EditorStore } from "./store/editor-store";

/** How long after the last change the Script window is sent the files. */
const SEND_AFTER_MS = 250;

/**
 * The editor's side of the Script window (D-105): it's sent the files as they change, so what
 * it reads is what's written here, and the recordings it makes are kept here, one undo step
 * each, saved with everything else.
 */
export function useScriptWindow(store: EditorStore, id: string): void {
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(prompterChannel(id));
    let open = false;
    let timer: number | null = null;
    const send = () =>
      channel.postMessage({
        kind: "files",
        files: store.getState().files,
      } satisfies PrompterMessage);
    channel.onmessage = (event: MessageEvent<PrompterMessage>) => {
      const message = event.data;
      if (message.kind === "hello") {
        open = true;
        send();
      } else if (message.kind === "voice") {
        const kept = store
          .getState()
          .edit("Record a beat", (files) => ({ files: withChanges(files, message.files) }));
        channel.postMessage({
          kind: "voice-saved",
          id: message.id,
          reason: kept
            ? null
            : "The editor couldn't keep that recording just now. Try the beat again.",
        } satisfies PrompterMessage);
      }
    };
    const unsubscribe = store.subscribe((state, previous) => {
      if (!open || state.files === previous.files) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(send, SEND_AFTER_MS);
    });
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      unsubscribe();
      channel.close();
    };
  }, [store, id]);
}

/** Where the Script window of the diagram or deck being edited opens. */
export function scriptWindowHref(
  viewerHref: string,
  state: { readonly root: string; readonly deckRoot: string | null },
): string {
  const root = state.deckRoot ?? state.root;
  const base = viewerHref.replace(/\/view$/, "/prompter");
  return root === "" ? base : `${base}?root=${encodeURIComponent(root).replace(/%2F/g, "/")}`;
}
