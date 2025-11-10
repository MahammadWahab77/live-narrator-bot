class AudioQueue {
  private queue: Int16Array[] = [];
  private isPlaying = false;
  private audioContext: AudioContext;
  private nextScheduledTime = 0;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  async addToQueue(pcmData: Int16Array) {
    this.queue.push(pcmData);
    if (!this.isPlaying) {
      await this.playNext();
    }
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const pcmData = this.queue.shift()!;

    try {
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const audioBuffer = this.audioContext.createBuffer(1, pcmData.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      // Convert Int16 PCM to Float32 for Web Audio API
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = Math.max(-1, Math.min(1, pcmData[i] / 32768.0));
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      // Schedule audio to play seamlessly without gaps
      const currentTime = this.audioContext.currentTime;
      const startTime = Math.max(currentTime, this.nextScheduledTime);
      this.nextScheduledTime = startTime + audioBuffer.duration;

      source.onended = () => {
        this.playNext();
      };
      
      source.start(startTime);
    } catch (error) {
      console.error("Error playing audio:", error);
      this.playNext();
    }
  }

  clear() {
    this.queue = [];
    this.isPlaying = false;
    this.nextScheduledTime = 0;
  }
}

let audioQueueInstance: AudioQueue | null = null;

export const initAudioPlayer = (audioContext: AudioContext) => {
  if (!audioQueueInstance) {
    audioQueueInstance = new AudioQueue(audioContext);
  }
  return audioQueueInstance;
};

export const playAudioChunk = (base64Audio: string, audioContext: AudioContext) => {
  if (!audioQueueInstance) {
    audioQueueInstance = new AudioQueue(audioContext);
  }

  try {
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Ensure even byte length for Int16Array
    let alignedBytes = bytes;
    if (bytes.length % 2 !== 0) {
      console.warn('Odd byte length detected, padding with zero byte');
      alignedBytes = new Uint8Array(bytes.length + 1);
      alignedBytes.set(bytes);
      alignedBytes[bytes.length] = 0;
    }

    console.log(`Audio chunk: ${alignedBytes.length} bytes (${alignedBytes.length / 2} samples)`);

    const int16Data = new Int16Array(alignedBytes.buffer);
    audioQueueInstance.addToQueue(int16Data);
  } catch (error) {
    console.error("Error processing audio chunk:", error);
    console.error("Base64 length:", base64Audio.length);
  }
};

export const clearAudioQueue = () => {
  if (audioQueueInstance) {
    audioQueueInstance.clear();
  }
};
