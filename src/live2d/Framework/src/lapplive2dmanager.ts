/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismMatrix44 } from "@framework/math/cubismmatrix44";
import { ACubismMotion } from "@framework/motion/acubismmotion";
import { csmVector } from "@framework/type/csmvector";

import * as LAppDefine from "./lappdefine";
import { LAppModel } from "./lappmodel";
import { LAppPal } from "./lapppal";
import { LAppSubdelegate } from "./lappsubdelegate";

/**
 * サンプルアプリケーションにおいてCubismModelを管理するクラス
 * モデル生成と破棄、タップイベントの処理、モデル切り替えを行う。
 */
export class LAppLive2DManager {
  /**
   * 現在のシーンで保持しているすべてのモデルを解放する
   */
  private releaseAllModel(): void {
    this._models.clear();
  }

  /**
   * 画面をドラッグした時の処理
   *
   * @param x 画面のX座標
   * @param y 画面のY座標
   */
  public onDrag(x: number, y: number): void {
    if (this._models.getSize() === 0) {
      return;
    }

    const model = this._models.at(0);
    if (!model) {
      return;
    }

    const anyModel = model as any;

    // Cubism 不同範例版本命名不一樣，有的叫 onDrag，有的叫 setDragging
    if (typeof anyModel.onDrag === "function") {
      anyModel.onDrag(x, y);
    } else if (typeof anyModel.setDragging === "function") {
      anyModel.setDragging(x, y);
    } else {
      // 沒有拖曳 API 就直接忽略，至少不要炸掉
      return;
    }
  }

  /**
   * 画面をタップした時の処理
   *
   * @param x 画面のX座標
   * @param y 画面のY座標
   */
  public onTap(x: number, y: number): void {
    // 沒有模型就直接跳出
    if (this._models.getSize() === 0) {
      return;
    }

    // 取出第一個模型，加上 null 檢查
    const model: LAppModel | null = this._models.at(0);
    if (!model) {
      return;
    }

    if (LAppDefine.DebugLogEnable) {
      LAppPal.printMessage(`[APP]tap point: {x: ${x.toFixed(2)} y: ${y.toFixed(2)}}`);
    }

    // 頭部判定
    if (model.hitTest(LAppDefine.HitAreaNameHead, x, y)) {
      if (LAppDefine.DebugLogEnable) {
        LAppPal.printMessage(`[APP]hit area: [${LAppDefine.HitAreaNameHead}]`);
      }
      model.setRandomExpression();
    }
    // 身體判定
    else if (model.hitTest(LAppDefine.HitAreaNameBody, x, y)) {
      if (LAppDefine.DebugLogEnable) {
        LAppPal.printMessage(`[APP]hit area: [${LAppDefine.HitAreaNameBody}]`);
      }
      model.startRandomMotion(
        LAppDefine.MotionGroupTapBody,
        LAppDefine.PriorityNormal,
        this.finishedMotion,
        this.beganMotion,
      );
    }
  }

  /**
   * 画面を更新するときの処理
   * モデルの更新処理及び描画処理を行う
   */
  public onUpdate(subdelegate: LAppSubdelegate): void {
    if (!subdelegate) {
      return;
    }

    // ① 先拿 canvas 尺寸
    const canvas = subdelegate.getCanvas();
    const width = canvas.width;
    const height = canvas.height;

    // ② 拿 glManager 和 gl
    const glManager = subdelegate.getGlManager();
    const gl = glManager.getGl() as WebGLRenderingContext | WebGL2RenderingContext;
    if (!gl) {
      return;
    }

    // ③ 設定 viewport & 清畫面（這裡 alpha 設 0 → 透明，不會整片黑）
    gl.viewport(0, 0, width, height);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // ④ 原本就有的投影與模型邏輯
    const projection: CubismMatrix44 = new CubismMatrix44();
    const model: any = this._models.at(0);

    if (!model) {
      return;
    }

    // 嘗試取得實際的 Cubism 模型與 modelMatrix
    const coreModel = model._model ?? model._cubismModel ?? null;
    const modelMatrix = model._modelMatrix ?? null;

    if (coreModel) {
      if (coreModel.getCanvasWidth && coreModel.getCanvasWidth() > 1.0 && width < height) {
        // 橫向模型顯示在縱長視窗時，用寬度算 scale
        if (modelMatrix) {
          modelMatrix.setWidth(2.0);
        }
        projection.scale(1.0, width / height);
      } else {
        projection.scale(height / width, 1.0);
      }

      // 如有 viewMatrix，就乘進去
      if (this._viewMatrix) {
        projection.multiplyByMatrix(this._viewMatrix);
      }
    }

    // ⑤ 更新 + 繪製模型
    model.update();
    model.draw(projection);
  }

