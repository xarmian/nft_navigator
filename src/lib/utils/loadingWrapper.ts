import { isLoading } from '../../stores/loading';

export async function withLoading<T>(asyncFunction: () => Promise<T>): Promise<T> {
    isLoading.set(true);
    try {
        return await asyncFunction();
    } finally {
        isLoading.set(false);
    }
}