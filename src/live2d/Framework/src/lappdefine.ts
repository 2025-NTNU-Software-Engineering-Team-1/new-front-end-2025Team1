// @ts-nocheck
/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LogLevel } from "@framework/live2dcubismframework";

/**
 * Sample Appで使用する定数
 */

// Canvas width and height pixel values, or dynamic screen size ('auto').
export const CanvasId: string = "live2d-canvas";
export const CanvasWidth = 400; // 可以之後微調
export const CanvasHeight = 520; // 先跟聊天框差不多高

// キャンバスの数
export const CanvasNum = 1;

// 画面
export const ViewScale = 1.0;
export const ViewMaxScale = 2.0;
export const ViewMinScale = 0.8;

export const ViewLogicalLeft = -1.0;
export const ViewLogicalRight = 1.0;
export const ViewLogicalBottom = -1.0;
export const ViewLogicalTop = 1.0;

export const ViewLogicalMaxLeft = -2.0;
export const ViewLogicalMaxRight = 2.0;
export const ViewLogicalMaxBottom = -2.0;
export const ViewLogicalMaxTop = 2.0;

// 相対パス - Dynamic skin support
// Default built-in skin (loaded from MinIO via API)
const apiBase = ((import.meta.env.VITE_APP_API_BASE_URL as string) || "/api").replace(/\/$/, "");
const defaultSkinPath = `${apiBase}/ai/skins/builtin_hiyori/assets/runtime/`;
let _resourcesPath = defaultSkinPath;
let _modelJsonName = "hiyori_pro_t11.model3.json";

// Getter functions for dynamic access
export const getResourcesPath = (): string => _resourcesPath;
export const getModelJsonName = (): string => _modelJsonName;

// Legacy exports for compatibility (use getters in new code)
export const ResourcesPath = _resourcesPath;
export const ModelJsonName = _modelJsonName;

/**
 * Set skin configuration dynamically
 * @param resourcesPath - Path to skin resources folder
 * @param modelJsonName - Name of the model3.json file
 */
export const setSkinConfig = (resourcesPath: string, modelJsonName: string): void => {
  _resourcesPath = resourcesPath;
  _modelJsonName = modelJsonName;
};

/**
 * Get current skin configuration
 */
export const getSkinConfig = (): { resourcesPath: string; modelJsonName: string } => ({
  resourcesPath: _resourcesPath,
  modelJsonName: _modelJsonName,
});

/**
 * Reset to default built-in skin
 */
export const resetToDefaultSkin = (): void => {
  _resourcesPath = defaultSkinPath;
  _modelJsonName = "hiyori_pro_t11.model3.json";
};

// モデルの後ろにある背景の画像ファイル
export const BackImageName = "";

// 歯車
export const GearImageName = "";

// 終了ボタン
export const PowerImageName = "";

// モデル定義---------------------------------------------
// モデルを配置したディレクトリ名の配列
// ディレクトリ名とmodel3.jsonの名前を一致させておくこと

export const ModelDir: string[] = ["."]; // 其實沒用，但防止程式出錯
export const ModelDirSize: number = ModelDir.length;

// 外部定義ファイル（json）と合わせる
export const MotionGroupIdle = "Idle"; // アイドリング
export const MotionGroupTapBody = "TapBody"; // 体をタップしたとき

// 外部定義ファイル（json）と合わせる
export const HitAreaNameHead = "Head";
export const HitAreaNameBody = "Body";

// モーションの優先度定数
export const PriorityNone = 0;
export const PriorityIdle = 1;
export const PriorityNormal = 2;
export const PriorityForce = 3;

// MOC3の整合性検証オプション
export const MOCConsistencyValidationEnable = true;
// motion3.jsonの整合性検証オプション
export const MotionConsistencyValidationEnable = true;

// デバッグ用ログの表示オプション
export const DebugLogEnable = true;
export const DebugTouchLogEnable = false;

// Frameworkから出力するログのレベル設定
export const CubismLoggingLevel: LogLevel = LogLevel.LogLevel_Verbose;

// デフォルトのレンダーターゲットサイズ
export const RenderTargetWidth = 1900;
export const RenderTargetHeight = 1000;
