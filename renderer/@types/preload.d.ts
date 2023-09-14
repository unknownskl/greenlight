import { Preload } from '../main/preload';

declare global {
    interface Window {
        Greenlight: typeof Preload;
    }
}