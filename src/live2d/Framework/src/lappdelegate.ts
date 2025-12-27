// @ts-nocheck
/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { csmVector } from "@framework/type/csmvector";
import { CubismFramework, Option } from "@framework/live2dcubismframework";
import * as LAppDefine from "./lappdefine";
import { LAppPal } from "./lapppal";
import { LAppSubdelegate } from "./lappsubdelegate";
import { CubismLogError } from "@framework/utils/cubismdebug";

export let s_instance: LAppDelegate = null;

/**
 * アプリケーションクラス。
 * Cubism SDKの管理を行う。
 */
export class LAppDelegate {
  /**
   * クラスのインスタンス（シングルトン）を返す。
   * インスタンスが生成されていない� �合は内部でインスタンスを生成する。
   *
   * @return クラスのインスタンス
   */
  public static getInstance(): LAppDelegate {
    if (s_instance == null) {
      s_instance = new LAppDelegate();
    }

    return s_instance;
  }

  /**
   * クラスのインスタンス（シングルトン）を解放する。
   */
  public static releaseInstance(): void {
    if (s_instance != null) {
      s_instance.release();
    }

    s_instance = null;
  }

  private _isEnd: boolean = false;

  /**
   * ポインタがアクティブになるときに呼ばれる。
   */
  private onPointerBegan(e: PointerEvent): void {
    if (!this._subdelegates) {
      return;
    }

    for (let ite = this._subdelegates.begin(); ite.notEqual(this._subdelegates.end()); ite.preIncrement()) {
      const sub = ite.ptr();

      if (!sub || typeof (sub as unknown).onPointBegan !== "function") {
        continue;
      }

      (sub as unknown).onPointBegan(e.pageX, e.pageY);
    }
  }

  /**
   * ポインタが動いたら呼ばれる。
   */
  private onPointerMoved(e: PointerEvent): void {
    if (!this._subdelegates) {
      return;
    }

    for (let ite = this._subdelegates.begin(); ite.notEqual(this._subdelegates.end()); ite.preIncrement()) {
      const sub = ite.ptr();

      if (!sub || typeof (sub as unknown).onPointMoved !== "function") {
        continue;
      }

      (sub as unknown).onPointMoved(e.pageX, e.pageY);
    }
  }

  /**
   * ポインタがアクティブでなくなったときに呼ばれる。
   */
  private onPointerEnded(e: PointerEvent): void {
    if (!this._subdelegates) {
      return;
    }

    for (let ite = this._subdelegates.begin(); ite.notEqual(this._subdelegates.end()); ite.preIncrement()) {
      const sub = ite.ptr();

      if (!sub || typeof (sub as unknown).onPointEnded !== "function") {
        continue;
      }

      (sub as unknown).onPointEnded(e.pageX, e.pageY);
    }
  }

  /**
   * ポインタがキャンセルされると呼ばれる。
   */
  private onPointerCancel(e: PointerEvent): void {
    if (!this._subdelegates) {
      return;
    }

    for (let ite = this._subdelegates.begin(); ite.notEqual(this._subdelegates.end()); ite.preIncrement()) {
      const sub = ite.ptr();

      if (!sub || typeof (sub as unknown).onTouchCancel !== "function") {
        continue;
      }

      (sub as unknown).onTouchCancel(e.pageX, e.pageY);
    }
  }

  /**
   * Resize canvas and re-initialize view.
   */
  public onResize(): void {
    for (let i = 0; i < this._subdelegates.getSize(); i++) {
      this._subdelegates.at(i).onResize();
    }
  }

  public run(): void {
    this._isEnd = false;

    const loopWrapper = (): void => {
      if (this._isEnd) {
        return;
      }

      LAppPal.updateTime();

      this.loop();

      requestAnimationFrame(loopWrapper);
    };

    requestAnimationFrame(loopWrapper);
  }

  private loop(): void {
    if (!this._subdelegates || this._subdelegates.getSize() === 0) {
      return;
    }

    for (let i = 0; i < this._subdelegates.getSize(); i++) {
      const sub = this._subdelegates.at(i);
      if (!sub) continue;

      sub.update();
    }
  }

  public setExpression(expressionId: string): void {
    // 檢查有沒有子委派 (通常會有一個)
    if (!this._subdelegates || this._subdelegates.getSize() === 0) return;

    // 取得 Live2D Manager
    const live2dManager = this._subdelegates.at(0).getLive2DManager();

    // 取得當前的模型 (通常只有一個)
    const model = live2dManager._models.at(0);

    if (model) {
      model.setExpression(expressionId);
      console.log(`[APP] 切換表情到: ${expressionId}`);
    }
  }
  public static setTalking(isTalking: boolean): void {
    // 檢查實例是否存在
    if (!s_instance) return;

    // 檢查是否有 subdelegates (通常只有一個)
    if (s_instance._subdelegates.getSize() > 0) {
      // 透過 Manager 去設定 Model
      s_instance._subdelegates.at(0).getLive2DManager().setTalking(isTalking);
    }
  }

