// src/routes/projects/hsojOS/os/location.svelte.ts
// The user's place, shared by Weather and News. Saved in localStorage so we only ask once.
const KEY = 'hsojos:location';

export type Place = { lat: number; lon: number; name: string; countryCode: string | null };
export type GeoStatus = 'idle' | 'locating' | 'denied' | 'unavailable';

/**
 * Turn coordinates into a place name using BigDataCloud's free client-side API.
 * Its terms say to call it from the browser with the device's CURRENT position (which is
 * exactly when we call it). It can fail on localhost, so callers must cope with null.
 */
async function reverseGeocode(lat: number, lon: number) {
	try {
		const res = await fetch(
			`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
		);
		if (!res.ok) return null;
		const d = await res.json();
		const town = d.city || d.locality || d.principalSubdivision || '';
		const name = [town, d.countryName].filter(Boolean).join(', ');
		return { name: name || null, countryCode: (d.countryCode as string | undefined) ?? null };
	} catch {
		return null;
	}
}

/** Search for a city by name with Open-Meteo's geocoding API */
export async function searchPlaces(query: string): Promise<Place[]> {
	try {
		const res = await fetch(
			`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
		);
		if (!res.ok) return [];
		const data = await res.json();
		return (data.results ?? []).map(
			(r: { name: string; admin1?: string; country?: string; country_code?: string; latitude: number; longitude: number }) => ({
				lat: r.latitude,
				lon: r.longitude,
				name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
				countryCode: r.country_code?.toUpperCase() ?? null
			})
		);
	} catch {
		return [];
	}
}

class LocationStore {
	place = $state<Place | null>(null);
	status = $state<GeoStatus>('idle');

	/** Country for "local" features: the saved place, else the browser's language region (en-PH gives PH) */
	get countryCode(): string | null {
		if (this.place?.countryCode) return this.place.countryCode;
		try {
			return new Intl.Locale(navigator.language).region ?? null;
		} catch {
			return null;
		}
	}

	/** Restore the saved place. Safe to call repeatedly. Call from onMount. */
	load() {
		if (this.place) return;
		try {
			const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
			if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon) && typeof saved.name === 'string') {
				this.place = { lat: saved.lat, lon: saved.lon, name: saved.name, countryCode: saved.countryCode ?? null };
			}
		} catch {
			/* ignore */
		}
	}

	set(place: Place) {
		this.place = place;
		try {
			localStorage.setItem(KEY, JSON.stringify(place));
		} catch {
			/* ignore */
		}
	}

	/** Ask the browser for the current position. Returns true if we got one. */
	async locate(): Promise<boolean> {
		if (!('geolocation' in navigator)) {
			this.status = 'unavailable';
			return false;
		}
		this.status = 'locating';
		try {
			const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
				navigator.geolocation.getCurrentPosition(resolve, reject, {
					timeout: 10_000,
					maximumAge: 10 * 60_000
				})
			);
			// Two decimals is about 1 km, plenty for weather and kinder to privacy
			const lat = Math.round(pos.coords.latitude * 100) / 100;
			const lon = Math.round(pos.coords.longitude * 100) / 100;
			const info = await reverseGeocode(lat, lon);
			this.set({ lat, lon, name: info?.name ?? 'Your location', countryCode: info?.countryCode ?? null });
			this.status = 'idle';
			return true;
		} catch (e) {
			const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code: number }).code : 0;
			this.status = code === 1 ? 'denied' : 'unavailable';
			return false;
		}
	}
}

export const loc = new LocationStore();