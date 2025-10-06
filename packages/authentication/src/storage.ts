import { safeStorage } from 'electron'
import Logger from '@greenlight/logger'

const log = new Logger('auth:storage')

export default class SafeStorage {
    
    constructor(){
        // Check if safeStorage is available
        if (!safeStorage.isEncryptionAvailable()) {
            log.warn('[isEncryptionAvailable] Encryption is not available on this platform')
        } else {
            log.log('[isEncryptionAvailable] SafeStorage is available')
        }
    }

    /**
     * Encrypts and stores sensitive data
     * @param data - String data to encrypt
     * @returns Encrypted buffer as base64 string
     */
    encryptData(data: string): string {
        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error('Encryption is not available')
        }
        
        const buffer = safeStorage.encryptString(data)
        return buffer.toString('base64')
    }

    /**
     * Decrypts previously encrypted data
     * @param encryptedData - Base64 encoded encrypted data
     * @returns Decrypted string
     */
    decryptData(encryptedData: string): string {
        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error('Encryption is not available')
        }
        
        const buffer = Buffer.from(encryptedData, 'base64')
        return safeStorage.decryptString(buffer)
    }

    /**
     * Securely store authentication tokens
     * @param tokens - Token object to encrypt and store
     * @returns Encrypted token string
     */
    secureStoreTokens(tokens: any): string {
        const tokenString = JSON.stringify(tokens)
        return this.encryptData(tokenString)
    }

    /**
     * Retrieve and decrypt stored tokens
     * @param encryptedTokens - Encrypted token string
     * @returns Decrypted token object
     */
    secureRetrieveTokens(encryptedTokens: string): any {
        const tokenString = this.decryptData(encryptedTokens)
        return JSON.parse(tokenString)
    }
}