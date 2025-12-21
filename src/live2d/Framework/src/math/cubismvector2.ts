/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

/**
 * 2次元ベクトル型
 *
 * 2次元ベクトル型の機能を提供する。
 */
export class CubismVector2 {
  /**
   * コンストラクタ
   */
  public constructor(
    public x?: number,
    public y?: number,
  ) {
    this.x = x == undefined ? 0.0 : x;

    this.y = y == undefined ? 0.0 : y;
  }

  /**
   * ベクトルの� 算
   *
   * @param vector2 � 算するベクトル値
   * @return � 算結果 ベクトル値
   */
  public add(vector2: CubismVector2): CubismVector2 {
    const ret: CubismVector2 = new CubismVector2(0.0, 0.0);
    ret.x = this.x + vector2.x;
    ret.y = this.y + vector2.y;
    return ret;
  }

  /**
   * ベクトルの減算
   *
   * @param vector2 減算するベクトル値
   * @return 減算結果 ベクトル値
   */
  public substract(vector2: CubismVector2): CubismVector2 {
    const ret: CubismVector2 = new CubismVector2(0.0, 0.0);
    ret.x = this.x - vector2.x;
    ret.y = this.y - vector2.y;
    return ret;
  }

  /**
   * ベクトルの乗算
   *
   * @param vector2 乗算するベクトル値
   * @return 乗算結果 ベクトル値
   */
  public multiply(vector2: CubismVector2): CubismVector2 {
    const ret: CubismVector2 = new CubismVector2(0.0, 0.0);
    ret.x = this.x * vector2.x;
    ret.y = this.y * vector2.y;
    return ret;
  }

  /**
   * ベクトルの乗算(スカラー)
   *
   * @param scalar 乗算するスカラー値
   * @return 乗算結果 ベクトル値
   */
  public multiplyByScaler(scalar: number): CubismVector2 {
    return this.multiply(new CubismVector2(scalar, scalar));
  }

  /**
   * ベクトルの除算
   *
   * @param vector2 除算するベクトル値
   * @return 除算結果 ベクトル値
   */
  public division(vector2: CubismVector2): CubismVector2 {
    const ret: CubismVector2 = new CubismVector2(0.0, 0.0);
    ret.x = this.x / vector2.x;
    ret.y = this.y / vector2.y;
    return ret;
  }

  /**
   * ベクトルの除算(スカラー)
   *
   * @param scalar 除算するスカラー値
   * @return 除算結果 ベクトル値
   */
  public divisionByScalar(scalar: number): CubismVector2 {
    return this.division(new CubismVector2(scalar, scalar));
  }

  /**
   * ベクトルの長さを取得する
   *
   * @return ベクトルの長さ
   */
  public getLength(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * ベクトルの距離の取得
   *
   * @param a 点
   * @return ベクトルの距離
   */
  public getDistanceWith(a: CubismVector2): number {
    return Math.sqrt((this.x - a.x) * (this.x - a.x) + (this.y - a.y) * (this.y - a.y));
  }

  /**
   * ドット積の計算
   *
   * @param a 値
   * @return 結果
   */
  public dot(a: CubismVector2): number {
    return this.x * a.x + this.y * a.y;
  }

  /**
   * 正規化の適用
   */
  public normalize(): void {
    const length: number = Math.pow(this.x * this.x + this.y * this.y, 0.5);

    this.x = this.x / length;
    this.y = this.y / length;
  }

  /**
   * 等しさの確認（等しいか？）
   *
   * 値が等しいか？
   *
   * @param rhs 確認する値
   * @return true 値は等しい
   * @return false 値は等しくない
   */
  public isEqual(rhs: CubismVector2): boolean {
    return this.x == rhs.x && this.y == rhs.y;
  }

  /**
   * 等しさの確認（等しくないか？）
   *
   * 値が等しくないか？
   *
   * @param rhs 確認する値
   * @return true 値は等しくない
   * @return false 値は等しい
   */
  public isNotEqual(rhs: CubismVector2): boolean {
    return !this.isEqual(rhs);
  }
}

// Namespace definition for compatibility.
import * as $ from "./cubismvector2";
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Live2DCubismFramework {
  export const CubismVector2 = $.CubismVector2;
  export type CubismVector2 = $.CubismVector2;
}
