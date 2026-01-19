import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import axios from 'axios';
import {
  Upload, Play, Settings, Users, Zap, Download, Eye, Trash2,
  ChevronDown, ChevronRight, Video, Globe, Mail, Phone, Building,
  User, Link, Calendar, Palette, Moon, Sun, MousePointer, ArrowDown,
  Circle, Square, Maximize, Monitor, RefreshCw, Check, X, Copy,
  ExternalLink, Loader2, Sparkles, Film
} from 'lucide-react';

const API_URL = '/api';

export default function Generator() {
  // Campaign state
  const [campaign, setCampaign] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  
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
      }

      // Start video generation
      await axios.post(`${API_URL}/videos/generate/${newCampaign.id}`);
      toast.success('Video generation started!');
      
      // Poll for status
      pollGenerationStatus(newCampaign.id);
      
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
        
        if (processing > 0 || pending > 0) {
          setTimeout(poll, 3000);
        } else {
          setIsGenerating(false);
          toast.success(`All ${completed} videos generated!`);
          fetchLeads(campaignId);
        }
      } catch (error) {
        console.error('Status poll error:', error);
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

  // Export CSV
  const handleExport = async () => {
    if (!campaign) {
      toast.error('No campaign to export');
      return;
    }
    
    try {
      const response = await axios.get(`${API_URL}/leads/export/${campaign.id}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `campaign-${campaign.id}-export.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('CSV exported!');
    } catch (error) {
      toast.error('Export failed');
    }
  };

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
    <div className="min-h-screen relative overflow-hidden">
      {/* Background orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      
      {/* Header */}
      <header className="relative z-10 px-6 py-4 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display gradient-text">Mass VSL Generator</h1>
              <p className="text-xs text-gray-400">Create personalized videos at scale</p>
            </div>
          </div>
          
          {campaign && (
            <button
              onClick={handleExport}
              className="btn-secondary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[
            { num: 1, label: 'Upload Video', icon: Video },
            { num: 2, label: 'Add Leads', icon: Users },
            { num: 3, label: 'Configure', icon: Settings },
            { num: 4, label: 'Generate', icon: Zap }
          ].map((step, i) => (
            <React.Fragment key={step.num}>
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all cursor-pointer
                  ${currentStep >= step.num 
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' 
                    : 'bg-white/5 text-gray-400 border border-white/10'}`}
                onClick={() => setCurrentStep(step.num)}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${currentStep >= step.num ? 'bg-primary-500 text-white' : 'bg-white/10'}`}>
                  {currentStep > step.num ? <Check className="w-3 h-3" /> : step.num}
                </div>
                <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
              </div>
              {i < 3 && <ChevronRight className="w-4 h-4 text-gray-600" />}
            </React.Fragment>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Panel - Configuration */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Video Upload Section */}
            <section className="glass rounded-2xl p-6 animate-slide-up">
              <button
                onClick={() => toggleSection('video')}
                className="w-full flex items-center justify-between mb-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/20 flex items-center justify-center">
                    <Video className="w-5 h-5 text-primary-400" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg font-semibold">Upload Your Videos</h2>
                    <p className="text-sm text-gray-400">Add your intro video (and optional secondary)</p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.video ? 'rotate-180' : ''}`} />
              </button>
              
              {expandedSections.video && (
                <div className="space-y-6 animate-slide-down">
                  {/* Intro Video */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Intro Video *</label>
                    <div
                      {...getIntroRootProps()}
                      className={`upload-zone ${isIntroDragActive ? 'active' : ''} ${introVideoPreview ? 'border-primary-500/50' : ''}`}
                    >
                      <input {...getIntroInputProps()} />
                      {introVideoPreview ? (
                        <div className="w-full">
                          <video 
                            src={introVideoPreview} 
                            className="w-full max-h-48 rounded-xl mb-3"
                            controls
                          />
                          <p className="text-sm text-primary-400">{introVideo?.name}</p>
                          <p className="text-xs text-gray-400 mt-1">Click or drop to replace</p>
                        </div>
                      ) : (
                        <>
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center mb-4">
                            <Upload className="w-8 h-8 text-primary-400" />
                          </div>
                          <p className="text-lg font-medium mb-1">Drop your video here</p>
                          <p className="text-sm text-gray-400">MP4, MOV, or WebM • Max 100MB</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Secondary Video Option */}
                  <div className="glass-light rounded-xl p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-medium">Add Secondary Video?</h3>
                        <p className="text-sm text-gray-400">Switch to a screen share or demo after intro</p>
                      </div>
                      <button
                        onClick={() => setUseSecondaryVideo(!useSecondaryVideo)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${useSecondaryVideo ? 'bg-primary-500' : 'bg-white/20'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${useSecondaryVideo ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    
                    {useSecondaryVideo && (
                      <div
                        {...getSecondaryRootProps()}
                        className={`upload-zone ${isSecondaryDragActive ? 'active' : ''} min-h-[120px]`}
                      >
                        <input {...getSecondaryInputProps()} />
                        {secondaryVideoPreview ? (
                          <div className="w-full">
                            <video 
                              src={secondaryVideoPreview} 
                              className="w-full max-h-32 rounded-lg mb-2"
                              controls
                            />
                            <p className="text-sm text-primary-400">{secondaryVideo?.name}</p>
                          </div>
                        ) : (
                          <>
                            <Film className="w-8 h-8 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-400">Drop secondary video</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Leads Section */}
            <section className="glass rounded-2xl p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <button
                onClick={() => toggleSection('leads')}
                className="w-full flex items-center justify-between mb-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500/20 to-accent-600/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-accent-400" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg font-semibold">Add Your Leads</h2>
                    <p className="text-sm text-gray-400">Import CSV or add manually • {leads.length} leads</p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.leads ? 'rotate-180' : ''}`} />
              </button>
              
              {expandedSections.leads && (
                <div className="space-y-6 animate-slide-down">
                  {/* CSV Upload */}
                  <div
                    {...getCsvRootProps()}
                    className={`upload-zone ${isCsvDragActive ? 'active' : ''} min-h-[100px]`}
                  >
                    <input {...getCsvInputProps()} />
                    {csvFile ? (
                      <div className="flex items-center gap-3">
                        <Check className="w-6 h-6 text-green-400" />
                        <div>
                          <p className="font-medium">{csvFile.name}</p>
                          <p className="text-sm text-gray-400">{csvPreview.length}+ rows detected</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-gray-400 mb-2" />
                        <p className="text-sm">Drop CSV file or click to browse</p>
                      </>
                    )}
                  </div>

                  {/* Column Mapping */}
                  {csvColumns.length > 0 && (
                    <div className="glass-light rounded-xl p-4">
                      <h3 className="font-medium mb-4">Map Columns</h3>
                      <div className="grid sm:grid-cols-2 gap-4">
                        {[
                          { key: 'website_url', label: 'Website URL *', icon: Globe },
                          { key: 'first_name', label: 'First Name', icon: User },
                          { key: 'company_name', label: 'Company Name', icon: Building },
                          { key: 'email', label: 'Email', icon: Mail },
                          { key: 'phone', label: 'Phone', icon: Phone }
                        ].map(field => (
                          <div key={field.key}>
                            <label className="text-sm text-gray-400 mb-1 flex items-center gap-2">
                              <field.icon className="w-3 h-3" />
                              {field.label}
                            </label>
                            <select
                              className="select-field"
                              value={columnMapping[field.key] || ''}
                              onChange={(e) => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })}
                            >
                              <option value="">Select column...</option>
                              {csvColumns.map(col => (
                                <option key={col} value={col}>{col}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CSV Preview */}
                  {csvPreview.length > 0 && (
                    <div className="table-container glass-light rounded-xl">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Website</th>
                            <th>First Name</th>
                            <th>Company</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.map((row, i) => (
                            <tr key={i}>
                              <td className="text-gray-400">{i + 1}</td>
                              <td className="truncate max-w-[200px]">{row[columnMapping.website_url]}</td>
                              <td>{row[columnMapping.first_name]}</td>
                              <td>{row[columnMapping.company_name]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Manual Leads */}
                  {leads.filter(l => l.isNew).length > 0 && (
                    <div className="space-y-3">
                      {leads.filter(l => l.isNew).map((lead, i) => (
                        <div key={lead.id} className="glass-light rounded-xl p-4 flex gap-4 items-start">
                          <div className="flex-1 grid sm:grid-cols-3 gap-3">
                            <input
                              type="url"
                              placeholder="https://example.com"
                              className="input-field"
                              value={lead.website_url}
                              onChange={(e) => updateLead(i, 'website_url', e.target.value)}
                            />
                            <input
                              type="text"
                              placeholder="First Name"
                              className="input-field"
                              value={lead.first_name}
                              onChange={(e) => updateLead(i, 'first_name', e.target.value)}
                            />
                            <input
                              type="text"
                              placeholder="Company Name"
                              className="input-field"
                              value={lead.company_name}
                              onChange={(e) => updateLead(i, 'company_name', e.target.value)}
                            />
                          </div>
                          <button
                            onClick={() => removeLead(i)}
                            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button onClick={addLead} className="btn-secondary w-full">
                    + Add Lead Manually
                  </button>
                </div>
              )}
            </section>

            {/* Settings Section */}
            <section className="glass rounded-2xl p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <button
                onClick={() => toggleSection('settings')}
                className="w-full flex items-center justify-between mb-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg font-semibold">Video Settings</h2>
                    <p className="text-sm text-gray-400">Customize appearance and behavior</p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.settings ? 'rotate-180' : ''}`} />
              </button>
              
              {expandedSections.settings && (
                <div className="space-y-6 animate-slide-down">
                  {/* Video Style */}
                  <div>
                    <label className="block text-sm font-medium mb-3">Video Style</label>
                    <div className="grid grid-cols-3 gap-3">
                      {videoStyles.map(style => (
                        <button
                          key={style.id}
                          onClick={() => setSettings({ ...settings, video_style: style.id })}
                          className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2
                            ${settings.video_style === style.id 
                              ? 'border-primary-500 bg-primary-500/10' 
                              : 'border-white/10 hover:border-white/20 bg-white/5'}`}
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center
                            ${style.id === 'small_bubble' ? 'scale-75' : style.id === 'big_bubble' ? 'scale-100' : ''}`}>
                            {style.id === 'full_screen' ? (
                              <Monitor className="w-8 h-8 text-gray-300" />
                            ) : (
                              <div className={`rounded-full bg-gradient-to-br from-primary-500 to-accent-500
                                ${style.id === 'small_bubble' ? 'w-6 h-6' : 'w-10 h-10'}`} />
                            )}
                          </div>
                          <span className="text-xs">{style.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Position & Shape */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Position</label>
                      <select
                        className="select-field"
                        value={settings.video_position}
                        onChange={(e) => setSettings({ ...settings, video_position: e.target.value })}
                      >
                        {videoPositions.map(pos => (
                          <option key={pos.id} value={pos.id}>{pos.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Shape</label>
                      <div className="flex gap-2">
                        {videoShapes.map(shape => (
                          <button
                            key={shape.id}
                            onClick={() => setSettings({ ...settings, video_shape: shape.id })}
                            className={`flex-1 py-3 rounded-xl border transition-all flex items-center justify-center gap-2
                              ${settings.video_shape === shape.id 
                                ? 'border-primary-500 bg-primary-500/10' 
                                : 'border-white/10 hover:border-white/20'}`}
                          >
                            <shape.icon className="w-4 h-4" />
                            {shape.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Timing */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Appear After (seconds)</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="0"
                        max="30"
                        value={settings.display_delay}
                        onChange={(e) => setSettings({ ...settings, display_delay: parseInt(e.target.value) })}
                        className="flex-1 accent-primary-500"
                      />
                      <span className="w-12 text-center font-mono bg-white/10 py-2 rounded-lg">
                        {settings.display_delay}s
                      </span>
                    </div>
                  </div>

                  {/* Video Title */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Video Title</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="A video for you 👋"
                      value={settings.video_title}
                      onChange={(e) => setSettings({ ...settings, video_title: e.target.value })}
                    />
                    <p className="text-xs text-gray-400 mt-1">Use @FirstName and @CompanyName for personalization</p>
                  </div>

                  {/* Button Settings */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Button Text</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Book a Call"
                        value={settings.button_text}
                        onChange={(e) => setSettings({ ...settings, button_text: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Button Link / Calendar URL</label>
                      <input
                        type="url"
                        className="input-field"
                        placeholder="https://calendly.com/..."
                        value={settings.calendar_url}
                        onChange={(e) => setSettings({ ...settings, calendar_url: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Colors */}
                  <div>
                    <label className="block text-sm font-medium mb-3">Button Colors</label>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Text</label>
                        <input
                          type="color"
                          value={settings.text_color}
                          onChange={(e) => setSettings({ ...settings, text_color: e.target.value })}
                          className="w-full h-10 rounded-lg cursor-pointer bg-transparent border border-white/10"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Background</label>
                        <input
                          type="color"
                          value={settings.bg_color}
                          onChange={(e) => setSettings({ ...settings, bg_color: e.target.value })}
                          className="w-full h-10 rounded-lg cursor-pointer bg-transparent border border-white/10"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Text Hover</label>
                        <input
                          type="color"
                          value={settings.text_hover_color}
                          onChange={(e) => setSettings({ ...settings, text_hover_color: e.target.value })}
                          className="w-full h-10 rounded-lg cursor-pointer bg-transparent border border-white/10"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Bg Hover</label>
                        <input
                          type="color"
                          value={settings.bg_hover_color}
                          onChange={(e) => setSettings({ ...settings, bg_hover_color: e.target.value })}
                          className="w-full h-10 rounded-lg cursor-pointer bg-transparent border border-white/10"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="flex flex-wrap gap-4">
                    {[
                      { key: 'dark_mode', label: 'Dark Mode', icon: Moon },
                      { key: 'display_tab', label: 'Show Tab', icon: Eye }
                    ].map(toggle => (
                      <button
                        key={toggle.key}
                        onClick={() => setSettings({ ...settings, [toggle.key]: !settings[toggle.key] })}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all
                          ${settings[toggle.key] 
                            ? 'border-primary-500 bg-primary-500/10 text-primary-400' 
                            : 'border-white/10 hover:border-white/20'}`}
                      >
                        <toggle.icon className="w-4 h-4" />
                        {toggle.label}
                        {settings[toggle.key] && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Right Panel - Preview & Actions */}
          <div className="space-y-6">
            {/* Preview */}
            <div className="glass rounded-2xl p-6 sticky top-6">
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
                  <p className="text-xs font-medium text-primary-400">{settings.video_title}</p>
                  <p className="text-[10px] text-gray-300">@FirstName @CompanyName</p>
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
                      style={{ width: `${(generationStatus.completed / generationStatus.total) * 100}%` }}
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

        {/* Generated Videos Table */}
        {leads.length > 0 && leads.some(l => l.unique_slug) && (
          <section className="mt-8 glass rounded-2xl p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Generated Videos</h2>
              <div className="flex gap-3">
                <button onClick={() => campaign && fetchLeads(campaign.id)} className="btn-secondary flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
                <button onClick={handleExport} className="btn-primary flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export All
                </button>
              </div>
            </div>
            
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
                  {leads.filter(l => l.unique_slug || l.status).map((lead, i) => (
                    <tr key={lead.id}>
                      <td className="text-gray-400">{i + 1}</td>
                      <td className="max-w-[200px] truncate">
                        <a href={lead.website_url} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
                          {lead.website_url}
                        </a>
                      </td>
                      <td>{lead.first_name}</td>
                      <td>{lead.company_name}</td>
                      <td>
                        {lead.status === 'completed' && <span className="badge badge-success">Complete</span>}
                        {lead.status === 'processing' && <span className="badge badge-warning">Processing</span>}
                        {lead.status === 'pending' && <span className="badge badge-info">Pending</span>}
                        {lead.status === 'failed' && <span className="badge badge-error">Failed</span>}
                      </td>
                      <td>{lead.views || 0}</td>
                      <td>
                        {lead.unique_slug && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => copyLink(lead.unique_slug)}
                              className="p-2 hover:bg-white/10 rounded-lg transition-colors tooltip"
                              data-tooltip="Copy Link"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <a
                              href={`/v/${lead.unique_slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-white/10 rounded-lg transition-colors tooltip"
                              data-tooltip="Open Page"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <a
                              href={`/api/videos/preview/${lead.unique_slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-white/10 rounded-lg transition-colors tooltip"
                              data-tooltip="Preview Video"
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
          </section>
        )}
      </main>
    </div>
  );
}
