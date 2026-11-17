import xCloudPlayer from './player'
import Teredo from './teredo'

export default class Ice {
    private _peerConnection:RTCPeerConnection
    private _iceCandidates: RTCIceCandidate[] = []

    constructor(player:xCloudPlayer) {
        this._peerConnection = player._peerConnection

        this._peerConnection.addEventListener('icecandidate', event => {
            if(event.candidate) {
                this._iceCandidates.push(event.candidate)

                // @TODO: Implement Teredo port selection for remote streaming
            }
        })
    }

    getCandidates(){
        return this._iceCandidates
    }

    setRemoteCandidates(candidates:RTCIceCandidate[]){
        if(candidates.length === 0){
            console.warn('Error: No candidates received!')
        }

        for(const candidate in candidates){
            if(candidates[candidate].candidate === 'a=end-of-candidates') {continue}

            const candidateAddress = candidates[candidate].candidate.split(' ')
                        
            if(candidateAddress.length > 4 && candidateAddress[4].substr(0, 4) === '2001'){
                const teredo = new Teredo(candidateAddress[4])

                this._peerConnection.addIceCandidate({
                    candidate: 'a=candidate:10 1 UDP 1 '+teredo.getIpv4Address()+' 9002 typ host ',
                    sdpMLineIndex: candidates[candidate].sdpMLineIndex,
                    sdpMid: candidates[candidate].sdpMid,
                }).catch((error) => {
                    console.error('[Ice] Failed to add the Teredo ICE candidate:', error)
                })
                this._peerConnection.addIceCandidate({
                    candidate: 'a=candidate:11 1 UDP 1 '+teredo.getIpv4Address()+' '+teredo.getIpv4Port()+' typ host ',
                    sdpMLineIndex: candidates[candidate].sdpMLineIndex,
                    sdpMid: candidates[candidate].sdpMid,
                }).catch((error) => {
                    console.error('[Ice] Failed to add the Teredo ICE candidate:', error)
                })
            }

            this._peerConnection.addIceCandidate({
                candidate: candidates[candidate].candidate,
                sdpMid: candidates[candidate].sdpMid,
                sdpMLineIndex: candidates[candidate].sdpMLineIndex,
            }).catch((error) => {
                console.error('[Ice] Failed to add the ICE candidate:', error)
            })
        }
    }
}