import Fuse from 'fuse.js';
import { ref, unref, watch, computed } from 'vue-demi';

function useFuse(search, data, options) {
  var _a;
  const createFuse = (data2, options2) => {
    var _a2;
    const _options = options2;
    return new Fuse((_a2 = unref(data2)) != null ? _a2 : [], _options);
  };
  const fuse = ref(createFuse(data, (_a = unref(options)) == null ? void 0 : _a.fuseOptions));
  watch(() => {
    var _a2;
    return (_a2 = unref(options)) == null ? void 0 : _a2.fuseOptions;
  }, (newOptions) => {
    fuse.value = createFuse(data, newOptions);
  }, { deep: true });
  watch(() => unref(data), (newData) => {
    fuse.value.setCollection(newData);
  }, { deep: true });
  const results = computed(() => {
    var _a2, _b;
    if (((_a2 = unref(options)) == null ? void 0 : _a2.matchAllWhenSearchEmpty) && !unref(search))
      return unref(data).map((item, index) => ({ item, refIndex: index }));
    const limit = (_b = unref(options)) == null ? void 0 : _b.resultLimit;
    return fuse.value.search(unref(search), limit ? { limit } : void 0);
  });
  return {
    results
  };
}

export { useFuse };
