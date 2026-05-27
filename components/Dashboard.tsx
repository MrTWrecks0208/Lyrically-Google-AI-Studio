import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Music, Clock, Folder, FolderHeart, Search, 
  Trash2, BookOpen, Sparkles, Clipboard, ArrowUpRight, HelpCircle
} from 'lucide-react';
import { Project } from '../types';
import { auth, db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { getRhymes } from '../services/geminiService';

interface DashboardProps {
  projects: Project[];
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
  onCreateWithAi: () => void;
  onSetView: (view: string) => void;
  credits: number;
}

const Dashboard: React.FC<DashboardProps> = ({
  projects,
  onSelectProject,
  onCreateProject,
  onSetView,
  credits
}) => {
  const user = auth.currentUser;
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Songwriter';

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState('All');
  
  // Rhymes state
  const [rhymeWord, setRhymeWord] = useState('heart');
  const [rhymeResults, setRhymeResults] = useState<string[]>(['start', 'part', 'art', 'smart', 'chart', 'apart']);
  const [isRhymeLoading, setIsRhymeLoading] = useState(false);
  const [copiedWord, setCopiedWord] = useState<string | null>(null);

  // Time Formatter
  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / (1000 * 60));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Generate albums list dynamically based on loaded projects
  const albums = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      const albumName = (p as any).album;
      if (albumName && albumName.trim()) {
        set.add(albumName.trim());
      }
    });
    const foundAlbums = Array.from(set);
    if (foundAlbums.length === 0) {
      return [];
    }
    return ['All', ...foundAlbums];
  }, [projects]);

  // Reset selected album if it is no longer valid or there are no albums
  React.useEffect(() => {
    if (selectedAlbum !== 'All') {
      if (albums.length === 0 || !albums.includes(selectedAlbum)) {
        setSelectedAlbum('All');
      }
    }
  }, [albums, selectedAlbum]);

  // Filter projects by both album and search query
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // 1. Album filter
      let matchesAlbum = true;
      if (selectedAlbum !== 'All') {
        const albumName = (p as any).album;
        matchesAlbum = albumName === selectedAlbum;
      }

      // 2. Search query filter
      let matchesSearch = true;
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        matchesSearch = p.title.toLowerCase().includes(query) || (p.lyrics && p.lyrics.toLowerCase().includes(query));
      }

      return matchesAlbum && matchesSearch;
    });
  }, [projects, selectedAlbum, searchQuery]);

  // Handle Find Rhymes
  const handleFindRhymes = async () => {
    if (!rhymeWord.trim()) return;
    setIsRhymeLoading(true);
    try {
      const results = await getRhymes(rhymeWord);
      setRhymeResults(results.slice(0, 10));
    } catch (err) {
      console.error("Rhyme error:", err);
    } finally {
      setIsRhymeLoading(false);
    }
  };

  // Copy word helper
  const handleCopyWord = (word: string) => {
    navigator.clipboard.writeText(word);
    setCopiedWord(word);
    setTimeout(() => setCopiedWord(null), 1500);
  };

  // Delete project trigger
  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'projects', projectId));
    } catch (err) {
      console.error("Error deleting project inside dashboard:", err);
    }
  };

  return (
    <div className="w-full min-h-screen px-6 py-8 md:px-10 bg-[#030712] text-white flex flex-col gap-8 pb-24">
      
      {/* 1. Header Hero Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8 select-none text-left">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3.5xl font-bold tracking-tight text-white font-sans sm:text-4xl">
            Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-br from-pink-400 to-pink-600">{displayName}</span>
          </h1>
          <p className="text-sm text-gray-400 font-medium">
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onSetView('templates')}
            className="flex items-center gap-2 px-4.5 py-2.5 bg-white/5 hover:bg-white/10 active:scale-95 text-gray-300 hover:text-white rounded-xl font-bold text-xs border border-white/10 transition-all cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            Browse Templates
          </button>
          
          <button
            onClick={onCreateProject}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#db2777] hover:bg-pink-600 active:scale-95 text-white rounded-xl font-bold text-xs shadow-lg shadow-pink-500/10 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {/* 2. Main High-Fidelity Full Width Dashboard Layout */}
      <div className="flex flex-col gap-6 text-left w-full">
        
        {/* Catalog Controls / Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search inputs */}
          <div className="relative max-w-sm w-full">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search songs or lyrics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500/50 transition-colors"
            />
          </div>

          {/* Folder filters horizontal list */}
          {albums.length > 0 && (
            <div className="flex flex-wrap gap-2 select-none">
              {albums.map(album => {
                const isActive = selectedAlbum === album;
                return (
                  <button
                    key={album}
                    onClick={() => setSelectedAlbum(album)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-pink-500/10 border-pink-500/30 text-pink-400' 
                        : 'bg-transparent border-white/5 text-gray-400 hover:text-white hover:border-white/10'
                    }`}
                  >
                    {album}
                  </button>
                );
              })}
            </div>
          )}

        </div>

        {/* Songs Grid wrapper adapted for full width grid display */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProjects.length > 0 ? (
            filteredProjects.map((project) => {
              // Generate a clean visual lyric draft snippet excluding song structure and instrumental cues
              const getCleanLyricsSnippet = (lyricsText: string | undefined): string => {
                if (!lyricsText) return '';
                const lines = lyricsText.split('\n');
                const lyricLines: string[] = [];

                for (let line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed) continue;

                  // Skip section headers like [Intro], [Chorus], etc.
                  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    continue;
                  }

                  // Skip parenthetical descriptions like (Chorus-Drop)
                  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
                    continue;
                  }

                  // Skip lines ending with '...' which represent instrument/tempo instructions in templates
                  const lower = trimmed.toLowerCase();
                  const isInstrumental = 
                    lower.includes('synth swelling') ||
                    lower.includes('bass drop') ||
                    lower.includes('piano chords') ||
                    lower.includes('motif driving') ||
                    lower.includes('drum') ||
                    lower.includes('beat drop') ||
                    lower.includes('808') ||
                    lower.includes('vocal chops') ||
                    lower.includes('instrumental') ||
                    lower.includes('chords swelling') ||
                    lower.includes('tempo:') ||
                    (lower.includes('synth') && lower.includes('swelling')) ||
                    (lower.includes('piano') && lower.includes('chords')) ||
                    (lower.includes('motif') && lower.includes('driving'));

                  if (isInstrumental) {
                    continue;
                  }

                  lyricLines.push(trimmed);
                  if (lyricLines.length >= 2) {
                    break;
                  }
                }

                return lyricLines.join(' / ');
              };

              const snippet = getCleanLyricsSnippet(project.lyrics);

              return (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className="group relative flex flex-col justify-between p-5 min-h-[160px] bg-[#010208]/40 border border-white/5 rounded-2xl hover:border-pink-500/30 hover:bg-[#060b24]/40 transition-all duration-300 cursor-pointer shadow-md text-left"
                >
                  <div>
                    {/* Header row in card */}
                    <div className="flex justify-between items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0">
                        <Music className="w-4.5 h-4.5 text-pink-400" />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-500 font-mono">
                          {formatTimeAgo(project.lastModified)}
                        </span>
                        
                        {/* Trash Delete button */}
                        <button
                          onClick={(e) => handleDelete(e, project.id)}
                          title="Delete draft"
                          className="w-6 h-6 rounded-md hover:bg-red-500/15 text-gray-500 hover:text-red-400 flex items-center justify-center transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Content block */}
                    <div className="mt-4">
                      <h4 className="font-bold text-gray-100 group-hover:text-pink-400 transition-colors duration-200 text-sm leading-tight line-clamp-1">
                        {project.title}
                      </h4>
                      
                      {/* Lyric Preview snippet */}
                      {snippet && (
                        <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed font-serif italic text-left pr-4">
                          "{snippet}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Metadata tags */}
                  <div className="mt-4 pt-3 border-t border-white/[0.03] flex items-center justify-between text-[10px] font-bold tracking-wide select-none">
                    <span className="text-pink-500/70 uppercase">
                      {(project as any).album || 'Unassigned Single'}
                    </span>
                    <span className="text-gray-500 font-mono">
                      {project.lyrics ? `${project.lyrics.length} characters` : '0 lyrics'}
                    </span>
                  </div>

                </div>
              );
            })
          ) : (
            /* High fidelity minimalist empty placeholder */
            <div className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 p-10 bg-[#010208]/30 border border-white/5 rounded-2xl flex flex-col items-center justify-center text-center gap-4 py-16">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
                <Music className="w-6 h-6" />
              </div>
              <div className="max-w-xs flex flex-col gap-1.5">
                <span className="text-sm font-bold text-white uppercase tracking-wider">No matching songs found</span>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Start a fresh piece or select another album group.
                </p>
              </div>
              <button
                onClick={onCreateProject}
                className="mt-2 px-4 py-2 bg-pink-500/10 border border-pink-500/20 text-pink-400 hover:bg-pink-500 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Start Fresh Concept
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

export default Dashboard;
