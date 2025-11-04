import { ref, computed } from 'vue-demi';
import jwt_decode from 'jwt-decode';

function useJwt(encodedJwt, options = {}) {
  const encodedJwtRef = ref(encodedJwt);
  const {
    onError,
    fallbackValue = null
  } = options;
  const decodeWithFallback = (encodedJwt2, options2) => {
    try {
      return jwt_decode(encodedJwt2, options2);
    } catch (err) {
      onError == null ? void 0 : onError(err);
      return fallbackValue;
    }
  };
  const header = computed(() => decodeWithFallback(encodedJwtRef.value, { header: true }));
  const payload = computed(() => decodeWithFallback(encodedJwtRef.value));
  return {
    header,
    payload
  };
}

export { useJwt };
