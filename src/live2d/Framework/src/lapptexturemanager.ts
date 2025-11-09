/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { csmVector, iterator } from '@framework/type/csmvector';
import { LAppGlManager } from './lappglmanager';

/**
 * テクスチャ管理クラス
 * 画像読み込み、管理を行うクラス。
 */
export class LAppTextureManager {
  /**
   * コンストラクタ
   */
  public constructor() {
    this._textures = new csmVector<TextureInfo>();
  }

  /**
   * 解放する。
   */
  public release(): void {
    for (
      let ite: iterator<TextureInfo> = this._textures.begin();
      ite.notEqual(this._textures.end());
      ite.preIncrement()
    ) {
      this._glManager.getGl().deleteTexture(ite.ptr().id);
    }
    this._textures = null;
  }

  /**
   * 画像読み込み
   *
	/**
	 * 画像読み込み
	 *
	 * @param fileName 読み込む画像ファイルパス名
	 * @param gl WebGL コンテキスト
	 * @param usePremultiply Premult 処理を有効にするか
	 * @param callback 読み込み完了時に呼ばれるコールバック
	 */
	public createTextureFromPngFile(
		fileName: string,
		gl: WebGLRenderingContext | WebGL2RenderingContext,
		usePremultiply: boolean,
		callback: (textureInfo: TextureInfo | null) => void
	): void {
		const img = new Image();

		img.addEventListener(
			'load',
			() => {
				const texture = gl.createTexture();
				if (!texture) {
					console.error('[APP] createTextureFromPngFile: createTexture 失敗', fileName);
					callback(null);
					return;
				}

				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.pixelStorei(
					gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
					usePremultiply ? 1 : 0
				);
				gl.texImage2D(
					gl.TEXTURE_2D,
					0,
					gl.RGBA,
					gl.RGBA,
					gl.UNSIGNED_BYTE,
					img
				);
				gl.texParameteri(
					gl.TEXTURE_2D,
					gl.TEXTURE_MIN_FILTER,
					gl.LINEAR_MIPMAP_LINEAR
				);
				gl.texParameteri(
					gl.TEXTURE_2D,
					gl.TEXTURE_MAG_FILTER,
					gl.LINEAR
				);

				gl.generateMipmap(gl.TEXTURE_2D);
				gl.bindTexture(gl.TEXTURE_2D, null);

				// TextureInfo を作って管理ベクタに入れる
				const textureInfo = new TextureInfo();
				textureInfo.id = texture;
				textureInfo.img = img;
				textureInfo.width = img.width;
				textureInfo.height = img.height;
				textureInfo.usePremultply = usePremultiply;
				textureInfo.fileName = fileName;

				this._textures.pushBack(textureInfo);

				callback(textureInfo);
			},
			{ passive: true }
		);

		img.addEventListener('error', () => {
			console.error('[APP] createTextureFromPngFile: 画像読み込み失敗', fileName);
			callback(null);
		});

		img.src = fileName;
	}



  /**
   * 画像の解放
   *
   * 配列に存在する画像全てを解放する。
   */
  public releaseTextures(): void {
    for (let i = 0; i < this._textures.getSize(); i++) {
      this._glManager.getGl().deleteTexture(this._textures.at(i).id);
      this._textures.set(i, null);
    }

    this._textures.clear();
  }

  /**
   * 画像の解放
   *
   * 指定したテクスチャの画像を解放する。
   * @param texture 解放するテクスチャ
   */
  public releaseTextureByTexture(texture: WebGLTexture): void {
    for (let i = 0; i < this._textures.getSize(); i++) {
      if (this._textures.at(i).id != texture) {
        continue;
      }

      this._glManager.getGl().deleteTexture(this._textures.at(i).id);
      this._textures.set(i, null);
      this._textures.remove(i);
      break;
    }
  }

  /**
   * 画像の解放
   *
   * 指定した名前の画像を解放する。
   * @param fileName 解放する画像ファイルパス名
   */
  public releaseTextureByFilePath(fileName: string): void {
    for (let i = 0; i < this._textures.getSize(); i++) {
      if (this._textures.at(i).fileName == fileName) {
        this._glManager.getGl().deleteTexture(this._textures.at(i).id);
        this._textures.set(i, null);
        this._textures.remove(i);
        break;
      }
    }
  }

  /**
   * setter
   * @param glManager
   */
  public setGlManager(glManager: LAppGlManager): void {
    this._glManager = glManager;
  }

  _textures: csmVector<TextureInfo>;
  private _glManager: LAppGlManager;
}

/**
 * 画像情報構造体
 */
export class TextureInfo {
  img: HTMLImageElement; // 画像
  id: WebGLTexture = null; // テクスチャ
  width = 0; // 横幅
  height = 0; // 高さ
  usePremultply: boolean; // Premult処理を有効にするか
  fileName: string; // ファイル名
}
