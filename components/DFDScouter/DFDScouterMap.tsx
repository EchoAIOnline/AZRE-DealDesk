import React, { useState, useEffect, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap, useMapsLibrary, ControlPosition, MapControl } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_API_KEY } from '../../constants';
import { PageNavBar } from '../Shared/PageNavBar';
import { Deal } from '../../types';
import { Layout, Locate, Loader2, Navigation, AlertCircle, Search, MapPin } from 'lucide-react';

interface DFDScouterMapProps {
    handleAddDeal: (overrides?: Partial<Deal>) => void;
    globalSearchQuery?: string;
}

export const DFDScouterMap: React.FC<DFDScouterMapProps> = ({ handleAddDeal }) => {
    const [search, setSearch] = useState('');
    const [triggerSearch, setTriggerSearch] = useState<string | null>(null);

    const handleSearchSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (search.trim()) {
            setTriggerSearch(search.trim());
        }
    };

    return (
        <div className="w-full h-full flex flex-col">
            <form onSubmit={handleSearchSubmit} className="w-full">
                <PageNavBar 
                    title="DFD Scouter" 
                    icon={<Layout/>}
                    searchValue={search}
                    onSearchChange={setSearch}
                    searchPlaceholder="Search address or city on map..."
                    actionLabel="Add Deal"
                    onAction={() => handleAddDeal()} 
                />
            </form>
            <div className="flex-1 w-full relative">
                <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
                    <DFDMapContent 
                        handleAddDeal={handleAddDeal} 
                        searchQuery={triggerSearch}
                        onSearchHandled={() => setTriggerSearch(null)}
                    />
                </APIProvider>
            </div>
        </div>
    );
};

interface DFDMapContentProps {
    handleAddDeal: (overrides?: Partial<Deal>) => void;
    searchQuery: string | null;
    onSearchHandled: () => void;
}

