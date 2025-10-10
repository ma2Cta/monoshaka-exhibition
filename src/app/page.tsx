import AudioRecorder from '@/components/recorder/AudioRecorder';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12">
      <AudioRecorder />
    </div>
  );
}
