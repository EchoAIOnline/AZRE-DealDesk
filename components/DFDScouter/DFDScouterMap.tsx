import React, { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap, useMapsLibrary, ControlPosition, MapControl } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_API_KEY } from '../../constants';
import { PageNavBar } from '../Shared/PageNavBar';
import { Deal } from '../../types';
import { Layout, Locate } from 'lucide-react';

interface DFDScouterMapProps {
    handleAddDeal: (overrides?: Partial<Deal>) => void;
    globalSearchQuery?: string;
}

export const DFDScouterMap: React.FC<DFDScouterMapProps> = ({ handleAddDeal }) => {
    const [search, setSearch] = useState('');

    return (
        <div className="w-full h-full flex flex-col">
            <PageNavBar 
                title="DFD Scouter" 
                icon={<Layout/>}
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search map..."
                actionLabel="Add Deal"
                onAction={() => handleAddDeal()} 
            />
            <div className="flex-1 w-full relative">
                <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
                    <DFDMapContent handleAddDeal={handleAddDeal} />
                </APIProvider>
            </div>
        </div>
    );
};

const DFDMapContent = ({ handleAddDeal }: { handleAddDeal: (overrides?: Partial<Deal>) => void }) => {
    const map = useMap();
    const geocodingLib = useMapsLibrary('geocoding');
    const [userLocation, setUserLocation] = useState({ lat: 33.7490, lng: -84.3880 }); // Atlanta default
    const [clickedLocation, setClickedLocation] = useState<google.maps.LatLngLiteral | null>(null);
    const [selectedAddress, setSelectedAddress] = useState('');
    const [hasLocated, setHasLocated] = useState(false);

    const locateUser = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const pos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    setUserLocation(pos);
                    setHasLocated(true);
                    if (map) {
                        map.panTo(pos);
                        map.setZoom(15);
                    }
                },
                () => {
                    console.warn("Geolocation denied or unavailable.");
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        }
    };

    useEffect(() => {
        locateUser();
    }, [map]);

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

    const handleAddToPipeline = (type: string) => {
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
                    <AdvancedMarker position={userLocation} title="Your Location">
                        <Pin background="#4285F4" glyphColor="#fff" borderColor="#1967d2" />
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
                                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition"
                                >
                                    Add to Off-Market Pipeline
                                </button>
                                <button 
                                    onClick={() => handleAddToPipeline('mls')}
                                    className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition"
                                >
                                    Add to MLS Pipeline
                                </button>
                            </div>
                        </div>
                    </InfoWindow>
                )}
            </Map>
            
            <MapControl position={ControlPosition.RIGHT_BOTTOM}>
                <div className="m-4">
                    <button 
                        onClick={locateUser}
                        className="bg-white text-gray-700 p-3 rounded-full shadow-lg hover:bg-gray-50 transition-colors"
                        title="Locate Me"
                    >
                        <Locate size={20} />
                    </button>
                </div>
            </MapControl>
        </>
    );
};
