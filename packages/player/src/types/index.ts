export interface xStreamToken {
    market: string;
    language: string;
    token: string;
}

export interface xCloudStreamConfig {
    id: string;
    type: 'home' | 'cloud';
    language: string;
    host: string;
    resolution: 720 | 1080;
}

export interface startStreamResponse {
    sessionId: string;
    sessionPath: string;
    state: 'Provisioning' | any;
}

export interface StatusResponse {
    status: number
}

export interface ErrorResponse {
    error: any
}

export interface SDPResponse {
    errorDetails?: {
        code: number | null;
        message: string | null;
    }
    exchangeResponse: string | null;
}

export interface ICEResponse {
    errorDetails?: {
        code: number | null;
        message: string | null;
    }
    exchangeResponse: string | null;
}