/**
 * 미리보기·검증이 손 입력을 대신 누른다 (합성 v2 의 손: 탭·꾹 누르기·두 탭 잇기·삼각형·경로·박자·연타).
 * 가장 앞 적을 기준으로 누를 자리를 고른다.
 */
import type { InputPattern } from '../../src/data/combineV2';
import type { Command, Enemy } from '../../src/sim/types';
import type { World } from '../../src/sim/World';

export class InputDriver {
  private t = 0;
  private next = 1;
  private queue: { at: number; cmd: Command }[] = [];

  constructor(private readonly pattern: InputPattern) {}

  step(w: World, dt: number): Command[] {
    this.t += dt;
    if (this.queue.length === 0 && this.t >= this.next) this.plan(w);
    const out: Command[] = [];
    while (this.queue.length && this.queue[0].at <= this.t) out.push(this.queue.shift()!.cmd);
    return out;
  }

  private tap(x: number, y: number, at: number): void {
    this.queue.push({ at, cmd: { t: 'press', x, y } }, { at: at + 0.04, cmd: { t: 'release', x, y } });
  }

  private plan(w: World): void {
    const es: Enemy[] = w.enemies.filter((e) => !e.dead && e.y > 60 && e.y < w.field.defenseLineY - 10).sort((a, b) => b.y - a.y);
    const t = this.t;
    if (es.length === 0) {
      this.next = t + 0.3;
      return;
    }
    const f = es[0];
    const other = es.find((e) => Math.hypot(e.x - f.x, e.y - f.y) > 90) ?? es[es.length - 1];
    switch (this.pattern) {
      case 'tap':
        this.tap(f.x, f.y, t);
        this.next = t + 0.45;
        break;
      case 'hold':
        this.queue.push({ at: t, cmd: { t: 'press', x: f.x, y: f.y } }, { at: t + 1.4, cmd: { t: 'release', x: f.x, y: f.y } });
        this.next = t + 2.1;
        break;
      case 'link':
        this.tap(f.x, f.y, t);
        this.tap(other.x, other.y, t + 0.5);
        this.next = t + 2.2;
        break;
      case 'tri': {
        const cx = Math.min(Math.max(f.x, 80), w.field.width - 80);
        const cy = f.y - 40;
        this.tap(cx - 75, cy - 45, t);
        this.tap(cx + 75, cy - 45, t + 0.3);
        this.tap(cx, cy + 60, t + 0.6);
        this.next = t + 2.6;
        break;
      }
      case 'path':
        es.slice(0, 4).forEach((e, i) => this.tap(e.x, e.y, t + i * 0.22));
        this.next = t + 2.4;
        break;
      case 'beat':
        this.tap(f.x, f.y, t);
        this.next = t + 0.6;
        break;
      case 'mash':
        for (let i = 0; i < 5; i++) this.tap(f.x, f.y, t + i * 0.13);
        this.next = t + 2.2;
        break;
    }
    this.queue.sort((a, b) => a.at - b.at);
  }
}
