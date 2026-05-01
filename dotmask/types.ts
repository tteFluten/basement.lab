export type FileStatus = 'queued' | 'converting' | 'done' | 'error';

export interface ConversionItem {
  id: string;
  file: File;
  fileName: string;
  sourceFormat: string;
  targetFormat: string;
  status: FileStatus;
  progress: number;
  outputUrl: string | null;
  outputName: string | null;
  error: string | null;
  size: number;
  outputSize: number | null;
}

export interface FormatGroup {
  label: string;
  extensions: string[];
}

export const FORMAT_GROUPS: FormatGroup[] = [
  { label: 'VIDEO', extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv'] },
  { label: 'AUDIO', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac'] },
];

export const ALL_FORMATS = FORMAT_GROUPS.flatMap(g => g.extensions);

export const CONVERSION_MAP: Record<string, string[]> = {
  mp4:  ['webm', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'ogg', 'aac'],
  webm: ['mp4', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'ogg', 'aac'],
  mov:  ['mp4', 'webm', 'avi', 'mkv', 'mp3', 'wav', 'ogg', 'aac'],
  avi:  ['mp4', 'webm', 'mov', 'mkv', 'mp3', 'wav', 'ogg', 'aac'],
  mkv:  ['mp4', 'webm', 'mov', 'avi', 'mp3', 'wav', 'ogg', 'aac'],
  mp3:  ['wav', 'ogg', 'flac', 'aac'],
  wav:  ['mp3', 'ogg', 'flac', 'aac'],
  ogg:  ['mp3', 'wav', 'flac', 'aac'],
  flac: ['mp3', 'wav', 'ogg', 'aac'],
  aac:  ['mp3', 'wav', 'ogg', 'flac'],
};
