
import React from 'react';
import { OptionItem } from './types';

export const ENGINES = [
  { id: 'veo', name: 'Google Veo 3', technical: 'Optimized for temporal consistency and photorealism.' },
  { id: 'kling', name: 'Kling AI 1.5', technical: 'Best for complex human motion and large scale physics.' },
  { id: 'luma', name: 'Luma Dream Machine', technical: 'Fast cinematic generations with high aesthetic value.' },
  { id: 'runway', name: 'Runway Gen-3 Alpha', technical: 'Hyper-realistic video with advanced camera control.' },
];

export const STILL_STYLES: OptionItem[] = [
  {
    id: 'realistic',
    name: 'Photorealistic',
    description: 'High-end cinema photos with raw textures.',
    technicalTerm: 'high-end photorealistic cinematic photography, 8k, raw textures, extreme detail, masterwork'
  },
  {
    id: 'stop_motion',
    name: 'Stop Motion',
    description: 'Classic handcrafted frame-by-frame aesthetic.',
    technicalTerm: 'high-end professional stop-motion animation, handcrafted sets, tactile materials, slightly imperfect frame-to-frame consistency, miniature cinematography, studio lighting, detailed miniatures, Laika studio style'
  },
  {
    id: 'action_figures',
    name: 'Retro Figures',
    description: '80s GI Joe style action figure dioramas.',
    technicalTerm: 'photorealistic macro photography of retro action figures, articulated plastic joints, authentic painted plastic textures, miniature diorama backgrounds, 1:12 scale accuracy, tactical military toy gear, dramatic cinematic lighting on plastic'
  },
  {
    id: 'ghibli',
    name: 'Studio Ghibli',
    description: 'Nostalgic hand-painted watercolor anime.',
    technicalTerm: 'Studio Ghibli aesthetic, hand-painted watercolor backgrounds, lush nature, soft cinematic lighting, Joe Hisaishi atmosphere'
  },
  {
    id: 'shinkai',
    name: 'Makoto Shinkai',
    description: 'Hyper-detailed clouds and lens flares.',
    technicalTerm: 'Makoto Shinkai style, Your Name aesthetic, hyper-detailed sky, massive cumulus clouds, vibrant purple and orange lighting, crystalline reflections'
  },
  {
    id: '90sanime',
    name: '90s Retro Anime',
    description: 'Celluloid aesthetic, lo-fi grit.',
    technicalTerm: '90s retro anime style, hand-drawn on celluloid, slight chromatic aberration, lo-fi aesthetic, muted vintage colors, Cowboy Bebop style'
  },
  {
    id: 'cyberpunk_anime',
    name: 'Cyber-Anime',
    description: 'Neon-drenched high contrast anime.',
    technicalTerm: 'Cyberpunk Edgerunners style, Trigger Studio aesthetic, neon high-contrast, kinetic motion lines, glitch effects, hyper-saturated'
  },
  {
    id: 'claymation',
    name: 'Claymation',
    description: 'Stop-motion clay masterpiece.',
    technicalTerm: 'hand-crafted claymation style, play-doh textures, stop-motion aesthetic, fingerprint details on clay'
  },
  {
    id: 'pixar',
    name: '3D Pixar',
    description: 'Disney/Pixar style 3D animation.',
    technicalTerm: 'Pixar-style 3D render, octane render, soft rounded shapes, expressive lighting, subsurface scattering'
  },
  {
    id: 'sketch',
    name: 'Charcoal',
    description: 'Rough artistic drawing.',
    technicalTerm: 'detailed charcoal and pencil sketch, artistic paper texture, cross-hatching, high contrast drawing'
  }
];

