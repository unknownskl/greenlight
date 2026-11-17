import Application from '../application'

// True when an API call failed because its token was refused (HTTP 401).
// xCloudApi rejects with { status }, xbox-webapi with an Error whose message contains the indented JSON details ("statuscode": 401).
export function isUnauthorizedError(error:unknown):boolean {
    if(typeof error !== 'object' || error === null){
        return false
    }
    const { status, message } = error as { status?:unknown, message?:unknown }
    if(status === 401){
        return true
    }
    return typeof message === 'string' && /"statuscode":\s*401\b/.test(message)
}

// Runs an API call; if its token was refused, refreshes the tokens and runs it once more.
// If the refresh itself fails, the original error is passed on.
export function withTokenRefresh<T>(application:Application, call:() => Promise<T>):Promise<T> {
    return call().catch((error) => {
        if(! isUnauthorizedError(error)){
            throw error
        }

        application.log('authenticationV2', __filename+'[withTokenRefresh()] Token refused, refreshing tokens and retrying once')
        return application.refreshApiTokens().then(call, (refreshError) => {
            application.log('authenticationV2', __filename+'[withTokenRefresh()] Failed to refresh tokens:', refreshError)
            throw error
        })
    })
}
