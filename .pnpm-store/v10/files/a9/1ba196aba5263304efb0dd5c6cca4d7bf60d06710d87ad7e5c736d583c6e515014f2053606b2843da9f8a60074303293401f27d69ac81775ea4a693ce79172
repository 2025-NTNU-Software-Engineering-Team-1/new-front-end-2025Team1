'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var Fuse = require('fuse.js');
var vueDemi = require('vue-demi');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var Fuse__default = /*#__PURE__*/_interopDefaultLegacy(Fuse);

function useFuse(search, data, options) {
  var _a;
  const createFuse = (data2, options2) => {
    var _a2;
    const _options = options2;
    return new Fuse__default["default"]((_a2 = vueDemi.unref(data2)) != null ? _a2 : [], _options);
  };
  const fuse = vueDemi.ref(createFuse(data, (_a = vueDemi.unref(options)) == null ? void 0 : _a.fuseOptions));
  vueDemi.watch(() => {
    var _a2;
    return (_a2 = vueDemi.unref(options)) == null ? void 0 : _a2.fuseOptions;
  }, (newOptions) => {
    fuse.value = createFuse(data, newOptions);
  }, { deep: true });
  vueDemi.watch(() => vueDemi.unref(data), (newData) => {
    fuse.value.setCollection(newData);
  }, { deep: true });
  const results = vueDemi.computed(() => {
    var _a2, _b;
    if (((_a2 = vueDemi.unref(options)) == null ? void 0 : _a2.matchAllWhenSearchEmpty) && !vueDemi.unref(search))
      return vueDemi.unref(data).map((item, index) => ({ item, refIndex: index }));
    const limit = (_b = vueDemi.unref(options)) == null ? void 0 : _b.resultLimit;
    return fuse.value.search(vueDemi.unref(search), limit ? { limit } : void 0);
  });
  return {
    results
  };
}

exports.useFuse = useFuse;
