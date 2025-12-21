/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismVector2 } from "./cubismvector2";

/**
 * 数値計算などに使用するユーティリティクラス
 */
export class CubismMath {
  static readonly Epsilon: number = 0.00001;

  /**
   * 第一引数の値を最小値と最大値の範囲に収めた値を返す
   *
   * @param value 収められる値
   * @param min   範囲の最小値
   * @param max   範囲の最大値
   * @return 最小値と最大値の範囲に収めた値
   */
  static range(value: number, min: number, max: number): number {
    if (value < min) {
      value = min;
    } else if (value > max) {
      value = max;
    }

    return value;
  }

  /**
   * サイン関数の値を求める
   *
   * @param x 角度値（ラジアン）
   * @return サイン関数sin(x)の値
   */
  static sin(x: number): number {
    return Math.sin(x);
  }

  /**
   * コサイン関数の値を求める
   *
   * @param x 角度値(ラジアン)
   * @return コサイン関数cos(x)の値
   */
  static cos(x: number): number {
    return Math.cos(x);
  }

  /**
   * 値の絶対値を求める
   *
   * @param x 絶対値を求める値
   * @return 値の絶対値
   */
  static abs(x: number): number {
    return Math.abs(x);
  }

  /**
   * 平方� �(ルート)を求める
   * @param x -> 平方� �を求める値
   * @return 値の平方� �
   */
  static sqrt(x: number): number {
    return Math.sqrt(x);
  }

  /**
   * 立方� �を求める
   * @param x -> 立方� �を求める値
   * @return 値の立方� �
   */
  static cbrt(x: number): number {
    if (x === 0) {
      return x;
    }

    let cx: number = x;
    const isNegativeNumber: boolean = cx < 0;

    if (isNegativeNumber) {
      cx = -cx;
    }

    let ret: number;
    if (cx === Infinity) {
      ret = Infinity;
    } else {
      ret = Math.exp(Math.log(cx) / 3);
      ret = (cx / (ret * ret) + 2 * ret) / 3;
    }
    return isNegativeNumber ? -ret : ret;
  }

  /**
   * イージング処理されたサインを求める
   * フェードイン・アウト時のイージングに利用できる
   *
   * @param value イージングを行う値
   * @return イージング処理されたサイン値
   */
  static getEasingSine(value: number): number {
    if (value < 0.0) {
      return 0.0;
    } else if (value > 1.0) {
      return 1.0;
    }

    return 0.5 - 0.5 * this.cos(value * Math.PI);
  }

  /**
   * 大きい方の値を返す
   *
   * @param left 左辺の値
   * @param right 右辺の値
   * @return 大きい方の値
   */
  static max(left: number, right: number): number {
    return left > right ? left : right;
  }

  /**
   * 小さい方の値を返す
   *
   * @param left  左辺の値
   * @param right 右辺の値
   * @return 小さい方の値
   */
  static min(left: number, right: number): number {
    return left > right ? right : left;
  }

  public static clamp(val: number, min: number, max: number): number {
    if (val < min) {
      return min;
    } else if (max < val) {
      return max;
    }
    return val;
  }

  /**
   * 角度値をラジアン値に変換する
   *
   * @param degrees   角度値
   * @return 角度値から変換したラジアン値
   */
  static degreesToRadian(degrees: number): number {
    return (degrees / 180.0) * Math.PI;
  }

  /**
   * ラジアン値を角度値に変換する
   *
   * @param radian    ラジアン値
   * @return ラジアン値から変換した角度値
   */
  static radianToDegrees(radian: number): number {
    return (radian * 180.0) / Math.PI;
  }

  /**
   * ２つのベクトルからラジアン値を求める
   *
   * @param from  始点ベクトル
   * @param to    終点ベクトル
   * @return ラジアン値から求めた方向ベクトル
   */
  static directionToRadian(from: CubismVector2, to: CubismVector2): number {
    const q1: number = Math.atan2(to.y, to.x);
    const q2: number = Math.atan2(from.y, from.x);

    let ret: number = q1 - q2;

    while (ret < -Math.PI) {
      ret += Math.PI * 2.0;
    }

    while (ret > Math.PI) {
      ret -= Math.PI * 2.0;
    }

    return ret;
  }

  /**
   * ２つのベクトルから角度値を求める
   *
   * @param from  始点ベクトル
   * @param to    終点ベクトル
   * @return 角度値から求めた方向ベクトル
   */
  static directionToDegrees(from: CubismVector2, to: CubismVector2): number {
    const radian: number = this.directionToRadian(from, to);
    let degree: number = this.radianToDegrees(radian);

    if (to.x - from.x > 0.0) {
      degree = -degree;
    }

    return degree;
  }

  /**
   * ラジアン値を方向ベクトルに変換する。
   *
   * @param totalAngle    ラジアン値
   * @return ラジアン値から変換した方向ベクトル
   */