const DFDMapContent = ({ handleAddDeal, searchQuery, onSearchHandled }: DFDMapContentProps) => {
    const map = useMap();
    const geocodingLib = useMapsLibrary('geocoding');
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>({ lat: 33.7490, lng: -84.3880 }); // Atlanta default
    const [clickedLocation, setClickedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedAddress, setSelectedAddress] = useState('');
    const [hasLocated, setHasLocated] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [locationMethod, setLocationMethod] = useState<'gps' | 'ip' | 'default' | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [showGpsHelp, setShowGpsHelp] = useState(false);
    const [showLocationPrompt, setShowLocationPrompt] = useState(() => {
        return localStorage.getItem('dfd_location_prompt_seen') !== 'true';
    });
    const [customZipInput, setCustomZipInput] = useState('');

    // Fallback handler when browser geolocation fails or is denied
    const fallbackToAtlanta = (reason?: string) => {
        const savedLoc = localStorage.getItem('dfd_home_location');
        let initialPos = { lat: 33.7490, lng: -84.3880 }; // Atlanta GA
        let locName = 'Atlanta, GA';
        if (savedLoc) {
            try {
                const parsed = JSON.parse(savedLoc);
                if (parsed.lat && parsed.lng) {
                    initialPos = { lat: parsed.lat, lng: parsed.lng };
                    if (parsed.name) locName = parsed.name;
                }
            } catch (e) {
                console.warn('Failed to parse saved location');
            }
        }
        setUserLocation(initialPos);
        setHasLocated(true);
        setLocationMethod('default');
        setStatusMessage(reason || `Centered on ${locName}`);
        if (map) {
            map.panTo(initialPos);
            map.setZoom(13);
        }
        setTimeout(() => setStatusMessage(null), 6000);
    };

    const locateUser = useCallback(() => {
        setIsLocating(true);
        setStatusMessage('Detecting current location...');

        if (!navigator.geolocation) {
            fallbackToAtlanta('Browser geolocation unavailable. Defaulted to Atlanta, GA');
            setIsLocating(false);
            return;
        }

        const handleSuccess = (position: GeolocationPosition) => {
            const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            setUserLocation(pos);
            setHasLocated(true);
            setLocationMethod('gps');
            setIsLocating(false);
            setStatusMessage('GPS Location detected!');
            setTimeout(() => setStatusMessage(null), 4000);

            if (map) {
                map.panTo(pos);
                map.setZoom(15);
            }
        };

        // Primary attempt: high accuracy with 10s timeout
        navigator.geolocation.getCurrentPosition(
            handleSuccess,
            (primaryError) => {
                console.warn('High accuracy geolocation attempt failed, trying low accuracy fallback:', primaryError);
                // Fallback attempt: low accuracy with 15s timeout and 1 minute cache
                navigator.geolocation.getCurrentPosition(
                    handleSuccess,
                    (fallbackError) => {
                        console.warn('Geolocation fallback failed:', fallbackError);
                        fallbackToAtlanta('GPS permission denied or unavailable. Centered on Atlanta, GA');
                        setIsLocating(false);
                    },
                    {
                        enableHighAccuracy: false,
                        timeout: 15000,
                        maximumAge: 60000
                    }
                );
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            }
        );
    }, [map]);

    // Handle search query from PageNavBar
    useEffect(() => {
        if (searchQuery && geocodingLib) {
            const geocoder = new geocodingLib.Geocoder();
            geocoder.geocode({ address: searchQuery }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                    const loc = results[0].geometry.location;
                    const latLng = { lat: loc.lat(), lng: loc.lng() };
                    if (map) {
                        map.panTo(latLng);
                        map.setZoom(16);
                    }
                    setClickedLocation(latLng);
                    setSelectedAddress(results[0].formatted_address);
                } else {
                    setStatusMessage(`No results found for "${searchQuery}"`);
                    setTimeout(() => setStatusMessage(null), 4000);
                }
                onSearchHandled();
            });
        }
    }, [searchQuery, geocodingLib, map, onSearchHandled]);

    const handleMapClick = async (e: any) => {
        if (!e.detail || !e.detail.latLng) return;
        const latLng = e.detail.latLng;
        setClickedLocation(latLng);
        
        if (geocodingLib) {
            const geocoder = new geocodingLib.Geocoder();
            try {
                const response = await geocoder.geocode({ location: latLng });
                if (response.results && response.results[0]) {
                    setSelectedAddress(response.results[0].formatted_address);
                } else {
                    setSelectedAddress('Unknown Address');
                }
            } catch (error) {
                console.error("Geocoding failed", error);
                setSelectedAddress('Unknown Address');
            }
        }
    };

    const handleAddToPipeline = (type: 'mls' | 'off-market' | 'dfd') => {
        handleAddDeal({ address: selectedAddress, pipelineType: type });
        setClickedLocation(null);
        setSelectedAddress('');
    };

    return (
        <>
            <Map
                defaultCenter={userLocation}
                defaultZoom={12}
                mapId="DFD_SCOUTER_MAP"
                onClick={handleMapClick}
                options={{ mapTypeControl: true, streetViewControl: true }}
                style={{ width: '100%', height: '100%' }}
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            >
                {hasLocated && (
                    <AdvancedMarker position={userLocation} title={locationMethod === 'gps' ? "Your GPS Location" : "Approximate Location"}>
                        <Pin 
                            background={locationMethod === 'gps' ? "#4285F4" : "#EA4335"} 
                            glyphColor="#fff" 
                            borderColor="#1967d2" 
                        />
                    </AdvancedMarker>
                )}

                {clickedLocation && (
                    <InfoWindow position={clickedLocation} onCloseClick={() => setClickedLocation(null)}>
                        <div className="p-4 bg-white dark:bg-gray-800 rounded shadow text-gray-900 dark:text-white max-w-sm">
                            <h3 className="font-bold text-lg mb-2">Selected Property</h3>
                            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">{selectedAddress}</p>
                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={() => handleAddToPipeline('off-market')}
                                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition"
                                >
                                    Add to Off-Market Pipeline
                                </button>
                                <button 
                                    onClick={() => handleAddToPipeline('mls')}
                                    className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 transition"
                                >
                                    Add to MLS Pipeline
                                </button>
                            </div>
                        </div>
                    </InfoWindow>
                )}
            </Map>

            {/* Location Prompt Modal */}
            {showLocationPrompt && (
                <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-fadeIn">
                        <div className="flex justify-center mb-4">
                            <div className="bg-blue-100 dark:bg-blue-900/50 p-4 rounded-full text-blue-600 dark:text-blue-400">
                                <MapPin size={32} />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">
                            Enable Location Services
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 text-center">
                            DealDesk needs your location to center the map on your local real estate market. 
                            By allowing GPS access, you can quickly find properties near you.
                        </p>
                        
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    localStorage.setItem('dfd_location_prompt_seen', 'true');
                                    setShowLocationPrompt(false);
                                    locateUser();
                                }}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-500/30 flex justify-center items-center gap-2"
                            >
                                <Locate size={18} />
                                Allow Location Access
                            </button>
                            <button
                                onClick={() => {
                                    localStorage.setItem('dfd_location_prompt_seen', 'true');
                                    setShowLocationPrompt(false);
                                    fallbackToAtlanta('Set to default market');
                                }}
                                className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                            >
                                Skip for Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* GPS Instructions Modal */}
            {showGpsHelp && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-fadeIn">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <Navigation className="text-blue-500" size={20} />
                            Enabling GPS Location Permissions
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
                            When hosted on Vercel or in an embedded browser/iframe, browser security requires explicit site location permission.
                        </p>
                        
                        <div className="space-y-3 text-xs text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/50 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700/80">
                            <div className="flex items-start gap-2.5">
                                <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]">1</span>
                                <div>
                                    <strong>Click the Lock/Tune Icon:</strong> Next to the URL in your browser address bar (top left of screen).
                                </div>
                            </div>
                            <div className="flex items-start gap-2.5">
                                <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]">2</span>
                                <div>
                                    <strong>Allow Location:</strong> Toggle <em>Location</em> or <em>Permissions</em> from <strong>Block</strong> to <strong>Allow</strong>.
                                </div>
                            </div>
                            <div className="flex items-start gap-2.5">
                                <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]">3</span>
                                <div>
                                    <strong>Refresh the Page:</strong> Reload the app tab and click the blue <strong>Locate</strong> button again!
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 flex gap-2 justify-end">
                            <button
                                onClick={() => setShowGpsHelp(false)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition"
                            >
                                Got It
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Toast Banner */}
            {statusMessage && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-gray-900/90 text-white text-xs px-4 py-2 rounded-full shadow-lg backdrop-blur flex items-center gap-2 border border-gray-700 animate-fadeIn">
                    {isLocating ? <Loader2 size={14} className="animate-spin text-blue-400" /> : <Navigation size={14} className="text-green-400" />}
                    <span>{statusMessage}</span>
                </div>
            )}
            
            {/* Custom Map Controls */}
            <MapControl position={ControlPosition.RIGHT_BOTTOM}>
                <div className="m-4 flex flex-col gap-2">
                    <button 
                        onClick={locateUser}
                        disabled={isLocating}
                        className={`p-3 rounded-full shadow-lg transition-all flex items-center justify-center ${
                            isLocating 
                                ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 cursor-wait' 
                                : hasLocated 
                                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                    : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                        }`}
                        title="Locate Current Location"
                    >
                        {isLocating ? (
                            <Loader2 size={20} className="animate-spin" />
                        ) : (
                            <Locate size={20} />
                        )}
                    </button>
                </div>
            </MapControl>
        </>
    );
};

