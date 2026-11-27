// ハイスコアをブラウザの localStorage に読み書きする。
// localStorage が使えない環境（プライベートブラウズなど）では、例外を出さずに 0 として扱う。

const KEY = "ai-invaders:high-score";

/** 読み書きに使う最小限の型（テストでは偽物を渡せる） */
export type ScoreStorage = Pick<Storage, "getItem" | "setItem">;

/** localStorage を取り出す。触っただけで例外になるブラウザもあるので、そのときは null を返す */
export function getDefaultStorage(): ScoreStorage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** 保存されたハイスコアを読む。無い・壊れている・読めないときは 0 */
export function loadHighScore(storage: ScoreStorage | null = getDefaultStorage()): number {
  if (!storage) return 0;
  try {
    const value = Number(storage.getItem(KEY));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

/**
 * 今回のスコアがハイスコアより高ければ保存する。新しいハイスコアを返す。
 * 保存できないとき（localStorage が使えない）は例外を出さず、ハイスコアは変えない（0 のまま）。
 */
export function updateHighScore(
  current: number,
  score: number,
  storage: ScoreStorage | null = getDefaultStorage(),
): number {
  if (score <= current || !storage) return current;
  try {
    storage.setItem(KEY, String(score));
    return score;
  } catch {
    return current;
  }
}

/** 画面に出す形（HI 00310） */
export function formatHighScore(score: number): string {
  return `HI ${String(score).padStart(5, "0")}`;
}
