/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismModel } from "../model/cubismmodel";
import { ACubismMotion } from "./acubismmotion";
import { CubismMotionQueueEntryHandle, CubismMotionQueueManager } from "./cubismmotionqueuemanager";

/**
 * モーションの管理
 *
 * モーションの管理を行うクラス
 */
export class CubismMotionManager extends CubismMotionQueueManager {
  /**
   * コンストラクタ
   */
  public constructor() {
    super();
    this._currentPriority = 0;
    this._reservePriority = 0;
  }

  /**
   * 再生中のモーションの優先度の取得
   * @return  モーションの優先度
   */
  public getCurrentPriority(): number {
    return this._currentPriority;
  }

  /**
   * 予約中のモーションの優先度を取得する。
   * @return  モーションの優先度
   */
  public getReservePriority(): number {
    return this._reservePriority;
  }

  /**
   * 予約中のモーションの優先度を設定する。
   * @param   val     優先度
   */
  public setReservePriority(val: number): void {
    this._reservePriority = val;
  }

  /**
   * 優先度を設定してモーションを開始する。
   *
   * @param motion          モーション
   * @param autoDelete      再生が狩猟したモーションのインスタンスを削除するならtrue
   * @param priority        優先度
   * @return                開始したモーションの識別番号を返す。個別のモーションが終了したか否かを判定するIsFinished()の引数で使用する。開始できない時は「-1」
   */
  public startMotionPriority(
    motion: ACubismMotion,
    autoDelete: boolean,
    priority: number,
  ): CubismMotionQueueEntryHandle {
    if (priority == this._reservePriority) {
      this._reservePriority = 0; // 予約を解除
    }

    this._currentPriority = priority; // 再生中モーションの優先度を設定

    return super.startMotion(motion, autoDelete);
  }

  /**
   * モーションを更新して、モデルにパラメータ値を反� する。
   *
   * @param model   対象のモデル
   * @param deltaTimeSeconds    デルタ時間[秒]
   * @return  true    更新されている
   * @return  false   更新されていない
   */
  public updateMotion(model: CubismModel, deltaTimeSeconds: number): boolean {
    this._userTimeSeconds += deltaTimeSeconds;

    const updated: boolean = super.doUpdateMotion(model, this._userTimeSeconds);

    if (this.isFinished()) {
      this._currentPriority = 0; // 再生中のモーションの優先度を解除
    }

    return updated;
  }

  /**
   * モーションを予約する。
   *
   * @param   priority    優先度
   * @return  true    予約できた
   * @return  false   予約できなかった
   */
  public reserveMotion(priority: number): boolean {
    if (priority <= this._reservePriority || priority <= this._currentPriority) {
      return false;
    }

    this._reservePriority = priority;

    return true;
  }

  _currentPriority: number; // 現在再生中のモーションの優先度
  _reservePriority: number; // 再生予定のモーションの優先度。再生中は0になる。モーションファイルを別スレッドで読み込むときの機能。
}

// Namespace definition for compatibility.
import * as $ from "./cubismmotionmanager";
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Live2DCubismFramework {
  export const CubismMotionManager = $.CubismMotionManager;
  export type CubismMotionManager = $.CubismMotionManager;
}
