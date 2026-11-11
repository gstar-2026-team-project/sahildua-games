# Realistic art direction

These two local PNG assets were generated with the built-in image generation tool.
No image service runs during gameplay. Original artwork is retained alongside them.

- `salvage-hardware-realistic.png`: transparent 2 × 2 atlas: tug, station, cargo, asteroid.
- `space-backdrop-realistic.png`: photographic-style planet and sparse star field.

The renderer trims atlas transparency on load, rotates sprites with the simulation,
and adds subdued engine plumes and navigation lamps. These are pre-rendered
2D sprites, rather than runtime 3D models; their fine surface lighting is baked
into the images. Asteroids also receive a directional shading overlay. Their
silhouettes are clipped to the simulation's rock geometry. Physical ship/cargo dimensions,
docking geometry, controls, and simulation remain unchanged.

## Hardware prompt

Use case: stylized-concept. Asset type: production sprite atlas for a top-down space salvage browser game, photorealistic physically based 3D renders with transparent alpha background. Create a 2 by 2 square sprite sheet, four equally sized square cells, each object fully contained within its own cell with generous empty transparent margins and no overlap. Orthographic camera exactly overhead for EVERY object, no isometric perspective. Upper-left cell: ONE rugged compact industrial salvage tug, elongated horizontal silhouette, nose points RIGHT, twin short engine nacelles at LEFT, small dark cockpit glass, off-white weathered ceramic armor, dark gunmetal plumbing, amber identification paint, thermal foil, panel seams and tiny scratches, practical aerospace proportions, no wings, engines OFF, no flames. Upper-right cell: ONE orbital recovery station viewed directly overhead, ring habitat with realistic central sealed mechanical hub, radial docking modules, truss spine and two broad rectangular dark-blue solar-array wings extending LEFT and RIGHT. Lower-left cell: ONE squat rectangular industrial cargo container viewed overhead, long axis horizontal, steel reinforcement corners, burnt ochre faded paint and scuffs, ribs and worn serial markings too small to read. Lower-right cell: ONE irregular grey-brown rocky asteroid viewed overhead, roughly circular silhouette, deeply cratered surface, natural mineral microtexture, rugged fractured terrain. Style: realistic miniature aerospace photography, highly detailed PBR surfaces, crisp physical form, deep ambient occlusion within joints, restrained specular reflections, neutral warm sunlight from upper left with soft cool bounce light in shadows. Absolutely no cartoon outlines, no illustration, no glowing borders, no neon, no shields, no starfield, no floor, no cast shadow outside an object, no text labels or UI, no sheet borders or cell dividers. All four complete isolated objects on genuine transparent background. Detail must read when scaled down for gameplay.

## Background prompt

Use case: photorealistic-natural. Asset type: wide landscape deep-space backdrop for a realistically rendered top-down browser game named Orbital Salvage. Produce a cinematic astronomical space photograph, wide 16:9 framing. A vast realistically banded muted grey-beige gas giant curves into the upper right corner, only partly in frame, with fine pale icy rings sweeping diagonally from upper left to right. Sunlight comes from upper left, an actual curved terminator and deep night side give the planet three dimensional volume, fine atmospheric limb scattering with no exaggerated glow. The rest is mostly clean dark charcoal/navy vacuum, sparse small sharp distant stars of varying faint brightness, a very faint dusty Milky Way haze along the lower left edge. Restrained photographic exposure, rich blacks, believable celestial scale, natural neutral desaturated color, detailed cloud band microstructure, scientific visualization quality, subtle cool illumination. Central and lower-middle seventy percent remain uncluttered very dark space so small ships remain legible. No saturated cyan, violet, or blue nebula painting, no streaks, no lens flare, no bokeh, no illustration. Pure background only: no spacecraft, no station, no asteroids, no ground, no text, no HUD, no reticles, no borders, no watermark.

