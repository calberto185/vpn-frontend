import { Injectable } from '@angular/core';

/**
 * SoundService — generates a pleasant notification chime using the Web Audio API.
 * No audio files required. Works in all modern browsers.
 */
@Injectable({ providedIn: 'root' })
export class SoundService {

  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  /**
   * Play a soft two-tone chime (high → mid), ~400 ms total.
   * Silently skipped if the browser blocks autoplay.
   */
  playMessage(): void {
    try {
      const ctx  = this.getCtx();
      const gain = ctx.createGain();
      gain.connect(ctx.destination);

      const notes = [
        { freq: 880, start: 0,    duration: 0.18 },  // A5
        { freq: 659, start: 0.18, duration: 0.22 },  // E5
      ];

      const now = ctx.currentTime;

      for (const note of notes) {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();

        osc.type      = 'sine';
        osc.frequency.setValueAtTime(note.freq, now + note.start);

        // Smooth envelope: quick attack, soft decay
        g.gain.setValueAtTime(0, now + note.start);
        g.gain.linearRampToValueAtTime(0.28, now + note.start + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);

        osc.connect(g);
        g.connect(ctx.destination);

        osc.start(now + note.start);
        osc.stop(now + note.start + note.duration);
      }
    } catch {
      // Autoplay policy or unsupported — fail silently
    }
  }
}