  static radianToDirection(totalAngle: number): CubismVector2 {
    const ret: CubismVector2 = new CubismVector2();

    ret.x = this.sin(totalAngle);
    ret.y = this.cos(totalAngle);

    return ret;
  }

  /**
   * 三次方程式の三次� �の係数が0になったときに補� 的に二次方程式の解をもとめる。
   * a * x^2 + b * x + c = 0
   *
   * @param   a -> 二次� �の係数値
   * @param   b -> 一次� �の係数値
   * @param   c -> 定数� �の値
   * @return  二次方程式の解
   */
  static quadraticEquation(a: number, b: number, c: number): number {
    if (this.abs(a) < CubismMath.Epsilon) {
      if (this.abs(b) < CubismMath.Epsilon) {
        return -c;
      }
      return -c / b;
    }

    return -(b + this.sqrt(b * b - 4.0 * a * c)) / (2.0 * a);
  }

  /**
   * カルダノの公式によってベジェのt値に該当する３次方程式の解を求める。
   * 重解になったときには0.0～1.0の値になる解を返す。
   *
   * a * x^3 + b * x^2 + c * x + d = 0
   *
   * @param   a -> 三次� �の係数値
   * @param   b -> 二次� �の係数値
   * @param   c -> 一次� �の係数値
   * @param   d -> 定数� �の値
   * @return  0.0～1.0の間にある解
   */
  static cardanoAlgorithmForBezier(a: number, b: number, c: number, d: number): number {
    if (this.abs(a) < CubismMath.Epsilon) {
      return this.range(this.quadraticEquation(b, c, d), 0.0, 1.0);
    }

    const ba: number = b / a;
    const ca: number = c / a;
    const da: number = d / a;

    const p: number = (3.0 * ca - ba * ba) / 3.0;
    const p3: number = p / 3.0;
    const q: number = (2.0 * ba * ba * ba - 9.0 * ba * ca + 27.0 * da) / 27.0;
    const q2: number = q / 2.0;
    const discriminant: number = q2 * q2 + p3 * p3 * p3;

    const center = 0.5;
    const threshold: number = center + 0.01;

    if (discriminant < 0.0) {
      const mp3: number = -p / 3.0;
      const mp33: number = mp3 * mp3 * mp3;
      const r: number = this.sqrt(mp33);
      const t: number = -q / (2.0 * r);
      const cosphi: number = this.range(t, -1.0, 1.0);
      const phi: number = Math.acos(cosphi);
      const crtr: number = this.cbrt(r);
      const t1: number = 2.0 * crtr;

      const root1: number = t1 * this.cos(phi / 3.0) - ba / 3.0;
      if (this.abs(root1 - center) < threshold) {
        return this.range(root1, 0.0, 1.0);
      }

      const root2: number = t1 * this.cos((phi + 2.0 * Math.PI) / 3.0) - ba / 3.0;
      if (this.abs(root2 - center) < threshold) {
        return this.range(root2, 0.0, 1.0);
      }

      const root3: number = t1 * this.cos((phi + 4.0 * Math.PI) / 3.0) - ba / 3.0;
      return this.range(root3, 0.0, 1.0);
    }

    if (discriminant == 0.0) {
      let u1: number;
      if (q2 < 0.0) {
        u1 = this.cbrt(-q2);
      } else {
        u1 = -this.cbrt(q2);
      }

      const root1: number = 2.0 * u1 - ba / 3.0;
      if (this.abs(root1 - center) < threshold) {
        return this.range(root1, 0.0, 1.0);
      }

      const root2: number = -u1 - ba / 3.0;
      return this.range(root2, 0.0, 1.0);
    }

    const sd: number = this.sqrt(discriminant);
    const u1: number = this.cbrt(sd - q2);
    const v1: number = this.cbrt(sd + q2);
    const root1: number = u1 - v1 - ba / 3.0;
    return this.range(root1, 0.0, 1.0);
  }

  /**
   * 浮動小数点の余りを求める。
   *
   * @param dividend 被除数（割られる値）
   * @param divisor 除数（割る値）
   * @returns 余り
   */
  static mod(dividend: number, divisor: number): number {
    if (!isFinite(dividend) || divisor === 0 || isNaN(dividend) || isNaN(divisor)) {
      console.warn(`divided: ${dividend}, divisor: ${divisor} mod() returns 'NaN'.`);
      return NaN;
    }

    // 絶対値に変換する。
    const absDividend = Math.abs(dividend);
    const absDivisor = Math.abs(divisor);

    // 絶対値で割り算する。
    let result = absDividend - Math.floor(absDividend / absDivisor) * absDivisor;

    // 符号を被除数のものに指定する。
    result *= Math.sign(dividend);
    return result;
  }

  /**
   * コンストラクタ
   */
  private constructor() {}
}

// Namespace definition for compatibility.
import * as $ from "./cubismmath";
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Live2DCubismFramework {
  export const CubismMath = $.CubismMath;
  export type CubismMath = $.CubismMath;
}
