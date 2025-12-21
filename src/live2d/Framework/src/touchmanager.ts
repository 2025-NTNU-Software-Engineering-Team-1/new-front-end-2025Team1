/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

export class TouchManager {
  /**
   * コンストラクタ
   */
  constructor() {
    this._startX = 0.0;
    this._startY = 0.0;
    this._lastX = 0.0;
    this._lastY = 0.0;
    this._lastX1 = 0.0;
    this._lastY1 = 0.0;
    this._lastX2 = 0.0;
    this._lastY2 = 0.0;
    this._lastTouchDistance = 0.0;
    this._deltaX = 0.0;
    this._deltaY = 0.0;
    this._scale = 1.0;
    this._touchSingle = false;
    this._flipAvailable = false;
  }

  public getCenterX(): number {
    return this._lastX;
  }

  public getCenterY(): number {
    return this._lastY;
  }

  public getDeltaX(): number {
    return this._deltaX;
  }

  public getDeltaY(): number {
    return this._deltaY;
  }

  public getStartX(): number {
    return this._startX;
  }

  public getStartY(): number {
    return this._startY;
  }

  public getScale(): number {
    return this._scale;
  }

  public getX(): number {
    return this._lastX;
  }

  public getY(): number {
    return this._lastY;
  }

  public getX1(): number {
    return this._lastX1;
  }

  public getY1(): number {
    return this._lastY1;
  }

  public getX2(): number {
    return this._lastX2;
  }

  public getY2(): number {
    return this._lastY2;
  }

  public isSingleTouch(): boolean {
    return this._touchSingle;
  }

  public isFlickAvailable(): boolean {
    return this._flipAvailable;
  }

  public disableFlick(): void {
    this._flipAvailable = false;
  }

  /**
   * タッチ開始時イベント
   * @param deviceX タッチした画面のxの値
   * @param deviceY タッチした画面のyの値
   */
  public touchesBegan(deviceX: number, deviceY: number): void {
    this._lastX = deviceX;
    this._lastY = deviceY;
    this._startX = deviceX;
    this._startY = deviceY;
    this._lastTouchDistance = -1.0;
    this._flipAvailable = true;
    this._touchSingle = true;
  }

  /**
   * ドラッグ時のイベント
   * @param deviceX タッチした画面のxの値
   * @param deviceY タッチした画面のyの値
   */
  public touchesMoved(deviceX: number, deviceY: number): void {
    this._lastX = deviceX;
    this._lastY = deviceY;
    this._lastTouchDistance = -1.0;
    this._touchSingle = true;
  }

  /**
   * フリックの距離測定
   * @return フリック距離
   */
  public getFlickDistance(): number {
    return this.calculateDistance(this._startX, this._startY, this._lastX, this._lastY);
  }

  /**
   * 点１から点２への距離を求める
   *
   * @param x1 １つ目のタッチした画面のxの値
   * @param y1 １つ目のタッチした画面のyの値
   * @param x2 ２つ目のタッチした画面のxの値
   * @param y2 ２つ目のタッチした画面のyの値
   */
  public calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
  }

  /**
   * ２つ目の値から、移動量を求める。
   * 違う方向の� �合は移動量０。同じ方向の� �合は、絶対値が小さい方の値を参照する。
   *
   * @param v1 １つ目の移動量
   * @param v2 ２つ目の移動量
   *
   * @return 小さい方の移動量
   */
  public calculateMovingAmount(v1: number, v2: number): number {
    if (v1 > 0.0 != v2 > 0.0) {
      return 0.0;
    }

    const sign: number = v1 > 0.0 ? 1.0 : -1.0;
    const absoluteValue1 = Math.abs(v1);
    const absoluteValue2 = Math.abs(v2);
    return sign * (absoluteValue1 < absoluteValue2 ? absoluteValue1 : absoluteValue2);
  }

  _startY: number; // タッチを開始した時のxの値
  _startX: number; // タッチを開始した時のyの値
  _lastX: number; // シングルタッチ時のxの値
  _lastY: number; // シングルタッチ時のyの値
  _lastX1: number; // ダブルタッチ時の一つ目のxの値
  _lastY1: number; // ダブルタッチ時の一つ目のyの値
  _lastX2: number; // ダブルタッチ時の二つ目のxの値
  _lastY2: number; // ダブルタッチ時の二つ目のyの値
  _lastTouchDistance: number; // 2本以上でタッチしたときの指の距離
  _deltaX: number; // 前回の値から今回の値へのxの移動距離。
  _deltaY: number; // 前回の値から今回の値へのyの移動距離。
  _scale: number; // このフレー� で掛け合わせる拡大率。拡大操作中以外は1。
  _touchSingle: boolean; // シングルタッチ時はtrue
  _flipAvailable: boolean; // フリップが有効かどうか
}