  /**
   * 次のシーンに切りかえる
   * サンプルアプリケーションではモデルセットの切り替えを行う。
   */
  public nextScene(): void {
    const no: number = (this._sceneIndex + 1) % LAppDefine.ModelDirSize;
    this.changeScene(no);
  }

  /**
   * シーンを切り替える
   * サンプルアプリケーションではモデルセットの切り替えを行う。
   * @param index
   */
  /**
  private changeScene(index: number): void {
    this._sceneIndex = index;

    if (LAppDefine.DebugLogEnable) {
      LAppPal.printMessage(`[APP]model index: ${this._sceneIndex}`);
    }

    // ModelDir[]に保持したディレクトリ名から
    // model3.jsonのパスを決定する。
    // ディレクトリ名とmodel3.jsonの名前を一致させておくこと。
    const modelPath: string = LAppDefine.ResourcesPath;
    const modelJsonName: string = 'hiyori_pro_t11.model3.json';

    this.releaseAllModel();
    const instance = new LAppModel();
    instance.setSubdelegate(this._subdelegate);
    instance.loadAssets(modelPath, modelJsonName);
    this._models.pushBack(instance);
  }
*/
  public setViewMatrix(matrix: CubismMatrix44 | null): void {
    // 如果沒有給，就清空，不要做任何運算
    if (!matrix) {
      this._viewMatrix = null;
      return;
    }

    // 直接記住 View 端給的矩陣，onUpdate 裡會用到
    this._viewMatrix = matrix;
  }

  /**
   * モデルの追加
   */
  public addModel(sceneIndex: number = 0): void {
    this._sceneIndex = sceneIndex;
    this.changeScene(this._sceneIndex);
  }

  /**
   * コンストラクタ
   */
  public constructor(subdelegate: LAppSubdelegate) {
    this._subdelegate = subdelegate;
    this._models = new csmVector<LAppModel>();

    LAppPal.printMessage("[APP] LAppLive2DManager.constructor 被呼叫");
  }

  /**
   * 解放する。
   */
  public release(): void {}

  /**
   * 初期化する。
   * @param subdelegate
   */
  public initialize(): void {
    LAppPal.printMessage("[APP] LAppLive2DManager.initialize 被呼叫");

    // 一開始就切到第 0 個場景（其實就是載我們的 hiyori）
    this.changeScene(0);
  }

  public changeScene(index: number): void {
    this._sceneIndex = index;

    LAppPal.printMessage("[APP] changeScene: " + index);

    const modelPath: string = "/live2d/hiyori_pro_zh/runtime/";
    const modelJsonName: string = "hiyori_pro_t11.model3.json";

    this.releaseAllModel();

    const model = new LAppModel();
    model.setSubdelegate(this._subdelegate);

    LAppPal.printMessage("[APP] 準備載入模型: " + modelPath + modelJsonName);
    model.loadAssets(modelPath, modelJsonName);

    this._models.pushBack(model);
  }

  /**
   * 自身が所属するSubdelegate
   */
  private _subdelegate: LAppSubdelegate;

  _viewMatrix: CubismMatrix44; // モデル描画に用いるview行列
  _models: csmVector<LAppModel>; // モデルインスタンスのコンテナ
  private _sceneIndex: number; // 表示するシーンのインデックス値

  // モーション再生開始のコールバック関数
  beganMotion = (self: ACubismMotion): void => {
    LAppPal.printMessage("Motion Began:");
    console.log(self);
  };
  // モーション再生終了のコールバック関数
  finishedMotion = (self: ACubismMotion): void => {
    LAppPal.printMessage("Motion Finished:");
    console.log(self);
  };
}
