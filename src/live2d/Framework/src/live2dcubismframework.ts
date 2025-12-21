/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismIdManager } from "./id/cubismidmanager";
import { CubismRenderer } from "./rendering/cubismrenderer";
import { CSM_ASSERT, CubismLogInfo, CubismLogWarning } from "./utils/cubismdebug";
import { Value } from "./utils/cubismjson";

export function strtod(s: string, endPtr: string[]): number {
  let index = 0;
  for (let i = 1; ; i++) {
    const testC: string = s.slice(i - 1, i);

    // 指数・マイナスの可能性があるのでスキップする
    if (testC == "e" || testC == "-" || testC == "E") {
      continue;
    } // 文字列の範囲を広げていく

    const test: string = s.substring(0, i);
    const number = Number(test);
    if (isNaN(number)) {
      // 数値として認識できなくなったので終了
      break;
    } // 最後に数値としてできたindexを� �納しておく

    index = i;
  }
  let d = parseFloat(s); // パースした数値

  if (isNaN(d)) {
    // 数値として認識できなくなったので終了
    d = NaN;
  }

  endPtr[0] = s.slice(index); // 後続の文字列
  return d;
}

// ファイルスコープの変数を初期化

let s_isStarted = false;
let s_isInitialized = false;
let s_option: Option = null;
let s_cubismIdManager: CubismIdManager = null;

/**
 * Framework内で使う定数の宣言
 */
export const Constant = Object.freeze<Record<string, number>>({
  vertexOffset: 0, // メッシュ� �点のオフセット値
  vertexStep: 2, // メッシュ� �点のステップ値
});

export function csmDelete<T>(address: T): void {
  if (!address) {
    return;
  }

  address = void 0;
}

/**
 * Live2D Cubism SDK Original Workflow SDKのエントリポイント
 * 利用開始時はCubismFramework.initialize()を呼び、CubismFramework.dispose()で終了する。
 */
export class CubismFramework {
  /**
   * Cubism FrameworkのAPIを使用可能にする。
   *  APIを実行する前に必ずこの関数を実行すること。
   *  一度準備が完了して以降は、再び実行しても内部処理がスキップされます。
   *
   * @param    option      Optionクラスのインスタンス
   *
   * @return   準備処理が完了したらtrueが返ります。
   */
  public static startUp(option: Option = null): boolean {
    if (s_isStarted) {
      CubismLogInfo("CubismFramework.startUp() is already done.");
      return s_isStarted;
    }

    s_option = option;

    if (s_option != null) {
      Live2DCubismCore.Logging.csmSetLogFunction(s_option.logFunction);
    }

    s_isStarted = true;

    // Live2D Cubism Coreバージョン情� �を表示
    if (s_isStarted) {
      const version: number = Live2DCubismCore.Version.csmGetVersion();
      const major: number = (version & 0xff000000) >> 24;
      const minor: number = (version & 0x00ff0000) >> 16;
      const patch: number = version & 0x0000ffff;
      const versionNumber: number = version;

      CubismLogInfo(
        `Live2D Cubism Core version: {0}.{1}.{2} ({3})`,
        ("00" + major).slice(-2),
        ("00" + minor).slice(-2),
        ("0000" + patch).slice(-4),
        versionNumber,
      );
    }

    CubismLogInfo("CubismFramework.startUp() is complete.");

    return s_isStarted;
  }

  /**
   * StartUp()で初期化したCubismFrameworkの各パラメータをクリアします。
   * Dispose()したCubismFrameworkを再利用する際に利用してく� さい。
   */
  public static cleanUp(): void {
    s_isStarted = false;
    s_isInitialized = false;
    s_option = null;
    s_cubismIdManager = null;
  }

