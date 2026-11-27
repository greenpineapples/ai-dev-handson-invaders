import { describe, expect, it } from "vitest";
import { BULLET, FORMATION, PLAYER, WIDTH } from "./config";
import { intersects } from "./collision";
import { createFormation, createGame, formationSpeed, step } from "./game";
import type { GameState, Input } from "./types";

const NONE: Input = { left: false, right: false, fire: false, start: false };
const never = () => 0.99; // 敵の弾の間隔を長くして、テストの邪魔をさせない

function playing(): GameState {
  return step(createGame(), { ...NONE, start: true }, 0);
}

describe("intersects", () => {
  it("重なっていれば true", () => {
    expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
  });
  it("辺が接しているだけなら false", () => {
    expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
  });
});

describe("createFormation", () => {
  it("行 × 列の数だけ敵を並べ、上の行ほど得点が高い", () => {
    const enemies = createFormation();
    expect(enemies).toHaveLength(FORMATION.rows * FORMATION.cols);
    expect(enemies[0].points).toBeGreaterThan(enemies[enemies.length - 1].points);
  });
  it("隊列は画面の左右の中央にある", () => {
    const enemies = createFormation();
    const left = Math.min(...enemies.map((e) => e.x));
    const right = Math.max(...enemies.map((e) => e.x + e.w));
    expect(left).toBeCloseTo(WIDTH - right);
  });
});

describe("formationSpeed", () => {
  it("敵が減るほど速くなる", () => {
    expect(formationSpeed(45, 45)).toBe(FORMATION.baseSpeed);
    expect(formationSpeed(1, 45)).toBe(FORMATION.baseSpeed * FORMATION.maxSpeedRate);
    expect(formationSpeed(20, 45)).toBeGreaterThan(formationSpeed(30, 45));
  });
});

describe("step", () => {
  it("ready のあいだは start が来るまで進まない", () => {
    const s = createGame();
    expect(step(s, NONE, 1).status).toBe("ready");
    expect(step(s, { ...NONE, start: true }, 0).status).toBe("playing");
  });

  it("自機は左右に動き、画面の外には出ない", () => {
    const s = playing();
    const x0 = s.player.x;
    step(s, { ...NONE, right: true }, 0.1, never);
    expect(s.player.x).toBeCloseTo(x0 + PLAYER.speed * 0.1);
    step(s, { ...NONE, left: true }, 10, never);
    expect(s.player.x).toBe(0);
  });

  it("撃つと弾が 1 発出て、待ち時間のあいだは次が出ない", () => {
    const s = playing();
    step(s, { ...NONE, fire: true }, 0.01, never);
    step(s, { ...NONE, fire: true }, 0.01, never);
    expect(s.playerBullets).toHaveLength(1);
    step(s, { ...NONE, fire: true }, BULLET.playerCooldown, never);
    expect(s.playerBullets).toHaveLength(2);
  });

  it("弾が敵に当たると、敵が消えて得点が入る", () => {
    const s = playing();
    const target = s.enemies[s.enemies.length - 1];
    s.playerBullets.push({ x: target.x + 1, y: target.y + 1, w: BULLET.w, h: BULLET.h, vy: 0 });
    step(s, NONE, 0, never);
    expect(target.alive).toBe(false);
    expect(s.score).toBe(target.points);
    expect(s.playerBullets).toHaveLength(0);
  });

  it("隊列が端に着くと 1 段下がって向きを変える", () => {
    const s = playing();
    const y0 = s.enemies[0].y;
    for (let i = 0; i < 1000 && s.direction === 1; i++) step(s, NONE, 0.05, never);
    expect(s.direction).toBe(-1);
    expect(s.enemies[0].y).toBe(y0 + FORMATION.stepDown);
  });

  it("敵の弾に当たると残機が減り、0 になるとゲームオーバー", () => {
    const s = playing();
    const hitPlayer = () =>
      s.enemyBullets.push({ x: s.player.x + 1, y: s.player.y + 1, w: BULLET.w, h: BULLET.h, vy: 0 });
    hitPlayer();
    step(s, NONE, 0, never);
    expect(s.lives).toBe(PLAYER.lives - 1);
    expect(s.status).toBe("playing");
    s.lives = 1;
    hitPlayer();
    step(s, NONE, 0, never);
    expect(s.status).toBe("over");
  });

  it("敵がすべて消えるとクリア", () => {
    const s = playing();
    for (const e of s.enemies) e.alive = false;
    step(s, NONE, 0.01, never);
    expect(s.status).toBe("clear");
  });

  it("敵が自機の高さまで下りてくるとゲームオーバー", () => {
    const s = playing();
    for (const e of s.enemies) e.y = s.player.y;
    step(s, NONE, 0, never);
    expect(s.status).toBe("over");
  });
});

