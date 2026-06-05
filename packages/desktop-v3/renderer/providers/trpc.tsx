'client'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { httpBatchLink, createTRPCClient, TRPCClientError } from '@trpc/client';
import { useState, ReactNode } from 'react';
import { TRPCProvider } from '../utils/trpc';
import { appRouter } from '@greenlight/platform';
import { ipcLink } from '../utils/ipc-link';

import { useToast } from '../contexts/ToastContext';

function makeQueryClient() {
  const toast = useToast();

  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 1000 * 5,
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        const message = getTrpcErrorMessage(error);
        toast.error('TRPC Error: ' + message);
        console.log("Query Error:", message);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        const message = getTrpcErrorMessage(error);
        toast.error('TRPC Error: ' + message);
        console.log("Mutation Error:", message);
      },
    }),
  });
}

function getTrpcErrorMessage(error: unknown): string {
  if (error instanceof TRPCClientError) {
    return error.message;
  }
  if (error instanceof Error) {
    console.error('Non-tRPC error:', error);
    return error.message;
  }
  return "An unknown error occurred.";
}

function getQueryClient() {
    return makeQueryClient();
}

export const TrpcProviderComponent = ({ children }: { children: ReactNode }) => {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<typeof appRouter>({
      links: [
        // Use IPC when running inside Electron, fall back to HTTP for web builds
        typeof window !== 'undefined' && 'trpcIpc' in window
          ? ipcLink<typeof appRouter>()
          : httpBatchLink({
              url: '/trpc',
            }),
      ],
    }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}