import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Play, Pause, Volume2, VolumeX, Maximize, Calendar, Loader2, SkipBack, SkipForward, RotateCcw } from 'lucide-react';

const API_URL = '/api';

export default function LandingPage() {
  const { slug } = useParams();
  const videoRef = useRef(null);
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    fetchVideoData();
  }, [slug]);

  const fetchVideoData = async () => {
    try {
      const res = await axios.get(`${API_URL}/videos/landing/${slug}`);
      setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Video not found');
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(progress);
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      videoRef.current.currentTime = percentage * videoRef.current.duration;
    }
  };

  const skip = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration));
    }
  };

  const rewind = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  // Replace personalization tokens
  const personalize = (text) => {
    if (!text || !data) return text;
    return text
      .replace(/@FirstName/gi, data.first_name || '')
      .replace(/@CompanyName/gi, data.company_name || data.last_name || '')
      .replace(/@LastName/gi, data.last_name || '');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading your video...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">😕</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Video Not Found</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-300 bg-gray-900">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl bg-primary-500/10" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl bg-accent-500/10" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 md:py-16">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold font-display mb-2 text-white">
            {personalize(data?.video_title || 'A video for you 👋')}
          </h1>
          <p className="text-xl text-primary-400">
            {data?.first_name && <span className="font-semibold">@{data.first_name}</span>}
            {data?.company_name && <span className="font-semibold ml-2">@{data.company_name}</span>}
          </p>
        </header>

        {/* Video Player */}
        <div 
          className="relative rounded-2xl overflow-hidden shadow-2xl mb-8 group bg-gray-800"
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => isPlaying && setShowControls(false)}
        >
          {/* Video Element */}
          <video
            ref={videoRef}
            src={`${API_URL}/videos/file/${slug}`}
            className="w-full aspect-video object-cover"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            poster={`${API_URL}/videos/thumbnail/${slug}`}
            playsInline
            onClick={togglePlay}
          />

          {/* Play Button Overlay */}
          {!isPlaying && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity hover:bg-black/40"
            >
              <div className="w-20 h-20 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform">
                <Play className="w-8 h-8 text-gray-800 ml-1" fill="currentColor" />
              </div>
            </button>
          )}

          {/* Video Controls */}
          <div className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            {/* Progress Bar */}
            <div 
              className="h-1.5 bg-white/30 rounded-full mb-4 cursor-pointer group/progress"
              onClick={handleSeek}
            >
              <div 
                className="h-full bg-primary-500 rounded-full transition-all relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg" />
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Rewind to start */}
                <button
                  onClick={rewind}
                  className="w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors"
                  title="Restart"
                >
                  <RotateCcw className="w-4 h-4 text-white" />
                </button>
                
                {/* Skip back 10s */}
                <button
                  onClick={() => skip(-10)}
                  className="w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors relative"
                  title="Skip back 10s"
                >
                  <SkipBack className="w-4 h-4 text-white" />
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-white">10</span>
                </button>
                
                {/* Play/Pause */}
                <button
                  onClick={togglePlay}
                  className="w-11 h-11 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 text-white" />
                  ) : (
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  )}
                </button>
                
                {/* Skip forward 10s */}
                <button
                  onClick={() => skip(10)}
                  className="w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors relative"
                  title="Skip forward 10s"
                >
                  <SkipForward className="w-4 h-4 text-white" />
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-white">10</span>
                </button>
                
                {/* Mute */}
                <button
                  onClick={toggleMute}
                  className="w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 text-white" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Time Display */}
                <span className="text-sm text-white/80 font-mono">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                
                {/* Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className="w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors"
                  title="Fullscreen"
                >
                  <Maximize className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        {(data?.button_text || data?.calendar_url) && (
          <div className="text-center">
            <a
              href={data?.calendar_url || data?.button_link || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl text-lg font-semibold transition-all transform hover:scale-105 hover:shadow-xl"
              style={{
                backgroundColor: data?.bg_color || '#6366f1',
                color: data?.text_color || '#ffffff',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = data?.bg_hover_color || '#4f46e5';
                e.currentTarget.style.color = data?.text_hover_color || '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = data?.bg_color || '#6366f1';
                e.currentTarget.style.color = data?.text_color || '#ffffff';
              }}
            >
              <Calendar className="w-5 h-5" />
              {data?.button_text || 'Book a Call'}
            </a>
          </div>
        )}

        {/* Description */}
        {data?.video_description && (
          <p className="text-center mt-6 text-gray-400">
            {personalize(data.video_description)}
          </p>
        )}

      </div>
    </div>
  );
}