  /**
   * 解放する。
   */
  public release(): void {
    this._isEnd = true;
    this.releaseEventListener();
    this.releaseSubdelegates();

    // Cubism SDKの解放
    CubismFramework.dispose();

    this._cubismOption = null;
  }

  /**
   * イベントリスナーを解除する。
   */
  private releaseEventListener(): void {
    document.removeEventListener("pointerup", this.pointBeganEventListener);
    this.pointBeganEventListener = null;
    document.removeEventListener("pointermove", this.pointMovedEventListener);
    this.pointMovedEventListener = null;
    document.removeEventListener("pointerdown", this.pointEndedEventListener);
    this.pointEndedEventListener = null;
    document.removeEventListener("pointerdown", this.pointCancelEventListener);
    this.pointCancelEventListener = null;
  }

  /**
   * Subdelegate を解放する
   */
  private releaseSubdelegates(): void {
    if (!this._subdelegates) {
      return;
    }

    const size = this._subdelegates.getSize ? this._subdelegates.getSize() : 0;

    for (let i = 0; i < size; i++) {
      const subdelegate = this._subdelegates.at(i);
      if (subdelegate) {
        subdelegate.release();
      }
    }

    this._subdelegates = null as unknown;
    this._canvases = null as unknown;
  }

  /**
   * APPに必要な物を初期化する。
   */
  public initialize(): boolean {
    // Cubism SDK の初期化
    this.initializeCubism();

    this.initializeSubdelegates();

    this.initializeEventListener();

    return true;
  }

  /**
   * イベントリスナーを設定する。
   */
  private initializeEventListener(): void {
    this.pointBeganEventListener = this.onPointerBegan.bind(this);
    this.pointMovedEventListener = this.onPointerMoved.bind(this);
    this.pointEndedEventListener = this.onPointerEnded.bind(this);
    this.pointCancelEventListener = this.onPointerCancel.bind(this);

    // ポインタ関連コールバック関数登録
    document.addEventListener("pointerdown", this.pointBeganEventListener, {
      passive: true,
    });
    document.addEventListener("pointermove", this.pointMovedEventListener, {
      passive: true,
    });
    document.addEventListener("pointerup", this.pointEndedEventListener, {
      passive: true,
    });
    document.addEventListener("pointercancel", this.pointCancelEventListener, {
      passive: true,
    });
  }

  /**
   * Cubism SDKの初期化
   */
  private initializeCubism(): void {
    LAppPal.updateTime();

    // setup cubism
    this._cubismOption.logFunction = LAppPal.printMessage;
    this._cubismOption.loggingLevel = LAppDefine.CubismLoggingLevel;
    CubismFramework.startUp(this._cubismOption);

    // initialize cubism
    CubismFramework.initialize();
  }

  /**
   * Canvasを生成配置、Subdelegateを初期化する
   */
  private initializeSubdelegates(): void {
    LAppPal.printMessage("[APP] LAppDelegate.initializeSubdelegates 被呼叫");

    const canvas = document.getElementById("live2d-canvas") as HTMLCanvasElement | null;

    if (!canvas) {
      CubismLogError("[APP] initializeSubdelegates: 找不到 live2d-canvas");
      return;
    }

    this._canvases.clear();
    this._subdelegates.clear();

    this._canvases.pushBack(canvas);

    const subdelegate = new LAppSubdelegate();

    const ok = subdelegate.initialize(canvas);
    if (!ok) {
      CubismLogError("[APP] LAppSubdelegate.initialize 失敗，可能是 WebGL context 拿不到");
      return;
    }

    this._subdelegates.pushBack(subdelegate);
  }

  /**
   * Privateなコンストラクタ
   */
  private constructor() {
    this._cubismOption = new Option();
    this._subdelegates = new csmVector<LAppSubdelegate>();
    this._canvases = new csmVector<HTMLCanvasElement>();
  }

  /**
   * Cubism SDK Option
   */
  private _cubismOption: Option;

  /**
   * 操作対象のcanvas要�
   */
  private _canvases: csmVector<HTMLCanvasElement>;

  /**
   * Subdelegate
   */
  private _subdelegates: csmVector<LAppSubdelegate>;

  /**
   * 登録済みイベントリスナー 関数オブジェクト
   */
  private pointBeganEventListener: (this: Document, ev: PointerEvent) => void;

  /**
   * 登録済みイベントリスナー 関数オブジェクト
   */
  private pointMovedEventListener: (this: Document, ev: PointerEvent) => void;

  /**
   * 登録済みイベントリスナー 関数オブジェクト
   */
  private pointEndedEventListener: (this: Document, ev: PointerEvent) => void;

  /**
   * 登録済みイベントリスナー 関数オブジェクト
   */
  private pointCancelEventListener: (this: Document, ev: PointerEvent) => void;
}
