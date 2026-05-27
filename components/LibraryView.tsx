import React, { useState } from 'react';
import { Search, FolderOpen, Headphones, FileText, Music, Disc, Sparkles } from 'lucide-react';
import { Project } from '../types';

interface LibraryProps {
  projects: Project[];
  onSelectProject: (projectId: string) => void;
}

interface SongEntry {
  id: string;
  title: string;
  type: 'Songs' | 'Lyrics' | 'Melody' | 'Beats' | 'Audio';
  duration: string;
  genre: string;
  key: string;
  updated: string;
}

const defaultSongs: SongEntry[] = [
  { id: 'lib-1', title: 'Neon Dreams', type: 'Songs', duration: '3:24', genre: 'Pop', key: 'A Major', updated: '2h ago' },
  { id: 'lib-2', title: 'Late Night Thoughts', type: 'Songs', duration: '3:02', genre: 'R&B', key: 'F# Minor', updated: '1d ago' },
  { id: 'lib-3', title: 'Ocean Drive', type: 'Songs', duration: '3:18', genre: 'Pop', key: 'C Major', updated: '2d ago' },
  { id: 'lib-4', title: 'Fading Echoes', type: 'Songs', duration: '2:58', genre: 'Pop', key: 'D Minor', updated: '3d ago' },
  { id: 'lib-5', title: 'Chasing Sunrise', type: 'Songs', duration: '3:41', genre: 'Indie', key: 'G Major', updated: '1w ago' }
];

const LibraryView: React.FC<LibraryProps> = ({ projects, onSelectProject }) => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Songs' | 'Lyrics' | 'Melody' | 'Beats' | 'Audio'>('All');

  const filteredItems = defaultSongs.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'All' || item.type === activeTab;
    return matchesSearch && matchesTab;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'Lyrics': return <FileText className="w-5 h-5 text-pink-400" />;
      case 'Melody': return <Music className="w-5 h-5 text-purple-400" />;
      case 'Beats': return <Disc className="w-5 h-5 text-emerald-400" />;
      default: return <Headphones className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div className="w-full min-h-screen p-6 md:p-8 bg-[#030712] text-white text-left pb-20">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Your Music Library</h1>
          <p className="text-sm text-gray-400 mt-1">A unified repository cataloging your full songs, melodies, instrumentals, and lyrics.</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search library catalog..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/5 rounded-2xl text-sm focus:outline-none focus:border-pink-500/50 transition-colors placeholder:text-gray-500"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {(['All', 'Songs', 'Lyrics', 'Melody', 'Beats', 'Audio'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab
                  ? 'bg-[#db2777] text-white shadow-lg'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Item Rows */}
        <div className="flex flex-col gap-3">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  // If there is an actual project matching this title, we can load it
                  const matchedProject = projects.find(p => p.title.toLowerCase() === item.title.toLowerCase());
                  if (matchedProject) {
                    onSelectProject(matchedProject.id);
                  } else {
                    alert(`To work details or record stems on "${item.title}", please select it inside Projects tab or create a fresh custom track!`);
                  }
                }}
                className="p-4 bg-[#010208] border border-white/5 rounded-2xl flex items-center justify-between cursor-pointer hover:border-pink-500/20 hover:bg-[#030712] transition-all duration-300 shadow-lg group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                    {getIcon(item.type)}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base group-hover:text-pink-400 transition-colors">
                      {item.title}
                    </h4>
                    <span className="text-xs text-gray-400 mt-1 block">
                      {item.duration} • {item.genre} • {item.key}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 flex items-center gap-4">
                  <span className="text-[10px] text-gray-500 font-medium">Updated {item.updated}</span>
                  <div className="w-8 h-8 rounded-full bg-white/5 text-gray-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <FolderOpen className="w-4 h-4 text-pink-400" />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center border border-dashed border-white/5 rounded-3xl">
              <span className="text-gray-500 text-sm block">No songs found matching filters.</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default LibraryView;
