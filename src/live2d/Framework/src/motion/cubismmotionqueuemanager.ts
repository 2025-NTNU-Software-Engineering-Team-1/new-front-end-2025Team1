/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { ACubismMotion } from "./acubismmotion";
import { CubismMotionQueueEntry } from "./cubismmotionqueueentry";
import { csmVector, iterator } from "../type/csmvector";
import { CubismModel } from "../model/cubismmodel";
import { csmString } from "../type/csmstring";

/**
 * モーション再生の管理
 *
 * モーション再生の管理用クラス。CubismMotionモーションなどACubismMotionのサブクラスを再生するために使用する。
 *
 * @note 再生中に別のモーションが StartMotion()された� �合は、新しいモーションに滑らかに変化し旧モーションは中断する。
 *       表情用モーション、体用モーションなどを分けてモーション化した� �合など、
 *       複数のモーションを同時に再生させる� �合は、複数のCubismMotionQueueManagerインスタンスを使用する。
 */
export class CubismMotionQueueManager {
  /**
   * コンストラクタ
   */
  public constructor() {
    this._userTimeSeconds = 0.0;
    this._eventCallBack = null;
    this._eventCustomData = null;
    this._motions = new csmVector<CubismMotionQueueEntry>();
  }

  /**
   * デストラクタ
   */
  public release(): void {
    for (let i = 0; i < this._motions.getSize(); ++i) {
      if (this._motions.at(i)) {
        this._motions.at(i).release();
        this._motions.set(i, null);
      }
    }

    this._motions = null;
  }

  /**
   * 指定したモーションの開始
   *
   * 指定したモーションを開始する。同じタイプのモーションが既にある� �合は、既存のモーションに終了フラグを立て、フェードアウトを開始させる。
   *
   * @param   motion          開始するモーション
   * @param   autoDelete      再生が終了したモーションのインスタンスを削除するなら true
   * @param   userTimeSeconds Deprecated: デルタ時間の積算値[秒] 関数内で参照していないため使用は非推奨。
   * @return                      開始したモーションの識別番号を返す。個別のモーションが終了したか否かを判定するIsFinished()の引数で使用する。開始できない時は「-1」
   */
  public startMotion(
    motion: ACubismMotion,
    autoDelete: boolean,
    userTimeSeconds?: number,
  ): CubismMotionQueueEntryHandle {
    if (motion == null) {
      return InvalidMotionQueueEntryHandleValue;
    }

    let motionQueueEntry: CubismMotionQueueEntry = null;

    // 既にモーションがあれば終了フラグを立てる
    for (let i = 0; i < this._motions.getSize(); ++i) {
      motionQueueEntry = this._motions.at(i);
      if (motionQueueEntry == null) {
        continue;
      }

      motionQueueEntry.setFadeOut(motionQueueEntry._motion.getFadeOutTime()); // フェードアウト設定
    }

    motionQueueEntry = new CubismMotionQueueEntry(); // 終了時に� �棄する
    motionQueueEntry._autoDelete = autoDelete;
    motionQueueEntry._motion = motion;

    this._motions.pushBack(motionQueueEntry);

    return motionQueueEntry._motionQueueEntryHandle;
  }

  /**
   * 全てのモーションの終了の確認
   * @return true 全て終了している
   * @return false 終了していない
   */
  public isFinished(): boolean {
    // ------- 処理を行う -------
    // 既にモーションがあれば終了フラグを立てる

    for (
      let ite: iterator<CubismMotionQueueEntry> = this._motions.begin();
      ite.notEqual(this._motions.end());
    ) {
      let motionQueueEntry: CubismMotionQueueEntry = ite.ptr();

      if (motionQueueEntry == null) {
        ite = this._motions.erase(ite); // 削除
        continue;
      }

      const motion: ACubismMotion = motionQueueEntry._motion;

      if (motion == null) {
        motionQueueEntry.release();
        motionQueueEntry = null;
        ite = this._motions.erase(ite); // 削除
        continue;
      }

      // ----- 終了済みの処理があれば削除する ------
      if (!motionQueueEntry.isFinished()) {
        return false;
      } else {
        ite.preIncrement();
      }
    }

    return true;
  }

