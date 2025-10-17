import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  mediaDevices,
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import FirebaseService from './firebaseService';
import { firebaseFirestore, COLLECTIONS } from '../config/firebase';
import NotificationService from './notificationService';
import PerfectVideoCallSignaling from './PerfectVideoCallSignaling';

export interface CallConfig {
  isAudioOnly?: boolean;
  enableSpeaker?: boolean;
}

export interface CallEvents {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onCallEnded?: () => void;
  onCallConnected?: () => void;
  onError?: (error: string) => void;
  onIncomingCall?: (callData: any) => void;
}

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callId: string | null = null;
  private isInitiator: boolean = false;
  private events: CallEvents = {};
  private callListener: (() => void) | null = null;
  private iceCandidatesListener: (() => void) | null = null;
  private currentUserId: string | null = null;
  private speakerEnabled: boolean = false;
  private isEnding: boolean = false;
  private isManualEnd: boolean = false;
  private notificationService: NotificationService;
  private videoCallSignaling: PerfectVideoCallSignaling;

  private configuration: any = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
  };

  constructor() {
    this.notificationService = NotificationService.getInstance();
    this.videoCallSignaling = PerfectVideoCallSignaling.getInstance();
    this.setupInCallManager();
  }

  private setupInCallManager() {
    InCallManager.setSpeakerphoneOn(false);
    InCallManager.setKeepScreenOn(true);
  }

  setEventHandlers(events: CallEvents) {
    this.events = events;
  }

  setCurrentUser(userId: string) {
    this.currentUserId = userId;
    try {
      // Initialize enhanced video call signaling instead of basic listener
      this.initializeEnhancedSignaling(userId);
    } catch (error) {
      console.log('Enhanced call service setup failed, falling back to basic:', error);
      // Fallback to basic setup
      this.setupCallListener();
    }
  }

  private async initializeEnhancedSignaling(userId: string) {
    try {
      console.log('🎥 Setting up enhanced video call signaling for:', userId);
      
      await this.videoCallSignaling.initializeUserSignaling(userId, {
        onIncomingCall: (callData) => {
          console.log('📞 Enhanced signaling: Incoming call received:', callData);
          this.events.onIncomingCall?.(callData);
        },
        onCallStatusUpdate: (callData) => {
          console.log('📞 Enhanced signaling: Call status updated:', callData);
          if (callData.status === 'ended' && this.callId === callData.id && !this.isEnding) {
            this.handleRemoteCallEnd();
          }
        },
        onCallEnded: (callId) => {
          console.log('📞 Enhanced signaling: Call ended:', callId);
          if (this.callId === callId && !this.isEnding) {
            this.handleRemoteCallEnd();
          }
        }
      });
      
      console.log('✅ Enhanced video call signaling initialized');
    } catch (error) {
      console.error('❌ Enhanced signaling setup failed:', error);
      throw error;
    }
  }

  private setupCallListener() {
    if (!this.currentUserId) return;

    try {
      // Clean up existing listener first
      if (this.callListener) {
        this.callListener();
        this.callListener = null;
      }

      // Listen for incoming calls using modern React Native Firebase
      const callsRef = firebaseFirestore.collection(COLLECTIONS.CALLS);
      const q = callsRef
        .where('receiverId', '==', this.currentUserId)
        .where('status', 'in', ['ringing', 'connecting']);
      
      this.callListener = q.onSnapshot((snapshot) => {
        if (this.isEnding) return; // Don't process if already ending
        
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const callData = { id: change.doc.id, ...change.doc.data() } as any;
            console.log('Incoming call detected:', callData);
            
            // Only handle if not currently in a call
            if (!this.callId || this.callId !== callData.id) {
              this.events.onIncomingCall?.(callData);
            }
          } else if (change.type === 'modified') {
            const callData = { id: change.doc.id, ...change.doc.data() } as any;
            console.log('Call status updated:', callData);
            
            // Handle call status changes only for current call
            if (callData.status === 'ended' && this.callId === callData.id && !this.isEnding) {
              this.handleRemoteCallEnd();
            }
          }
        });
      }, (error) => {
        console.log('Call service temporarily unavailable:', error.message);
        // Don't crash the app, just log the error
      });
    } catch (error) {
      console.log('WebRTC service initialization skipped:', error);
      // WebRTC is optional functionality
    }
  }

  private handleRemoteCallEnd() {
    console.log('Remote party ended the call');
    
    // Prevent multiple executions
    if (this.isEnding) {
      console.log('Already handling call end, skipping...');
      return;
    }
    
    this.isEnding = true;
    
    // Clean up immediately to prevent loops
    this.performCleanup();
    
    // Notify about call end after cleanup
    if (this.events.onCallEnded) {
      const callback = this.events.onCallEnded;
      this.events.onCallEnded = undefined; // Prevent loops
      
      // Use a longer delay to ensure cleanup is complete
      setTimeout(() => {
        callback();
        this.isEnding = false; // Reset flag after callback
      }, 500);
    } else {
      this.isEnding = false;
    }
  }

  async initializeCall(callId: string, isInitiator: boolean, config: CallConfig = {}) {
    try {
      this.callId = callId;
      this.isInitiator = isInitiator;

      // Setup InCall Manager
      InCallManager.start({ media: config.isAudioOnly ? 'audio' : 'video' });
      
      if (config.enableSpeaker) {
        InCallManager.setSpeakerphoneOn(true);
      }

      // Create peer connection
      this.peerConnection = new RTCPeerConnection(this.configuration);

      // Setup peer connection event handlers
      this.setupPeerConnectionHandlers();

      // Get local media stream
      await this.getLocalStream(config.isAudioOnly || false);

      if (isInitiator) {
        // Create offer
        const offer = await this.peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: !config.isAudioOnly,
        });

        await this.peerConnection.setLocalDescription(offer);

        // Save offer to Firebase using modern approach
        const callDocRef = firebaseFirestore.collection(COLLECTIONS.CALLS).doc(callId);
        await callDocRef.update({
          offer: {
            type: offer.type,
            sdp: offer.sdp,
          },
          status: 'calling',
        });
      }

      // Listen for call updates
      this.listenForCallUpdates();

    } catch (error) {
      console.error('Error initializing call:', error);
      this.events.onError?.('Failed to initialize call');
      this.endCall();
    }
  }

  private async getLocalStream(isAudioOnly: boolean) {
    try {
      const constraints = {
        audio: true,
        video: !isAudioOnly ? {
          mandatory: {
            minWidth: 640,
            minHeight: 480,
            minFrameRate: 30,
          },
          facingMode: 'user',
        } : false,
      };

      this.localStream = await mediaDevices.getUserMedia(constraints);
      
      if (this.peerConnection && this.localStream) {
        this.localStream.getTracks().forEach(track => {
          this.peerConnection?.addTrack(track, this.localStream!);
        });
      }

      this.events.onLocalStream?.(this.localStream);
    } catch (error) {
      console.error('Error getting local stream:', error);
      this.events.onError?.('Failed to access camera/microphone');
    }
  }

  private setupPeerConnectionHandlers() {
    if (!this.peerConnection) return;

    (this.peerConnection as any).onicecandidate = (event: any) => {
      if (this.isEnding || !this.callId || !this.peerConnection) return;
      
      if (event.candidate) {
        // Send ICE candidate to Firebase using modern approach
        const iceCandidatesRef = firebaseFirestore
          .collection(COLLECTIONS.CALLS)
          .doc(this.callId)
          .collection('iceCandidates');
          
        iceCandidatesRef.add({
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
          from: this.isInitiator ? 'caller' : 'callee',
          timestamp: new Date().toISOString(),
          })
          .catch(error => {
            console.error('Error sending ICE candidate:', error);
          });
      }
    };

    (this.peerConnection as any).onaddstream = (event: any) => {
      if (this.isEnding || !this.peerConnection) return;
      
      console.log('Remote stream received');
      this.remoteStream = event.stream;
      this.events.onRemoteStream?.(event.stream);
      this.events.onCallConnected?.();
    };

    (this.peerConnection as any).onconnectionstatechange = () => {
      if (!this.peerConnection || this.isEnding) return;
      
      const state = this.peerConnection.connectionState;
      console.log('Connection state changed:', state);
      
      if (!state) {
        console.warn('Connection state is undefined, skipping state handling');
        return;
      }
      
      if (state === 'connected') {
        this.events.onCallConnected?.();
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        console.log(`Connection ${state}, ending call`);
        if (!this.isEnding) {
          this.handleRemoteCallEnd();
        }
      }
    };
  }

  private listenForCallUpdates() {
    if (!this.callId) return;

    // Clean up general call listener to prevent conflicts
    if (this.callListener) {
      this.callListener();
      this.callListener = null;
    }

    // Listen for call status changes using modern approach
    const callDocRef = firebaseFirestore.collection(COLLECTIONS.CALLS).doc(this.callId);
    this.callListener = callDocRef.onSnapshot((doc) => {
      if (!doc.exists || this.isEnding) return;

      const data = doc.data();
      
      // Prevent loop by checking if we're already ending the call
      if ((data?.status === 'ended' || data?.status === 'rejected') && !this.isEnding) {
        console.log('Call ended from Firebase listener');
        this.handleRemoteCallEnd();
        return;
      }

      // Handle offer (for callee)
      if (!this.isInitiator && data?.offer && this.peerConnection && !this.isEnding) {
        this.handleOffer(data.offer);
      }

      // Handle answer (for caller)
      if (this.isInitiator && data?.answer && this.peerConnection && !this.isEnding) {
        this.handleAnswer(data.answer);
      }
    }, (error) => {
      console.error('Error listening to call updates:', error);
    });

    // Listen for ICE candidates using modern approach
    const iceCandidatesRef = firebaseFirestore
      .collection(COLLECTIONS.CALLS)
      .doc(this.callId)
      .collection('iceCandidates');
      
    const iceCandidatesListener = iceCandidatesRef.onSnapshot((snapshot) => {
      if (this.isEnding) return; // Don't process if call is ending
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const from = data.from;
          
          // Only process ICE candidates from the other peer
          if ((this.isInitiator && from === 'callee') || (!this.isInitiator && from === 'caller')) {
            const candidate = new RTCIceCandidate({
              candidate: data.candidate,
              sdpMLineIndex: data.sdpMLineIndex,
              sdpMid: data.sdpMid,
            });
            
            this.peerConnection?.addIceCandidate(candidate);
          }
        }
        });
      });

    // Store listener for cleanup
    if (!this.iceCandidatesListener) {
      this.iceCandidatesListener = iceCandidatesListener;
    }
  }

  private async handleOffer(offer: any) {
    try {
      if (!this.peerConnection || this.isEnding) return;

      // Check if we already have a remote description set
      if (this.peerConnection.signalingState !== 'stable' && 
          this.peerConnection.signalingState !== 'have-remote-offer') {
        console.log('Peer connection not ready for offer, current state:', this.peerConnection.signalingState);
        return;
      }

      console.log('Processing offer automatically...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Only create answer if we're not the initiator and haven't answered yet
      if (!this.isInitiator && this.peerConnection.signalingState === 'have-remote-offer') {
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        // Save answer to Firebase using modern approach
        const callDocRef = firebaseFirestore.collection(COLLECTIONS.CALLS).doc(this.callId!);
        const callDoc = await callDocRef.get();
        const callData = callDoc.data();
        
        // Only update if not already answered
        if (callData?.status !== 'answered') {
          await callDocRef.update({
            answer: {
              type: answer.type,
              sdp: answer.sdp,
            },
            status: 'answered',
          });
        }
      }
    } catch (error) {
      console.error('Error handling offer:', error);
      this.events.onError?.('Failed to handle call offer');
    }
  }

  private async handleAnswer(answer: any) {
    try {
      if (!this.peerConnection || this.isEnding) {
        console.log('Cannot handle answer: peer connection not available or call ending');
        return;
      }

      if (!answer || !answer.type || !answer.sdp) {
        console.error('Invalid answer format:', answer);
        this.events.onError?.('Invalid call answer format');
        return;
      }

      // Check if we're in the right state to handle answer
      if (this.peerConnection.signalingState === 'closed') {
        console.log('Peer connection is closed, cannot handle answer');
        return;
      }

      console.log('Handling call answer...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Call answer processed successfully');
    } catch (error) {
      console.error('Error handling answer:', error);
      
      // Only show error if it's not due to cleanup
      if (!this.isEnding && this.peerConnection && this.peerConnection.signalingState !== 'closed') {
        this.events.onError?.('Failed to handle call answer');
        
        // Give it a moment before ending the call to avoid race conditions
        setTimeout(() => {
          if (!this.isEnding) {
            this.endCall();
          }
        }, 1000);
      }
    }
  }

  async answerCall() {
    if (!this.callId || this.isEnding) {
      console.log('Cannot answer call: no call ID or call ending');
      return;
    }

    try {
      console.log('Manual call answer triggered...');
      
      const callDocRef = firebaseFirestore.collection(COLLECTIONS.CALLS).doc(this.callId);
      const callDoc = await callDocRef.get();
      
      if (!callDoc.exists) {
        throw new Error('Call document not found');
      }
      
      const callData = callDoc.data();
      
      // Check if call is already answered
      if (callData?.status === 'answered') {
        console.log('Call already answered');
        return;
      }
      
      // If there's an offer and we haven't processed it yet, handle it
      if (callData?.offer && this.peerConnection && !this.isEnding) {
        const currentState = this.peerConnection.signalingState;
        console.log('Current signaling state:', currentState);
        
        // Only process if we haven't set remote description yet
        if (currentState === 'stable') {
          console.log('Processing offer manually during answer...');
          
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
          
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);
          
          // Update call document with answer and status
          await callDocRef.update({
            answer: {
              type: answer.type,
              sdp: answer.sdp,
            },
            status: 'answered',
            answeredAt: new Date().toISOString(),
          });
          
          console.log('Call answered successfully with manual WebRTC signaling');
        } else {
          // If offer already processed, just update status
          await callDocRef.update({
            status: 'answered',
            answeredAt: new Date().toISOString(),
          });
          
          console.log('Call answered successfully (offer already processed)');
        }
      } else {
        // No offer available, just update status
        await callDocRef.update({
          status: 'answered',
          answeredAt: new Date().toISOString(),
        });
        
        console.log('Call answered successfully (status update only)');
      }
    } catch (error) {
      console.error('Error answering call:', error);
      this.events.onError?.('Failed to answer call');
      
      // If we can't answer, end the call
      if (!this.isEnding) {
        this.endCall();
      }
    }
  }

  async rejectCall() {
    if (!this.callId) return;

    try {
      const callDocRef = firebaseFirestore.collection(COLLECTIONS.CALLS).doc(this.callId);
      await callDocRef.update({
        status: 'rejected',
      });
      
      this.endCall();
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  }

  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return !audioTrack.enabled; // Return muted state
      }
    }
    return false;
  }

  toggleCamera() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return !videoTrack.enabled; // Return camera off state
      }
    }
    return false;
  }

  switchCamera() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack._switchCamera();
      }
    }
  }

  toggleSpeaker() {
    this.speakerEnabled = !this.speakerEnabled;
    InCallManager.setSpeakerphoneOn(this.speakerEnabled);
    return this.speakerEnabled;
  }

  private performCleanup() {
    try {
      console.log('Performing cleanup...');
      
      // Clean up listeners first to prevent new events
      if (this.callListener) {
        this.callListener();
        this.callListener = null;
      }
      
      if (this.iceCandidatesListener) {
        this.iceCandidatesListener();
        this.iceCandidatesListener = null;
      }

      // Clean up media streams
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (error) {
            console.warn('Error stopping track:', error);
          }
        });
        this.localStream = null;
      }

      if (this.remoteStream) {
        this.remoteStream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (error) {
            console.warn('Error stopping remote track:', error);
          }
        });
        this.remoteStream = null;
      }

      // Close peer connection
      if (this.peerConnection) {
        try {
          this.peerConnection.close();
        } catch (error) {
          console.warn('Error closing peer connection:', error);
        }
        this.peerConnection = null;
      }

      // Stop InCall Manager
      try {
        InCallManager.stop();
      } catch (error) {
        console.warn('Error stopping InCallManager:', error);
      }

      // Reset state
      this.callId = null;
      this.isInitiator = false;
      
      console.log('Cleanup completed');
    } catch (error) {
      console.error('Error during performCleanup:', error);
    }
  }

  endCall() {
    try {
      // Prevent multiple calls to endCall
      if (this.isEnding) {
        console.log('Call already ending, skipping...');
        return;
      }
      
      if (!this.peerConnection && !this.localStream && !this.callId) {
        console.log('Call already cleaned up');
        return; // Already cleaned up
      }

      console.log('Ending call...');
      this.isEnding = true;
      this.isManualEnd = true; // Mark as manual end to prevent unwanted callbacks

      // Update call status in Firebase first using modern approach
      if (this.callId) {
        const callDocRef = firebaseFirestore.collection(COLLECTIONS.CALLS).doc(this.callId);
        callDocRef.update({
          status: 'ended',
          endedAt: new Date().toISOString(),
        }).catch(error => console.error('Error updating call status:', error));

        // Clear call notifications
        this.notificationService.clearCallNotification(this.callId);
      }

      // Perform cleanup
      this.performCleanup();

      // Reset flags after a delay to prevent immediate re-entry
      setTimeout(() => {
        this.isManualEnd = false;
        this.isEnding = false;
      }, 1000);
      
    } catch (error) {
      console.error('Error ending call:', error);
      // Reset flags on error
      setTimeout(() => {
        this.isManualEnd = false;
        this.isEnding = false;
      }, 1000);
    }
  }

  cleanup() {
    try {
      console.log('Cleanup called...');
      this.isManualEnd = true; // Mark as manual end
      this.performCleanup();
      this.events = {}; // Clear all event handlers
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  // Method for manually ending call (called by UI)
  endCallManually() {
    this.isManualEnd = true;
    this.endCall();
  }

  // Static methods for call management using enhanced signaling
  async startCall(
    callerId: string,
    receiverId: string,
    isVideoCall: boolean = true
  ): Promise<string> {
    try {
      console.log(`🎥 Starting ${isVideoCall ? 'video' : 'audio'} call using enhanced signaling`);
      
      // Use enhanced video call signaling for both video and audio calls
      const callId = await this.videoCallSignaling.initiateVideoCall(
        callerId,
        receiverId,
        isVideoCall
      );
      
      console.log('✅ Call initiated successfully with enhanced signaling:', callId);
      return callId;
      
    } catch (error) {
      console.error('❌ Enhanced call initiation failed, trying fallback:', error);
      
      // Fallback to original method if enhanced signaling fails
      return this.startCallFallback(callerId, receiverId, isVideoCall);
    }
  }

  // Fallback method for call initiation
  private async startCallFallback(
    callerId: string,
    receiverId: string,
    isVideoCall: boolean = true
  ): Promise<string> {
    try {
      // Get caller user data
      const callerData = await FirebaseService.getUserProfile(callerId);
      
      const callData = {
        callerId,
        receiverId,
        type: isVideoCall ? 'video' : 'audio',
        status: 'ringing',
        createdAt: new Date().toISOString(),
        offer: null,
        answer: null,
        callerName: callerData?.displayName || callerData?.username || 'Unknown User',
        callerProfilePicture: callerData?.profilePicture || callerData?.photoURL || '',
        callerUsername: callerData?.username || '',
      };

      const callsRef = firebaseFirestore.collection(COLLECTIONS.CALLS);
      const callRef = await callsRef.add(callData);

      console.log('Call created with caller info:', callData);

      // Send notification using both Firebase and NotificationService
      await FirebaseService.createNotification(
        receiverId,
        callerId,
        'call',
        `Incoming ${isVideoCall ? 'video' : 'audio'} call from ${callData.callerName}`,
        callRef.id
      );

      // Send enhanced push notification for better user experience
      await this.notificationService.sendCallNotification({
        callId: callRef.id,
        callerId: callerId,
        callerName: callData.callerName,
        callerAvatar: callData.callerProfilePicture,
        targetUserId: receiverId,
        isVideoCall: isVideoCall
      });

      return callRef.id;
    } catch (error) {
      console.error('Error starting call:', error);
      throw error;
    }
  }
}

export default new WebRTCService();
export { RTCView };
