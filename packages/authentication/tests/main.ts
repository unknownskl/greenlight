import GreenlightAuthentication from '../src/index'
import SafeStorage from '../src/storage'
import { expect } from 'chai'

describe('GreenlightAuthentication', () => {

    describe('new instance', () => {
        it('should create an instance of Authentication', function(){
            const auth = new GreenlightAuthentication()
            expect(auth).to.be.an.instanceOf(GreenlightAuthentication)
        })

        it('should have the correct properties', function(){
            const auth = new GreenlightAuthentication()
            // @ts-ignore - _storage is private
            expect(auth._storage).to.be.an.instanceOf(SafeStorage)
        })
    })
})