export const CAMERA_TYPES: OptionItem[] = [
  {
    id: 'arri',
    name: 'ARRI Alexa 35',
    description: 'Industry gold standard for skin tones.',
    technicalTerm: 'shot on ARRI Alexa 35, REVEAL Color Science, LogC4'
  },
  {
    id: 'red',
    name: 'RED V-Raptor XL',
    description: '8K high-speed powerhouse.',
    technicalTerm: 'shot on RED V-Raptor 8K VV, R3D Raw, high bitrate'
  },
  {
    id: '35mm',
    name: 'Panavision 35mm',
    description: 'Vintage 35mm film aesthetic.',
    technicalTerm: 'shot on Panavision Millennium XL2, Kodak Vision3 500T 5219'
  },
  {
    id: 'imax',
    name: 'IMAX 70mm',
    description: 'Immense scale and resolution.',
    technicalTerm: 'IMAX 15/70mm format, MSM 9802, ultra-wide gate'
  },
  {
    id: 'gopro',
    name: 'Action POV',
    description: 'Ultra-wide perspective.',
    technicalTerm: 'Specialty POV action camera, HyperSmooth stabilization, 5.3K'
  }
];

export const LENSES: OptionItem[] = [
  { id: '14mm', name: '14mm Ultra Wide', description: 'Expansive architecture and landscapes.', technicalTerm: '14mm ultra-wide angle lens, wide field of view, expansive perspective' },
  { id: '24mm', name: '24mm Wide', description: 'Standard wide for cinematic environmental shots.', technicalTerm: '24mm wide angle lens, f/1.4, immersive depth' },
  { id: '35mm', name: '35mm Storyteller', description: 'The most versatile cinematic focal length.', technicalTerm: '35mm prime lens, natural perspective, documentary style' },
  { id: '50mm', name: '50mm Nifty Fifty', description: 'Mimics human eye vision.', technicalTerm: '50mm prime lens, f/1.2, creamy bokeh, natural gaze' },
  { id: '85mm', name: '85mm Portrait', description: 'Flattering compression for characters.', technicalTerm: '85mm portrait lens, shallow depth of field, compressed background' },
  { id: '135mm', name: '135mm Telephoto', description: 'Heavy compression, isolates subjects.', technicalTerm: '135mm telephoto lens, f/2.0, extreme background blur' },
  { id: 'anamorphic', name: '2X Anamorphic', description: 'The "Hollywood" look with oval bokeh.', technicalTerm: '2X anamorphic lens, oval bokeh, horizontal blue lens flares, cinematic widescreen distortion' },
  { id: 'fisheye', name: '8mm Fisheye', description: 'Extreme distortion for stylized shots.', technicalTerm: '8mm fisheye lens, 180-degree field of view, curvilinear distortion' },
  { id: 'tilt_shift', name: 'Tilt-Shift', description: 'Miniature effect or perspective control.', technicalTerm: 'tilt-shift lens, selective focus, miniature model effect' },
  { id: 'macro', name: '100mm Macro', description: 'Extreme close-up details.', technicalTerm: '100mm macro lens, 1:1 magnification, microscopic detail' },
  { id: 'probe', name: 'Laowa Probe', description: 'Bug-eye perspective inside objects.', technicalTerm: 'Laowa 24mm probe lens, internal object perspective, deep focus' },
  { id: 'petzval', name: 'Petzval 58mm', description: 'Vintage swirly bokeh.', technicalTerm: 'Petzval 58mm lens, swirly bokeh effect, vintage glow' }
];

