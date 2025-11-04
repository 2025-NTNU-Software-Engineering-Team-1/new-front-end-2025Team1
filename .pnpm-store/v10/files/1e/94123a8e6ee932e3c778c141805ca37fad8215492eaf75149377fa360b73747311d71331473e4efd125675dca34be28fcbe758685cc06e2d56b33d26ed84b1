import { ComputedRef } from 'vue-demi';
import { MaybeRef } from '@vueuse/shared';
import { JwtPayload, JwtHeader } from 'jwt-decode';

interface JwtOptions<Fallback> {
    /**
     * Value returned when encounter error on decoding
     *
     * @default null
     */
    fallbackValue?: Fallback;
    /**
     * Error callback for decoding
     */
    onError?: (error: unknown) => void;
}
interface JwtResult<Payload, Header, Fallback> {
    header: ComputedRef<Header | Fallback>;
    payload: ComputedRef<Payload | Fallback>;
}
/**
 * Reactive decoded jwt token.
 *
 * @see https://vueuse.org/useJwt
 * @param jwt
 */
declare function useJwt<Payload extends object = JwtPayload, Header extends object = JwtHeader, Fallback = null>(encodedJwt: MaybeRef<string>, options?: JwtOptions<Fallback>): JwtResult<Payload, Header, Fallback>;

export { JwtOptions, JwtResult, useJwt };
