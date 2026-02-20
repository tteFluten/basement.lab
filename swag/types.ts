
export enum MockupType {
  TSHIRT = 'Premium T-Shirt',
  HOODIE = 'Heavyweight Hoodie',
  TOTE_BAG = 'Canvas Tote Bag',
  EMBROIDERED_CAP = 'Dad Hat / Cap',
  COFFEE_MUG = 'Ceramic Coffee Mug',
  VINYL_STICKER = 'Die-Cut Vinyl Sticker',
  ENAMEL_PIN = 'Metal Enamel Pin',
  NOTEBOOK = 'Moleskine Notebook',
  STREET_POSTER = 'Urban Street Poster',
  MACBOOK = 'MacBook Pro Screen',
  SMARTPHONE = 'iPhone Screen',
  BILLBOARD = 'Highway Billboard'
}

export enum AspectRatio {
  SQUARE = '1:1',
  VERTICAL = '9:16',
  HORIZONTAL = '16:9'
}

export enum StylePreset {
  MINIMALIST = 'Clean & Minimalist',
  URBAN = 'Urban Industrial',
  TECH_EDITORIAL = 'Apple Tech Editorial',
  LUXURY = 'High-End Luxury',
  STUDIO = 'Clean Studio Lighting',
  ONIRIC = 'Oniric & Surreal',
  POETIC = 'Soft & Poetic',
  APOCALYPTIC = 'Dark Apocalyptic',
  NATURAL = 'Organic & Natural'
}

export interface GenerationResult {
  imageUrl: string;
  id: string;
  timestamp: number;
  config: {
    mockup: MockupType;
    ratio: AspectRatio;
    resolution: string;
  };
}
