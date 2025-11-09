/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import * as LAppDefine from './lappdefine';
import { LAppGlManager } from './lappglmanager';
import { LAppLive2DManager } from './lapplive2dmanager';
import { LAppPal } from './lapppal';
import { LAppTextureManager } from './lapptexturemanager';
import { LAppView } from './lappview';

/**
 * Canvasに関連する操作を取りまとめるクラス
 */
export class LAppSubdelegate {
  /**
   * コンストラクタ
   */
  public constructor() {
    this._canvas = null;
    this._glManager = new LAppGlManager();
    this._textureManager = new LAppTextureManager();
    this._live2dManager = new LAppLive2DManager();
    this._view = new LAppView();
    this._frameBuffer = null;
    this._captured = false;
  }

  /**
   * デストラクタ相当の処理
   */
	public release(): void {
		// 🟣 1. 安全關掉 ResizeObserver（有才關，避免 undefined.unobserve）
		const ro = (this as any)._resizeObserver as ResizeObserver | null | undefined;

		if (ro) {
			if (this._canvas) {
				try {
					ro.unobserve(this._canvas);
				} catch (e) {
					console.warn('[Live2D] ResizeObserver unobserve 時發生例外：', e);
				}
			}
			try {
				ro.disconnect();
			} catch (e) {
				console.warn('[Live2D] ResizeObserver disconnect 時發生例外：', e);
			}
			(this as any)._resizeObserver = null;
		}

		// 🟣 2. 釋放 View
		if (this._view) {
			this._view.release();
			this._view = null;
		}

		// 🟣 3. 釋放 Live2D Manager
		if (this._live2DManager) {
			if ((this._live2DManager as any).release) {
				(this._live2DManager as any).release();
			} else if ((this._live2DManager as any).releaseAllModel) {
				(this._live2DManager as any).releaseAllModel();
			}
			this._live2DManager = null;
		}

		// 🟣 4. 釋放 GL 資源
		if (this._glManager) {
			try {
				const gl = this._glManager.getGl();
				if (gl) {
					const lose = gl.getExtension('WEBGL_lose_context');
					lose?.loseContext();
				}
			} catch (e) {
				console.warn('[Live2D] 在 release 中釋放 GL context 時發生例外：', e);
			}

			if ((this._glManager as any).release) {
				(this._glManager as any).release();
			}
			this._glManager = null;
		}

		// 🟣 5. 清掉其他參考
		this._canvas = null;
		this._gl = null;
	}


  /**
   * APPに必要な物を初期化する。
   */
	public initialize(canvas: HTMLCanvasElement): boolean {
		this._canvas = canvas;

    const rect = this._canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;

    this._canvas.width = rect.width * ratio;
    this._canvas.height = rect.height * ratio;

		// 建立 GL 管理器並初始化 WebGL
		this._glManager = new LAppGlManager();
		const ok = this._glManager.initialize(this._canvas);
		if (!ok) {
			console.error('[APP] LAppGlManager.initialize 失敗，無法取得 WebGL context');
			return false;
		}

		this._gl = this._glManager.getGl();

		console.log('[APP] LAppSubdelegate.initialize 完成，gl =', this._gl);

		// 建立 View，交給它負責畫畫
		this._view = new LAppView();
		this._view.initialize(this); // 把自己傳進去

		// 🔑 在這裡建立 Live2D Manager，並讓它載入模型
		this._live2DManager = new LAppLive2DManager(this);
		this._live2DManager.changeScene(0);

		return true;
	}

	public getLive2DManager(): LAppLive2DManager | null {
		return this._live2DManager;
	}




  /**
   * Resize canvas and re-initialize view.
   */
  public onResize(): void {
    this.resizeCanvas();
    this._view.initialize(this);
    this._view.initializeSprite();
  }

  private resizeObserverCallback(
    entries: ResizeObserverEntry[],
    observer: ResizeObserver
  ): void {
    if (LAppDefine.CanvasSize === 'auto') {
      this._needResize = true;
    }
  }

  /**
   * ループ処理
   */
  public update(): void {
    if (this._glManager.getGl().isContextLost()) {
      return;
    }

    // キャンバスのサイズが変わっている場合はリサイズに必要な処理をする。
    if (this._needResize) {
      this.onResize();
      this._needResize = false;
    }

    const gl = this._glManager.getGl();

    // 画面の初期化
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    // 深度テストを有効化
    gl.enable(gl.DEPTH_TEST);

    // 近くにある物体は、遠くにある物体を覆い隠す
    gl.depthFunc(gl.LEQUAL);

    // カラーバッファや深度バッファをクリアする
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.clearDepth(1.0);

    // 透過設定
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // 描画更新
    this._view.render();
  }