describe("面（ウェーブ）", () => {
  function cleared(): GameState {
    const s = playing();
    for (const e of s.enemies) e.alive = false;
    step(s, NONE, 0.01, never);
    return s;
  }

  it("最初の面は 1", () => {
    expect(createGame().wave).toBe(1);
    expect(playing().wave).toBe(1);
  });

  it("clear で start を押すと、スコアと残機はそのままで次の面に進み、隊列が並び直す", () => {
    const s = cleared();
    expect(s.status).toBe("clear");
    s.score = 1234;
    s.lives = 2;
    const next = step(s, { ...NONE, start: true }, 0, never);
    expect(next.status).toBe("playing");
    expect(next.wave).toBe(2);
    expect(next.score).toBe(1234);
    expect(next.lives).toBe(2);
    expect(next.enemies).toEqual(createFormation());
    expect(next.direction).toBe(1);
  });

  it("面を続けてクリアすると、面の番号が 1 ずつ増える", () => {
    let s = cleared();
    s = step(s, { ...NONE, start: true }, 0, never);
    for (const e of s.enemies) e.alive = false;
    step(s, NONE, 0.01, never);
    s = step(s, { ...NONE, start: true }, 0, never);
    expect(s.wave).toBe(3);
  });

  it("over で start を押すと、面 1・スコア 0 から始まる", () => {
    const s = cleared();
    const s2 = step(s, { ...NONE, start: true }, 0, never);
    s2.score = 500;
    s2.status = "over";
    const next = step(s2, { ...NONE, start: true }, 0, never);
    expect(next.status).toBe("playing");
    expect(next.wave).toBe(1);
    expect(next.score).toBe(0);
    expect(next.lives).toBe(PLAYER.lives);
  });

  it("隊列の横の速さは、面ごとに 1.2 倍ずつ速くなる（面 1 は今と同じ）", () => {
    expect(FORMATION.waveSpeedRate).toBe(1.2);
    expect(formationSpeed(45, 45, 1)).toBe(FORMATION.baseSpeed);
    expect(formationSpeed(45, 45)).toBe(FORMATION.baseSpeed);
    expect(formationSpeed(45, 45, 2)).toBeCloseTo(FORMATION.baseSpeed * 1.2);
    expect(formationSpeed(45, 45, 3)).toBeCloseTo(FORMATION.baseSpeed * 1.2 * 1.2);
    expect(formationSpeed(1, 45, 2)).toBeCloseTo(FORMATION.baseSpeed * FORMATION.maxSpeedRate * 1.2);
  });

  it("面 2 では、隊列が 1 フレームで面 1 の 1.2 倍動く", () => {
    // 隊列は中央から始まり、0.1 秒では端に着かない（端に着くと横ではなく下に動くため）
    const dt = 0.1;
    const s1 = playing();
    const x1 = s1.enemies[0].x;
    step(s1, NONE, dt, never);
    const s2 = step(cleared(), { ...NONE, start: true }, 0, never);
    const x2 = s2.enemies[0].x;
    step(s2, NONE, dt, never);
    expect(s2.enemies[0].x - x2).toBeCloseTo((s1.enemies[0].x - x1) * 1.2);
  });
});
