/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */

// 這個補丁會修補 Live2D Framework TS 原始碼
// 和官方 'live2dcubismcore.d.ts' 型別定義檔之間的不一致。

declare namespace Live2DCubismCore {
  // 修補在 .ts 原始碼中存在，但在 .d.ts 中缺少的屬性
  // @ts-expect-error
  let Logging: unknown;
  // @ts-expect-error
  let Version: unknown;
  // @ts-expect-error
  let Memory: unknown;
  // @ts-expect-error
  let Utils: unknown;

  // 修補在 .ts 原始碼中存在，但在 .d.ts 中缺少的型別
  type csmLogFunction = (message: string) => void;
  type csmParameterType = any;

  // --- 這是新的修復 ---
  // 修復 'Moc' 和 'Model' 被當作型別使用，
  // 但在 .d.ts 中卻只被定義為「值」(const) 的錯誤。
  // 我們在這裡手動幫它們� 上同名的「型別」。
  type Moc = any;
  type Model = any;
}

// 修補 'Cannot find name 'LAppGlManager''
declare class LAppGlManager {}