  /**
   * シェーダーを登録する。
   */
  public createShader(): WebGLProgram {
    const gl = this._glManager.getGl();

    // バーテックスシェーダーのコンパイル
    const vertexShaderId = gl.createShader(gl.VERTEX_SHADER);

    if (vertexShaderId == null) {
      LAppPal.printMessage('failed to create vertexShader');
      return null;
    }

    const vertexShader: string =
      'precision mediump float;' +
      'attribute vec3 position;' +
      'attribute vec2 uv;' +
      'varying vec2 vuv;' +
      'void main(void)' +
      '{' +
      '   gl_Position = vec4(position, 1.0);' +
      '   vuv = uv;' +
      '}';

    gl.shaderSource(vertexShaderId, vertexShader);
    gl.compileShader(vertexShaderId);

    // フラグメントシェーダのコンパイル
    const fragmentShaderId = gl.createShader(gl.FRAGMENT_SHADER);

    if (fragmentShaderId == null) {
      LAppPal.printMessage('failed to create fragmentShader');
      return null;
    }

    const fragmentShader: string =
      'precision mediump float;' +
      'varying vec2 vuv;' +
      'uniform sampler2D texture;' +
      'void main(void)' +
      '{' +
      '   gl_FragColor = texture2D(texture, vuv);' +
      '}';

    gl.shaderSource(fragmentShaderId, fragmentShader);
    gl.compileShader(fragmentShaderId);

    // プログラムオブジェクトの作成
    const programId = gl.createProgram();
    gl.attachShader(programId, vertexShaderId);
    gl.attachShader(programId, fragmentShaderId);

    gl.deleteShader(vertexShaderId);
    gl.deleteShader(fragmentShaderId);

    // リンク
    gl.linkProgram(programId);
    gl.useProgram(programId);

    return programId;
  }

  public getTextureManager(): LAppTextureManager {
    return this._textureManager;
  }

  public getFrameBuffer(): WebGLFramebuffer {
    return this._frameBuffer;
  }

  public getCanvas(): HTMLCanvasElement {
    return this._canvas;
  }

  public getGlManager(): LAppGlManager {
    return this._glManager;
  }



  /**
   * Resize the canvas to fill the screen.
   */
  private resizeCanvas(): void {
    this._canvas.width = this._canvas.clientWidth * window.devicePixelRatio;
    this._canvas.height = this._canvas.clientHeight * window.devicePixelRatio;

    const gl = this._glManager.getGl();

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  /**
   * マウスダウン、タッチダウンしたときに呼ばれる。
   */
  public onPointBegan(pageX: number, pageY: number): void {
    if (!this._view) {
      LAppPal.printMessage('view notfound');
      return;
    }
    this._captured = true;

    const localX: number = pageX - this._canvas.offsetLeft;
    const localY: number = pageY - this._canvas.offsetTop;

    //this._view.onTouchesBegan(localX, localY);
  }

  /**
   * マウスポインタが動いたら呼ばれる。
   */
  public onPointMoved(pageX: number, pageY: number): void {
    if (!this._captured) {
      return;
    }

    const localX: number = pageX - this._canvas.offsetLeft;
    const localY: number = pageY - this._canvas.offsetTop;

    this._view.onTouchesMoved(localX, localY);
  }

  /**
   * クリックが終了したら呼ばれる。
   */
  public onPointEnded(pageX: number, pageY: number): void {
    this._captured = false;

    if (!this._view) {
      LAppPal.printMessage('view notfound');
      return;
    }

    const localX: number = pageX - this._canvas.offsetLeft;
    const localY: number = pageY - this._canvas.offsetTop;

    //this._view.onTouchesEnded(localX, localY);
  }

  /**
   * タッチがキャンセルされると呼ばれる。
   */
  public onTouchCancel(pageX: number, pageY: number): void {
    this._captured = false;

    if (!this._view) {
      LAppPal.printMessage('view notfound');
      return;
    }

    const localX: number = pageX - this._canvas.offsetLeft;
    const localY: number = pageY - this._canvas.offsetTop;

    this._view.onTouchesEnded(localX, localY);
  }

  public isContextLost(): boolean {
    return this._glManager.getGl().isContextLost();
  }

  private _canvas: HTMLCanvasElement;

  /**
   * View情報
   */
  private _view: LAppView;

  /**
   * テクスチャマネージャー
   */
  private _textureManager: LAppTextureManager;
  private _frameBuffer: WebGLFramebuffer;
  private _glManager: LAppGlManager;
  private _live2dManager: LAppLive2DManager;
  private _gl: WebGLRenderingContext | WebGL2RenderingContext = null;
  private _live2DManager: LAppLive2DManager | null = null;



  /**
   * ResizeObserver
   */
  private _resizeObserver: ResizeObserver;

  /**
   * クリックしているか
   */
  private _captured: boolean;

  private _needResize: boolean;
}
