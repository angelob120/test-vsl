import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import axios from 'axios';
import {
  Upload, Play, Settings, Users, Zap, Download, Eye, Trash2,
  ChevronDown, ChevronRight, Video, Globe, Mail, Phone, Building,
  User, Link, Calendar, Palette, Moon, Sun, MousePointer, ArrowDown,
  Circle, Square, Maximize, Monitor, RefreshCw, Check, X, Copy,
  ExternalLink, Loader2, Sparkles, Film, Plus, Search, FolderOpen,
  Clock, ChevronLeft, FileDown, Package, Pause, SkipBack, SkipForward,
  RotateCcw, Volume2, VolumeX
} from 'lucide-react';

const API_URL = '/api';

// Custom Video Player Component
const VideoPlayer = ({ src, className = '', maxHeight = 'max-h-48' }) => {
  const videoRef = React.useRef(null);
  const progressRef = React.useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const togglePlay = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  const skip = (seconds, e) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration));
    }
  };

  const rewind = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleProgressClick = (e) => {
    e.stopPropagation();
    if (progressRef.current && videoRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      videoRef.current.currentTime = percentage * duration;
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      className={`relative group ${className}`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(true)}
    >
      <video
        ref={videoRef}
        src={src}
        className={`w-full ${maxHeight} object-contain rounded-lg`}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
      />
      
      {/* Controls Overlay */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 rounded-b-lg transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress Bar */}
        <div 
          ref={progressRef}
          className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-2 group/progress"
          onClick={handleProgressClick}
        >
          <div 
            className="h-full bg-primary-500 rounded-full relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg" />
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* Rewind to start */}
            <button
              onClick={rewind}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              title="Restart"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            
            {/* Skip back 10s */}
            <button
              onClick={(e) => skip(-10, e)}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors relative"
              title="Skip back 10s"
            >
              <SkipBack className="w-4 h-4" />
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold">10</span>
            </button>
            
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            
            {/* Skip forward 10s */}
            <button
              onClick={(e) => skip(10, e)}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors relative"
              title="Skip forward 10s"
            >
              <SkipForward className="w-4 h-4" />
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold">10</span>
            </button>
            
            {/* Mute */}
            <button
              onClick={toggleMute}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
          
          {/* Time Display */}
          <div className="text-xs text-white/80 font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      </div>
      
      {/* Center Play Button (when paused) */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-4 bg-black/50 hover:bg-black/70 rounded-full transition-all transform hover:scale-110"
        >
          <Play className="w-8 h-8 text-white" />
        </button>
      )}
    </div>
  );
};

