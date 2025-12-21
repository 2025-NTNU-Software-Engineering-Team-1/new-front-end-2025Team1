/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

/**
 * メモリアロケーションを抽象化したクラス
 *
 * メモリ確保・解放処理をプラットフォー� 側で実装して
 * フレー� ワークから呼び出すためのインターフェース
 */
export abstract class ICubismAllocator {
  /**
   * アラインメント制約なしのヒープ・メモリーを確保します
   *
   * @param size 確保するバイト数
   * @return 成功すると割り当てられたメモリのアドレス。そうでなければ'0'を返す
   */
  public abstract allocate(size: number): unknown;

  /**
   * アラインメント制約なしのヒープ・メモリーを解放します。
   *
   * @param memory 解放するメモリのアドレス
   */
  public abstract deallocate(memory: unknown): void;

  /**
   * アラインメント制約有のヒープ・メモリーを確保します。
   * @param size 確保するバイト数
   * @param alignment メモリーブロックのアラインメント幅
   * @return 成功すると割り当てられたメモリのアドレス。そうでなければ'0'を返す
   */
  public abstract allocateAligned(size: number, alignment: number): unknown;

  /**
   * アラインメント制約ありのヒープ・メモリーを解放します。
   * @param alignedMemory 解放するメモリのアドレス
   */
  public abstract deallocateAligned(alignedMemory: unknown): void;
}

// Namespace definition for compatibility.
import * as $ from "./icubismallcator";
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Live2DCubismFramework {
  export const ICubismAllocator = $.ICubismAllocator;
  export type ICubismAllocator = $.ICubismAllocator;
}
