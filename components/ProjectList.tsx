import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { Project } from '../types';
import { companions } from '../companions';
import { TrashIcon } from './icons/TrashIcon';
import { User as UserIcon, Settings as SettingsIcon, LogOut, ChevronDown, Plus, Music, Trash2 } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../services/firestoreUtils';

interface ProjectListProps {
  onSelectProject: (projectId: string) => void;
  onGoToSettings: () => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ onSelectProject, onGoToSettings }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const path = `users/${auth.currentUser.uid}/projects`;
    const q = query(
      collection(db, 'users', auth.currentUser.uid, 'projects'),
      orderBy('lastModified', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const projectData: Project[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data) {
            // Robust mapping with defaults to prevent crashes
            const project: Project = {
              id: doc.id,
              title: typeof data.title === 'string' ? data.title : 'Untitled Song',
              lastModified: typeof data.lastModified === 'number' ? data.lastModified : Date.now(),
              lyrics: typeof data.lyrics === 'string' ? data.lyrics : '',
              suggestion: typeof data.suggestion === 'string' ? data.suggestion : '',
              feedback: typeof data.feedback === 'string' ? data.feedback : '',
              companion: data.companion || companions[0],
              messages: Array.isArray(data.messages) ? data.messages : [{ sender: 'greeting', content: companions[0].greeting }],
              activeTab: (data.activeTab === 'editor' || data.activeTab === 'chat' || data.activeTab === 'recordings' || data.activeTab === 'history') ? data.activeTab : 'editor',
              audioClips: Array.isArray(data.audioClips) ? data.audioClips : [],
              uid: data.uid || auth.currentUser?.uid || '',
              isShared: !!data.isShared,
              collaborators: Array.isArray(data.collaborators) ? data.collaborators : []
            };
            projectData.push(project);
          }
        });
        setProjects(projectData);
        setIsLoading(false);
      } catch (err) {
        console.error("Error processing projects snapshot:", err);
        setIsLoading(false);
      }
    }, (error) => {
      setIsLoading(false);
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateProject = async () => {
    if (!auth.currentUser) return;

    const path = `users/${auth.currentUser.uid}/projects`;
    const newProjectData = {
      title: 'Untitled Song',
      lastModified: Date.now(),
      lyrics: '',
      suggestion: '',
      feedback: '',
      companion: companions[0],
      messages: [{ sender: 'greeting', content: companions[0].greeting }],
      activeTab: 'editor',
      uid: auth.currentUser.uid
    };

    try {
      const docRef = await addDoc(collection(db, 'users', auth.currentUser.uid, 'projects'), newProjectData);
      onSelectProject(docRef.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    
    const path = `users/${auth.currentUser.uid}/projects/${projectId}`;
    // We cannot use window.confirm in an iframe, so we just proceed
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'projects', projectId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleSignOut = () => {
    signOut(auth);
  };

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

  const getCleanLyricsSnippet = (lyricsText: string | undefined): string => {
    if (!lyricsText) return '';
    const lines = lyricsText.split('\n');
    const lyricLines: string[] = [];

    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        continue;
      }

      if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
        continue;
      }

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-main">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 sm:p-8 min-h-screen">
      <div className="flex flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-2 sm:gap-4">
        <div className="text-left">
          <h1 className="text-xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-accent-light to-accent leading-tight mb-1 sm:mb-2 text-left">
            Your Projects
          </h1>
          <p className="text-xs sm:text-base text-gray-300">Manage your songs and creative ideas</p>
        </div>
        
        <div className="relative flex items-center gap-2 sm:gap-4 shrink-0 mt-1 sm:mt-0 md:hidden">
          {auth.currentUser?.isAnonymous && (
            <div className="px-2 sm:px-3 py-1 bg-accent/20 border border-accent/30 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />
              <span className="text-[10px] font-bold text-accent uppercase tracking-wider hidden sm:block">Guest Mode</span>
              <span className="text-[10px] font-bold text-accent uppercase tracking-wider sm:hidden">Guest</span>
            </div>
          )}
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="transition-transform hover:scale-120 active:scale-95 focus:outline-none hover:brightness-110"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-light to-accent flex items-center justify-center hover:drop-shadow-xl/25 hover:drop-shadow-pink-200/25 overflow-hidden">
              {auth.currentUser?.photoURL ? (
                <img src={auth.currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="w-5 h-5 text-white" />
              )}
            </div>
          </button>

          <AnimatePresence>
            {isUserMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setIsUserMenuOpen(false)} 
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 w-56 bg-main/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-40 overflow-hidden"
                >
                  <div className="p-4 border-bottom border-white/5 bg-white/5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                      {auth.currentUser?.isAnonymous ? 'Guest Session' : 'Account'}
                    </p>
                    <p className="text-sm font-medium text-white truncate">
                      {auth.currentUser?.isAnonymous ? 'Guest Artist' : auth.currentUser?.email}
                    </p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onGoToSettings();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                    >
                      <SettingsIcon className="w-4 h-4" />
                      Settings
                    </button>
                    <div className="h-px bg-white/5 my-2" />
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {/* Create New Card */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCreateProject}
          className="group relative flex flex-col justify-between p-5 min-h-[170px] bg-[#010208]/40 border border-dashed border-white/20 hover:border-pink-500/50 hover:bg-[#060b24]/40 rounded-2xl transition-all duration-300 cursor-pointer text-left overflow-hidden shadow-md"
        >
          <div>
            <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5 text-pink-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-4">
              <h4 className="font-bold text-gray-100 group-hover:text-pink-400 transition-colors duration-200 text-sm leading-tight">
                New Song
              </h4>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Create a fresh empty canvas to start draft writing
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/[0.03] flex items-center justify-between text-[10px] font-bold tracking-wide select-none text-pink-500/70 uppercase">
            Start Fresh Project
          </div>
        </motion.button>

        {/* Project Cards */}
        <AnimatePresence mode="popLayout">
          {projects.map((project) => {
            const snippet = getCleanLyricsSnippet(project.lyrics);
            return (
              <motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ y: -4 }}
                onClick={() => onSelectProject(project.id)}
                className="group relative flex flex-col justify-between p-5 min-h-[170px] bg-[#010208]/40 border border-white/5 rounded-2xl hover:border-pink-500/30 hover:bg-[#060b24]/40 transition-all duration-300 cursor-pointer shadow-md text-left"
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
                        onClick={(e) => handleDeleteProject(e, project.id)}
                        title="Delete draft"
                        className="w-6 h-6 rounded-md hover:bg-red-500/15 text-gray-500 hover:text-red-400 flex items-center justify-center transition-all cursor-pointer z-20"
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
                    {project.album || 'Unassigned Single'}
                  </span>
                  <span className="text-gray-500 font-mono">
                    {project.lyrics ? `${project.lyrics.length} chars` : '0 lyrics'}
                  </span>
                </div>

              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ProjectList;
