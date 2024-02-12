import { Preload } from '../main/preload'

/* eslint-disable */
declare global {
    interface Window {
        Greenlight: typeof Preload;
    }
}
/* eslint-enable */