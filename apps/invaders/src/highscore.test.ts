import { describe, expect, it } from "vitest";
import { formatHighScore, loadHighScore, updateHighScore, type ScoreStorage } from "./highscore";

function memoryStorage(): ScoreStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const broken: ScoreStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("highscore", () => {
  it("何も保存されていなければ 0", () => {
    expect(loadHighScore(memoryStorage())).toBe(0);
  });

  it("高いスコアは保存され、読み直すと残っている", () => {
    const s = memoryStorage();
    expect(updateHighScore(0, 310, s)).toBe(310);
    expect(loadHighScore(s)).toBe(310);
  });

  it("ハイスコア以下のスコアでは更新しない", () => {
    const s = memoryStorage();
    updateHighScore(0, 310, s);
    expect(updateHighScore(310, 200, s)).toBe(310);
    expect(updateHighScore(310, 310, s)).toBe(310);
    expect(loadHighScore(s)).toBe(310);
  });

  it("壊れた値は 0 として読む", () => {
    const s = memoryStorage();
    s.data.set("ai-invaders:high-score", "abc");
    expect(loadHighScore(s)).toBe(0);
  });

  it("localStorage が使えなくても例外を出さず、ハイスコアは 0 のまま", () => {
    expect(loadHighScore(null)).toBe(0);
    expect(loadHighScore(broken)).toBe(0);
    expect(updateHighScore(0, 100, null)).toBe(0);
    expect(updateHighScore(0, 100, broken)).toBe(0);
  });

  it("5 桁・0 埋めで表示する", () => {
    expect(formatHighScore(310)).toBe("HI 00310");
    expect(formatHighScore(0)).toBe("HI 00000");
  });
});
