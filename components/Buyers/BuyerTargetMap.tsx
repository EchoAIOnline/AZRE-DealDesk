import React, { useEffect, useRef, useState } from 'react';
import { GOOGLE_MAPS_API_KEY } from '../../constants';
import { loadGoogleMapsScript } from '../../services/utils';

interface BuyerTargetMapProps {
    locations: string[];
}

const MAP_ID = 'af9f1e180df0a12509417f9f';

export const BuyerTargetMap: React.FC<BuyerTargetMapProps> = ({ locations }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const shapesRef = useRef<any[]>([]);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const locationsString = JSON.stringify(locations);

    useEffect(() => {
        if ((window as any).google?.maps && (window as any).google.maps.places) {
            setIsMapLoaded(true);
            return;
        }

        // Load the script if it's not already there
        if (!(window as any).google?.maps) {
            loadGoogleMapsScript(GOOGLE_MAPS_API_KEY);
        }
        
        // Poll for google.maps to be available
        const interval = setInterval(() => {
            if ((window as any).google?.maps && (window as any).google.maps.places) {
                clearInterval(interval);
                setIsMapLoaded(true);
            }
        }, 50);
        
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        return () => {
            shapesRef.current.forEach(shape => shape.setMap(null));
            shapesRef.current = [];
        };
    }, []);

    useEffect(() => {
        if (!isMapLoaded || !mapRef.current) return;
        let isCancelled = false;

        const google = (window as any).google;

        // Initialize map if not already initialized
        if (!mapInstanceRef.current) {
            mapInstanceRef.current = new google.maps.Map(mapRef.current, {
                center: { lat: 33.7490, lng: -84.3880 }, // Default to Atlanta
                zoom: 9,
                mapId: MAP_ID,
                disableDefaultUI: true,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
            });
        }

        const map = mapInstanceRef.current;
        const placesService = new google.maps.places.PlacesService(map);

        // Process locations and apply markers/circles
        const processLocations = async () => {
            const bounds = new google.maps.LatLngBounds();
            let hasBounds = false;
            
            // Clear existing circles
            shapesRef.current.forEach(shape => shape.setMap(null));
            shapesRef.current = [];
            
            const parsedLocationsStr = JSON.parse(locationsString);

            // Parse location strings into type and value
            const parsedLocations = parsedLocationsStr.map((loc: string) => {
                const parts = loc.split(':');
                if (parts.length > 1) {
                    return { type: parts[0].trim(), value: parts.slice(1).join(':').trim() };
                }
                return { type: 'Location', value: loc };
            });

            for (const loc of parsedLocations) {
                if (isCancelled) return;
                let query = loc.value;

                if (loc.type === 'Zip Code') {
                    query += ' Zip Code, GA';
                } else if (loc.type === 'City') {
                    query += ', GA'; 
                } else if (loc.type === 'County') {
                    query += ' County, GA';
                } else if (loc.type === 'Neighborhood') {
                    query += ', Atlanta, GA';
                } else {
                    query += ', GA';
                }

                const request = {
                    query: query,
                    fields: ['geometry', 'name'],
                };
                
                await new Promise<void>((resolve) => {
                     placesService.findPlaceFromQuery(request, (results: any[], status: any) => {
                        if (isCancelled) {
                            resolve();
                            return;
                        }
                        if (status === google.maps.places.PlacesServiceStatus.OK && results && results[0]) {
                            const geometry = results[0].geometry;
                            
                            if (geometry && geometry.location) {
                                bounds.extend(geometry.location);
                                hasBounds = true;
                                
                                // Determine radius based on type
                                let radius = 4000; // default 4km
                                if (loc.type === 'Zip Code') radius = 3000;
                                if (loc.type === 'City') radius = 8000;
                                if (loc.type === 'County') radius = 15000;
                                if (loc.type === 'Neighborhood') radius = 1500;
                                
                                // Draw Circle
                                const circle = new google.maps.Circle({
                                    strokeColor: '#3b82f6',
                                    strokeOpacity: 0.8,
                                    strokeWeight: 2,
                                    fillColor: '#3b82f6',
                                    fillOpacity: 0.25,
                                    map: map,
                                    center: geometry.location,
                                    radius: radius,
                                });
                                shapesRef.current.push(circle);
                                
                                // Add a small marker label
                                const marker = new google.maps.Marker({
                                    position: geometry.location,
                                    map: map,
                                    icon: {
                                        path: google.maps.SymbolPath.CIRCLE,
                                        scale: 0
                                    },
                                    label: {
                                        text: loc.value,
                                        color: '#1e3a8a',
                                        fontWeight: 'bold',
                                        fontSize: '11px'
                                    }
                                });
                                shapesRef.current.push(marker);
                            }
                        }
                        resolve();
                    });
                });
            }

            if (hasBounds && !isCancelled) {
                map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
                google.maps.event.addListenerOnce(map, 'idle', () => {
                    if (!isCancelled && map.getZoom() && map.getZoom()! > 13) {
                        map.setZoom(13);
                    }
                });
            }
        };

        processLocations();

        return () => {
            isCancelled = true;
        };

    }, [isMapLoaded, locationsString]);

    return (
        <div 
            ref={mapRef} 
            className="w-full h-full rounded-xl" 
            style={{ isolation: 'isolate', transform: 'translateZ(0)' }}
        />
    );
};
