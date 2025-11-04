import Fuse from 'fuse.js';
import { ComputedRef } from 'vue-demi';
import { MaybeRef } from '@vueuse/shared';

declare type FuseOptions<T> = Fuse.IFuseOptions<T>;
interface UseFuseOptions<T> {
    fuseOptions?: FuseOptions<T>;
    resultLimit?: number;
    matchAllWhenSearchEmpty?: boolean;
}
declare function useFuse<DataItem>(search: MaybeRef<string>, data: MaybeRef<DataItem[]>, options?: MaybeRef<UseFuseOptions<DataItem>>): {
    results: ComputedRef<Fuse.FuseResult<DataItem>[]>;
};
declare type UseFuseReturn = ReturnType<typeof useFuse>;

export { FuseOptions, UseFuseOptions, UseFuseReturn, useFuse };
