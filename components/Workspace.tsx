import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { doc, onSnapshot, updateDoc, getDoc, collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, ChevronRight, Play, Pause, RotateCcw, RotateCw, 
  Volume2, VolumeX, Shuffle, Repeat, SkipForward, SkipBack, 
  Plus, Trash, Copy, Heart, X, Send, Sun, Music, Clock, Key, 
  Tag, ChevronDown, Check, Loader2, LogOut, Settings, 
  Home, LayoutGrid, Lightbulb, FileText, Library, TrendingUp, Users, Sparkles,
  MousePointer, Eraser, Activity, Pencil
} from 'lucide-react';
import { getAiSuggestion } from '../services/geminiService';
import { SuggestionType } from '../types';

interface WorkspaceProps {
  projectId: string;
  ownerId?: string;
  onBack: () => void;
}

interface LyricLine {
  globalIndex: number;
  text: string;
}

interface LyricSection {
  id: string;
  type: string; // 'VERSE 1', 'PRE-CHORUS', 'CHORUS', 'VERSE 2', etc.
  lines: LyricLine[];
}

const Workspace: React.FC<WorkspaceProps> = ({ projectId, ownerId, onBack }) => {
  const defaultOwnerId = ownerId || auth.currentUser?.uid || '';
  const isOwner = defaultOwnerId === auth.currentUser?.uid;

  // Firebase synchronised states
  const [projectTitle, setProjectTitle] = useState('Untitled Song');
  const [lyricsString, setLyricsString] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Active Editor and selection views
  const [activeTab, setActiveTab] = useState<'lyrics' | 'melody' | 'chords' | 'structure'>('lyrics');
  const [selectedLineIndex, setSelectedLineIndex] = useState<number>(1);
  const [editingText, setEditingText] = useState<string>('');
  
  // Custom Section groupings starting completely empty by default
  const [sections, setSections] = useState<LyricSection[]>([
    {
      id: 'sec_v1_empty',
      type: 'VERSE 1',
      lines: [
        { globalIndex: 1, text: '' }
      ]
    }
  ]);

  // AI Suggestions and Prompts states
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  // Tool states (Right Sidebar Panel) - blank or empty by default
  const [mood, setMood] = useState("");
  const [themeInput, setThemeInput] = useState("");
  const [themes, setThemes] = useState<string[]>([]);
  const [genre, setGenre] = useState("");
  const [tempo, setTempo] = useState(120);
  const [musicalKey, setMusicalKey] = useState("");

  // Full Lyrics Analysis Modal states
  const [showFullAnalysisModal, setShowFullAnalysisModal] = useState<boolean>(false);
  const [analysisType, setAnalysisType] = useState<string>('REVIEW'); // 'REVIEW' | 'IMPROVE' | 'ORIGINALITY_CHECK' | 'RADIO_READY'
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [isAnalysisLoading, setIsAnalysisLoading] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisFeedback, setAnalysisFeedback] = useState<string>('');

  const handleRunFullLyricsAnalysis = async (customFeedback?: string) => {
    setIsAnalysisLoading(true);
    setAnalysisError(null);
    
    // Compile full lyrics
    const fullLyrics = serializeToFullString(sections);
    
    if (!fullLyrics || fullLyrics.replace(/\[.*?\]/g, '').trim() === '') {
      setAnalysisError("Your song has no lyrics yet. Please add some lyrics first to evaluate!");
      setIsAnalysisLoading(false);
      return;
    }
    
    let selectedSugType = SuggestionType.REVIEW;
    let systemPrompt = "You are Lyrically Review AI, an expert music editor providing objective lyric critique.";
    
    if (analysisType === 'IMPROVE') {
      selectedSugType = SuggestionType.IMPROVE;
      systemPrompt = "You are Lyrically Editor AI, an elite songwriter providing micro-improvements and polished alternates.";
    } else if (analysisType === 'ORIGINALITY_CHECK') {
      selectedSugType = SuggestionType.ORIGINALITY_CHECK;
      systemPrompt = "You are Lyrically Copyright & Originality AI, checking for plagiarism/cliches and providing dynamic insights and references.";
    } else if (analysisType === 'RADIO_READY') {
      selectedSugType = SuggestionType.RADIO_READY;
      systemPrompt = "You are Lyrically Hitmaker AI, giving commercial, radio-ready polished feedback, hooks advice, and production ideas.";
    }

    try {
      const result = await getAiSuggestion(
        fullLyrics,
        selectedSugType,
        customFeedback || analysisFeedback,
        systemPrompt
      );
      if (result && result.text) {
        setAnalysisResult(result.text);
      } else {
        setAnalysisError("Could not retrieve analysis from Gemini. Please try again.");
      }
    } catch (err: any) {
      console.error("Full lyrics analysis error:", err);
      setAnalysisError(err.message || "An error occurred during full lyrics evaluation.");
    } finally {
      setIsAnalysisLoading(false);
    }
  };

  // Web Audio Synthesizer Loop states
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration] = useState(198); // 3m 18s matching mockup "3:18"
  const [volume, setVolume] = useState(80);

  // Debouncing save timer ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reference to keep track of the latest lyricsString representation locally
  const lyricsStringRef = useRef(lyricsString);

  // Melody Sketch synthesizer state
  const [melodyPlaying, setMelodyPlaying] = useState(false);
  const melodyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [melodyProgress, setMelodyProgress] = useState(0);

  // Audio Context for direct chord and melody synthesis
  const audioCtxRef = useRef<AudioContext | null>(null);

  // --- MELODY SEQUENCER ENGINE DESIGN ---
  const KEY_NOTES = [
    { name: 'C5', freq: 523.25, isBlack: false },
    { name: 'B4', freq: 493.88, isBlack: false },
    { name: 'A#4', freq: 466.16, isBlack: true },
    { name: 'A4', freq: 440.00, isBlack: false },
    { name: 'G#4', freq: 415.30, isBlack: true },
    { name: 'G4', freq: 392.00, isBlack: false },
    { name: 'F#4', freq: 369.99, isBlack: true },
    { name: 'F4', freq: 349.23, isBlack: false },
    { name: 'E4', freq: 329.63, isBlack: false },
    { name: 'D#4', freq: 311.13, isBlack: true },
    { name: 'D4', freq: 293.66, isBlack: false },
    { name: 'C#4', freq: 277.18, isBlack: true },
    { name: 'C4', freq: 261.63, isBlack: false },
  ];

  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set<string>());
  const [melodyPlayhead, setMelodyPlayhead] = useState<number>(-1);
  const [melodyPlaybackActive, setMelodyPlaybackActive] = useState<boolean>(false);
  const [selectedMelodyIdeaIndex, setSelectedMelodyIdeaIndex] = useState<number>(0);
  const [melodyTool, setMelodyTool] = useState<'select' | 'pencil' | 'eraser' | 'duplicate'>('pencil');

  const melodyIdeasPreset = [
    { name: 'Late Night Drives', genre: 'Synthwave', pattern: [8, 5, 1, 8, 5, 3, 1, 0, 3, 5, 8, 10, 8, 5, 3, 1], wave: "M 0 10 Q 5 20 10 10 T 20 10 T 30 10 T 40 10" },
    { name: 'Nostalgic Spark', genre: 'Indie Pop', pattern: [12, 10, 8, 5, 8, 10, 12, 1, 12, 10, 8, 5, 8, 10, 12, 1], wave: "M 0 15 Q 10 5 15 15 T 30 15 T 45 15 T 60 15" },
    { name: 'Reflective Echoes', genre: 'Ambient', pattern: [8, 3, 1, 8, 3, 1, 5, 3, 8, 3, 1, 8, 3, 1, 5, 3], wave: "M 0 10 C 15 0, 15 20, 30 10 S 45 30, 60 10" },
    { name: 'Sunset Highway', genre: 'Dream Pop', pattern: [5, 8, 10, 12, 10, 8, 5, 3, 5, 8, 10, 12, 10, 8, 5, 3], wave: "M 0 20 Q 20 5 40 20 T 80 20 T 120 20" },
  ];

  const playSingleFrequency = (frequency: number) => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, now);
      
      env.gain.setValueAtTime((volume / 100) * 0.18, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      
      osc.connect(env);
      env.connect(ctx.destination);
      
      osc.start();
      osc.stop(now + 0.5);
    } catch (e) {
      console.warn("Audio Context synth error:", e);
    }
  };

  const toggleSequencerNote = (rowIdx: number, colIdx: number) => {
    const key = `${rowIdx}_${colIdx}`;
    const updated = new Set(activeNotes);
    if (updated.has(key)) {
      updated.delete(key);
    } else {
      updated.add(key);
      const note = KEY_NOTES[rowIdx];
      if (note) {
        playSingleFrequency(note.freq);
      }
    }
    setActiveNotes(updated);
  };

  const handleGenerateMelodyRandomizer = () => {
    // Randomize melody blocks for a nice visual and listening experience
    const newNotes = new Set<string>();
    const probability = 0.35; // 35% chance per cell to create custom sequence
    for (let col = 0; col < 16; col++) {
      // Ensure at least one note per beat column to make it sound full
      const targetRow = Math.floor(Math.random() * KEY_NOTES.length);
      newNotes.add(`${targetRow}_${col}`);
      // Add optional second layer notes
      if (Math.random() < probability) {
        let secondRow = Math.floor(Math.random() * KEY_NOTES.length);
        if (secondRow !== targetRow) {
          newNotes.add(`${secondRow}_${col}`);
        }
      }
    }
    setActiveNotes(newNotes);
    
    // Play a preview sound of chord sweep
    playSingleFrequency(440.00);
    setTimeout(() => playSingleFrequency(554.37), 100);
    setTimeout(() => playSingleFrequency(659.25), 200);
  };

  const playPresetMelodyIdea = (idx: number) => {
    setSelectedMelodyIdeaIndex(idx);
    const idea = melodyIdeasPreset[idx];
    if (!idea) return;
    
    // Load notes from idea into sequencer grid
    const targetNotes = new Set<string>();
    idea.pattern.forEach((rowIdx, colIdx) => {
      targetNotes.add(`${rowIdx}_${colIdx}`);
    });
    setActiveNotes(targetNotes);

    // Play a preview
    try {
      const ctx = getAudioContext();
      let timeOffset = 0;
      idea.pattern.slice(0, 8).forEach((noteRow, index) => {
        const note = KEY_NOTES[noteRow];
        if (note) {
          setTimeout(() => {
            playSingleFrequency(note.freq);
          }, timeOffset);
          timeOffset += 240;
        }
      });
    } catch (e) {
      console.warn("Idea playback error:", e);
    }
  };

  // Sweeping ticker playhead loop for sequencer notes
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (melodyPlaybackActive) {
      const stepDelay = Math.round(15000 / tempo);
      interval = setInterval(() => {
        setMelodyPlayhead(prev => {
          const nextVal = (prev + 1) % 16;
          // Trigger synthesizer sound for active notes
          KEY_NOTES.forEach((note, rowIdx) => {
            if (activeNotes.has(`${rowIdx}_${nextVal}`)) {
              playSingleFrequency(note.freq);
            }
          });
          return nextVal;
        });
      }, stepDelay);
    } else {
      setMelodyPlayhead(-1);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [melodyPlaybackActive, activeNotes, volume, tempo]);


  // --- SONG STRUCTURE SECTION DETAILS AND STATES ---
  interface StructuralSection {
    type: string;
    bars: number;
    colorClass: string;
    textColor: string;
    energy: number;
    instruments: string[];
  }

  const [structuralSections, setStructuralSections] = useState<StructuralSection[]>([
    { type: 'Intro', bars: 8, colorClass: 'bg-[#9d174d]/10 border-pink-500/20 text-pink-500 hover:bg-[#9d174d]/20', textColor: 'text-pink-400', energy: 30, instruments: ['Synth', 'Keys'] },
    { type: 'Verse 1', bars: 16, colorClass: 'bg-blue-950/20 border-blue-500/20 text-blue-400 hover:bg-blue-950/30', textColor: 'text-blue-400', energy: 50, instruments: ['Drums', 'Bass', 'Guitar'] },
    { type: 'Pre-Chorus', bars: 8, colorClass: 'bg-cyan-950/20 border-cyan-500/20 text-cyan-400 hover:bg-cyan-950/30', textColor: 'text-cyan-400', energy: 65, instruments: ['Drums', 'Bass', 'Keys', 'Guitar'] },
    { type: 'Chorus', bars: 16, colorClass: 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/30', textColor: 'text-emerald-400', energy: 90, instruments: ['Drums', 'Bass', 'Piano', 'Guitar', 'Strings'] },
    { type: 'Verse 2', bars: 16, colorClass: 'bg-violet-950/20 border-violet-500/20 text-violet-400 hover:bg-violet-950/30', textColor: 'text-violet-400', energy: 45, instruments: ['Bass', 'Piano', 'Strings'] },
    { type: 'Pre-Chorus', bars: 8, colorClass: 'bg-cyan-950/20 border-cyan-500/20 text-cyan-400 hover:bg-cyan-950/30', textColor: 'text-cyan-400', energy: 70, instruments: ['Drums', 'Bass', 'Keys', 'Guitar'] },
    { type: 'Chorus', bars: 16, colorClass: 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/30', textColor: 'text-emerald-400', energy: 95, instruments: ['Drums', 'Bass', 'Piano', 'Guitar', 'Strings'] },
    { type: 'Outro', bars: 8, colorClass: 'bg-amber-950/20 border-amber-500/20 text-amber-400 hover:bg-amber-950/30', textColor: 'text-amber-400', energy: 20, instruments: ['Piano', 'Strings'] }
  ]);
  const [selectedSectionBlockIdx, setSelectedSectionBlockIdx] = useState<number>(1); // Default to Verse 1

  const getMatchingLyricsForSectionType = (typeName: string): string => {
    const canonicalName = typeName.toUpperCase().trim();
    const found = sections.find(s => s.type === canonicalName || s.type.startsWith(canonicalName) || canonicalName.startsWith(s.type));
    if (found) {
      return found.lines.map(l => l.text).filter(t => t.trim()).join(' / ');
    }
    return "No lyrics added to this block yet.";
  };

  const [arrangementSuggestions, setArrangementSuggestions] = useState<string[]>([
    "Build intensity before Chorus: Add riser or drum fill in last 2 bars",
    "Add harmony layer: Try adding background vocals in active sections",
    "Dynamic change in active sections: Reduce instrumentation for contrastic breakdowns"
  ]);
  const [isArrangementLoading, setIsArrangementLoading] = useState<boolean>(false);

  const handleGenerateArrangementSuggestions = async () => {
    setIsArrangementLoading(true);
    const selectedSec = structuralSections[selectedSectionBlockIdx];
    const sectionName = selectedSec ? selectedSec.type : "Verse 1";
    const sectionLyrics = getMatchingLyricsForSectionType(sectionName);
    
    const userPrompt = `Analyze the songwriting project titled "${projectTitle}".
Selected Section: ${sectionName}
Selected Section Lyrics: "${sectionLyrics}"
Genre: ${genre}
Tempo: ${tempo} BPM
Key: ${musicalKey}
Mood: ${mood}

Suggest exactly three professional and highly creative musical arrangement, drum spacing, instrumentation, or transition tips for this section. Create clear, concise, actionable notes. Match this format line by line:
Title: Advice text`;

    try {
      const response = await getAiSuggestion(
        sectionLyrics,
        SuggestionType.STRUCTURE,
        userPrompt,
        "You are an elite music arranger and record co-producer."
      );
      if (response && response.text) {
        const lines = response.text.split('\n')
          .map(l => l.replace(/^[-*•\d.\s]+/g, '').trim())
          .filter(l => l && l.includes(':'))
          .slice(0, 3);
        if (lines.length >= 2) {
          setArrangementSuggestions(lines);
        } else {
          setArrangementSuggestions([
            `Build intensity before ${sectionName}: Add high riser sweep or snare drum swell leading down`,
            "Introduce rhythm double-time: Subdivide the percussion elements to elevate energy",
            "Sparsity design: Completely clear the drums in the first bars for dynamic room"
          ]);
        }
      }
    } catch (e) {
      console.error(e);
      setArrangementSuggestions([
        `Build intensity before ${sectionName}: Add high riser sweep or snare drum swell leading down`,
        "Introduce rhythm double-time: Subdivide the percussion elements to elevate energy",
        "Sparsity design: Pull instruments down slightly to let the emotional lyrics breathe"
      ]);
    } finally {
      setIsArrangementLoading(false);
    }
  };

  const toggleStructureInstrument = (inst: string) => {
    setStructuralSections(prev => prev.map((sec, idx) => {
      if (idx === selectedSectionBlockIdx) {
        const contains = sec.instruments.includes(inst);
        return {
          ...sec,
          instruments: contains 
            ? sec.instruments.filter(i => i !== inst)
            : [...sec.instruments, inst]
        };
      }
      return sec;
    }));
  };

  const updateSectionBars = (barsCount: number) => {
    setStructuralSections(prev => prev.map((sec, idx) => {
      if (idx === selectedSectionBlockIdx) {
        return { ...sec, bars: barsCount };
      }
      return sec;
    }));
  };

  const updateSectionEnergy = (val: number) => {
    setStructuralSections(prev => prev.map((sec, idx) => {
      if (idx === selectedSectionBlockIdx) {
        return { ...sec, energy: val };
      }
      return sec;
    }));
  };

  // Undo/Redo lists
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // Parse lines to plain text database representation
  const serializeToFullString = (secArray: LyricSection[]): string => {
    return secArray.map(sec => {
      const header = `[${sec.type}]`;
      const txt = sec.lines.map(l => l.text).join('\n');
      return `${header}\n${txt}`;
    }).join('\n\n');
  };

  // Convert plain text database raw string into section structure
  const deserializeFromFullString = (rawLyricsString: string): LyricSection[] => {
    if (rawLyricsString === undefined || rawLyricsString === null || rawLyricsString.trim() === '') {
      return [
        {
          id: 'sec_v1_empty',
          type: 'VERSE 1',
          lines: [{ globalIndex: 1, text: '' }]
        }
      ];
    }
    const blocks = rawLyricsString.split('\n\n');
    const parsedSections: LyricSection[] = [];
    let lineCounter = 1;

    blocks.forEach((block, bIdx) => {
      const lines = block.split('\n');
      let header = `VERSE ${bIdx + 1}`;
      let firstLineIndex = 0;

      if (lines[0] && lines[0].startsWith('[') && lines[0].endsWith(']')) {
        header = lines[0].slice(1, -1).toUpperCase();
        firstLineIndex = 1;
      }

      const secLines: LyricLine[] = [];
      for (let i = firstLineIndex; i < lines.length; i++) {
        secLines.push({
          globalIndex: lineCounter++,
          text: lines[i]
        });
      }

      parsedSections.push({
        id: `sec_${bIdx}_${header.toLowerCase().replace(/\s+/g, '_')}`,
        type: header,
        lines: secLines.length > 0 ? secLines : [{ globalIndex: lineCounter++, text: '' }]
      });
    });

    return parsedSections;
  };

  // Listen to Firestore changes
  useEffect(() => {
    if (!auth.currentUser) return;
    const projectRef = doc(db, 'users', defaultOwnerId, 'projects', projectId);

    const unsubscribe = onSnapshot(projectRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data) {
          if (data.title !== undefined) {
            setProjectTitle(data.title);
          }
          if (data.lyrics !== undefined) {
            if (!isLoaded || data.lyrics !== lyricsStringRef.current) {
              lyricsStringRef.current = data.lyrics;
              setLyricsString(data.lyrics);
              const parsed = deserializeFromFullString(data.lyrics);
              setSections(parsed);
            }
          }
        }
      }
      setIsLoaded(true);
    }, (err) => {
      console.error("Snapshot error:", err);
      setIsLoaded(true);
    });

    return () => unsubscribe();
  }, [projectId, isLoaded]);

  // Handle auto-save changes with debouncing
  const saveToFirebase = useCallback(async (newSections: LyricSection[], newTitle: string) => {
    if (!auth.currentUser) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setIsSaving(true);
    const serialized = serializeToFullString(newSections);
    const projectRef = doc(db, 'users', defaultOwnerId, 'projects', projectId);

    try {
      await updateDoc(projectRef, {
        title: newTitle,
        lyrics: serialized,
        lastModified: Date.now()
      });
    } catch (err) {
      console.error("Firestore save failure:", err);
    } finally {
      setTimeout(() => setIsSaving(false), 800);
    }
  }, [projectId, defaultOwnerId]);

  // Unified function to update lyric sections and keep serialized string states in sync
  const updateSections = (updatedSections: LyricSection[]) => {
    setSections(updatedSections);
    const serialized = serializeToFullString(updatedSections);
    setLyricsString(serialized);
    lyricsStringRef.current = serialized;
  };

  // Push to Undo list
  const recordHistoryState = (secs: LyricSection[]) => {
    const rawVal = serializeToFullString(secs);
    setUndoStack(prev => [...prev.slice(-19), rawVal]); // Keep max 20 undos
    setRedoStack([]); // Clear Redos on new change
  };

  // Trigger Undo
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    const currentSerialized = serializeToFullString(sections);
    setRedoStack(prev => [...prev, currentSerialized]);

    const parsed = deserializeFromFullString(previous);
    updateSections(parsed);
    saveToFirebase(parsed, projectTitle);
  };

  // Trigger Redo
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    const currentSerialized = serializeToFullString(sections);
    setUndoStack(prev => [...prev, currentSerialized]);

    const parsed = deserializeFromFullString(next);
    updateSections(parsed);
    saveToFirebase(parsed, projectTitle);
  };

  // Find line coordinate structures
  const findLineTextByIndex = (idx: number): string => {
    for (const sec of sections) {
      const line = sec.lines.find(l => l.globalIndex === idx);
      if (line) return line.text;
    }
    return '';
  };

  // Load editing helper
  useEffect(() => {
    const activeTxt = findLineTextByIndex(selectedLineIndex);
    setEditingText(activeTxt);
  }, [selectedLineIndex]);

  // Handle single line key change
  const handleLineTextChange = (lineIdx: number, newText: string) => {
    const updated = sections.map(sec => {
      const updatedLines = sec.lines.map(l => {
        if (l.globalIndex === lineIdx) {
          return { ...l, text: newText };
        }
        return l;
      });
      return { ...sec, lines: updatedLines };
    });
    updateSections(updated);

    // Debounce actual Firestore call by 1000ms
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveToFirebase(updated, projectTitle);
    }, 1000);
  };

  // Keypress event handler (specifically Enter inside interactive text area)
  const handleLineKeyDown = (secId: string, lineIdx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      recordHistoryState(sections);
      
      // Inject next line immediately underneath this one
      const updated = sections.map(sec => {
        if (sec.id === secId) {
          const insertPos = sec.lines.findIndex(l => l.globalIndex === lineIdx);
          const head = sec.lines.slice(0, insertPos + 1);
          const tail = sec.lines.slice(insertPos + 1);
          
          const newLineObj = {
            globalIndex: Date.now() % 100000, // Safe local unique identifier for globalIndex
            text: ''
          };
          
          return {
            ...sec,
            lines: [...head, newLineObj, ...tail]
          };
        }
        return sec;
      });

      // Recalculate linear absolute indices to keep numbers consecutive
      let absoluteCounter = 1;
      const reindexed = updated.map(sec => {
        return {
          ...sec,
          lines: sec.lines.map(l => ({
            ...l,
            globalIndex: absoluteCounter++
          }))
        };
      });

      updateSections(reindexed);
      const targetIndex = lineIdx + 1;
      setSelectedLineIndex(targetIndex);
      saveToFirebase(reindexed, projectTitle);

      // Programmatically shift focus to the next newly inserted line input element
      setTimeout(() => {
        const nextInput = document.getElementById(`lyric-line-input-${targetIndex}`);
        if (nextInput) {
          (nextInput as HTMLInputElement).focus();
        }
      }, 50);
    }
  };

  // Append new section to songwriter list
  const insertSectionGap = (afterSecId: string, customSectionType?: string) => {
    recordHistoryState(sections);
    const targetIdx = sections.findIndex(s => s.id === afterSecId);
    if (targetIdx === -1) return;
    const head = sections.slice(0, targetIdx + 1);
    const tail = sections.slice(targetIdx + 1);

    let nextSecType = customSectionType || 'CHORUS';
    if (nextSecType === 'VERSE') {
      const verseCount = sections.filter(s => s.type.toUpperCase().includes('VERSE')).length;
      nextSecType = `VERSE ${verseCount + 1}`;
    } else if (nextSecType === 'CHORUS') {
      const chorusCount = sections.filter(s => s.type.toUpperCase().includes('CHORUS')).length;
      nextSecType = chorusCount > 0 ? `CHORUS ${chorusCount + 1}` : 'CHORUS';
    } else if (nextSecType === 'PRE-CHORUS') {
      const pcCount = sections.filter(s => s.type.toUpperCase().includes('PRE-CHORUS')).length;
      nextSecType = pcCount > 0 ? `PRE-CHORUS ${pcCount + 1}` : 'PRE-CHORUS';
    }

    const newSec: LyricSection = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: nextSecType.toUpperCase(),
      lines: [{ globalIndex: Date.now() % 10000, text: '' }]
    };

    const combined = [...head, newSec, ...tail];
    // Reindex
    let absoluteCounter = 1;
    const reindexed = combined.map(sec => {
      return {
        ...sec,
        lines: sec.lines.map(l => ({
            ...l,
            globalIndex: absoluteCounter++
          }))
      };
    });

    updateSections(reindexed);
    saveToFirebase(reindexed, projectTitle);

    // Focus first line of the newly created section after a short layout paint
    const targetLineIndex = reindexed[targetIdx + 1]?.lines[0]?.globalIndex;
    if (targetLineIndex) {
      setSelectedLineIndex(targetLineIndex);
      setTimeout(() => {
        const nextInput = document.getElementById(`lyric-line-input-${targetLineIndex}`);
        if (nextInput) {
          (nextInput as HTMLInputElement).focus();
        }
      }, 100);
    }
  };

  // Change the type header of a section
  const changeSectionType = (secId: string, newType: string) => {
    recordHistoryState(sections);
    const updated = sections.map(sec => {
      if (sec.id === secId) {
        return { ...sec, type: newType };
      }
      return sec;
    });
    updateSections(updated);
    saveToFirebase(updated, projectTitle);
  };

  // Delete a section and all its lines, or clean it up if it is the last section
  const deleteSection = (secId: string) => {
    recordHistoryState(sections);
    let updated = sections.filter(sec => sec.id !== secId);
    
    // Ensure we always have at least one empty section
    if (updated.length === 0) {
      updated = [{
        id: `sec_v1_empty_${Date.now()}`,
        type: 'VERSE 1',
        lines: [{ globalIndex: 1, text: '' }]
      }];
    }

    // Reindex
    let absoluteCounter = 1;
    const reindexed = updated.map(sec => {
      return {
        ...sec,
        lines: sec.lines.map(l => ({
            ...l,
            globalIndex: absoluteCounter++
          }))
      };
    });

    updateSections(reindexed);
    
    // Choose active line safely
    const firstLineIdx = reindexed[0]?.lines[0]?.globalIndex || 1;
    setSelectedLineIndex(firstLineIdx);
    
    saveToFirebase(reindexed, projectTitle);
  };

  // Toggle Favorite
  const toggleFav = (txt: string) => {
    setFavorites(prev => ({
      ...prev,
      [txt]: !prev[txt]
    }));
  };

  // Append suggested line to active lyrics editor view
  const applySuggestionLine = (suggestionText: string) => {
    recordHistoryState(sections);
    const updated = sections.map(sec => {
      const lineExists = sec.lines.some(l => l.globalIndex === selectedLineIndex);
      if (lineExists) {
        // Appends suggested line beneath currently selected line!
        const insertPos = sec.lines.findIndex(l => l.globalIndex === selectedLineIndex);
        const head = sec.lines.slice(0, insertPos + 1);
        const tail = sec.lines.slice(insertPos + 1);
        const newLineObj = {
          globalIndex: Date.now() % 100000,
          text: suggestionText
        };
        return {
          ...sec,
          lines: [...head, newLineObj, ...tail]
        };
      }
      return sec;
    });

    // Reindex
    let absoluteCounter = 1;
    const reindexed = updated.map(sec => {
      return {
        ...sec,
        lines: sec.lines.map(l => ({
            ...l,
            globalIndex: absoluteCounter++
          }))
      };
    });

    updateSections(reindexed);
    setSelectedLineIndex(selectedLineIndex + 1);
    saveToFirebase(reindexed, projectTitle);
  };

  // Request new suggestions from Gemini SDK based on active line context
  const handleGenerateAiSuggestions = async (enrichTag?: string) => {
    setIsAiLoading(true);
    const activeText = findLineTextByIndex(selectedLineIndex) || "Midnight Drive";
    
    // Construct rich prompt context
    let promptWithContext = `Suggest exactly four alternative rhyming lines or continuation lines to complete or expand upon the lyric: "${activeText}".`;
    if (enrichTag) {
      promptWithContext += ` Refine style to be ${enrichTag}.`;
    }
    if (promptText.trim()) {
      promptWithContext += ` User instruction: ${promptText}.`;
    }
    promptWithContext += ` Genre: ${genre}, Mood: ${mood}, Themes: ${themes.join(', ')}. Keep individual lines short and natural. Group them clearly with a line-break or number, format with no other text wrappers.`;

    try {
      const result = await getAiSuggestion(
        activeText,
         SuggestionType.NEXT_LINES,
         promptWithContext,
         "You are Lyrically Suggestions AI, generating catchy and rhyming alternative lines based on the user's focus line."
      );

      if (result && result.text) {
        // Parse results split on lines
        const candidates = result.text.split('\n')
          .map(line => line.replace(/^[-*•\d.\s]+/g, '').trim())
          .filter(Boolean)
          .slice(0, 4);

        if (candidates.length >= 2) {
          setAiSuggestions(candidates);
        } else {
          // Fallback options
          setAiSuggestions([
            "and watch the shadows drift away",
            "and find a path to start a day",
            "and chase the road that leads to you",
            "and let the quiet light shine through"
          ]);
        }
      }
    } catch (e) {
      console.error("AI prompt retrieval error:", e);
      // Fallback fallback
      setAiSuggestions([
        "and feel the beat that starts to rise",
        "and count the stars along the skies",
        "and heal the heart we lost inside",
        "and map the patterns of the tide"
      ]);
    } finally {
      setIsAiLoading(false);
      setPromptText("");
    }
  };

  // Auto compile lines inside a specific section
  const handleAutoCompileSection = async (secId: string) => {
    setIsAiLoading(true);
    const targetSec = sections.find(s => s.id === secId);
    if (!targetSec) return;

    const baseLine = targetSec.lines[0]?.text || "Neon signs and empty streets";
    try {
      const result = await getAiSuggestion(
        baseLine,
        SuggestionType.NEXT_LINES,
        `Build exactly three high-impact, emotional rhyming lines to continue: "${baseLine}" for section: ${targetSec.type}. Format with separate newline.`
      );
      if (result && result.text) {
        const generatedLines = result.text.split('\n')
          .map(line => line.replace(/^[-*•\d.\s]+/g, '').trim())
          .filter(Boolean)
          .slice(0, 3);

        if (generatedLines.length > 0) {
          recordHistoryState(sections);
          const updated = sections.map(sec => {
            if (sec.id === secId) {
              const headLine = sec.lines[0] || { globalIndex: 1, text: baseLine };
              const addedLines = generatedLines.map((glText, idx) => ({
                globalIndex: Date.now() + idx,
                text: glText
              }));
              return {
                ...sec,
                lines: [headLine, ...addedLines]
              };
            }
            return sec;
          });

          // Reindex
          let absoluteCounter = 1;
          const reindexed = updated.map(sec => {
            return {
              ...sec,
              lines: sec.lines.map(l => ({
                  ...l,
                  globalIndex: absoluteCounter++
                }))
            };
          });

          updateSections(reindexed);
          saveToFirebase(reindexed, projectTitle);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Add Theme Label
  const addThemeTag = () => {
    if (themeInput.trim() && !themes.includes(themeInput.trim())) {
      setThemes([...themes, themeInput.trim()]);
      setThemeInput("");
    }
  };

  // Remove Theme Label
  const removeThemeTag = (tag: string) => {
    setThemes(themes.filter(t => t !== tag));
  };

  // Global Audio Playback bar ticking timer
  useEffect(() => {
    let tick: NodeJS.Timeout | null = null;
    if (audioPlaying) {
      tick = setInterval(() => {
        setAudioTime(prev => {
          if (prev >= audioDuration) {
            setAudioPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (tick) clearInterval(tick);
    }
  }, [audioPlaying, audioDuration]);

  // Master Volume controller helper
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Initialize Audio Context on demand
  const getAudioContext = (): AudioContext => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Web Audio Synth to play pleasant chord arpeggios in the browser!
  const playSynthesizerChord = (frequencyList: number[]) => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      const masterVolume = ctx.createGain();
      // Bound the chord synthesis volume
      masterVolume.gain.setValueAtTime((volume / 100) * 0.15, now);
      masterVolume.connect(ctx.destination);

      frequencyList.forEach((freq, idx) => {
        // Double oscillator formulation for layered synth pad
        const osc = ctx.createOscillator();
        const oscSub = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const env = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        oscSub.type = 'sine';
        oscSub.frequency.setValueAtTime(freq / 2, now); // Add depth with sub-octave

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800 + idx * 100, now);

        env.gain.setValueAtTime(0, now);
        // Stagger strum trigger
        const strokeDelay = idx * 0.05;
        env.gain.linearRampToValueAtTime(0.4, now + strokeDelay + 0.05);
        env.gain.exponentialRampToValueAtTime(0.001, now + strokeDelay + 1.8);

        osc.connect(filter);
        oscSub.connect(filter);
        filter.connect(env);
        env.connect(masterVolume);

        osc.start(now + strokeDelay);
        oscSub.start(now + strokeDelay);
        osc.stop(now + strokeDelay + 2.0);
        oscSub.stop(now + strokeDelay + 2.0);
      });
    } catch (err) {
      console.warn("Synthesizer error:", err);
    }
  };

  // Trigger sound arpeggios for mapped progression chords representatively
  const triggerChordSound = (chordName: string) => {
    // Frequency chords lookups mapping keys
    const chordFrequencies: Record<string, number[]> = {
      'A': [220.00, 277.18, 329.63, 440.00], // A Major
      'F#m': [185.00, 220.00, 277.18, 369.99], // F# Minor
      'D': [146.83, 220.00, 293.66, 369.99], // D Major
      'E': [164.81, 246.94, 329.63, 392.00]  // E Major
    };

    const freqs = chordFrequencies[chordName] || [261.63, 329.63, 392.00];
    playSynthesizerChord(freqs);
  };

  // Play continuous flowing arpeggios when Melody Sketch is clicked!
  const startMelodyArpeggiator = () => {
    if (melodyPlaying) {
      if (melodyTimerRef.current) clearInterval(melodyTimerRef.current);
      setMelodyPlaying(false);
      setMelodyProgress(0);
      return;
    }

    setMelodyPlaying(true);
    let step = 0;
    const melodyPattern = [
      [220.00, 329.63], // A
      [277.18, 440.00], // C#
      [329.63, 493.88], // E
      [440.00, 554.37], // A octave
      [369.99, 440.00], // F#
      [293.66, 369.99], // D
      [329.63, 493.88], // E
      [277.18, 440.00]  // C#
    ];

    melodyTimerRef.current = setInterval(() => {
      setMelodyProgress(prev => {
        if (prev >= 100) return 0;
        return prev + 1.5;
      });

      const currentFreqIdx = step % melodyPattern.length;
      playSynthesizerChord(melodyPattern[currentFreqIdx]);
      step++;
    }, 280);
  };

  useEffect(() => {
    return () => {
      if (melodyTimerRef.current) clearInterval(melodyTimerRef.current);
    };
  }, []);

  // Export options handler (saves lyrics as complete text files)
  const triggerTextExport = () => {
    const songData = `SONG TITLE: ${projectTitle}
GENRE: ${genre}
TEMPO: ${tempo} BPM
KEY: ${musicalKey}
MOOD: ${mood}
THEMES: ${themes.join(', ')}

==================================================
LYRICS:
==================================================

${serializeToFullString(sections)}`;

    const blob = new Blob([songData], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectTitle.toLowerCase().replace(/\s+/g, '_')}_lyrics.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#030712] text-white font-sans select-none">

        {/* 2. TOP HEADER NAVIGATION - Identical to Mockup */}
        <header className="h-16 bg-[#030712] border-b border-white/5 px-6 flex items-center justify-between flex-shrink-0">
          
          <div className="flex items-center gap-4">
            {/* Song title with inline verification pill */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => {
                  setProjectTitle(e.target.value);
                  saveToFirebase(sections, e.target.value);
                }}
                className="bg-transparent border-none text-white text-lg font-bold focus:outline-none focus:ring-1 focus:ring-white/20 px-2 py-0.5 rounded-lg w-40"
              />
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-extrabold uppercase">
                <Check className="w-3 h-3" />
                <span>Saved</span>
              </div>
            </div>

            {/* Back button option */}
            {isSaving && (
              <span className="text-xs text-pink-500 animate-pulse font-semibold">Autosaving...</span>
            )}
          </div>

          {/* Center-Right controls undo / redo */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 border-r border-white/5 pr-5">
              <button 
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-all"
                title="Undo"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button 
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-all"
                title="Redo"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* Action buttons drawer */}
            <div className="flex items-center gap-3">
              <button 
                onClick={triggerTextExport}
                className="flex items-center gap-2 px-4.5 py-2 rounded-xl text-xs font-extrabold bg-[#db2777] hover:bg-[#c2185b] transition-all text-white active:scale-95 shadow-md shadow-[#db2777]/15"
              >
                <span>Export</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <div className="w-9 h-9 rounded-full bg-[#3f3f46]/20 border border-[#27272a] flex items-center justify-center text-xs font-black select-none text-pink-400">
                AV
              </div>
            </div>
          </div>
        </header>

        {/* WORKSPACE SUBTAB HEADERS PANEL */}
        <div className="bg-[#030712] px-6 pt-4 flex items-center justify-between border-b border-white/5 shrink-0 select-none z-10">
          <div className="flex gap-8">
            {(['lyrics', 'melody', 'chords', 'structure'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  // stop sequencer playing if we switch tabs
                  setMelodyPlaybackActive(false);
                }}
                className="pb-3 text-sm font-extrabold uppercase tracking-widest relative whitespace-nowrap transition-all cursor-pointer focus:outline-none"
                style={{ color: activeTab === tab ? '#db2777' : '#6b7280' }}
              >
                <span>{tab}</span>
                {activeTab === tab && (
                  <motion.span 
                    layoutId="activeSubTabNav"
                    className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#db2777] rounded" 
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* DYNAMIC MAIN AREA CONTENT */}
        {activeTab === 'lyrics' ? (
          <main className="flex-1 grid grid-cols-12 overflow-hidden bg-[#030712] p-5 gap-5 pb-24">
            
            {/* COLUMN 1: LYRICS EDITOR SCREEN (ColSpan 5 - 40% Width) */}
            <section className="col-span-5 flex flex-col h-full overflow-hidden">
              
              <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-4 shrink-0">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Active Lyric Sheets</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setShowFullAnalysisModal(true);
                      setAnalysisResult('');
                      setAnalysisError(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#db2777]/10 border border-[#db2777]/30 hover:bg-[#db2777]/25 rounded-xl text-[10px] font-bold text-pink-400 hover:text-white transition-all cursor-pointer shadow-[0_0_12px_rgba(219,39,119,0.15)] hover:shadow-[0_0_16px_rgba(219,39,119,0.3)] duration-200"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Evaluate Full Song</span>
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold text-gray-300 hover:text-white transition-all">
                    <Music className="w-3 h-3 text-[#db2777]" />
                    <span>{genre}</span>
                    <ChevronDown className="w-3 h-3 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Scrolling lyric sheets lines sheet editor */}
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-6 scrollbar-thin">
                {sections.map((sec, secIdx) => (
                  <div key={sec.id} className="flex flex-col gap-2 relative">
                    
                    {/* Section Title Header */}
                    <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-widest text-[#db2777] mb-1">
                      <div className="flex items-center gap-1 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 rounded-xl px-2.5 py-1 transition-all">
                        <select
                          value={sec.type}
                          onChange={(e) => changeSectionType(sec.id, e.target.value)}
                          className="bg-transparent text-[#db2777] font-extrabold border-none focus:outline-none focus:ring-0 uppercase tracking-widest text-[11px] cursor-pointer hover:text-pink-400 appearance-none pr-1"
                        >
                          <option value="VERSE 1" className="bg-[#090a1a] text-gray-200">Verse 1</option>
                          <option value="VERSE 2" className="bg-[#090a1a] text-gray-200">Verse 2</option>
                          <option value="VERSE 3" className="bg-[#090a1a] text-gray-200">Verse 3</option>
                          <option value="PRE-CHORUS" className="bg-[#090a1a] text-gray-200">Pre-Chorus</option>
                          <option value="CHORUS" className="bg-[#090a1a] text-gray-200">Chorus</option>
                          <option value="CHORUS 2" className="bg-[#090a1a] text-gray-200">Chorus 2</option>
                          <option value="BRIDGE" className="bg-[#090a1a] text-gray-200">Bridge</option>
                          <option value="OUTRO" className="bg-[#090a1a] text-gray-200">Outro</option>
                        </select>
                        <ChevronDown className="w-3 h-3 text-[#db2777]/60 pointer-events-none" />
                      </div>

                      <div className="flex items-center gap-2 text-gray-500">
                        <button 
                          onClick={() => handleAutoCompileSection(sec.id)}
                          className="flex items-center gap-1 text-[#db2777] hover:text-[#f472b6] bg-pink-500/10 px-2.5 py-0.5 rounded border border-pink-500/20 active:scale-95 cursor-pointer text-[10px]"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Auto</span>
                        </button>
                        
                        {sections.length > 1 && (
                          <button 
                            onClick={() => deleteSection(sec.id)}
                            className="p-1 hover:bg-red-500/10 rounded-lg text-gray-500 hover:text-red-400 border border-transparent hover:border-red-500/20 active:scale-95 transition-all cursor-pointer"
                            title="Delete Section"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Lines mapping list */}
                    <div className="flex flex-col gap-1.5">
                      {sec.lines.map((line) => {
                        const isActive = selectedLineIndex === line.globalIndex;
                        return (
                          <div 
                            key={line.globalIndex}
                            onClick={() => {
                              setSelectedLineIndex(line.globalIndex);
                              const inp = document.getElementById(`lyric-line-input-${line.globalIndex}`);
                              if (inp) inp.focus();
                            }}
                            className={`group flex items-center rounded-xl p-2 pl-3 transition-all cursor-text text-left relative ${
                              isActive 
                                ? 'bg-[#db2777]/5 border border-[#db2777]/20 shadow-md ring-1 ring-[#db2777]/10' 
                                : 'border border-transparent hover:bg-white/[0.02]'
                            }`}
                          >
                            {/* Line Number Marker */}
                            <span className="w-6 text-xs font-mono font-bold text-gray-600 select-none group-hover:text-gray-400 block pb-0.5">
                              {line.globalIndex}
                            </span>
 
                            {/* Line Editable input */}
                            <input
                              id={`lyric-line-input-${line.globalIndex}`}
                              type="text"
                              value={line.text}
                              onChange={(e) => handleLineTextChange(line.globalIndex, e.target.value)}
                              onKeyDown={(e) => handleLineKeyDown(sec.id, line.globalIndex, e)}
                              placeholder={isActive ? "Type your next lyrical line..." : "Empty lyric line"}
                              className="bg-transparent border-none text-sm font-medium text-gray-300 w-full focus:outline-none focus:ring-0 placeholder-gray-700 leading-relaxed pb-0.5"
                              style={{ 
                                color: isActive ? '#f472b6' : undefined,
                                caretColor: '#db2777'
                              }}
                            />

                            {/* Highlight cursor indicator on right side */}
                            {isActive && (
                              <span className="w-1 h-3.5 bg-[#db2777] rounded absolute right-4 animate-pulse block" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Section Divider/Insert Options - Always shown below every section block */}
                    <div className="relative py-3 flex flex-col items-center justify-center group/divider mt-2 mb-2 select-none">
                      <div className="absolute inset-x-0 h-px bg-white/[0.03] group-hover/divider:bg-white/10 transition-all" />
                      <div className="relative z-10 flex gap-1.5 items-center opacity-40 group-hover/divider:opacity-100 transition-opacity">
                        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mr-1">Insert Section:</span>
                        <button 
                          onClick={() => insertSectionGap(sec.id, 'VERSE')}
                          className="px-2 py-0.5 rounded-md bg-[#04050d] hover:bg-white/5 border border-white/5 hover:border-[#db2777]/30 text-[9px] font-extrabold uppercase tracking-widest text-[#db2777] active:scale-95 transition-all cursor-pointer"
                        >
                          + Verse
                        </button>
                        <button 
                          onClick={() => insertSectionGap(sec.id, 'PRE-CHORUS')}
                          className="px-2 py-0.5 rounded-md bg-[#04050d] hover:bg-white/5 border border-white/5 hover:border-[#db2777]/30 text-[9px] font-extrabold uppercase tracking-widest text-[#db2777] active:scale-95 transition-all cursor-pointer"
                        >
                          + Pre-Chorus
                        </button>
                        <button 
                          onClick={() => insertSectionGap(sec.id, 'CHORUS')}
                          className="px-2 py-0.5 rounded-md bg-[#04050d] hover:bg-white/5 border border-white/5 hover:border-[#db2777]/30 text-[9px] font-extrabold uppercase tracking-widest text-[#db2777] active:scale-95 transition-all cursor-pointer"
                        >
                          + Chorus
                        </button>
                        <button 
                          onClick={() => insertSectionGap(sec.id, 'BRIDGE')}
                          className="px-2 py-0.5 rounded-md bg-[#04050d] hover:bg-white/5 border border-white/5 hover:border-[#db2777]/30 text-[9px] font-extrabold uppercase tracking-widest text-[#db2777] active:scale-95 transition-all cursor-pointer"
                        >
                          + Bridge
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>

            </section>

            {/* COLUMN 2: LYRIC SUGGESTIONS SECTION (ColSpan 4 - 33% Width) */}
            <section className="col-span-4 bg-[#010208] border border-white/5 rounded-2xl flex flex-col h-full overflow-hidden p-5 shadow-2xl relative animate-fadeIn">
              
              {/* Column Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#db2777]" />
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">Lyrically Suggestions</h3>
                </div>
                <button 
                  onClick={() => setSelectedLineIndex(0)} 
                  className="text-gray-500 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Current Active Context Focus line info */}
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl mb-4 shrink-0 text-left">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Continue this line...</span>
                <span className="text-sm font-semibold text-[#db2777]">
                  "{findLineTextByIndex(selectedLineIndex) || "Select a line to get ideas"}"
                </span>
              </div>

              {/* List and scroll of Suggestion cards */}
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-thin">
                {isAiLoading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                    <Loader2 className="w-7 h-7 text-[#db2777] animate-spin" />
                    <span className="text-xs font-semibold">Generating next lines...</span>
                  </div>
                ) : (
                  aiSuggestions.map((sug, sIndex) => {
                    const isFav = !!favorites[sug];
                    return (
                      <div
                        key={sIndex}
                        onClick={() => applySuggestionLine(sug)}
                        className="group p-4 bg-white/[0.01] border hover:border-[#db2777]/30 border-white/5 rounded-xl flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.03] transition-all text-left"
                      >
                        <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                          {sug}
                        </span>
                        
                        {/* Heart & Copy tools on cards */}
                        <div className="flex items-center gap-3 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFav(sug);
                            }}
                            className={`p-1 hover:bg-white/5 rounded transition-all leading-none ${isFav ? 'text-[#db2777]' : 'text-gray-400'} cursor-pointer`}
                          >
                            <Heart className="w-3.5 h-3.5" fill={isFav ? '#db2777' : 'none'} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(sug);
                            }}
                            className="p-1 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-all leading-none cursor-pointer"
                            title="Copy Suggestion"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Generate More triggers */}
              <div className="border-t border-white/5 pt-4 mt-4 flex flex-col gap-4 shrink-0">
                <button
                  onClick={() => handleGenerateAiSuggestions()}
                  disabled={isAiLoading}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-[#db2777] hover:bg-[#db2777]/10 tracking-wide text-xs font-extrabold text-[#db2777] transition-all active:scale-95 disabled:opacity-20 cursor-pointer"
                >
                  <Loader2 className={`w-4 h-4 ${isAiLoading ? 'animate-spin' : ''}`} style={{ display: isAiLoading ? 'block' : 'none' }} />
                  <span>Generate More</span>
                </button>

                {/* Refinement grid triggers chips */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest text-left">Refine Suggestions</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      "Make it shorter", 
                      "More poetic", 
                      "Stronger rhyme", 
                      "More uplifting", 
                      "Alternative perspective", 
                      "Simplify"
                    ].map((chip) => (
                      <button
                        key={chip}
                        onClick={() => handleGenerateAiSuggestions(chip)}
                        className="px-2.5 py-1.5 bg-white/[0.02] border border-white/5 hover:border-[#db2777] hover:bg-white/5 rounded-xl text-[10px] font-bold text-gray-400 hover:text-white transition-all text-center truncate cursor-pointer"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Lyrically prompting input fields */}
                <div className="relative flex items-center bg-white/[0.02] border border-white/5 rounded-xl px-3 py-1.5 focus-within:border-[#db2777] transition-all">
                  <input
                    type="text"
                    placeholder="Tell Lyrically what you want..."
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGenerateAiSuggestions();
                    }}
                    className="bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0 w-full placeholder-gray-600 mr-2"
                  />
                  <button
                    onClick={() => handleGenerateAiSuggestions()}
                    className="w-8 h-8 rounded-lg bg-[#db2777] hover:bg-[#c2185b] flex items-center justify-center text-white shrink-0 active:scale-95 transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>

            </section>

            {/* COLUMN 3: SIDE TOOLBAR PANEL OPTIONS (ColSpan 3 - 27% Width) */}
            <section className="col-span-3 flex flex-col h-full overflow-hidden gap-4">
              
              {/* Top Toolbar Navigation Header option */}
              <div className="border-b border-white/5 pb-2 mb-2 flex gap-4 shrink-0 select-none">
                <button className="pb-3 text-xs font-extrabold uppercase tracking-widest text-gray-500 hover:text-white transition-all">Inspiration</button>
                <button className="pb-3 text-xs font-extrabold uppercase tracking-widest text-white relative">
                  <span>Tools</span>
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#db2777]" />
                </button>
              </div>

              {/* Custom selectors forms list in container panel */}
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 text-left scrollbar-none pb-4">
                
                {/* Mood Select */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <Sun className="w-3 h-3 text-[#db2777]" />
                    <span>Mood</span>
                  </label>
                  <div className="relative">
                    <select
                      value={mood}
                      onChange={(e) => setMood(e.target.value)}
                      className="w-full pl-3.5 pr-8 py-2 bg-white/[0.01] border border-white/5 rounded-xl text-xs font-bold text-gray-300 focus:outline-none focus:border-[#db2777] appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-[#04050d] text-gray-500">Select Mood...</option>
                      <option value="Reflective" className="bg-[#04050d] text-white">Reflective</option>
                      <option value="Melancholic" className="bg-[#04050d] text-white">Melancholic</option>
                      <option value="Energetic" className="bg-[#04050d] text-white">Energetic</option>
                      <option value="Uplifting" className="bg-[#04050d] text-white">Uplifting</option>
                      <option value="Aggressive" className="bg-[#04050d] text-white">Aggressive</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                {/* Theme Selector tags badges */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <Tag className="w-3 h-3 text-[#db2777]" />
                    <span>Theme</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {themes.map(t => (
                      <div 
                        key={t}
                        className="flex items-center gap-1 px-2.5 py-1 bg-[#db2777]/10 text-[#f472b6] border border-[#db2777]/20 rounded-full text-[10px] font-extrabold"
                      >
                        <span>{t}</span>
                        <button onClick={() => removeThemeTag(t)} className="text-[#db2777] hover:text-white cursor-pointer select-none">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="relative flex items-center bg-white/[0.01] border border-white/5 rounded-xl px-3 py-1.5">
                    <input
                      type="text"
                      placeholder="Add themes..."
                      value={themeInput}
                      onChange={(e) => setThemeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addThemeTag();
                      }}
                      className="bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0 w-full placeholder-gray-600 mr-2"
                    />
                    <button 
                      onClick={addThemeTag}
                      className="text-[#db2777] hover:text-[#f472b6] font-bold text-xs cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Genre Selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <Music className="w-3 h-3 text-[#db2777]" />
                    <span>Genre</span>
                  </label>
                  <div className="relative">
                    <select
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="w-full pl-3.5 pr-8 py-2 bg-white/[0.01] border border-white/5 rounded-xl text-xs font-bold text-gray-300 focus:outline-none focus:border-[#db2777] appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-[#04050d] text-gray-500">Select Genre...</option>
                      <option value="Indie Pop" className="bg-[#04050d] text-white">Indie Pop</option>
                      <option value="Synthwave" className="bg-[#04050d] text-white">Synthwave</option>
                      <option value="Pop" className="bg-[#04050d] text-white">Pop</option>
                      <option value="Rock" className="bg-[#04050d] text-white">Rock</option>
                      <option value="Hip Hop" className="bg-[#04050d] text-white">Hip Hop</option>
                      <option value="Classical" className="bg-[#04050d] text-white">Classical</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                {/* Tempo Slider BPM */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-[#db2777]" />
                      <span>Tempo</span>
                    </label>
                    <span className="text-xs font-mono font-bold text-white">{tempo} BPM</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="60"
                      max="180"
                      value={tempo}
                      onChange={(e) => setTempo(parseInt(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#db2777]"
                    />
                  </div>
                </div>

                {/* Key Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <Key className="w-3 h-3 text-[#db2777]" />
                    <span>Key</span>
                  </label>
                  <div className="relative">
                    <select
                      value={musicalKey}
                      onChange={(e) => setMusicalKey(e.target.value)}
                      className="w-full pl-3.5 pr-8 py-2 bg-white/[0.01] border border-white/5 rounded-xl text-xs font-bold text-gray-300 focus:outline-none focus:border-[#db2777] appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-[#04050d] text-gray-500">Select Key...</option>
                      <option value="A Major" className="bg-[#04050d] text-white">A Major</option>
                      <option value="C Major" className="bg-[#04050d] text-white">C Major</option>
                      <option value="G Major" className="bg-[#04050d] text-white">G Major</option>
                      <option value="E Minor" className="bg-[#04050d] text-white">E Minor</option>
                      <option value="D Minor" className="bg-[#04050d] text-white">D Minor</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                {/* Melody Waveform sketch canvas visual card */}
                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col gap-3 relative overflow-hidden mt-1.5 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wide">Melody Sketch</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#db2777] text-[8px] font-extrabold text-white uppercase">New</span>
                  </div>

                  <div className="h-10 bg-[#010208] border border-white/5 rounded-xl relative overflow-hidden flex items-center">
                    {/* Glowing pink neon flat graphic SVG */}
                    <svg className="w-full h-full stroke-current text-[#db2777] opacity-80" strokeWidth="2.5" fill="none" viewBox="0 0 200 40">
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        d="M 0 20 Q 15 5 30 20 T 60 20 T 90 20 T 120 20 T 150 20 T 180 20 T 200 20" 
                        className={melodyPlaying ? "animate-pulse" : ""}
                      />
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        d="M 5 20 Q 25 35 45 20 T 85 20 T 125 20 T 165 20" 
                        className="opacity-40"
                      />
                    </svg>
                    
                    {/* Playing arpeggiator progress bar indicator */}
                    {melodyPlaying && (
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-pink-400 shadow-lg" 
                        style={{ left: `${melodyProgress}%` }}
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 italic font-medium">Click play to arpeggiate</span>
                    <button
                      onClick={startMelodyArpeggiator}
                      className="w-7 h-7 rounded-full bg-[#db2777] hover:bg-[#c2185b] flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer"
                    >
                      {melodyPlaying ? <X className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                    </button>
                  </div>
                </div>

                {/* Chord Progression details cards */}
                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col gap-3 relative mt-1 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wide">Chord Progression</span>
                    <button className="text-[10px] font-extrabold text-[#db2777] hover:underline cursor-pointer">Edit</button>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { chord: "A", idx: "VI" }, 
                      { chord: "F#m", idx: "iii" }, 
                      { chord: "D", idx: "IV" }, 
                      { chord: "E", idx: "V" }
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => triggerChordSound(item.chord)}
                        className="flex flex-col items-center justify-center p-2.5 bg-[#010208] border border-white/10 hover:border-[#db2777] hover:bg-white/5 rounded-xl transition-all group active:scale-95 shrink-0 cursor-pointer"
                      >
                        <span className="text-xs font-black text-white group-hover:text-[#db2777] transition-colors">{item.chord}</span>
                        <span className="text-[9px] font-mono font-bold text-gray-600 mt-0.5">{item.idx}</span>
                      </button>
                    ))}
                  </div>
                </div>

              </div>

            </section>

          </main>
        ) : activeTab === 'melody' ? (
          <main className="flex-1 grid grid-cols-12 overflow-y-auto bg-[#030712] p-5 gap-5 pb-24 animate-fadeIn select-none">
            
            {/* AREA 1: PIANO SEQUENCER CARD (ColSpan 6 - 50% Width to align sidebars nicely) */}
            <div className="col-span-6 bg-[#010208] border border-white/5 rounded-2xl flex flex-col p-5 gap-4 relative shadow-2xl">
              
              {/* Piano Sequencer card header */}
              <div className="flex items-center justify-between select-none font-sans">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tracking-wider text-white uppercase">MELODY SKETCH</span>
                  <button className="text-gray-500 hover:text-white transition-colors animate-none" title="Edit Melody Name">
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
                {/* Grid Snap dropdown & Tool group selectors */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <select className="bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold px-3 py-1.5 text-gray-300 focus:outline-none focus:border-pink-500 cursor-pointer appearance-none pr-8">
                      <option>Snap: 1/4</option>
                      <option>Snap: 1/8</option>
                      <option>Snap: 1/16</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-3 top-2.5 pointer-events-none" />
                  </div>
                  
                  <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5 shrink-0">
                    <button
                      onClick={() => setMelodyTool('select')}
                      className={`p-1.5 rounded-md transition-all ${melodyTool === 'select' ? 'bg-[#db2777] text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                      title="Select cursor tool"
                    >
                      <MousePointer className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setMelodyTool('pencil')}
                      className={`p-1.5 rounded-md transition-all ${melodyTool === 'pencil' ? 'bg-[#db2777] text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                      title="Pencil write tool"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setMelodyTool('eraser')}
                      className={`p-1.5 rounded-md transition-all ${melodyTool === 'eraser' ? 'bg-[#db2777] text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                      title="Eraser tool"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setMelodyTool('duplicate')}
                      className={`p-1.5 rounded-md transition-all ${melodyTool === 'duplicate' ? 'bg-[#db2777] text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                      title="Duplicate pattern"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Note sequencer roll board container */}
              <div className="bg-[#010208]/40 border border-white/5 rounded-xl flex flex-col overflow-hidden relative shadow-inner">
                
                {/* Horizontal Column Beat headers */}
                <div className="flex h-6 bg-white/[0.01] border-b border-white/5 select-none shrink-0">
                  <div className="w-16 shrink-0 border-r border-white/5" />
                  <div className="flex-1 grid grid-cols-16 text-[9px] font-mono font-bold text-gray-400 text-center leading-6 font-sans">
                    {Array.from({ length: 8 }).map((_, idx) => (
                      <div key={idx} className="col-span-2 border-r border-white/[0.02]">
                        {idx + 1}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Keyboard & sequencer dynamic grids scroll container */}
                <div className="h-[218px] overflow-y-auto flex scrollbar-thin">
                  
                  {/* Left Column Piano Keys */}
                  <div className="w-16 flex flex-col border-r border-white/10 bg-[#010208] sticky left-0 z-10 shrink-0">
                    {KEY_NOTES.map((note, idx) => (
                      <div
                        key={idx}
                        onClick={() => playSingleFrequency(note.freq)}
                        className={`h-[24px] shrink-0 flex items-center justify-between px-1.5 text-[8px] font-mono font-black border-b border-white/5 cursor-pointer transition-colors relative ${
                          note.isBlack 
                            ? 'bg-black text-[#db2777] hover:bg-zinc-900 border-l-4 border-l-pink-500 shadow-inner' 
                            : 'bg-white text-zinc-800 hover:bg-zinc-100 border-l-4 border-l-transparent'
                        }`}
                        title={`Frequency: ${note.freq}Hz`}
                      >
                        <span className="truncate pr-0.5">{note.name}</span>
                        <div className={`w-1 h-3.5 rounded ${note.isBlack ? 'bg-[#db2777]' : 'bg-gray-300'}`} />
                      </div>
                    ))}
                  </div>

                  {/* Beats Steps grids area */}
                  <div className="flex-1 min-w-[500px] grid grid-cols-16 relative">
                    
                    {/* Floating pink sweeping timeline index playhead */}
                    {melodyPlayhead >= 0 && (
                      <div 
                        className="absolute top-0 bottom-0 w-[2px] bg-pink-500 z-20 pointer-events-none shadow-[0_0_12px_#db2777]"
                        style={{ left: `${(melodyPlayhead / 16) * 100}%` }}
                      />
                    )}

                    {/* Array steps grids (16 cols) */}
                    {Array.from({ length: 16 }).map((_, colIdx) => (
                      <div 
                        key={colIdx} 
                        className={`flex flex-col border-r border-white/5 relative ${
                          melodyPlayhead === colIdx 
                            ? 'bg-[#db2777]/[0.05]' 
                            : colIdx % 4 === 0 
                              ? 'bg-white/[0.01]' 
                              : ''
                        }`}
                      >
                        {KEY_NOTES.map((note, rowIdx) => {
                          const isCellActive = activeNotes.has(`${rowIdx}_${colIdx}`);
                          return (
                            <div
                              key={rowIdx}
                              onClick={() => {
                                if (melodyTool === 'eraser') {
                                  if (isCellActive) toggleSequencerNote(rowIdx, colIdx);
                                } else if (melodyTool === 'pencil' || melodyTool === 'select' || melodyTool === 'duplicate') {
                                  toggleSequencerNote(rowIdx, colIdx);
                                }
                              }}
                              className={`h-[24px] border-b border-white/[0.03] flex items-center justify-center cursor-pointer relative group transition-colors ${
                                isCellActive 
                                  ? 'bg-[#db2777]/10' 
                                  : 'hover:bg-white/[0.02]'
                              }`}
                            >
                              {isCellActive && (
                                <motion.div 
                                  layoutId={`note_${rowIdx}_${colIdx}`}
                                  className="absolute inset-[2.5px] rounded-sm bg-gradient-to-r from-[#db2777] to-[#9d174d] border border-pink-400 shadow shadow-[#db2777]/40 flex items-center justify-center"
                                >
                                  <div className="w-1 h-1 rounded-full bg-white/40 animate-pulse" />
                                </motion.div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}

                  </div>

                </div>

              </div>

              {/* CARD-FOOTER COMPACT PLAYER ROW (Directly inside Melody card as mockups show) */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-2 pt-4 border-t border-white/5">
                
                {/* Left controls: Audio icon + key dropdown + tempo */}
                <div className="flex items-center gap-2 text-left font-sans">
                  <div className="w-8 h-8 rounded-lg bg-[#db2777]/10 border border-[#db2777]/20 flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 text-[#db2777]" />
                  </div>
                  
                  <div className="relative">
                    <select
                      value={musicalKey}
                      onChange={(e) => setMusicalKey(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold px-2 py-1.5 focus:outline-none focus:border-pink-500 cursor-pointer text-gray-200"
                    >
                      <option value="A Major" className="bg-[#050614] text-white">A Major</option>
                      <option value="B Major" className="bg-[#050614] text-white">B Major</option>
                      <option value="C Major" className="bg-[#050614] text-white">C Major</option>
                      <option value="D Major" className="bg-[#050614] text-white">D Major</option>
                      <option value="E Major" className="bg-[#050614] text-white">E Major</option>
                    </select>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-gray-200 flex items-center gap-1">
                    <span>{tempo} BPM</span>
                  </div>
                </div>

                {/* Center controls: play actions loop */}
                <div className="flex items-center gap-2.5">
                  <button onClick={() => setMelodyPlayhead(prev => (prev - 1 + 16) % 16)} className="text-gray-400 hover:text-white transition-colors" title="Previous Node">
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => setMelodyPlaybackActive(!melodyPlaybackActive)}
                    className="w-8 h-8 rounded-full bg-[#db2777] hover:bg-pink-600 active:scale-95 transition-all text-white flex items-center justify-center shadow"
                    title="Play sequence"
                  >
                    {melodyPlaybackActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                  </button>
                  <button onClick={() => setMelodyPlayhead(prev => (prev + 1) % 16)} className="text-gray-400 hover:text-white transition-colors" title="Next Node">
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => setMelodyPlaybackActive(!melodyPlaybackActive)}
                    className={`transition-all ${melodyPlaybackActive ? 'text-[#db2777]' : 'text-gray-500 hover:text-white'}`}
                    title="Repeat step"
                  >
                    <Repeat className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Right controls: timeline tracker + audio volume slider */}
                <div className="flex items-center gap-2.5 shrink-0 select-none">
                  <span className="text-[9px] font-mono text-gray-500">0:42</span>
                  <div className="w-20 md:w-28 h-[3px] bg-white/10 rounded-full overflow-hidden relative">
                    <div className="absolute top-0 bottom-0 left-0 bg-[#db2777] rounded-full" style={{ width: '35%' }} />
                    <div className="absolute left-[35%] w-1.5 h-1.5 rounded-full bg-white -mt-[1.5px] shadow" />
                  </div>
                  <span className="text-[9px] font-mono text-gray-500">3:18</span>
                  
                  <div className="w-px h-3.5 bg-white/10" />
                  
                  <button onClick={() => setVolume(volume === 0 ? 80 : 0)} className="text-gray-400 hover:text-white">
                    {volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-[#db2777]" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => setVolume(parseInt(e.target.value))}
                    className="w-12 h-[3px] bg-white/10 rounded-full accent-[#db2777] cursor-pointer"
                  />
                </div>

              </div>

            </div>

            {/* AREA 2: LYRICALLY CO-WRITER CONTROLLER CARD (ColSpan 3 - 25% Width) */}
            <div className="col-span-3 bg-[#010208] border border-white/5 rounded-2xl flex flex-col p-5 gap-4 shadow-2xl font-sans text-left">
              
              {/* Header title */}
              <div className="flex items-center gap-1.5 pb-2.5 border-b border-white/5 select-none shrink-0 font-sans">
                <Sparkles className="w-4 h-4 text-[#db2777] animate-pulse" />
                <span className="text-xs font-black uppercase text-white tracking-widest">Lyrically Co-Writer</span>
              </div>

              {/* Action grid block loops */}
              <div className="flex flex-col gap-1.5 shrink-0 select-none">
                <button
                  onClick={handleGenerateMelodyRandomizer}
                  className="w-full text-center py-2 bg-[#db2777] hover:bg-[#c2185b] active:scale-[0.98] text-[10px] font-extrabold uppercase tracking-wider text-white rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Generate Melody Variation
                </button>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={handleGenerateMelodyRandomizer}
                    className="py-1.5 border border-white/10 rounded-xl hover:bg-white/5 hover:border-pink-500/20 active:scale-95 text-[9px] font-bold text-gray-300 transition-all truncate cursor-pointer"
                  >
                    Harmonize This Line
                  </button>
                  <button
                    onClick={handleGenerateMelodyRandomizer}
                    className="py-1.5 border border-white/10 rounded-xl hover:bg-white/5 hover:border-pink-500/20 active:scale-95 text-[9px] font-bold text-gray-300 transition-all truncate cursor-pointer"
                  >
                    Make More Emotional
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={handleGenerateMelodyRandomizer}
                    className="py-1.5 border border-white/10 rounded-xl hover:bg-white/5 hover:border-pink-500/20 active:scale-95 text-[9px] font-bold text-gray-300 transition-all truncate cursor-pointer"
                  >
                    Simplify Melody
                  </button>
                  <button
                    onClick={handleGenerateMelodyRandomizer}
                    className="py-1.5 border border-white/10 rounded-xl hover:bg-white/5 hover:border-pink-500/20 active:scale-95 text-[9px] font-bold text-gray-300 transition-all truncate cursor-pointer"
                  >
                    Make Catchier
                  </button>
                </div>
              </div>

              {/* Section Sub-separator title */}
              <div className="text-[10px] font-black uppercase text-gray-400 tracking-wider text-left select-none mt-1">
                MELODY IDEAS
              </div>

              {/* Stack items listing */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-0.5 scrollbar-twin">
                {[
                  { name: "Indie Verse Lead", genre: "Indie Pop", wave: "M 5 20 Q 20 5 35 25 T 65 10 T 95 15" },
                  { name: "Synth Wave Echo", genre: "Synthwave", wave: "M 5 15 Q 15 30 35 15 T 75 25 T 95 20" },
                  { name: "Dreamy Pluck Mel", genre: "Chillout", wave: "M 5 25 Q 25 5 45 25 T 85 15 T 95 10" },
                  { name: "Acoustic Arp", genre: "Folk Acoustic", wave: "M 5 20 Q 20 25 35 5 T 65 20 T 95 25" }
                ].map((idea, idx) => {
                  const isActive = selectedMelodyIdeaIndex === idx;
                  const isFav = !!favorites[idea.name];
                  return (
                    <div
                      key={idx}
                      onClick={() => playPresetMelodyIdea(idx)}
                      className={`p-2.5 bg-white/[0.01] border hover:border-pink-500/20 rounded-xl flex items-center justify-between gap-1.5 transition-all text-left cursor-pointer ${
                        isActive ? 'border-pink-500/30 bg-pink-500/[0.02]' : 'border-white/5'
                      }`}
                    >
                      <button
                        className={`w-5.5 h-5.5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                          isActive ? 'bg-[#db2777] border-pink-500 text-white' : 'bg-white/5 border-white/10 text-gray-400'
                        }`}
                      >
                        <Play className="w-2.5 h-2.5 ml-0.5" />
                      </button>
                      
                      <div className="flex-1 min-w-0 flex flex-col overflow-hidden leading-tight">
                        <span className="text-[10px] font-black text-white truncate">{idea.name}</span>
                        <span className="text-[8px] text-gray-500 uppercase tracking-wider font-extrabold truncate">{idea.genre}</span>
                      </div>

                      {/* Sparkline wave visualizer path */}
                      <div className="w-12 h-6 bg-black/40 border border-white/5 rounded-lg flex items-center relative overflow-hidden text-[#db2777] shrink-0">
                        <svg className="w-full h-full stroke-current opacity-70" strokeWidth="1.5" fill="none" viewBox="0 0 100 30">
                          <path d={idea.wave} />
                        </svg>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFav(idea.name);
                        }}
                        className={`p-1 hover:bg-white/5 rounded transition-all cursor-pointer ${isFav ? 'text-pink-505' : 'text-gray-500'}`}
                      >
                        <Heart className="w-3 h-3" fill={isFav ? '#db2777' : 'none'} />
                      </button>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          playPresetMelodyIdea(idx);
                        }}
                        className="px-2 py-0.5 bg-white/5 hover:bg-[#db2777] border border-white/10 hover:border-[#db2777] transition-all text-white rounded text-[8px] font-extrabold cursor-pointer"
                      >
                        Insert
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Chat-prompt input block bottom */}
              <div className="relative mt-2 shrink-0">
                <textarea
                  className="w-full pl-3.5 pr-12 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-[#db2777]/55 h-10 resize-none overflow-hidden"
                  placeholder="Describe the feeling you want..."
                />
                <button
                  onClick={handleGenerateMelodyRandomizer}
                  className="w-6 h-6 rounded-lg bg-[#db2777] hover:bg-pink-600 flex items-center justify-center text-white shrink-0 absolute right-2 top-2 active:scale-95 transition-all cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>

            </div>

            {/* AREA 3: THE HIGH FIDELITY INSPIRATION PANEL (ColSpan 3 - 25% Width) */}
            <div className="col-span-3 bg-[#010208] border border-white/5 rounded-2xl flex flex-col p-5 gap-4.5 shadow-2xl text-left font-sans">
              
              <div className="flex items-center gap-1.5 pb-2.5 border-b border-white/5 select-none shrink-0 font-sans">
                <span className="text-xs font-black uppercase text-white tracking-widest">Inspiration</span>
              </div>

              <div className="flex flex-col gap-4 overflow-y-auto pr-0.5 scrollbar-none">
                
                {/* Mood Select */}
                <div className="flex flex-col gap-1.5 text-left bg-transparent">
                  <label className="text-[9px] font-black uppercase tracking-wider text-gray-500">Mood</label>
                  <div className="relative">
                    <select
                      value={mood}
                      onChange={(e) => setMood(e.target.value)}
                      className="w-full pl-3.5 pr-8 py-2 bg-white/[0.02] border border-white/10 rounded-xl text-xs font-bold text-gray-300 focus:outline-none focus:border-pink-500 appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-[#050614] text-gray-500">Select Mood...</option>
                      <option value="Reflective" className="bg-[#050614] text-white">Reflective</option>
                      <option value="Melancholic" className="bg-[#050614] text-white">Melancholic</option>
                      <option value="Energetic" className="bg-[#050614] text-white">Energetic</option>
                      <option value="Uplifting" className="bg-[#050614] text-white">Uplifting</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-3.5 top-2.5 pointer-events-none" />
                  </div>
                </div>

                {/* Genre Select */}
                <div className="flex flex-col gap-1.5 text-left bg-transparent">
                  <label className="text-[9px] font-black uppercase tracking-wider text-gray-500">Genre</label>
                  <div className="relative">
                    <select
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="w-full pl-3.5 pr-8 py-2 bg-white/[0.02] border border-white/10 rounded-xl text-xs font-bold text-gray-300 focus:outline-none focus:border-pink-500 appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-[#050614] text-gray-500">Select Genre...</option>
                      <option value="Indie Pop" className="bg-[#050614] text-white">Indie Pop</option>
                      <option value="Synthwave" className="bg-[#050614] text-white">Synthwave</option>
                      <option value="Ambient" className="bg-[#050614] text-white">Ambient</option>
                      <option value="Dream Pop" className="bg-[#050614] text-white">Dream Pop</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-3.5 top-2.5 pointer-events-none" />
                  </div>
                </div>

                {/* Tempo slider info */}
                <div className="flex flex-col gap-1.5 text-left">
                  <div className="flex justify-between items-center select-none">
                    <label className="text-[9px] font-black uppercase tracking-wider text-gray-500">Tempo</label>
                    <span className="text-xs font-bold font-mono text-[#db2777]">{tempo} BPM</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="180"
                    value={tempo}
                    onChange={(e) => setTempo(parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-full accent-[#db2777] cursor-pointer"
                  />
                </div>

                {/* Key Selection */}
                <div className="flex flex-col gap-1.5 text-left bg-transparent">
                  <label className="text-[9px] font-black uppercase tracking-wider text-gray-500">Key</label>
                  <div className="relative">
                    <select
                      value={musicalKey}
                      onChange={(e) => setMusicalKey(e.target.value)}
                      className="w-full pl-3.5 pr-8 py-2 bg-white/[0.02] border border-white/10 rounded-xl text-xs font-bold text-gray-300 focus:outline-none focus:border-pink-500 appearance-none cursor-pointer"
                    >
                      <option value="A Major" className="bg-[#050614] text-white">A Major</option>
                      <option value="B Major" className="bg-[#050614] text-white">B Major</option>
                      <option value="C Major" className="bg-[#050614] text-white">C Major</option>
                      <option value="A Minor" className="bg-[#050614] text-white">A Minor</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-3.5 top-2.5 pointer-events-none" />
                  </div>
                </div>

                {/* Vocal range selection */}
                <div className="flex flex-col gap-1.5 text-left bg-transparent">
                  <label className="text-[9px] font-black uppercase tracking-wider text-gray-500">Vocal Range</label>
                  <div className="relative">
                    <select className="w-full pl-3.5 pr-8 py-2 bg-white/[0.02] border border-white/10 rounded-xl text-xs font-bold text-gray-200 focus:outline-none appearance-none cursor-not-allowed">
                      <option>Medium (C3 - G4)</option>
                      <option>High (E3 - C5)</option>
                      <option>Low (A2 - E4)</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-3.5 top-2.5 pointer-events-none" />
                  </div>
                </div>

                {/* Melody Sketch mini-waveform artwork */}
                <div className="flex flex-col gap-1.5 mt-1 text-left">
                  <label className="text-[9px] font-black uppercase tracking-wider text-gray-500">Melody Sketch</label>
                  <div className="bg-[#010208] border border-white/5 rounded-xl p-3 flex items-center justify-between gap-2.5 relative">
                    <div className="w-20 h-6 text-[#db2777]/80 shrink-0 select-none pointer-events-none">
                      <svg className="w-full h-full stroke-current" strokeWidth="1.5" fill="none" viewBox="0 0 100 30">
                        <path d="M 5 15 Q 20 5 35 25 T 65 10 T 95 15 M 15 15 Q 35 25 55 15" />
                      </svg>
                    </div>
                    
                    <button 
                      onClick={() => setMelodyPlaybackActive(!melodyPlaybackActive)}
                      className="w-7 h-7 bg-[#db2777] rounded-full flex items-center justify-center text-white shrink-0 hover:bg-pink-600 active:scale-95 transition-all shadow shadow-pink-500/10 cursor-pointer animate-none"
                    >
                      {melodyPlaybackActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                    </button>
                  </div>
                  
                  {/* Status checklist label */}
                  <div className="flex items-center gap-1.5 select-none mt-1 font-sans">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-wide">Auto-save is on</span>
                  </div>
                </div>

              </div>

            </div>

          </main>
        ) : activeTab === 'structure' ? (
          <main className="flex-1 grid grid-cols-12 overflow-y-auto bg-[#030712] p-5 gap-5 pb-24 animate-fadeIn select-none">
            
            {/* AREA 1: SONG TIMELINE BUILDER (ColSpan 6 - 50% Width) */}
            <div className="col-span-6 bg-[#010208] border border-white/5 rounded-2xl flex flex-col p-5 gap-5 shadow-2xl text-left font-sans">
              
              <div className="flex items-center justify-between pb-3 border-b border-white/5 select-none font-sans">
                <span className="text-xs font-black uppercase tracking-widest text-white">Song Timeline Builder</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-extrabold uppercase text-emerald-400">Synced</span>
              </div>

              {/* Vertical scrollable stack of standard layout arrangement blocks */}
              <div className="flex-1 overflow-y-auto pr-0.5 flex flex-col gap-2.5 max-h-[350px] scrollbar-thin">
                {structuralSections.map((sec, idx) => {
                  const isSelected = selectedSectionBlockIdx === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedSectionBlockIdx(idx)}
                      className={`p-3 bg-white/[0.01] border hover:border-[#db2777]/20 rounded-xl flex items-center justify-between gap-3 transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-[#db2777]/50 bg-[#db2777]/[0.03] shadow-[0_0_12px_rgba(219,39,119,0.1)]' 
                          : 'border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          sec.type.includes('Chorus') 
                            ? 'bg-pink-500' 
                            : sec.type.includes('Verse') 
                              ? 'bg-indigo-500' 
                              : sec.type.includes('Bridge') 
                                ? 'bg-amber-500' 
                                : 'bg-purple-500'
                        }`} />
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-white">{sec.type}</span>
                          <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold mt-0.5">{sec.bars} Bars • Energy {sec.energy}%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 font-mono font-bold uppercase select-none">0{idx + 1}</span>
                        {isSelected && <span className="text-[#db2777] font-black text-[10px]">✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* SECTION DETAIL MODIFIER CARD */}
              <div className="border-t border-white/5 pt-4 flex flex-col gap-4">
                
                {/* Active Section header indicator */}
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Configure Section Details</span>
                  <div className="px-2 py-0.5 bg-[#db2777]/10 border border-[#db2777]/20 rounded text-[9px] font-bold text-[#f472b6]">
                    {structuralSections[selectedSectionBlockIdx]?.type || "Intro"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Bars length dropdown */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Duration (Bars)</label>
                    <div className="relative">
                      <select
                        value={structuralSections[selectedSectionBlockIdx]?.bars || 16}
                        onChange={(e) => updateSectionBars(parseInt(e.target.value))}
                        className="w-full pl-3 pr-8 py-2 bg-white/[0.02] border border-white/10 rounded-xl text-xs font-bold text-gray-200 focus:outline-none focus:border-[#db2777] appearance-none cursor-pointer"
                      >
                        <option value="4" className="bg-[#050614] text-white">4 Bars</option>
                        <option value="8" className="bg-[#050614] text-white">8 Bars</option>
                        <option value="12" className="bg-[#050614] text-white">12 Bars</option>
                        <option value="16" className="bg-[#050614] text-white">16 Bars</option>
                        <option value="24" className="bg-[#050614] text-white">24 Bars</option>
                        <option value="32" className="bg-[#050614] text-white">32 Bars</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-3 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Section Energy rating */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center select-none">
                      <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Energy Impact</label>
                      <span className="text-[10px] font-extrabold text-[#db2777] font-mono">{structuralSections[selectedSectionBlockIdx]?.energy || 50}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={structuralSections[selectedSectionBlockIdx]?.energy || 50}
                      onChange={(e) => updateSectionEnergy(parseInt(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-full accent-[#db2777] cursor-pointer mt-2"
                    />
                  </div>
                </div>

                {/* Sub-block instrumentation selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Instrument Arrangement</label>
                  <div className="grid grid-cols-4 gap-1.5 py-0.5">
                    {['Drums', 'Bass', 'Piano', 'Keys', 'Guitar', 'Synth', 'Strings', 'Percussion'].map((item) => {
                      const isActive = structuralSections[selectedSectionBlockIdx]?.instruments.includes(item);
                      return (
                        <button
                          key={item}
                          onClick={() => toggleStructureInstrument(item)}
                          className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all cursor-pointer text-center ${
                            isActive 
                              ? 'bg-[#db2777]/10 border-[#db2777] text-white shadow shadow-[#db2777]/10' 
                              : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

            </div>

            {/* AREA 2: STRUCTURE PROGRESSION & ENERGY ANALYSIS (ColSpan 6 - 50% Width) */}
            <div className="col-span-6 bg-[#010208] border border-white/5 rounded-2xl flex flex-col p-5 gap-5 shadow-2xl text-left font-sans">
              
              <div className="flex items-center justify-between pb-3 border-b border-white/5 select-none font-sans">
                <span className="text-xs font-black uppercase tracking-widest text-[#db2777]">Energy Analysis Graph</span>
              </div>

              {/* High precision SVG continuous energy curve analysis mapping */}
              <div className="h-28 bg-[#030712] border border-white/5 rounded-xl flex flex-col justify-end p-2 relative overflow-hidden select-none shrink-0">
                <div className="absolute top-2 left-2 text-[8px] font-black uppercase tracking-widest text-gray-500 z-10 font-sans">Energy Curve Impact</div>
                
                <svg className="w-full h-16 absolute bottom-1 inset-x-0 stroke-current text-[#db2777] overflow-visible" strokeWidth="2" fill="none">
                  {/* Draw a dynamic bezier line curving up and down across the 8 structural blocks */}
                  <path d="M 0 50 Q 80 10 160 40 T 320 15 T 480 20 T 640 45" className="opacity-90 animate-pulse" />
                  
                  {/* Energy markers of each block */}
                  {structuralSections.map((sec, idx) => {
                    const widthFraction = 100 / 8;
                    const xCoord = `${idx * widthFraction + widthFraction/2}%`;
                    const yCoord = `${100 - (sec.energy || 50)}%`;
                    const isSelected = selectedSectionBlockIdx === idx;
                    return (
                      <g key={idx}>
                        <circle cx={xCoord} cy={yCoord} r={isSelected ? "4" : "2.5"} className={isSelected ? "fill-[#db2777] stroke-white" : "fill-gray-500"} />
                        <line x1={xCoord} y1="100%" x2={xCoord} y2={yCoord} className="stroke-white/5" strokeDasharray="2" />
                      </g>
                    );
                  })}
                </svg>

                {/* Left/Right dynamic guides */}
                <div className="flex justify-between items-center text-[7px] font-mono text-gray-500 uppercase font-black px-1 mt-1 z-10 select-none">
                  <span>Start (Intro)</span>
                  <span>Climax (Chorus/Bridge)</span>
                  <span>Resolution (Outro)</span>
                </div>
              </div>

              {/* Colored horizontal progress arrangement timeline bars */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Arrangement Timeline Flow</label>
                <div className="h-10 bg-black/40 border border-white/5 rounded-xl p-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none select-none">
                  {structuralSections.map((sec, idx) => {
                    const isSelected = selectedSectionBlockIdx === idx;
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedSectionBlockIdx(idx)}
                        className={`h-full flex-1 rounded-lg flex items-center justify-center text-[9px] font-black uppercase text-white tracking-wider px-1 cursor-pointer transition-all border ${
                          sec.type.includes('Chorus') 
                            ? isSelected ? 'bg-pink-500 border-white' : 'bg-pink-600/70 border-pink-500/20' 
                            : sec.type.includes('Verse') 
                              ? isSelected ? 'bg-indigo-500 border-white' : 'bg-indigo-600/70 border-indigo-500/20' 
                              : sec.type.includes('Bridge') 
                                ? isSelected ? 'bg-amber-500 border-white' : 'bg-amber-600/70 border-amber-500/20' 
                                : isSelected ? 'bg-purple-500 border-white' : 'bg-purple-600/70 border-purple-500/20'
                        }`}
                        title={`${sec.type} - Click to edit`}
                      >
                        {sec.type.substring(0, 3)}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* STRUCTURE DYNAMIC FORMULAS GENERATOR */}
              <div className="border-t border-white/5 pt-4 flex flex-col gap-3.5">
                
                <div className="flex items-center gap-2 select-none font-sans">
                  <Sparkles className="w-3.5 h-3.5 text-[#db2777]" />
                  <span className="text-[10px] font-black uppercase text-white tracking-wider">Dynamic Progression Formulas</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 shrink-0">
                  <div className="flex flex-col gap-1 text-left">
                    <label className="text-[8px] font-black uppercase tracking-wider text-gray-500">Preset Progression</label>
                    <select
                      className="w-full bg-white/[0.02] border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] font-extrabold text-gray-300 focus:outline-none cursor-pointer"
                    >
                      <option className="bg-[#050614] text-white">Classic Radio Pop (Intro-V-C-V-C-B-C-O)</option>
                      <option className="bg-[#050614] text-white">Extended Epic Dance</option>
                      <option className="bg-[#050614] text-white">Dynamic R&B Layout</option>
                      <option className="bg-[#050614] text-white">Ambient Textures Build</option>
                    </select>
                  </div>
                  
                  <div className="flex items-end">
                    <button
                      onClick={handleGenerateArrangementSuggestions}
                      disabled={isArrangementLoading}
                      className="w-full py-1.5 bg-[#db2777] hover:bg-pink-600 rounded-xl text-[10px] font-extrabold uppercase tracking-wide text-white transition-all active:scale-95 disabled:opacity-30 cursor-pointer shadow shadow-[#db2777]/20 flex items-center justify-center gap-1"
                    >
                      <Loader2 className={`w-3 h-3 ${isArrangementLoading ? 'animate-spin' : ''}`} style={{ display: isArrangementLoading ? 'block' : 'none' }} />
                      <span>Smart Re-Arrange</span>
                    </button>
                  </div>
                </div>

                {/* AI Advice list panel box scrolling */}
                <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex flex-col gap-2 min-h-[96px] max-h-[110px] overflow-y-auto scrollbar-thin text-left font-sans">
                  <div className="text-[8px] font-black uppercase tracking-widest text-[#db2777]">AI Co-Writer Advice</div>
                  
                  {isArrangementLoading ? (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="w-3 h-3 text-[#db2777] animate-spin" />
                      <span className="text-[9px] font-bold">Arranging suggestions from Lyrically AI...</span>
                    </div>
                  ) : (
                    arrangementSuggestions.map((sug, idx) => {
                      const colonIdx = sug.indexOf(':');
                      const detail = colonIdx !== -1 ? sug.slice(colonIdx + 1) : sug;
                      return (
                        <p key={idx} className="text-[10px] text-gray-300 antialiased leading-relaxed leading-normal">
                          • {detail.trim()}
                        </p>
                      );
                    })
                  )}
                </div>

              </div>

            </div>

          </main>
        ) : null}

        {/* 4. FOOTER AUDIO PLAYBACK BAR - Identical to Mockup */}
        <footer className="absolute bottom-0 inset-x-0 h-20 bg-[#010208] border-t border-white/5 px-6 flex items-center justify-between z-10 shrink-0">
          
          {/* Left Track Artwork and Details tag metadata */}
          <div className="flex items-center gap-4 text-left w-1/4">
            <div className="w-12 h-12 bg-purple-950 border border-white/10 rounded-xl overflow-hidden relative shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 opacity-60 flex items-center justify-center">
                <Music className="w-5 h-5 text-white/50" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white truncate">{projectTitle}</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">
                {genre} • {tempo} BPM • {musicalKey}
              </span>
            </div>
          </div>

          {/* Center Playback control sets */}
          <div className="flex flex-col gap-1.5 md:w-1/3 text-center items-center">
            
            <div className="flex items-center gap-6 mb-1">
              <button className="text-gray-500 hover:text-white transition-colors" title="Shuffle">
                <Shuffle className="w-3.5 h-3.5" />
              </button>
              <button className="text-gray-500 hover:text-white transition-colors" title="Previous clip">
                <SkipBack className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setAudioPlaying(!audioPlaying)}
                className="w-10 h-10 rounded-full bg-[#db2777] hover:bg-[#c2185b] flex items-center justify-center text-white active:scale-90 transition-all shadow-md shadow-[#db2777]/25"
                title={audioPlaying ? "Pause Track" : "Play Track"}
              >
                {audioPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 ml-0.5 text-white" />}
              </button>
              <button className="text-gray-500 hover:text-white transition-colors" title="Next clip">
                <SkipForward className="w-4 h-4" />
              </button>
              <button className="text-gray-500 hover:text-white transition-colors animate-pulse" title="Repeat/Loop">
                <Repeat className="w-3.5 h-3.5 text-[#db2777]" />
              </button>
            </div>

            {/* Timelines tracking sliders */}
            <div className="w-full flex items-center gap-3">
              <span className="text-[10px] font-mono font-extrabold text-gray-600 w-8 text-right">{formatTime(audioTime)}</span>
              <div 
                className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden relative cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const fraction = (e.clientX - rect.left) / rect.width;
                  setAudioTime(Math.floor(fraction * audioDuration));
                }}
              >
                <div 
                  className="bg-[#db2777] absolute inset-y-0 left-0 rounded-full" 
                  style={{ width: `${(audioTime / audioDuration) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-mono font-extrabold text-gray-600 w-8 text-left">{formatTime(audioDuration)}</span>
            </div>

          </div>

          {/* Right Volume / Master Output panel */}
          <div className="flex items-center justify-end gap-3.5 w-1/4">
            <button 
              onClick={() => setVolume(volume === 0 ? 80 : 0)}
              className="text-gray-500 hover:text-white"
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-gray-300" />}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value))}
              className="w-24 accent-[#db2777] h-1 bg-white/10 rounded-lg cursor-pointer"
            />
          </div>

        </footer>

        {/* FULL LYRICS EVALUATION MODAL */}
        <AnimatePresence>
          {showFullAnalysisModal && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 overflow-hidden select-none">
              {/* Backing screen blur */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowFullAnalysisModal(false)}
                className="absolute inset-0 bg-black/85 backdrop-blur-md"
              />

              {/* Central Modal Sheet */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative w-full max-w-4xl max-h-[90vh] bg-[#030712] border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#010208]/40 shrink-0">
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5 text-pink-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">Full-Song Lyric Evaluation</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Analyze and improve the complete architecture of your lyrics</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowFullAnalysisModal(false)}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Subheader / Mode Selectors Tab buttons */}
                <div className="bg-[#010208]/20 px-6 py-3 border-b border-white/5 flex flex-wrap items-center gap-2 shrink-0 select-none">
                  {[
                    { id: 'REVIEW', label: 'Quality Critique', desc: 'Flow and narratives check' },
                    { id: 'IMPROVE', label: 'micro-Improvements', desc: 'Alternative options' },
                    { id: 'ORIGINALITY_CHECK', label: 'Originality Check', desc: 'Verify cliches & copy' },
                    { id: 'RADIO_READY', label: 'Radio Ready', desc: 'Commercial standards' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setAnalysisType(tab.id);
                        setAnalysisResult('');
                        setAnalysisError(null);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all text-left flex flex-col gap-0.5 min-w-[145px] cursor-pointer border ${
                        analysisType === tab.id
                          ? 'bg-pink-500/10 border-pink-500/30 text-pink-400 shadow-sm'
                          : 'bg-white/[0.01] border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className="text-[9px] font-normal text-gray-500 truncate">{tab.desc}</span>
                    </button>
                  ))}
                </div>

                {/* Main scrollable body panel */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 text-left font-sans">
                  
                  {isAnalysisLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 text-center select-none">
                      <div className="flex items-center justify-center gap-3.5 h-16">
                        <div className="w-4 h-4 rounded-full bg-pink-500 animate-pulse" />
                        <div className="w-4 h-4 rounded-full bg-[#db2777] animate-pulse" style={{ animationDelay: '150ms' }} />
                        <div className="w-4 h-4 rounded-full bg-pink-400 animate-pulse" style={{ animationDelay: '300ms' }} />
                      </div>
                      <h4 className="mt-6 text-sm font-bold text-gray-200">Critiquing Whole Composition...</h4>
                      <p className="text-xs text-gray-500 mt-2 max-w-md leading-relaxed">
                        Lyrically AI is assessing rhymes, narrative progression, and stylistic cohesion. This may take a few seconds.
                      </p>
                    </div>
                  ) : analysisError ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-14 p-6 select-none border border-red-500/10 bg-red-500/5 rounded-2xl">
                      <span className="text-xs font-black text-red-400 uppercase tracking-widest">Analysis Failure</span>
                      <p className="text-xs text-red-300/80 mt-2 max-w-sm text-center leading-relaxed font-semibold">
                        {analysisError}
                      </p>
                      <button
                        onClick={() => handleRunFullLyricsAnalysis()}
                        className="mt-6 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
                      >
                        Retry Evaluation
                      </button>
                    </div>
                  ) : analysisResult ? (
                    <div className="flex flex-col gap-6 font-sans">
                      
                      {/* Active Response Card */}
                      <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div className="markdown-body prose prose-invert select-text max-w-none text-xs text-gray-300 leading-relaxed prose-headings:text-white prose-headings:font-extrabold prose-headings:text-sm prose-p:mb-4 last:prose-p:mb-0 prose-li:text-gray-300 prose-strong:text-pink-400 prose-ul:list-disc prose-ul:pl-4">
                          <ReactMarkdown>{analysisResult}</ReactMarkdown>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 text-center select-none">
                      <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-center shrink-0 mb-4">
                        <Sparkles className="w-6 h-6 text-pink-500" />
                      </div>
                      <h4 className="text-sm font-black text-gray-200">No active evaluation loaded</h4>
                      <p className="text-xs text-gray-500 mt-2 max-w-xs leading-relaxed">
                        Choose your diagnostic mode above and click "Run Full Analysis" to read comprehensive advice.
                      </p>
                    </div>
                  )}

                </div>

                {/* Footer and dynamic feedback box */}
                <div className="p-6 border-t border-white/5 bg-[#010208]/40 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 font-sans">
                  
                  <div className="w-full sm:flex-1 relative">
                    <input
                      type="text"
                      value={analysisFeedback}
                      onChange={(e) => setAnalysisFeedback(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRunFullLyricsAnalysis();
                      }}
                      placeholder="Add focus guidelines, e.g. 'Critique the hook' or 'Make verse 2 more vivid'..."
                      className="w-full bg-[#030712] border border-white/10 rounded-xl px-4 py-3 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-pink-500 pr-10"
                    />
                    <Sparkles className="w-4 h-4 text-gray-650 absolute right-4 top-3.5 pointer-events-none" />
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => handleRunFullLyricsAnalysis()}
                      disabled={isAnalysisLoading}
                      className="px-5 py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-900/30 disabled:text-pink-700/60 transition-all font-bold text-xs text-white rounded-xl flex items-center gap-2 shadow-lg shadow-pink-500/10 active:scale-95 cursor-pointer"
                    >
                      {isAnalysisLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <Activity className="w-3.5 h-3.5" />
                          <span>Run Full Analysis</span>
                        </>
                      )}
                    </button>
                  </div>

                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>

    </div>
  );
};

export default Workspace;
