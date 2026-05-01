import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { ConversionItem, FileStatus, CONVERSION_MAP, FORMAT_GROUPS, ALL_FORMATS } from './types';

const MaskIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter">
    <path d="M2 12a5 5 0 0 0 5 5 8 8 0 0 1 5 2 8 8 0 0 1 5-2 5 5 0 0 0 5-5V7h-5a8 8 0 0 0-5 2 8 8 0 0 0-5-2H2Z" />
    <path d="M6 11c1.5 0 3 .5 3 2-2 0-3-0.5-3-2Z" />
    <path d="M18 11c-1.5 0-3 .5-3 2 2 0 3-0.5 3-2Z" />
  </svg>
);

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const getExtension = (name: string): string => {
  return name.split('.').pop()?.toLowerCase() || '';
};

const getMimeType = (ext: string): string => {
  const map: Record<string, string> = {
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    avi: 'video/x-msvideo', mkv: 'video/x-matroska',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
    flac: 'audio/flac', aac: 'audio/aac',
  };
  return map[ext] || 'application/octet-stream';
};

const App: React.FC = () => {
  const [items, setItems] = useState<ConversionItem[]>([]);
  const [globalTarget, setGlobalTarget] = useState<string>('mp4');
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const ffmpegRef = useRef(new FFmpeg());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFFmpeg = async () => {
    if (ffmpegLoaded || ffmpegLoading) return;
    setFfmpegLoading(true);
    try {
      const ffmpeg = ffmpegRef.current;
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      setFfmpegLoaded(true);
    } catch (err) {
      console.error('FFmpeg load failed:', err);
    } finally {
      setFfmpegLoading(false);
    }
  };

  useEffect(() => {
    loadFFmpeg();
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: ConversionItem[] = Array.from(files)
      .filter(f => {
        const ext = getExtension(f.name);
        return ALL_FORMATS.includes(ext);
      })
      .map(f => {
        const ext = getExtension(f.name);
        const targets = CONVERSION_MAP[ext] || [];
        const target = targets.includes(globalTarget) ? globalTarget : targets[0] || 'mp4';
        return {
          id: Math.random().toString(36).substr(2, 9),
          file: f,
          fileName: f.name,
          sourceFormat: ext,
          targetFormat: target,
          status: 'queued' as FileStatus,
          progress: 0,
          outputUrl: null,
          outputName: null,
          error: null,
          size: f.size,
          outputSize: null,
        };
      });
    setItems(prev => [...prev, ...newItems]);
  }, [globalTarget]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const updateItem = (id: string, updates: Partial<ConversionItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item?.outputUrl) URL.revokeObjectURL(item.outputUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  const changeItemTarget = (id: string, target: string) => {
    updateItem(id, { targetFormat: target });
  };

  const convertSingle = async (item: ConversionItem) => {
    const ffmpeg = ffmpegRef.current;
    const inputName = `input_${item.id}.${item.sourceFormat}`;
    const outputName = `${item.fileName.replace(/\.[^/.]+$/, '')}.${item.targetFormat}`;
    const outputFile = `output_${item.id}.${item.targetFormat}`;

    updateItem(item.id, { status: 'converting', progress: 10 });

    try {
      const fileData = await fetchFile(item.file);
      await ffmpeg.writeFile(inputName, fileData);
      updateItem(item.id, { progress: 30 });

      const args = buildFFmpegArgs(inputName, outputFile, item.sourceFormat, item.targetFormat);
      await ffmpeg.exec(args);
      updateItem(item.id, { progress: 80 });

      const data = await ffmpeg.readFile(outputFile) as Uint8Array;
      const blob = new Blob([data.buffer], { type: getMimeType(item.targetFormat) });
      const url = URL.createObjectURL(blob);

      updateItem(item.id, {
        status: 'done',
        progress: 100,
        outputUrl: url,
        outputName: outputName,
        outputSize: blob.size,
      });

      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputFile);
    } catch (err: any) {
      console.error(`Conversion failed for ${item.fileName}:`, err);
      updateItem(item.id, { status: 'error', error: err.message || 'CONVERSION_FAILED', progress: 0 });
      try { await ffmpeg.deleteFile(inputName); } catch {}
      try { await ffmpeg.deleteFile(outputFile); } catch {}
    }
  };

  const buildFFmpegArgs = (input: string, output: string, srcFmt: string, tgtFmt: string): string[] => {
    const isVideoSrc = ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(srcFmt);
    const isAudioTgt = ['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(tgtFmt);

    if (isVideoSrc && isAudioTgt) {
      const codecMap: Record<string, string[]> = {
        mp3: ['-c:a', 'libmp3lame', '-q:a', '2'],
        wav: ['-c:a', 'pcm_s16le'],
        ogg: ['-c:a', 'libvorbis', '-q:a', '4'],
        flac: ['-c:a', 'flac'],
        aac: ['-c:a', 'aac', '-b:a', '192k'],
      };
      return ['-i', input, '-vn', ...(codecMap[tgtFmt] || []), output];
    }

    if (!isVideoSrc && isAudioTgt) {
      const codecMap: Record<string, string[]> = {
        mp3: ['-c:a', 'libmp3lame', '-q:a', '2'],
        wav: ['-c:a', 'pcm_s16le'],
        ogg: ['-c:a', 'libvorbis', '-q:a', '4'],
        flac: ['-c:a', 'flac'],
        aac: ['-c:a', 'aac', '-b:a', '192k'],
      };
      return ['-i', input, ...(codecMap[tgtFmt] || []), output];
    }

    return ['-i', input, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', output];
  };

  const handleConvertAll = async () => {
    if (!ffmpegLoaded || isConverting) return;
    setIsConverting(true);

    const queued = items.filter(i => i.status === 'queued');
    for (const item of queued) {
      await convertSingle(item);
    }
    setIsConverting(false);
  };

  const handleDownload = (item: ConversionItem) => {
    if (!item.outputUrl || !item.outputName) return;
    const link = document.createElement('a');
    link.href = item.outputUrl;
    link.download = item.outputName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    const done = items.filter(i => i.status === 'done');
    done.forEach((item, index) => {
      setTimeout(() => handleDownload(item), index * 300);
    });
  };

  const handleClearAll = () => {
    items.forEach(i => { if (i.outputUrl) URL.revokeObjectURL(i.outputUrl); });
    setItems([]);
  };

  const handleRemoveDone = () => {
    setItems(prev => {
      prev.filter(i => i.status === 'done').forEach(i => { if (i.outputUrl) URL.revokeObjectURL(i.outputUrl); });
      return prev.filter(i => i.status !== 'done');
    });
  };

  const applyGlobalTarget = (target: string) => {
    setGlobalTarget(target);
    setItems(prev => prev.map(item => {
      if (item.status !== 'queued') return item;
      const targets = CONVERSION_MAP[item.sourceFormat] || [];
      if (targets.includes(target)) return { ...item, targetFormat: target };
      return item;
    }));
  };

  const queuedCount = items.filter(i => i.status === 'queued').length;
  const doneCount = items.filter(i => i.status === 'done').length;
  const convertingCount = items.filter(i => i.status === 'converting').length;

  return (
    <div className="min-h-screen bg-black text-slate-400 font-mono">
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-slate-500">
              <MaskIcon size={20} />
            </div>
            <h1 className="text-xs font-bold tracking-[0.3em] text-slate-200 uppercase">DotMask</h1>
            {convertingCount > 0 && (
              <span className="text-[10px] bg-white text-black px-2 py-0.5 font-bold animate-pulse">
                CONVERTING: {convertingCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-6">
            {!ffmpegLoaded && (
              <span className="text-[9px] text-slate-700 uppercase tracking-widest">
                {ffmpegLoading ? 'Loading_FFmpeg...' : 'FFmpeg_Not_Ready'}
              </span>
            )}
            {ffmpegLoaded && (
              <span className="flex items-center gap-2 text-[9px] text-slate-600 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 bg-green-800" />
                Engine_Ready
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 grid lg:grid-cols-12 gap-12">
        <aside className="lg:col-span-4 space-y-10">
          <section className="space-y-4">
            <h2 className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">01_Input_Files</h2>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`aspect-video border border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-slate-300 bg-slate-900/30'
                  : 'border-slate-800 hover:border-slate-600 bg-black'
              }`}
            >
              <div className="text-slate-600 mb-4">
                <MaskIcon size={32} />
              </div>
              <p className="text-[10px] text-slate-600 uppercase tracking-[0.2em] font-bold">
                {isDragging ? 'Release_Files' : 'Drop_Files_Here'}
              </p>
              <p className="text-[8px] text-slate-800 uppercase tracking-widest mt-2">
                MP4 / WEBM / MOV / AVI / MKV / MP3 / WAV / OGG / FLAC / AAC
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
                className="hidden"
                multiple
                accept=".mp4,.webm,.mov,.avi,.mkv,.mp3,.wav,.ogg,.flac,.aac"
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">02_Target_Format</h2>
            {FORMAT_GROUPS.map(group => (
              <div key={group.label}>
                <label className="text-[8px] text-slate-700 uppercase tracking-widest block mb-2">{group.label}</label>
                <div className="flex flex-wrap gap-1">
                  {group.extensions.map(ext => (
                    <button
                      key={ext}
                      onClick={() => applyGlobalTarget(ext)}
                      className={`px-3 py-2 text-[10px] border transition-all uppercase font-bold ${
                        globalTarget === ext
                          ? 'bg-slate-200 text-black border-slate-200'
                          : 'border-slate-800 text-slate-600 hover:border-slate-600'
                      }`}
                    >
                      .{ext}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <button
              onClick={handleConvertAll}
              disabled={!ffmpegLoaded || queuedCount === 0 || isConverting}
              className={`w-full py-5 font-bold uppercase text-xs tracking-[0.4em] transition-all border ${
                !ffmpegLoaded || queuedCount === 0 || isConverting
                  ? 'border-slate-800 text-slate-700 cursor-not-allowed'
                  : 'bg-white border-white text-black hover:bg-black hover:text-white active:scale-[0.98]'
              }`}
            >
              {isConverting ? 'Converting...' : `Convert_All (${queuedCount})`}
            </button>

            {doneCount > 0 && (
              <button
                onClick={handleDownloadAll}
                className="w-full py-4 border border-slate-700 text-slate-300 uppercase text-[10px] tracking-[0.3em] font-bold hover:bg-white hover:text-black transition-all"
              >
                Download_All ({doneCount})
              </button>
            )}

            {items.length > 0 && (
              <div className="flex gap-2">
                {doneCount > 0 && (
                  <button
                    onClick={handleRemoveDone}
                    className="flex-1 py-3 border border-slate-800 text-slate-600 uppercase text-[9px] tracking-widest hover:border-slate-600 transition-all"
                  >
                    Clear_Done
                  </button>
                )}
                <button
                  onClick={handleClearAll}
                  className="flex-1 py-3 border border-red-900/30 text-red-900 uppercase text-[9px] tracking-widest hover:border-red-900 transition-all"
                >
                  Clear_All
                </button>
              </div>
            )}
          </section>

          {items.length > 0 && (
            <section className="border border-slate-800 p-5 space-y-3">
              <h3 className="text-[9px] text-slate-600 uppercase tracking-widest font-bold">Stats</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[8px] text-slate-700 uppercase">Queued</p>
                  <p className="text-sm text-slate-300 font-bold">{queuedCount}</p>
                </div>
                <div>
                  <p className="text-[8px] text-slate-700 uppercase">Done</p>
                  <p className="text-sm text-green-800 font-bold">{doneCount}</p>
                </div>
                <div>
                  <p className="text-[8px] text-slate-700 uppercase">Total</p>
                  <p className="text-sm text-slate-300 font-bold">{items.length}</p>
                </div>
              </div>
            </section>
          )}
        </aside>

        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.5em] text-slate-200">Queue</h2>
            <span className="text-[9px] text-slate-700 uppercase tracking-widest">
              {items.length} file{items.length !== 1 ? 's' : ''}
            </span>
          </div>

          {items.length === 0 ? (
            <div className="aspect-video border border-slate-800 flex flex-col items-center justify-center space-y-6 opacity-30">
              <MaskIcon size={40} />
              <p className="text-[10px] uppercase tracking-[0.3em]">No_Files_Loaded</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <div
                  key={item.id}
                  className={`border bg-black transition-all ${
                    item.status === 'converting' ? 'border-slate-600' :
                    item.status === 'done' ? 'border-green-900/40' :
                    item.status === 'error' ? 'border-red-900/40' :
                    'border-slate-800'
                  }`}
                >
                  <div className="px-5 py-4 flex items-center gap-4">
                    <div className={`w-2 h-2 flex-shrink-0 ${
                      item.status === 'converting' ? 'bg-white animate-pulse' :
                      item.status === 'done' ? 'bg-green-800' :
                      item.status === 'error' ? 'bg-red-900' :
                      'bg-slate-800'
                    }`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <p className="text-[11px] text-slate-200 font-bold truncate">{item.fileName}</p>
                        <span className="text-[8px] text-slate-700 uppercase flex-shrink-0">{formatBytes(item.size)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-slate-500 uppercase font-bold">.{item.sourceFormat}</span>
                        <span className="text-[9px] text-slate-700">{'\u2192'}</span>
                        {item.status === 'queued' ? (
                          <select
                            value={item.targetFormat}
                            onChange={(e) => changeItemTarget(item.id, e.target.value)}
                            className="bg-black border border-slate-800 text-[9px] text-slate-400 px-2 py-0.5 uppercase font-bold outline-none focus:border-slate-600"
                          >
                            {(CONVERSION_MAP[item.sourceFormat] || []).map(fmt => (
                              <option key={fmt} value={fmt}>.{fmt}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[9px] text-slate-400 uppercase font-bold">.{item.targetFormat}</span>
                        )}
                        {item.status === 'done' && item.outputSize != null && (
                          <span className="text-[8px] text-slate-700 uppercase ml-2">{'\u2192'} {formatBytes(item.outputSize)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {item.status === 'done' && (
                        <button
                          onClick={() => handleDownload(item)}
                          className="px-3 py-1.5 bg-white text-black text-[9px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all"
                        >
                          Save
                        </button>
                      )}
                      {item.status === 'error' && (
                        <span className="text-[8px] text-red-900 uppercase tracking-widest font-bold max-w-[120px] truncate">
                          {item.error}
                        </span>
                      )}
                      {item.status !== 'converting' && (
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-[9px] text-slate-800 hover:text-red-900 transition-colors uppercase"
                        >
                          [X]
                        </button>
                      )}
                    </div>
                  </div>

                  {item.status === 'converting' && (
                    <div className="h-[2px] bg-slate-900">
                      <div
                        className="h-full bg-white transition-all duration-500"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
