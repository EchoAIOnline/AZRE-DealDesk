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

    // Fallback handler when browser geolocation fails or is denied
    const fallbackToAtlanta = (reason?: string) => {
        const atlantaPos = { lat: 33.7490, lng: -84.3880 };
        setUserLocation(atlantaPos);
        setHasLocated(true);
        setLocationMethod('default');
        setStatusMessage(reason || 'Set to default market: Atlanta, GA');
        if (map) {
            map.panTo(atlantaPos);
            map.setZoom(13);
        }
        setTimeout(() => setStatusMessage(null), 5000);
    };

    const locateUser = useCallback(() => {
        setIsLocating(true);
        setStatusMessage('Detecting current location...');

        if (!navigator.geolocation) {
            fallbackToAtlanta('Browser geolocation unavailable. Defaulted to Atlanta, GA');
            setIsLocating(false);
            return;
        }

        const options = { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 };

        navigator.geolocation.getCurrentPosition(
            (position) => {
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
            },
            (error) => {
                console.warn('Geolocation failed or permission denied:', error.message);
                fallbackToAtlanta('GPS permission denied or unavailable. Centered on Atlanta, GA');
                setIsLocating(false);
            },
            options
        );
    }, [map]);

    useEffect(() => {
        locateUser();
    }, [locateUser]);

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

            {/* Quick Market Presets Bar */}
            <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-1.5 rounded-xl shadow-md border border-gray-200/80 dark:border-gray-700/80 text-xs font-medium">
                <span className="px-2 text-gray-500 dark:text-gray-400 font-semibold flex items-center gap-1">
                    <MapPin size={12} className="text-blue-500" />
                    Markets:
                </span>
                <button
                    type="button"
                    onClick={() => {
                        const pos = { lat: 33.7490, lng: -84.3880 };
                        setUserLocation(pos);
                        setHasLocated(true);
                        setLocationMethod('default');
                        setStatusMessage('Centered on Atlanta, GA');
                        setTimeout(() => setStatusMessage(null), 3000);
                        if (map) {
                            map.panTo(pos);
                            map.setZoom(13);
                        }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 font-semibold transition-colors flex items-center gap-1"
                >
                    📍 Atlanta, GA
                </button>
                <button
                    type="button"
                    onClick={() => {
                        const pos = { lat: 33.4484, lng: -112.0740 };
                        setUserLocation(pos);
                        setHasLocated(true);
                        setLocationMethod('default');
                        setStatusMessage('Centered on Phoenix, AZ');
                        setTimeout(() => setStatusMessage(null), 3000);
                        if (map) {
                            map.panTo(pos);
                            map.setZoom(13);
                        }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                >
                    Phoenix, AZ
                </button>
                <button
                    type="button"
                    onClick={() => {
                        const pos = { lat: 32.7767, lng: -96.7970 };
                        setUserLocation(pos);
                        setHasLocated(true);
                        setLocationMethod('default');
                        setStatusMessage('Centered on Dallas, TX');
                        setTimeout(() => setStatusMessage(null), 3000);
                        if (map) {
                            map.panTo(pos);
                            map.setZoom(13);
                        }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                >
                    Dallas, TX
                </button>
                <button
                    type="button"
                    onClick={() => {
                        const pos = { lat: 27.9506, lng: -82.4572 };
                        setUserLocation(pos);
                        setHasLocated(true);
                        setLocationMethod('default');
                        setStatusMessage('Centered on Tampa, FL');
                        setTimeout(() => setStatusMessage(null), 3000);
                        if (map) {
                            map.panTo(pos);
                            map.setZoom(13);
                        }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                >
                    Tampa, FL
                </button>
            </div>

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

