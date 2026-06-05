'use client';

import { TRPCClientError, TRPCLink } from '@trpc/client'
import { observable } from '@trpc/server/observable'
import type { AnyRouter } from '@trpc/server'

/**
 * Custom tRPC link that routes calls through Electron's IPC instead of HTTP.
 * Falls back gracefully when `window.trpcIpc` is not available (web mode).
 */
export function ipcLink<TRouter extends AnyRouter>(): TRPCLink<TRouter> {

  return () =>
    ({ op }) =>
      observable((observer) => {
        window.trpcIpc
          .invoke({ path: op.path, type: op.type, input: op.input })
          .then(
            (response: { result?: { data: unknown }; error?: { message: string; code: string } }) => {
              if (response.error) {
                observer.error(
                  TRPCClientError.from(
                    Object.assign(new Error(response.error.message), {
                      code: response.error.code,
                    }),
                  ),
                )
                console.log('tRPC error from IPC:', response.error)
                // observer.error({
                //   code: response.error.code,
                //   message: response.error.message,
                // })
                observer.complete()
                
              } else {
                observer.next({ result: response.result! as { type: 'data'; data: unknown } })
                observer.complete()
              }
            },
          )
          // .catch((err: unknown) => observer.error(TRPCClientError.from(err as Error)))
          // .catch((err: unknown) => {
          //   console.error('IPC link error:', err)
          // })
      })
}
