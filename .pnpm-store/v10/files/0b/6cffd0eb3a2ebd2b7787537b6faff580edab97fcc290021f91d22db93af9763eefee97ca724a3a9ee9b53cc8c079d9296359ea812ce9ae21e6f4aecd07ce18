import nprogress from 'nprogress';
import { isNumber, tryOnScopeDispose } from '@vueuse/shared';
import { isRef, ref, computed, watchEffect } from 'vue-demi';

function useNProgress(currentProgress = null, options) {
  const progress = isRef(currentProgress) ? currentProgress : ref(currentProgress);
  const isLoading = computed({
    set: (load) => load ? nprogress.start() : nprogress.done(),
    get: () => isNumber(progress.value) && progress.value < 1
  });
  if (options)
    nprogress.configure(options);
  const setProgress = nprogress.set;
  nprogress.set = (n) => {
    progress.value = n;
    return setProgress.call(nprogress, n);
  };
  watchEffect(() => {
    if (isNumber(progress.value))
      setProgress.call(nprogress, progress.value);
  });
  tryOnScopeDispose(nprogress.remove);
  return {
    isLoading,
    progress,
    start: nprogress.start,
    done: nprogress.done,
    remove: () => {
      progress.value = null;
      nprogress.remove();
    }
  };
}

export { useNProgress };
