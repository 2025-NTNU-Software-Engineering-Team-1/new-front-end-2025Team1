/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismIdHandle } from "../id/cubismid";
import { CubismFramework } from "../live2dcubismframework";
import { csmString } from "../type/csmstring";
import { csmVector } from "../type/csmvector";
import { CubismModelUserDataJson } from "./cubismmodeluserdatajson";

const ArtMesh = "ArtMesh";

/**
 * ユーザーデータインターフェース
 *
 * Jsonから読み込ん� ユーザーデータを記録しておくための構� 体
 */
export class CubismModelUserDataNode {
  targetType: CubismIdHandle; // ユーザーデータターゲットタイプ
  targetId: CubismIdHandle; // ユーザーデータターゲットのID
  value: csmString; // ユーザーデータ
}

/**
 * ユーザデータの管理クラス
 *
 * ユーザデータをロード、管理、検索インターフェイス、解放までを行う。
 */
export class CubismModelUserData {
  /**
   * インスタンスの作成
   *
   * @param buffer    userdata3.jsonが読み込まれているバッファ
   * @param size      バッファのサイズ
   * @return 作成されたインスタンス
   */
  public static create(buffer: ArrayBuffer, size: number): CubismModelUserData {
    const ret: CubismModelUserData = new CubismModelUserData();

    ret.parseUserData(buffer, size);

    return ret;
  }

  /**
   * インスタンスを� �棄する
   *
   * @param modelUserData � �棄するインスタンス
   */
  public static delete(modelUserData: CubismModelUserData): void {
    if (modelUserData != null) {
      modelUserData.release();
      modelUserData = null;
    }
  }

  /**
   * ArtMeshのユーザーデータのリストの取得
   *
   * @return ユーザーデータリスト
   */
  public getArtMeshUserDatas(): csmVector<CubismModelUserDataNode> {
    return this._artMeshUserDataNode;
  }

  /**
   * userdata3.jsonのパース
   *
   * @param buffer    userdata3.jsonが読み込まれているバッファ
   * @param size      バッファのサイズ
   */
  public parseUserData(buffer: ArrayBuffer, size: number): void {
    let json: CubismModelUserDataJson = new CubismModelUserDataJson(buffer, size);
    if (!json) {
      json.release();
      json = void 0;
      return;
    }

    const typeOfArtMesh = CubismFramework.getIdManager().getId(ArtMesh);
    const nodeCount: number = json.getUserDataCount();

    for (let i = 0; i < nodeCount; i++) {
      const addNode: CubismModelUserDataNode = new CubismModelUserDataNode();

      addNode.targetId = json.getUserDataId(i);
      addNode.targetType = CubismFramework.getIdManager().getId(json.getUserDataTargetType(i));
      addNode.value = new csmString(json.getUserDataValue(i));
      this._userDataNodes.pushBack(addNode);

      if (addNode.targetType == typeOfArtMesh) {
        this._artMeshUserDataNode.pushBack(addNode);
      }
    }

    json.release();
    json = void 0;
  }

  /**
   * コンストラクタ
   */
  public constructor() {
    this._userDataNodes = new csmVector<CubismModelUserDataNode>();
    this._artMeshUserDataNode = new csmVector<CubismModelUserDataNode>();
  }

  /**
   * デストラクタ相当の処理
   *
   * ユーザーデータ構� 体配列を解放する
   */
  public release(): void {
    for (let i = 0; i < this._userDataNodes.getSize(); ++i) {
      this._userDataNodes.set(i, null);
    }

    this._userDataNodes = null;
  }

  private _userDataNodes: csmVector<CubismModelUserDataNode>; // ユーザーデータ構� 体配列
  private _artMeshUserDataNode: csmVector<CubismModelUserDataNode>; // 閲覧リストの保持
}

// Namespace definition for compatibility.
import * as $ from "./cubismmodeluserdata";
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Live2DCubismFramework {
  export const CubismModelUserData = $.CubismModelUserData;
  export type CubismModelUserData = $.CubismModelUserData;
  export const CubismModelUserDataNode = $.CubismModelUserDataNode;
  export type CubismModelUserDataNode = $.CubismModelUserDataNode;
}