export const MOVEMENTS: OptionItem[] = [
  { id: 'static', name: 'Static / Fixed', description: 'Zero movement, locked tripod.', technicalTerm: 'static camera, locked-off shot, no motion' },
  { id: 'dolly_in', name: 'Dolly In', description: 'Smooth physical push towards subject.', technicalTerm: 'dolly in, slow push-in, physical camera approach' },
  { id: 'dolly_out', name: 'Dolly Out', description: 'Pulling away to reveal context.', technicalTerm: 'dolly out, pull-back shot, revealing the environment' },
  { id: 'pan_horizontal', name: 'Cinematic Pan', description: 'Horizontal rotation left to right.', technicalTerm: 'slow cinematic horizontal pan, fluid head movement' },
  { id: 'tilt', name: 'Vertical Tilt', description: 'Looking up or down.', technicalTerm: 'tilt up from ground, vertical camera rotation' },
  { id: 'crane', name: 'Crane / Jib', description: 'Sweeping vertical and arc movement.', technicalTerm: 'crane shot, sweeping jib movement, high-to-low transition' },
  { id: 'orbit', name: '360 Orbit', description: 'Circling around the subject.', technicalTerm: 'orbital camera move, 360-degree rotation around subject' },
  { id: 'handheld', name: 'Handheld', description: 'Gritty, organic human shake.', technicalTerm: 'handheld camera, organic jitter, documentary realism' },
  { id: 'drone_fpv', name: 'Drone FPV', description: 'Dynamic, agile aerial flight.', technicalTerm: 'FPV drone shot, high-speed aerial tracking, acrobatic flight' },
  { id: 'vertigo', name: 'Zolly (Vertigo)', description: 'Zoom in while dollying out.', technicalTerm: 'dolly zoom effect, vertigo effect, warping perspective' },
  { id: 'tracking', name: 'Lateral Tracking', description: 'Following subject from the side.', technicalTerm: 'lateral tracking shot, side-profile follow, parallel movement' },
  { id: 'rack_focus', name: 'Rack Focus', description: 'Shifting focus between subjects.', technicalTerm: 'rack focus from foreground to background, shallow depth shift' }
];

export const LIGHTING: OptionItem[] = [
  { id: 'golden_hour', name: 'Golden Hour', description: 'Soft sunset warmth.', technicalTerm: 'golden hour, warm sunset lighting, long soft shadows' },
  { id: 'blue_hour', name: 'Blue Hour', description: 'Cool, moody twilight.', technicalTerm: 'blue hour, twilight aesthetic, deep blue sky, soft ambient light' },
  { id: 'rembrandt', name: 'Rembrandt', description: 'Classic painterly portrait light.', technicalTerm: 'Rembrandt lighting, triangular highlight on cheek, dramatic chiaroscuro' },
  { id: 'volumetric', name: 'Volumetric Fog', description: 'God rays through haze.', technicalTerm: 'volumetric lighting, god rays, atmospheric fog, visible light beams' },
  { id: 'neon', name: 'Cyberpunk Neon', description: 'Saturated pinks and blues.', technicalTerm: 'neon cyberpunk lighting, pink and teal highlights, high saturation' },
  { id: 'rim', name: 'Rim Lighting', description: 'Backlit halo effect.', technicalTerm: 'rim lighting, backlit subject, silhouette edges, glowing outlines' },
  { id: 'bioluminescent', name: 'Bioluminescent', description: 'Natural glowing elements.', technicalTerm: 'bioluminescent glow, glowing flora, ethereal blue and green light' },
  { id: 'firelight', name: 'Flickering Fire', description: 'Warm, dancing orange light.', technicalTerm: 'warm firelight, flickering orange shadows, campfire glow' },
  { id: 'moonlight', name: 'Moonlight', description: 'Cool, silver nocturnal light.', technicalTerm: 'moonlight, cool silver lighting, deep shadows, night aesthetic' },
  { id: 'high_key', name: 'High-Key', description: 'Bright, airy, minimal shadows.', technicalTerm: 'high-key lighting, bright even exposure, commercial look' },
  { id: 'low_key', name: 'Noir / Low-Key', description: 'Dramatic, high-contrast shadows.', technicalTerm: 'low-key lighting, film noir aesthetic, harsh shadows, mystery' },
  { id: 'strobe', name: 'Pulse / Strobe', description: 'Rhythmic light flashes.', technicalTerm: 'strobe lighting, rhythmic light pulses, high energy' }
];
