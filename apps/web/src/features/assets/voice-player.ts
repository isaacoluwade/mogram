import type { Voice } from "@mogram/core/assets";
import { findAsset } from "./remote";

/** What plays a beat's recording: one at a time, stopped when the picture moves on by hand. */
export interface Sound {
  play(voice: Voice): void;
  stop(): void;
}

/**
 * Plays recordings in the browser (D-105): the clip's bytes from this browser or the diagram's
 * server, from the end of the silence it starts with.
 */
export class VoicePlayer implements Sound {
  private audio: HTMLAudioElement | null = null;
  private url: string | null = null;
  private run = 0;

  /** `onEnd` is told when what's playing stops, by itself or not. */
  constructor(private readonly onEnd: (() => void) | null = null) {}

  play(voice: Voice): void {
    this.stop();
    const run = this.run;
    void findAsset(voice.pointer).then((blob) => {
      if (blob === null || run !== this.run) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.currentTime = voice.skip;
      // The silence after the last word isn't played either.
      const end = voice.skip + voice.seconds;
      audio.ontimeupdate = () => {
        if (audio.currentTime >= end) audio.pause();
      };
      audio.onpause = () => this.onEnd?.();
      this.audio = audio;
      this.url = url;
      // A browser that won't play sound before a click plays the picture without it.
      void audio.play().catch(() => undefined);
    });
  }

  stop(): void {
    this.run++;
    this.audio?.pause();
    this.audio = null;
    if (this.url !== null) URL.revokeObjectURL(this.url);
    this.url = null;
  }
}
