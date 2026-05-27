import React, { useState, useEffect } from 'react';
import { Search, Plus, Play, Pause, MoreVertical, Music, FileText, Mic, Guitar, Sliders } from 'lucide-react';

interface Idea {
  id: string;
  title: string;
  type: 'Lyrics' | 'Melody' | 'Chords' | 'Voice Memo';
  timestamp: string;
  duration?: string;
  content: string;
}

const initialIdeas: Idea[] = [
  { id: '1', title: 'Midnight Drive', type: 'Lyrics', timestamp: '2h ago', content: 'City lights blur but I can still feel / The rhythm of a heart that\'s real.' },
  { id: '2', title: 'Ocean Breeze', type: 'Melody', timestamp: '3h ago', content: 'Fast arpeggiated piano chords on major 7ths.' },
  { id: '3', title: 'Late Night Hook', type: 'Lyrics', timestamp: '1d ago', content: 'Chasing dreams, no looking back, / Writing my story, on this track.' },
  { id: '4', title: 'Summer Vibes', type: 'Chords', timestamp: '2d ago', content: 'Cmaj7 - Am7 - Fmaj7 - G7 (120 BPM)' },
  { id: '5', title: 'Voice Memo 01', type: 'Voice Memo', timestamp: '2d ago', duration: '0:28', content: 'Recorded melody draft humming in falsetto.' }
];

const Ideas: React.FC = () => {
  const [ideas, setIdeas] = useState<Idea[]>(() => {
    const saved = localStorage.getItem('lyrically_ideas');
    return saved ? JSON.parse(saved) : initialIdeas;
  });
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Lyrics' | 'Melody' | 'Chords' | 'Voice Memo'>('All');
  const [playingId, setPlayingId] = useState<string | null>(null);

  // New Idea modal/input state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'Lyrics' | 'Melody' | 'Chords' | 'Voice Memo'>('Lyrics');
  const [newContent, setNewContent] = useState('');

  useEffect(() => {
    localStorage.setItem('lyrically_ideas', JSON.stringify(ideas));
  }, [ideas]);

  const handlePlayToggle = (id: string) => {
    if (playingId === id) {
      setPlayingId(null);
    } else {
      setPlayingId(id);
    }
  };

  const handleAddIdea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const freshIdea: Idea = {
      id: Date.now().toString(),
      title: newTitle,
      type: newType,
      timestamp: 'Just now',
      content: newContent,
      duration: newType === 'Voice Memo' ? '0:15' : undefined
    };

    setIdeas([freshIdea, ...ideas]);
    setNewTitle('');
    setNewContent('');
    setShowAddForm(false);
  };

  const filteredIdeas = ideas.filter(idea => {
    const matchesSearch = idea.title.toLowerCase().includes(search.toLowerCase()) || 
                          idea.content.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'All' || idea.type === activeTab;
    return matchesSearch && matchesTab;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'Lyrics': return <FileText className="w-5 h-5 text-pink-400" />;
      case 'Melody': return <Music className="w-5 h-5 text-purple-400" />;
      case 'Chords': return <Guitar className="w-5 h-5 text-emerald-400" />;
      default: return <Mic className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div className="w-full min-h-screen p-6 md:p-8 bg-[#030712] text-white text-left pb-20">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        
        {/* Title and Add Button */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Ideas Scrapbook</h1>
            <p className="text-sm text-gray-400 mt-1">Capture lyrics, quick hooks, chord charts, or hum melodies.</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#db2777] hover:bg-[#db2777]/90 text-white rounded-xl font-semibold transition-all hover:scale-105 shadow-md shadow-pink-500/10 text-sm"
          >
            <Plus className="w-5 h-5" />
            New Idea
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search ideas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/5 rounded-xl text-sm focus:outline-none focus:border-pink-500/50 transition-colors placeholder:text-gray-500"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(['All', 'Lyrics', 'Melody', 'Chords', 'Voice Memo'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab
                  ? 'bg-[#db2777] text-white shadow-lg shadow-pink-500/20'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab === 'Voice Memo' ? 'Voice Memos' : tab}
            </button>
          ))}
        </div>

        {/* List of Scrapbook Ideas */}
        <div className="flex flex-col gap-4">
          {filteredIdeas.length > 0 ? (
            filteredIdeas.map((idea) => (
              <div
                key={idea.id}
                className="p-5 bg-[#010208] border border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xl group hover:border-pink-500/20 transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                    {getIcon(idea.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-base">{idea.title}</h4>
                      <span className="text-[10px] font-semibold text-pink-500/80 bg-pink-500/10 px-2 py-0.5 rounded-full">
                        {idea.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mt-2 line-clamp-2 max-w-xl font-medium italic">
                      "{idea.content}"
                    </p>
                    <span className="text-xs text-gray-500 mt-2 block">Captured {idea.timestamp}</span>
                  </div>
                </div>

                {/* Left controls: Play / options */}
                <div className="flex items-center justify-end gap-3 self-end sm:self-center shrink-0">
                  {idea.type === 'Voice Memo' && (
                    <div className="flex items-center gap-2 bg-pink-500/10 px-3 py-1.5 rounded-xl border border-pink-500/20">
                      <button
                        onClick={() => handlePlayToggle(idea.id)}
                        className="w-8 h-8 rounded-full bg-[#db2777] hover:bg-pink-600 flex items-center justify-center text-white transition-all shadow-md active:scale-95"
                      >
                        {playingId === idea.id ? (
                          <Pause className="w-4 h-4 fill-white" />
                        ) : (
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        )}
                      </button>
                      <span className="text-xs font-mono text-pink-400 font-bold">{idea.duration}</span>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (confirm('Delete this idea?')) {
                        setIdeas(ideas.filter(i => i.id !== idea.id));
                      }
                    }}
                    className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                    title="Delete Idea"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center border-2 border-dashed border-white/5 rounded-2xl">
              <p className="text-gray-500 text-sm">No ideas found matching that category.</p>
            </div>
          )}
        </div>

        {/* Popup Modal Form to Add Ideas */}
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#010208] border border-white/10 rounded-2xl max-w-lg w-full p-6 text-left shadow-2xl relative">
              <button
                onClick={() => setShowAddForm(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl"
              >
                &times;
              </button>
              <h3 className="text-xl font-bold mb-4">Add New Idea</h3>
              <form onSubmit={handleAddIdea} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-gray-400">Idea Name</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Midnight groove, Verse segment..."
                    className="w-full mt-1.5 px-4 py-2.5 bg-[#030712] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-pink-500 transition-colors text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-gray-400">Category Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full mt-1.5 px-4 py-2.5 bg-[#030712] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-pink-500 transition-colors text-white"
                  >
                    <option value="Lyrics">Lyrics</option>
                    <option value="Melody">Melody</option>
                    <option value="Chords">Chords</option>
                    <option value="Voice Memo">Voice Memo</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-gray-400">Content Draft</label>
                  <textarea
                    rows={4}
                    required
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Type or describe your creative idea..."
                    className="w-full mt-1.5 p-4 bg-[#030712] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-pink-500 transition-colors text-white placeholder:text-gray-600 font-medium"
                  />
                </div>
                <div className="flex gap-3 mt-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-semibold transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#db2777] hover:bg-[#db2777]/90 text-white rounded-xl font-semibold transition-colors text-sm shadow-lg shadow-pink-500/20"
                  >
                    Save Idea
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Ideas;
