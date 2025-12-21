/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { JsonArray, JsonBoolean, JsonFloat, JsonMap, JsonNullvalue, JsonString, Value } from "./cubismjson";

/**
 * CubismJsonで実装されているJsonパーサを使用せず、
 * TypeScript標準のJsonパーサなどを使用し出力された結果を
 * Cubism SDKで定義されているJSONエレメントの要� に
 * 置き換える処理をするクラス。
 */
export class CubismJsonExtension {
  static parseJsonObject(obj: Value, map: JsonMap) {
    Object.keys(obj).forEach((key) => {
      if (typeof obj[key] == "boolean") {
        const convValue = Boolean(obj[key]);
        map.put(key, new JsonBoolean(convValue));
      } else if (typeof obj[key] == "string") {
        const convValue = String(obj[key]);
        map.put(key, new JsonString(convValue));
      } else if (typeof obj[key] == "number") {
        const convValue = Number(obj[key]);
        map.put(key, new JsonFloat(convValue));
      } else if (obj[key] instanceof Array) {
        // HACK: Array 単体で変換できないので unknown に変更してから Value にしている
        map.put(key, CubismJsonExtension.parseJsonArray(obj[key] as unknown as Value));
      } else if (obj[key] instanceof Object) {
        map.put(key, CubismJsonExtension.parseJsonObject(obj[key], new JsonMap()));
      } else if (obj[key] == null) {
        map.put(key, new JsonNullvalue());
      } else {
        // どれにも当てはまらない� �合でも処理する
        map.put(key, obj[key]);
      }
    });
    return map;
  }

  protected static parseJsonArray(obj: Value) {
    const arr = new JsonArray();
    Object.keys(obj).forEach((key) => {
      const convKey = Number(key);
      if (typeof convKey == "number") {
        if (typeof obj[key] == "boolean") {
          const convValue = Boolean(obj[key]);
          arr.add(new JsonBoolean(convValue));
        } else if (typeof obj[key] == "string") {
          const convValue = String(obj[key]);
          arr.add(new JsonString(convValue));
        } else if (typeof obj[key] == "number") {
          const convValue = Number(obj[key]);
          arr.add(new JsonFloat(convValue));
        } else if (obj[key] instanceof Array) {
          // HACK: Array 単体で変換できないので unknown に変更してから Value にしている
          arr.add(this.parseJsonArray(obj[key] as unknown as Value));
        } else if (obj[key] instanceof Object) {
          arr.add(this.parseJsonObject(obj[key], new JsonMap()));
        } else if (obj[key] == null) {
          arr.add(new JsonNullvalue());
        } else {
          // どれにも当てはまらない� �合でも処理する
          arr.add(obj[key]);
        }
      } else if (obj[key] instanceof Array) {
        // HACK: Array 単体で変換できないので unknown に変更してから Value にしている
        arr.add(this.parseJsonArray(obj[key] as unknown as Value));
      } else if (obj[key] instanceof Object) {
        arr.add(this.parseJsonObject(obj[key], new JsonMap()));
      } else if (obj[key] == null) {
        arr.add(new JsonNullvalue());
      } else {
        const convValue = Array(obj[key]);
        // 配列ともObjectとも判定できなかった� �合でも処理する
        for (let i = 0; i < convValue.length; i++) {
          arr.add(convValue[i]);
        }
      }
    });
    return arr;
  }
}
