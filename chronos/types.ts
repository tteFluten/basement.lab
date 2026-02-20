
export interface TimeTravelState {
  originalImage: string | null;
  reversedImage: string | null;
  isProcessing: boolean;
  error: string | null;
}

export interface TravelHistoryItem {
  id: string;
  original: string;
  reversed: string;
  timestamp: number;
}
