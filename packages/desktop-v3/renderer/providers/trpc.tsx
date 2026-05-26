import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { httpBatchLink, createTRPCClient, TRPCClientError } from '@trpc/client';
import { useState, ReactNode } from 'react';
import { TRPCProvider } from '../utils/trpc';
import { appRouter } from '@greenlight/platform';
import { ipcLink } from '../utils/ipc-link';

function makeQueryClient() {
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
        // showErrorToast(message);
        console.log("Query Error:", message);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        const message = getTrpcErrorMessage(error);
        // showErrorToast(message);
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