  /**
   * 指定したモーションの終了の確認
   * @param motionQueueEntryNumber モーションの識別番号
   * @return true 全て終了している
   * @return false 終了していない
   */
  public isFinishedByHandle(motionQueueEntryNumber: CubismMotionQueueEntryHandle): boolean {
    for (
      let ite: iterator<CubismMotionQueueEntry> = this._motions.begin();
      ite.notEqual(this._motions.end());
      ite.increment()
    ) {
      const motionQueueEntry: CubismMotionQueueEntry = ite.ptr();

      if (motionQueueEntry == null) {
        continue;
      }

      if (
        motionQueueEntry._motionQueueEntryHandle == motionQueueEntryNumber &&
        !motionQueueEntry.isFinished()
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * 全てのモーションを停止する
   */
  public stopAllMotions(): void {
    // ------- 処理を行う -------
    // 既にモーションがあれば終了フラグを立てる

    for (
      let ite: iterator<CubismMotionQueueEntry> = this._motions.begin();
      ite.notEqual(this._motions.end());
    ) {
      let motionQueueEntry: CubismMotionQueueEntry = ite.ptr();

      if (motionQueueEntry == null) {
        ite = this._motions.erase(ite);

        continue;
      }

      // ----- 終了済みの処理があれば削除する ------
      motionQueueEntry.release();
      motionQueueEntry = null;
      ite = this._motions.erase(ite); // 削除
    }
  }

  /**
   * @brief CubismMotionQueueEntryの配列の取得
   *
   * CubismMotionQueueEntryの配列を取得する。
   *
   * @return  CubismMotionQueueEntryの配列へのポインタ
   * @retval  NULL   見つからなかった
   */
  public getCubismMotionQueueEntries(): csmVector<CubismMotionQueueEntry> {
    return this._motions;
  }

  /**
   * 指定したCubismMotionQueueEntryの取得

   * @param   motionQueueEntryNumber  モーションの識別番号
   * @return  指定したCubismMotionQueueEntry
   * @return  null   見つからなかった
   */
  public getCubismMotionQueueEntry(motionQueueEntryNumber: unknown): CubismMotionQueueEntry {
    //------- 処理を行う -------
    for (
      let ite: iterator<CubismMotionQueueEntry> = this._motions.begin();
      ite.notEqual(this._motions.end());
      ite.preIncrement()
    ) {
      const motionQueueEntry: CubismMotionQueueEntry = ite.ptr();

      if (motionQueueEntry == null) {
        continue;
      }

      if (motionQueueEntry._motionQueueEntryHandle == motionQueueEntryNumber) {
        return motionQueueEntry;
      }
    }

    return null;
  }

  /**
   * イベントを受け取るCallbackの登録
   *
   * @param callback コールバック関数
   * @param customData コールバックに返されるデータ
   */
  public setEventCallback(callback: CubismMotionEventFunction, customData: unknown = null): void {
    this._eventCallBack = callback;
    this._eventCustomData = customData;
  }

  /**
   * モーションを更新して、モデルにパラメータ値を反� する。
   *
   * @param   model   対象のモデル
   * @param   userTimeSeconds   デルタ時間の積算値[秒]
   * @return  true    モデルへパラメータ値の反� あり
   * @return  false   モデルへパラメータ値の反� なし(モーションの変化なし)
   */
  public doUpdateMotion(model: CubismModel, userTimeSeconds: number): boolean {
    let updated = false;

    // ------- 処理を行う --------
    // 既にモーションがあれば終了フラグを立てる

    for (
      let ite: iterator<CubismMotionQueueEntry> = this._motions.begin();
      ite.notEqual(this._motions.end());
    ) {
      let motionQueueEntry: CubismMotionQueueEntry = ite.ptr();

      if (motionQueueEntry == null) {
        ite = this._motions.erase(ite); // 削除
        continue;
      }

      const motion: ACubismMotion = motionQueueEntry._motion;

      if (motion == null) {
        motionQueueEntry.release();
        motionQueueEntry = null;
        ite = this._motions.erase(ite); // 削除

        continue;
      }

      // ------ 値を反� する ------
      motion.updateParameters(model, motionQueueEntry, userTimeSeconds);
      updated = true;

      // ------ ユーザトリガーイベントを検査する ----
      const firedList: csmVector<csmString> = motion.getFiredEvent(
        motionQueueEntry.getLastCheckEventSeconds() - motionQueueEntry.getStartTime(),
        userTimeSeconds - motionQueueEntry.getStartTime(),
      );

      for (let i = 0; i < firedList.getSize(); ++i) {
        this._eventCallBack(this, firedList.at(i), this._eventCustomData);
      }

      motionQueueEntry.setLastCheckEventSeconds(userTimeSeconds);

      // ------ 終了済みの処理があれば削除する ------
      if (motionQueueEntry.isFinished()) {
        motionQueueEntry.release();
        motionQueueEntry = null;
        ite = this._motions.erase(ite); // 削除
      } else {
        if (motionQueueEntry.isTriggeredFadeOut()) {
          motionQueueEntry.startFadeOut(motionQueueEntry.getFadeOutSeconds(), userTimeSeconds);
        }
        ite.preIncrement();
      }
    }

    return updated;
  }
  _userTimeSeconds: number; // デルタ時間の積算値[秒]

  _motions: csmVector<CubismMotionQueueEntry>; // モーション
  _eventCallBack: CubismMotionEventFunction; // コールバック関数
  _eventCustomData: unknown; // コールバックに戻されるデータ
}

/**
 * イベントのコールバック関数を定義
 *
 * イベントのコールバックに登録できる関数の型情� �
 * @param caller        発火したイベントを再生させたCubismMotionQueueManager
 * @param eventValue    発火したイベントの文字列データ
 * @param customData   コールバックに返される登録時に指定されたデータ
 */
export interface CubismMotionEventFunction {
  (caller: CubismMotionQueueManager, eventValue: csmString, customData: unknown): void;
}

/**
 * モーションの識別番号
 *
 * モーションの識別番号の定義
 */
export declare type CubismMotionQueueEntryHandle = any;
export const InvalidMotionQueueEntryHandleValue: CubismMotionQueueEntryHandle = -1;

// Namespace definition for compatibility.
import * as $ from "./cubismmotionqueuemanager";
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Live2DCubismFramework {
  export const CubismMotionQueueManager = $.CubismMotionQueueManager;
  export type CubismMotionQueueManager = $.CubismMotionQueueManager;
  export const InvalidMotionQueueEntryHandleValue = $.InvalidMotionQueueEntryHandleValue;
  export type CubismMotionQueueEntryHandle = $.CubismMotionQueueEntryHandle;
  export type CubismMotionEventFunction = $.CubismMotionEventFunction;
}