  /**
   * Cubism Framework内のリソースを初期化してモデルを表示可能な状態にします。<br>
   *     再度Initialize()するには先にDispose()を実行する必要があります。
   *
   * @param memorySize 初期化時メモリ量 [byte(s)]
   *    複数モデル表示時などにモデルが更新されない際に使用してく� さい。
   *    指定する際は必ず1024*1024*16 byte(16MB)以上の値を指定してく� さい。
   *    それ以外はすべて1024*1024*16 byteに丸めます。
   */
  public static initialize(memorySize = 0): void {
    CSM_ASSERT(s_isStarted);
    if (!s_isStarted) {
      CubismLogWarning("CubismFramework is not started.");
      return;
    }

    // --- s_isInitializedによる連続初期化ガード ---
    // 連続してリソース確保が行われないようにする。
    // 再度Initialize()するには先にDispose()を実行する必要がある。
    if (s_isInitialized) {
      CubismLogWarning("CubismFramework.initialize() skipped, already initialized.");
      return;
    }

    //---- static 初期化 ----
    Value.staticInitializeNotForClientCall();

    s_cubismIdManager = new CubismIdManager();

    // --- HACK: 初期化時メモリ量の拡張(単位byte) ---
    // 複数モデル表示時などにモデルが更新されない際に使用してく� さい。
    // 指定する際は必ず1024*1024*16 byte(16MB)以上の値を指定してく� さい。
    // それ以外はすべて1024*1024*16 byteに丸めます。
    Live2DCubismCore.Memory.initializeAmountOfMemory(memorySize);

    s_isInitialized = true;

    CubismLogInfo("CubismFramework.initialize() is complete.");
  }

  /**
   * Cubism Framework内の全てのリソースを解放します。
   *      た� し、外部で確保されたリソースについては解放しません。
   *      外部で適切に� �棄する必要があります。
   */
  public static dispose(): void {
    CSM_ASSERT(s_isStarted);
    if (!s_isStarted) {
      CubismLogWarning("CubismFramework is not started.");
      return;
    }

    // --- s_isInitializedによる未初期化解放ガード ---
    // dispose()するには先にinitialize()を実行する必要がある。
    if (!s_isInitialized) {
      // false...リソース未確保の� �合
      CubismLogWarning("CubismFramework.dispose() skipped, not initialized.");
      return;
    }

    Value.staticReleaseNotForClientCall();

    s_cubismIdManager.release();
    s_cubismIdManager = null;

    // レンダラの静的リソース（シェーダプログラ� 他）を解放する
    CubismRenderer.staticRelease();

    s_isInitialized = false;

    CubismLogInfo("CubismFramework.dispose() is complete.");
  }

  /**
   * Cubism FrameworkのAPIを使用する準備が完了したかどうか
   * @return APIを使用する準備が完了していればtrueが返ります。
   */
  public static isStarted(): boolean {
    return s_isStarted;
  }

  /**
   * Cubism Frameworkのリソース初期化がすでに行われているかどうか
   * @return リソース確保が完了していればtrueが返ります
   */
  public static isInitialized(): boolean {
    return s_isInitialized;
  }

  /**
   * Core APIにバインドしたログ関数を実行する
   *
   * @praram message ログメッセージ
   */
  public static coreLogFunction(message: string): void {
    // Return if logging not possible.
    if (!Live2DCubismCore.Logging.csmGetLogFunction()) {
      return;
    }

    Live2DCubismCore.Logging.csmGetLogFunction()(message);
  }

  /**
   * 現在のログ出力レベル設定の値を返す。
   *
   * @return  現在のログ出力レベル設定の値
   */
  public static getLoggingLevel(): LogLevel {
    if (s_option != null) {
      return s_option.loggingLevel;
    }
    return LogLevel.LogLevel_Off;
  }

  /**
   * IDマネージャのインスタンスを取得する
   * @return CubismManagerクラスのインスタンス
   */
  public static getIdManager(): CubismIdManager {
    return s_cubismIdManager;
  }

  /**
   * 静的クラスとして使用する
   * インスタンス化させない
   */
  private constructor() {}
}

export class Option {
  logFunction: Live2DCubismCore.csmLogFunction; // ログ出力の関数オブジェクト
  loggingLevel: LogLevel; // ログ出力レベルの設定
}

/**
 * ログ出力のレベル
 */
export enum LogLevel {
  LogLevel_Verbose = 0, // 詳細ログ
  LogLevel_Debug, // デバッグログ
  LogLevel_Info, // Infoログ
  LogLevel_Warning, // 警告ログ
  LogLevel_Error, // エラーログ
  LogLevel_Off, // ログ出力無効
}

// Namespace definition for compatibility.
import * as $ from "./live2dcubismframework";
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Live2DCubismFramework {
  export const Constant = $.Constant;
  export const csmDelete = $.csmDelete;
  export const CubismFramework = $.CubismFramework;
  export type CubismFramework = $.CubismFramework;
}
