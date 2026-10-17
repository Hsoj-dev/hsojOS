// src/routes/projects/hsojOS/os/apps/weather-utils.ts
// Weather code names, icons, and the "what to wear / bring" tips.

export type IconKind = 'sun' | 'moon' | 'cloud' | 'cloud-sun' | 'rain' | 'snow' | 'storm' | 'fog';

export const ICON_PATHS: Record<IconKind, string[]> = {
	sun: [
		'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
		'M12 2v2', 'M12 20v2', 'm4.93 4.93 1.41 1.41', 'm17.66 17.66 1.41 1.41',
		'M2 12h2', 'M20 12h2', 'm6.34 17.66-1.41 1.41', 'm19.07 4.93-1.41 1.41'
	],
	moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
	cloud: ['M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z'],
	'cloud-sun': [
		'M12 2v2', 'm4.93 4.93 1.41 1.41', 'M20 12h2', 'm19.07 4.93-1.41 1.41',
		'M15.947 12.65a4 4 0 0 0-5.925-4.128',
		'M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z'
	],
	rain: ['M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242', 'M16 14v6', 'M8 14v6', 'M12 16v6'],
	snow: [
		'M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242',
		'M8 15h.01', 'M8 19h.01', 'M12 17h.01', 'M12 21h.01', 'M16 15h.01', 'M16 19h.01'
	],
	storm: ['M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973', 'm13 12-3 5h4l-3 5'],
	fog: ['M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242', 'M16 17H7', 'M17 21H9']
};

/** Name and icon for a WMO weather code (what Open-Meteo returns) */
export function describe(code: number, isDay = true): { label: string; icon: IconKind } {
	if (code === 0) return { label: 'Clear sky', icon: isDay ? 'sun' : 'moon' };
	if (code === 1) return { label: 'Mostly clear', icon: isDay ? 'sun' : 'moon' };
	if (code === 2) return { label: 'Partly cloudy', icon: 'cloud-sun' };
	if (code === 3) return { label: 'Overcast', icon: 'cloud' };
	if (code === 45 || code === 48) return { label: 'Fog', icon: 'fog' };
	if (code >= 51 && code <= 55) return { label: 'Drizzle', icon: 'rain' };
	if (code === 56 || code === 57) return { label: 'Freezing drizzle', icon: 'rain' };
	if (code >= 61 && code <= 65) return { label: 'Rain', icon: 'rain' };
	if (code === 66 || code === 67) return { label: 'Freezing rain', icon: 'rain' };
	if (code >= 71 && code <= 77) return { label: 'Snow', icon: 'snow' };
	if (code >= 80 && code <= 82) return { label: 'Rain showers', icon: 'rain' };
	if (code === 85 || code === 86) return { label: 'Snow showers', icon: 'snow' };
	if (code >= 95) return { label: 'Thunderstorm', icon: 'storm' };
	return { label: 'Unknown', icon: 'cloud' };
}

export type Conditions = {
	/** All temperatures in Celsius */
	tempC: number;
	feelsLikeC: number;
	maxC: number;
	humidity: number;
	windKmh: number;
	code: number;
	/** Chance of rain today, 0 to 100 */
	rainChance: number;
	uvMax: number;
};

export type Tip = { kind: 'Wear' | 'Bring' | 'Heads up'; text: string };

export function tips(c: Conditions): Tip[] {
	const out: Tip[] = [];
	const feels = Math.round(c.feelsLikeC);

	// What to wear
	if (feels >= 33) out.push({ kind: 'Wear', text: 'Light, loose, breathable clothes.' });
	else if (feels >= 28) out.push({ kind: 'Wear', text: 'A T-shirt and shorts or a light dress.' });
	else if (feels >= 23) out.push({ kind: 'Wear', text: 'A light top. A thin layer helps indoors with air conditioning.' });
	else if (feels >= 17) out.push({ kind: 'Wear', text: 'Long sleeves or a light jacket.' });
	else if (feels >= 10) out.push({ kind: 'Wear', text: 'A warm jacket or a sweater.' });
	else if (feels >= 0) out.push({ kind: 'Wear', text: 'A heavy coat, a scarf, and gloves.' });
	else out.push({ kind: 'Wear', text: 'Thermal layers, a heavy coat, a hat, and gloves.' });

	const thunder = c.code >= 95;
	const snowy = (c.code >= 71 && c.code <= 77) || c.code === 85 || c.code === 86;
	const icy = c.code === 56 || c.code === 57 || c.code === 66 || c.code === 67;
	const rainy = (c.code >= 51 && c.code <= 67) || (c.code >= 80 && c.code <= 82);

	// What to bring
	if (rainy || c.rainChance >= 60) out.push({ kind: 'Bring', text: 'An umbrella or a raincoat.' });
	else if (c.rainChance >= 30) out.push({ kind: 'Bring', text: 'A compact umbrella, just in case.' });

	if (c.uvMax >= 8) out.push({ kind: 'Bring', text: 'Sunscreen, sunglasses, and a hat. Avoid the midday sun.' });
	else if (c.uvMax >= 6) out.push({ kind: 'Bring', text: 'Sunscreen and sunglasses.' });
	else if (c.uvMax >= 3) out.push({ kind: 'Bring', text: 'Sunscreen if you will be out for long.' });

	if (feels >= 30 || c.maxC >= 33) out.push({ kind: 'Bring', text: 'A water bottle. Stay hydrated.' });
	if (snowy) out.push({ kind: 'Bring', text: 'Waterproof boots. Paths may be slippery.' });
	if (c.windKmh >= 25 && c.windKmh < 40) out.push({ kind: 'Bring', text: 'A windbreaker. It is breezy out.' });

	// Heads up
	if (thunder) out.push({ kind: 'Heads up', text: 'Thunderstorms. Stay indoors if you can.' });
	if (icy) out.push({ kind: 'Heads up', text: 'Icy conditions. Wear shoes with good grip.' });
	if (c.windKmh >= 40) out.push({ kind: 'Heads up', text: 'Strong wind. Secure loose items.' });
	if (c.code === 45 || c.code === 48) out.push({ kind: 'Heads up', text: 'Fog. Visibility is low, so take extra care on the road.' });
	if (c.humidity >= 80 && c.tempC >= 26) out.push({ kind: 'Heads up', text: 'Very humid. Moisture-wicking fabrics feel better.' });

	return out;
}