export default function Generator() {
  // Campaign state
  const [campaign, setCampaign] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  
  // Video uploads
  const [introVideo, setIntroVideo] = useState(null);
  const [introVideoPreview, setIntroVideoPreview] = useState(null);
  const [secondaryVideo, setSecondaryVideo] = useState(null);
  const [secondaryVideoPreview, setSecondaryVideoPreview] = useState(null);
  const [useSecondaryVideo, setUseSecondaryVideo] = useState(false);
  
  // Leads
  const [leads, setLeads] = useState([]);
  const [csvFile, setCsvFile] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [csvColumns, setCsvColumns] = useState([]);
  const [csvPreview, setCsvPreview] = useState([]);
  
  // Settings
  const [settings, setSettings] = useState({
    name: 'My Campaign',
    video_style: 'small_bubble',
    video_position: 'bottom_left',
    video_shape: 'circle',
    video_title: 'A video for you 👋',
    video_description: 'Intro',
    calendar_url: '',
    button_text: 'Book a Call',
    button_link: '',
    text_color: '#ffffff',
    bg_color: '#6366f1',
    text_hover_color: '#ffffff',
    bg_hover_color: '#4f46e5',
    dark_mode: false,
    display_delay: 10,
    fullscreen_transition_time: 20,
    scroll_duration: 15,
    scroll_behavior: 'stay_down',
    mouse_display: 'moving',
    display_tab: true
  });
  
  // UI state
  const [currentStep, setCurrentStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    video: true,
    leads: false,
    settings: false
  });
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'history'
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  
  // All generated videos state
  const [allVideos, setAllVideos] = useState([]);
  const [allVideosTotal, setAllVideosTotal] = useState(0);
  const [allVideosSearch, setAllVideosSearch] = useState('');
  const [isLoadingAllVideos, setIsLoadingAllVideos] = useState(false);
  const MAX_VIDEOS = 100;

  // Load campaigns on mount
  useEffect(() => {
    fetchCampaigns();
    fetchAllVideos(true);
  }, []);
  
  // Debounced search for all videos
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAllVideos(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [allVideosSearch]);

  // Fetch all generated videos
  const fetchAllVideos = async (reset = false) => {
    setIsLoadingAllVideos(true);
    try {
      const res = await axios.get(`${API_URL}/videos/all`, {
        params: {
          limit: MAX_VIDEOS,
          offset: 0,
          search: allVideosSearch
        }
      });
      
      const newVideos = res.data.videos || [];
      const total = Math.min(res.data.total || 0, MAX_VIDEOS);
      
      setAllVideos(newVideos);
      setAllVideosTotal(total);
    } catch (error) {
      console.error('Fetch all videos error:', error);
    } finally {
      setIsLoadingAllVideos(false);
    }
  };

  // Fetch all campaigns
  const fetchCampaigns = async () => {
    setIsLoadingCampaigns(true);
    try {
      const res = await axios.get(`${API_URL}/campaigns`);
      setCampaigns(res.data.campaigns || []);
    } catch (error) {
      console.error('Fetch campaigns error:', error);
    } finally {
      setIsLoadingCampaigns(false);
    }
  };

  // Load a specific campaign's leads
  const loadCampaignLeads = async (campaignId) => {
    try {
      const res = await axios.get(`${API_URL}/leads/campaign/${campaignId}`);
      return res.data.leads || [];
    } catch (error) {
      console.error('Fetch leads error:', error);
      return [];
    }
  };

  // Select a campaign to view
  const selectCampaign = async (camp) => {
    setSelectedCampaign(camp);
    setCampaign(camp);
    const campaignLeads = await loadCampaignLeads(camp.id);
    setLeads(campaignLeads);
    setActiveTab('history');
  };

  // Start new campaign - reset everything
  const startNewCampaign = () => {
    setCampaign(null);
    setSelectedCampaign(null);
    setIntroVideo(null);
    setIntroVideoPreview(null);
    setSecondaryVideo(null);
    setSecondaryVideoPreview(null);
    setUseSecondaryVideo(false);
    setLeads([]);
    setCsvFile(null);
    setColumnMapping({});
    setCsvColumns([]);
    setCsvPreview([]);
    setGenerationStatus(null);
    setCurrentStep(1);
    setSettings({
      name: 'My Campaign',
      video_style: 'small_bubble',
      video_position: 'bottom_left',
      video_shape: 'circle',
      video_title: 'A video for you 👋',
      video_description: 'Intro',
      calendar_url: '',
      button_text: 'Book a Call',
      button_link: '',
      text_color: '#ffffff',
      bg_color: '#6366f1',
      text_hover_color: '#ffffff',
      bg_hover_color: '#4f46e5',
      dark_mode: false,
      display_delay: 10,
      scroll_behavior: 'stay_down',
      mouse_display: 'moving',
      display_tab: true
    });
    setActiveTab('create');
    toast.success('Ready for new campaign!');
  };

  // Video dropzone
  const onDropIntro = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setIntroVideo(file);
      setIntroVideoPreview(URL.createObjectURL(file));
      toast.success('Intro video uploaded!');
    }
  }, []);

  const onDropSecondary = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setSecondaryVideo(file);
      setSecondaryVideoPreview(URL.createObjectURL(file));
      toast.success('Secondary video uploaded!');
    }
  }, []);

  const { getRootProps: getIntroRootProps, getInputProps: getIntroInputProps, isDragActive: isIntroDragActive } = useDropzone({
    onDrop: onDropIntro,
    accept: { 'video/*': ['.mp4', '.mov', '.webm'] },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024
  });

  const { getRootProps: getSecondaryRootProps, getInputProps: getSecondaryInputProps, isDragActive: isSecondaryDragActive } = useDropzone({
    onDrop: onDropSecondary,
    accept: { 'video/*': ['.mp4', '.mov', '.webm'] },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024
  });

  // CSV dropzone
  const onDropCSV = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setCsvFile(file);
      parseCSVPreview(file);
      toast.success('CSV file loaded!');
    }
  }, []);

  const { getRootProps: getCsvRootProps, getInputProps: getCsvInputProps, isDragActive: isCsvDragActive } = useDropzone({
    onDrop: onDropCSV,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1
  });

  // Parse CSV for preview
  const parseCSVPreview = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      setCsvColumns(headers);
      
      const preview = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        return headers.reduce((obj, header, i) => {
          obj[header] = values[i] || '';
          return obj;
        }, {});
      });
      setCsvPreview(preview);
      
      // Auto-detect column mapping
      const autoMapping = {};
      headers.forEach(h => {
        const lower = h.toLowerCase();
        if (lower.includes('website') || lower.includes('url') || lower.includes('link')) {
          autoMapping.website_url = h;
        } else if (lower.includes('first') && lower.includes('name')) {
          autoMapping.first_name = h;
        } else if (lower.includes('last') && lower.includes('name')) {
          autoMapping.last_name = h;
        } else if (lower.includes('company')) {
          autoMapping.company_name = h;
        } else if (lower.includes('email')) {
          autoMapping.email = h;
        } else if (lower.includes('phone')) {
          autoMapping.phone = h;
        }
      });
      setColumnMapping(autoMapping);
    };
    reader.readAsText(file);
  };

  // Create campaign and start generation
  const handleGenerate = async () => {
    if (!introVideo) {
      toast.error('Please upload an intro video first');
      return;
    }
    
    if (leads.length === 0 && !csvFile) {
      toast.error('Please add leads or upload a CSV file');
      return;
    }

    setIsGenerating(true);
    
    try {
      // Create FormData for campaign
      const formData = new FormData();
      formData.append('introVideo', introVideo);
      if (secondaryVideo && useSecondaryVideo) {
        formData.append('secondaryVideo', secondaryVideo);
      }
      
      Object.entries(settings).forEach(([key, value]) => {
        formData.append(key, value);
      });

      // Create campaign
      const campaignRes = await axios.post(`${API_URL}/campaigns`, formData);
      const newCampaign = campaignRes.data.campaign;
      setCampaign(newCampaign);
      setSelectedCampaign(newCampaign);
      
      // Import CSV leads if present
      if (csvFile) {
        const csvFormData = new FormData();
        csvFormData.append('file', csvFile);
        csvFormData.append('columnMapping', JSON.stringify(columnMapping));
        
        const leadsRes = await axios.post(
          `${API_URL}/leads/import/${newCampaign.id}`,
          csvFormData
        );
        setLeads(leadsRes.data.leads);
        toast.success(`Imported ${leadsRes.data.imported} leads`);
        
        // Initialize generation status immediately with the imported leads count
        setGenerationStatus({
          completed: 0,
          processing: 0,
          pending: leadsRes.data.imported,
          failed: 0,
          total: leadsRes.data.imported
        });
      }

      // Start video generation
      await axios.post(`${API_URL}/videos/generate/${newCampaign.id}`);
      toast.success('Video generation started!');
      
      // Poll for status
      pollGenerationStatus(newCampaign.id);
      
      // Refresh campaigns list
      fetchCampaigns();
      
    } catch (error) {
      console.error('Generation error:', error);
      toast.error(error.response?.data?.error || 'Failed to start generation');
      setIsGenerating(false);
    }
  };

  // Poll generation status
  const pollGenerationStatus = async (campaignId) => {
    const poll = async () => {
      try {
        const res = await axios.get(`${API_URL}/videos/status/${campaignId}`);
        setGenerationStatus(res.data.status);
        
        const { completed, total, processing, pending } = res.data.status;
        const { isProcessing: serverProcessing, queuePosition } = res.data;
        
        // Continue polling if there's work in progress
        const stillWorking = processing > 0 || pending > 0 || serverProcessing || queuePosition > 0;
        
        if (stillWorking) {
          setTimeout(poll, 2000);
        } else {
          setIsGenerating(false);
          toast.success(`All ${completed} videos generated!`);
          fetchLeads(campaignId);
          fetchCampaigns(); // Refresh campaigns list
          fetchAllVideos(true); // Refresh all videos list
        }
      } catch (error) {
        console.error('Status poll error:', error);
        setTimeout(poll, 3000);
      }
    };
    
    poll();
  };

  // Fetch leads with video status
  const fetchLeads = async (campaignId) => {
    try {
      const res = await axios.get(`${API_URL}/leads/campaign/${campaignId}`);
      setLeads(res.data.leads);
    } catch (error) {
      console.error('Fetch leads error:', error);
    }
  };

  // Export CSV for a campaign
  const handleExport = async (campaignId = null) => {
    const exportCampaignId = campaignId || campaign?.id || selectedCampaign?.id;
    
    if (!exportCampaignId) {
      toast.error('No campaign to export');
      return;
    }
    
    try {
      const response = await axios.get(`${API_URL}/leads/export/${exportCampaignId}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `campaign-${exportCampaignId}-export.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('CSV exported!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed');
    }
  };

  // Download individual video
  const downloadVideo = async (slug, leadName) => {
    try {
      toast.loading('Preparing download...');
      const response = await axios.get(`${API_URL}/videos/file/${slug}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `video-${leadName || slug}.mp4`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.dismiss();
      toast.success('Video downloaded!');
    } catch (error) {
      toast.dismiss();
      toast.error('Download failed');
    }
  };

  // Download all videos for a campaign (as individual files)
  const downloadAllVideos = async () => {
    const videosToDownload = leads.filter(l => l.unique_slug && l.status === 'completed');
    
    if (videosToDownload.length === 0) {
      toast.error('No completed videos to download');
      return;
    }
    
    toast.loading(`Downloading ${videosToDownload.length} videos...`);
    
    for (const lead of videosToDownload) {
      await downloadVideo(lead.unique_slug, lead.first_name || lead.company_name);
      await new Promise(r => setTimeout(r, 500)); // Small delay between downloads
    }
    
    toast.dismiss();
    toast.success(`Downloaded ${videosToDownload.length} videos!`);
  };

  // Filter leads by search query
  const filteredLeads = leads.filter(lead => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.website_url?.toLowerCase().includes(query) ||
      lead.first_name?.toLowerCase().includes(query) ||
      lead.last_name?.toLowerCase().includes(query) ||
      lead.company_name?.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query)
    );
  });

  // Add manual lead
  const addLead = () => {
    setLeads([...leads, {
      id: `temp-${Date.now()}`,
      website_url: '',
      first_name: '',
      company_name: '',
      isNew: true
    }]);
  };

  // Remove lead
  const removeLead = (index) => {
    const newLeads = [...leads];
    newLeads.splice(index, 1);
    setLeads(newLeads);
  };

  // Update lead
  const updateLead = (index, field, value) => {
    const newLeads = [...leads];
    newLeads[index] = { ...newLeads[index], [field]: value };
    setLeads(newLeads);
  };

  // Copy link to clipboard
  const copyLink = (slug) => {
    const url = `${window.location.origin}/v/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  };

  // Toggle section
  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Delete campaign
  const deleteCampaign = async (campaignId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    
    try {
      await axios.delete(`${API_URL}/campaigns/${campaignId}`);
      toast.success('Campaign deleted');
      fetchCampaigns();
      if (selectedCampaign?.id === campaignId) {
        startNewCampaign();
      }
    } catch (error) {
      toast.error('Failed to delete campaign');
    }
  };

  const videoStyles = [
    { id: 'small_bubble', name: 'Small Bubble', icon: Circle },
    { id: 'big_bubble', name: 'Big Bubble', icon: Circle },
    { id: 'full_screen', name: 'Full Screen', icon: Maximize }
  ];

  const videoPositions = [
    { id: 'bottom_left', name: 'Bottom Left' },
    { id: 'bottom_right', name: 'Bottom Right' },
    { id: 'top_left', name: 'Top Left' },
    { id: 'top_right', name: 'Top Right' }
  ];

  const videoShapes = [
    { id: 'circle', name: 'Circle', icon: Circle },
    { id: 'square', name: 'Square', icon: Square }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-x-hidden w-full">
      {/* Header */}
      <header className="border-b border-white/10 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
                <Film className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
                Mass VSL Generator
              </span>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('create')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'create' 
                    ? 'bg-primary-500 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Create
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'history' 
                    ? 'bg-primary-500 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <FolderOpen className="w-4 h-4 inline mr-2" />
                Campaigns ({campaigns.length})
              </button>
            </div>

            <button
              onClick={startNewCampaign}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Campaign
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-x-hidden">
        {/* Main Content Area */}
        {activeTab === 'create' ? (
          /* Create Campaign View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full min-w-0">
            {/* Left Panel - Configuration */}
            <div className="lg:col-span-2 space-y-6 min-w-0">
              {/* Step 1: Upload Video */}
              <section className="glass rounded-2xl p-6 animate-fade-in">
                <button
                  onClick={() => toggleSection('video')}
                  className="flex items-center justify-between w-full mb-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="step-number">1</div>
                    <h2 className="text-lg font-semibold">Upload Video</h2>
                    {introVideo && <Check className="w-5 h-5 text-green-400" />}
                  </div>
                  {expandedSections.video ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>

                {expandedSections.video && (
                  <div className="space-y-4">
                    {/* Intro Video Dropzone */}
                    <div
                      {...getIntroRootProps()}
                      className={`dropzone ${isIntroDragActive ? 'dropzone-active' : ''} ${introVideo ? 'border-green-500/50' : ''}`}
                    >
                      <input {...getIntroInputProps()} />
                      {introVideoPreview ? (
                        <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
                          <VideoPlayer
                            src={introVideoPreview}
                            maxHeight="max-h-48"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIntroVideo(null);
                              setIntroVideoPreview(null);
                            }}
                            className="absolute top-2 right-2 p-2 bg-red-500 rounded-full hover:bg-red-600 transition-colors z-10"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="w-12 h-12 mx-auto mb-3 text-primary-400" />
                          <p className="font-medium">Drop your intro video here</p>
                          <p className="text-sm text-gray-400 mt-1">MP4, MOV, or WebM (max 100MB)</p>
                        </div>
                      )}
                    </div>

                    {/* Secondary Video Toggle */}
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="useSecondary"
                        checked={useSecondaryVideo}
                        onChange={(e) => setUseSecondaryVideo(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-500 focus:ring-primary-500"
                      />
                      <label htmlFor="useSecondary" className="text-sm text-gray-300">
                        Add secondary video (plays after intro)
                      </label>
                    </div>

                    {useSecondaryVideo && (
                      <div
                        {...getSecondaryRootProps()}
                        className={`dropzone ${isSecondaryDragActive ? 'dropzone-active' : ''}`}
                      >
                        <input {...getSecondaryInputProps()} />
                        {secondaryVideoPreview ? (
                          <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
                            <VideoPlayer
                              src={secondaryVideoPreview}
                              maxHeight="max-h-32"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSecondaryVideo(null);
                                setSecondaryVideoPreview(null);
                              }}
                              className="absolute top-2 right-2 p-1 bg-red-500 rounded-full z-10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <Video className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm">Drop secondary video</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Step 2: Import Leads */}
              <section className="glass rounded-2xl p-6 animate-fade-in">
                <button
                  onClick={() => toggleSection('leads')}
                  className="flex items-center justify-between w-full mb-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="step-number">2</div>
                    <h2 className="text-lg font-semibold">Import Leads</h2>
                    {(csvFile || leads.length > 0) && <Check className="w-5 h-5 text-green-400" />}
                  </div>
                  {expandedSections.leads ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>

                {expandedSections.leads && (
                  <div className="space-y-4">
                    {/* CSV Dropzone */}
                    <div
                      {...getCsvRootProps()}
                      className={`dropzone ${isCsvDragActive ? 'dropzone-active' : ''}`}
                    >
                      <input {...getCsvInputProps()} />
                      <div className="text-center">
                        <Users className="w-10 h-10 mx-auto mb-3 text-primary-400" />
                        <p className="font-medium">
                          {csvFile ? csvFile.name : 'Drop CSV file here'}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          Required: Website URL column
                        </p>
                      </div>
                    </div>

                    {/* CSV Preview */}
                    {csvPreview.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">Preview ({csvPreview.length} of {csvFile?.name})</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-white/10">
                                {csvColumns.slice(0, 5).map((col, i) => (
                                  <th key={i} className="text-left py-2 px-3 text-gray-400">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {csvPreview.slice(0, 3).map((row, i) => (
                                <tr key={i} className="border-b border-white/5">
                                  {csvColumns.slice(0, 5).map((col, j) => (
                                    <td key={j} className="py-2 px-3 truncate max-w-[150px]">{row[col]}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Column Mapping */}
                    {csvColumns.length > 0 && (
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Website URL Column *</label>
                          <select
                            value={columnMapping.website_url || ''}
                            onChange={(e) => setColumnMapping({ ...columnMapping, website_url: e.target.value })}
                            className="input-field"
                          >
                            <option value="">Select column...</option>
                            {csvColumns.map(col => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">First Name</label>
                          <select
                            value={columnMapping.first_name || ''}
                            onChange={(e) => setColumnMapping({ ...columnMapping, first_name: e.target.value })}
                            className="input-field"
                          >
                            <option value="">Select column...</option>
                            {csvColumns.map(col => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Company Name</label>
                          <select
                            value={columnMapping.company_name || ''}
                            onChange={(e) => setColumnMapping({ ...columnMapping, company_name: e.target.value })}
                            className="input-field"
                          >
                            <option value="">Select column...</option>
                            {csvColumns.map(col => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Email</label>
                          <select
                            value={columnMapping.email || ''}
                            onChange={(e) => setColumnMapping({ ...columnMapping, email: e.target.value })}
                            className="input-field"
                          >
                            <option value="">Select column...</option>
                            {csvColumns.map(col => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Step 3: Customize Settings */}
              <section className="glass rounded-2xl p-6 animate-fade-in">
                <button
                  onClick={() => toggleSection('settings')}
                  className="flex items-center justify-between w-full mb-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="step-number">3</div>
                    <h2 className="text-lg font-semibold">Configure</h2>
                  </div>
                  {expandedSections.settings ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>

                {expandedSections.settings && (
                  <div className="space-y-6">
                    {/* Campaign Name */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Campaign Name</label>
                      <input
                        type="text"
                        value={settings.name}
                        onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                        className="input-field"
                        placeholder="My Campaign"
                      />
                    </div>

                    {/* Video Style */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Video Style</label>
                      <div className="grid grid-cols-3 gap-3">
                        {videoStyles.map((style) => (
                          <button
                            key={style.id}
                            onClick={() => setSettings({ ...settings, video_style: style.id })}
                            className={`p-3 rounded-xl border transition-all ${
                              settings.video_style === style.id
                                ? 'border-primary-500 bg-primary-500/10'
                                : 'border-white/10 hover:border-white/20'
                            }`}
                          >
                            <style.icon className="w-6 h-6 mx-auto mb-2" />
                            <span className="text-sm">{style.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Video Position */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Position
                        {settings.video_style === 'full_screen' && (
                          <span className="text-xs text-gray-400 ml-2">(Starting position before fullscreen)</span>
                        )}
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {videoPositions.map((pos) => (
                          <button
                            key={pos.id}
                            onClick={() => setSettings({ ...settings, video_position: pos.id })}
                            className={`p-3 rounded-xl border transition-all text-sm ${
                              settings.video_position === pos.id
                                ? 'border-primary-500 bg-primary-500/10'
                                : 'border-white/10 hover:border-white/20'
                            }`}
                          >
                            {pos.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Video Shape */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Shape
                        {settings.video_style === 'full_screen' && (
                          <span className="text-xs text-gray-400 ml-2">(Starting shape before fullscreen)</span>
                        )}
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {videoShapes.map((shape) => (
                          <button
                            key={shape.id}
                            onClick={() => setSettings({ ...settings, video_shape: shape.id })}
                            className={`p-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${
                              settings.video_shape === shape.id
                                ? 'border-primary-500 bg-primary-500/10'
                                : 'border-white/10 hover:border-white/20'
                            }`}
                          >
                            <shape.icon className="w-5 h-5" />
                            <span className="text-sm">{shape.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Title & Display Delay - Only for full_screen style */}
                    {settings.video_style === 'full_screen' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Video Title</label>
                          <input
                            type="text"
                            value={settings.video_title}
                            onChange={(e) => setSettings({ ...settings, video_title: e.target.value })}
                            className="input-field"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Display Delay (seconds)</label>
                          <input
                            type="number"
                            value={settings.display_delay}
                            onChange={(e) => setSettings({ ...settings, display_delay: parseInt(e.target.value) || 0 })}
                            className="input-field"
                            min="0"
                            max="60"
                          />
                        </div>
                      </div>
                    )}

                    {/* Fullscreen Transition Time - Only for full_screen style */}
                    {settings.video_style === 'full_screen' && (
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Fullscreen Transition Time (seconds)
                        </label>
                        <input
                          type="number"
                          value={settings.fullscreen_transition_time}
                          onChange={(e) => setSettings({ ...settings, fullscreen_transition_time: parseInt(e.target.value) || 20 })}
                          className="input-field"
                          min="1"
                          max="300"
                          placeholder="20"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Time in seconds before video transitions from corner to fullscreen
                        </p>
                      </div>
                    )}

                    {/* Scroll Duration */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Background Scroll Duration (seconds)
                      </label>
                      <input
                        type="number"
                        value={settings.scroll_duration}
                        onChange={(e) => setSettings({ ...settings, scroll_duration: parseInt(e.target.value) || 15 })}
                        className="input-field"
                        min="5"
                        max="60"
                        placeholder="15"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        How long the website takes to scroll from top to bottom
                      </p>
                    </div>

                    {/* CTA Button */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Button Text</label>
                        <input
                          type="text"
                          value={settings.button_text}
                          onChange={(e) => setSettings({ ...settings, button_text: e.target.value })}
                          className="input-field"
                          placeholder="Book a Call"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Button Link</label>
                        <input
                          type="url"
                          value={settings.button_link}
                          onChange={(e) => setSettings({ ...settings, button_link: e.target.value })}
                          className="input-field"
                          placeholder="https://calendly.com/..."
                        />
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Right Panel - Preview & Actions */}
            <div className="space-y-6">
              {/* Preview */}
              <div className="glass rounded-2xl p-6 sticky top-24">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Preview</h3>
                  <span className="badge badge-info">Step {currentStep}/4</span>
                </div>
                
                {/* Mockup Preview */}
                <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    <Globe className="w-12 h-12 text-gray-600" />
                  </div>
                  
                  {/* Video Bubble Preview */}
                  {introVideoPreview && (
                    <div className={`absolute transition-all duration-500
                      ${settings.video_position === 'bottom_left' ? 'bottom-3 left-3' : ''}
                      ${settings.video_position === 'bottom_right' ? 'bottom-3 right-3' : ''}
                      ${settings.video_position === 'top_left' ? 'top-3 left-3' : ''}
                      ${settings.video_position === 'top_right' ? 'top-3 right-3' : ''}
                      ${settings.video_style === 'full_screen' ? 'inset-0' : ''}
                    `}>
                      <div className={`overflow-hidden shadow-xl border-2 border-white/30
                        ${settings.video_shape === 'circle' && settings.video_style !== 'full_screen' ? 'rounded-full' : 'rounded-xl'}
                        ${settings.video_style === 'small_bubble' ? 'w-16 h-16' : ''}
                        ${settings.video_style === 'big_bubble' ? 'w-24 h-24' : ''}
                        ${settings.video_style === 'full_screen' ? 'w-full h-full' : ''}
                      `}>
                        <video
                          src={introVideoPreview}
                          className="w-full h-full object-cover"
                          autoPlay
                          muted
                          loop
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Title Preview */}
                  <div className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent
                    ${settings.video_style === 'full_screen' ? 'hidden' : ''}`}>
                    <p className="text-xs font-medium text-primary-400">👇 A video for @CompanyName 👇</p>
                    <p className="text-[10px] text-gray-300 mt-1">☝️ Here is the video ☝️</p>
                  </div>
                </div>

                {/* Stats */}
                {generationStatus && (
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Progress</span>
                      <span className="font-medium">{generationStatus.completed}/{generationStatus.total}</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${generationStatus.total > 0 ? (generationStatus.completed / generationStatus.total) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex gap-4 mt-3 text-xs">
                      <span className="badge badge-success">✓ {generationStatus.completed}</span>
                      {generationStatus.processing > 0 && (
                        <span className="badge badge-warning">⟳ {generationStatus.processing}</span>
                      )}
                      {generationStatus.failed > 0 && (
                        <span className="badge badge-error">✗ {generationStatus.failed}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !introVideo}
                  className="btn-primary w-full flex items-center justify-center gap-2 text-lg py-4"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Generate Videos
                    </>
                  )}
                </button>
                
                <p className="text-xs text-gray-400 text-center mt-3">
                  {leads.length > 0 || csvPreview.length > 0 
                    ? `Ready to create ${leads.length || csvPreview.length}+ personalized videos`
                    : 'Add leads to start generation'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* History/Campaign Detail View */
          <div className="space-y-6">
            {selectedCampaign ? (
              <>
                {/* Campaign Header */}
                <div className="glass rounded-2xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setSelectedCampaign(null)}
                        className="p-2 hover:bg-white/10 rounded-lg"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div>
                        <h2 className="text-xl font-semibold">{selectedCampaign.name}</h2>
                        <p className="text-sm text-gray-400">
                          Created {new Date(selectedCampaign.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => fetchLeads(selectedCampaign.id)}
                        className="btn-secondary flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                      </button>
                      <button
                        onClick={() => handleExport(selectedCampaign.id)}
                        className="btn-secondary flex items-center gap-2"
                      >
                        <FileDown className="w-4 h-4" />
                        Export CSV
                      </button>
                      <button
                        onClick={downloadAllVideos}
                        className="btn-primary flex items-center gap-2"
                      >
                        <Package className="w-4 h-4" />
                        Download All Videos
                      </button>
                    </div>
                  </div>
                </div>

                {/* Search & Filter */}
                <div className="glass rounded-2xl p-4">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                      <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search videos by name, company, website..."
                        className="input-field pl-10"
                      />
                    </div>
                    <span className="text-sm text-gray-400">
                      {filteredLeads.length} of {leads.length} videos
                    </span>
                  </div>
                </div>

                {/* Videos Grid */}
                <div className="glass rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4">Generated Videos</h3>
                  
                  {filteredLeads.length > 0 ? (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Website</th>
                            <th>Name</th>
                            <th>Company</th>
                            <th>Status</th>
                            <th>Views</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLeads.map((lead, i) => (
                            <tr key={lead.id}>
                              <td className="text-gray-400">{i + 1}</td>
                              <td className="max-w-[200px] truncate">
                                <a 
                                  href={lead.website_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-primary-400 hover:underline"
                                >
                                  {lead.website_url}
                                </a>
                              </td>
                              <td>{lead.first_name} {lead.last_name}</td>
                              <td>{lead.company_name}</td>
                              <td>
                                {lead.status === 'completed' && <span className="badge badge-success">Complete</span>}
                                {lead.status === 'processing' && <span className="badge badge-warning">Processing</span>}
                                {lead.status === 'pending' && <span className="badge badge-info">Pending</span>}
                                {lead.status === 'failed' && <span className="badge badge-error">Failed</span>}
                                {!lead.status && <span className="badge">Not Started</span>}
                              </td>
                              <td>{lead.views || 0}</td>
                              <td>
                                {lead.unique_slug && lead.status === 'completed' && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => copyLink(lead.unique_slug)}
                                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                      title="Copy Link"
                                    >
                                      <Copy className="w-4 h-4" />
                                    </button>
                                    <a
                                      href={`/v/${lead.unique_slug}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                      title="Open Page"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </a>
                                    <button
                                      onClick={() => downloadVideo(lead.unique_slug, lead.first_name || lead.company_name)}
                                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                      title="Download Video"
                                    >
                                      <Download className="w-4 h-4" />
                                    </button>
                                    <a
                                      href={`/api/videos/preview/${lead.unique_slug}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                      title="Preview Video"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </a>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No videos found</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* All Campaigns List */
              <div className="glass rounded-2xl p-6">
                <h2 className="text-xl font-semibold mb-6">All Campaigns</h2>
                
                {campaigns.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {campaigns.map((camp) => (
                      <div
                        key={camp.id}
                        onClick={() => selectCampaign(camp)}
                        className="p-4 rounded-xl border border-white/10 bg-white/5 cursor-pointer transition-all hover:border-primary-500/50 hover:bg-primary-500/5"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-medium">{camp.name}</h3>
                          <button
                            onClick={(e) => deleteCampaign(camp.id, e)}
                            className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-400 mb-2">
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {camp.lead_count || 0} leads
                          </span>
                          <span className="flex items-center gap-1">
                            <Video className="w-4 h-4" />
                            {camp.video_count || 0} videos
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(camp.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No campaigns yet</p>
                    <button
                      onClick={() => setActiveTab('create')}
                      className="btn-primary mt-4"
                    >
                      Create Your First Campaign
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Generated Videos Panel - Always visible */}
        <div className="mt-8 glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Video className="w-5 h-5 text-primary-400" />
              Generated Videos
              <span className="text-sm font-normal text-gray-400">
                ({allVideosTotal} total)
              </span>
            </h2>
            <div className="flex items-center gap-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={allVideosSearch}
                  onChange={(e) => setAllVideosSearch(e.target.value)}
                  placeholder=""
                  className="input-field pl-9 py-2 w-64"
                />
                {allVideosSearch && (
                  <button
                    onClick={() => setAllVideosSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button 
                onClick={() => fetchAllVideos(true)} 
                className="btn-secondary text-sm"
                disabled={isLoadingAllVideos}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingAllVideos ? 'animate-spin' : ''}`} />
              
              </button>
            </div>
          </div>
          
          {allVideos.length > 0 ? (
            <>
              <div className="table-container max-h-96 overflow-y-auto">
                <table className="data-table">
                  <thead className="sticky top-0 bg-gray-800/95 backdrop-blur z-10">
                    <tr>
                      <th>#</th>
                      <th>Campaign</th>
                      <th>Website</th>
                      <th>Name</th>
                      <th>Company</th>
                      <th>Views</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allVideos.map((video, i) => (
                      <tr key={video.id}>
                        <td className="text-gray-400">{i + 1}</td>
                        <td className="max-w-[120px] truncate">
                          <span className="text-primary-400">{video.campaign_name}</span>
                        </td>
                        <td className="max-w-[180px] truncate">
                          <a 
                            href={video.website_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-primary-400 hover:underline"
                          >
                            {video.website_url}
                          </a>
                        </td>
                        <td>{video.first_name}</td>
                        <td>{video.company_name}</td>
                        <td>{video.views || 0}</td>
                        <td className="text-gray-400 text-xs">
                          {new Date(video.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              onClick={() => copyLink(video.unique_slug)}
                              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                              title="Copy Link"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={`/v/${video.unique_slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                              title="Open Page"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => downloadVideo(video.unique_slug, video.first_name || video.company_name)}
                              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                              title="Download Video"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={`/api/videos/preview/${video.unique_slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                              title="Preview Video"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Display count */}
              <div className="mt-3 text-center text-sm text-gray-400">
                Showing {allVideos.length} of {allVideosTotal} videos
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
              {isLoadingAllVideos ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <p>Loading videos...</p>
                </div>
              ) : allVideosSearch ? (
                <p>No videos found matching "{allVideosSearch}"</p>
              ) : (
                <p>No videos generated yet</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}