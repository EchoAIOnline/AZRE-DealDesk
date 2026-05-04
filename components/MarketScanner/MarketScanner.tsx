import React, { useState } from 'react';
import { Search, Filter, Map as MapIcon, Heart, ChevronDown, MoreHorizontal, X } from 'lucide-react';
import { mockDealFinderProperties } from '../../services/mockData';
import { DealFinderProperty } from '../../types';
import { formatCurrency } from '../../services/utils';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Create a custom red dot icon to look like the design
const customMarkerIcon = new L.DivIcon({
  html: `<div class="w-3 h-3 bg-red-600 border border-white dark:border-gray-800 rounded-full shadow-sm"></div>`,
  className: 'custom-marker-icon',
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

// A custom pulsing marker icon
const customActiveMarkerIcon = new L.DivIcon({
  html: `<div class="flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded shadow-sm relative">
           <div class="w-2 h-2 bg-white rounded-full"></div> Available Soon
           <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-red-600"></div>
         </div>`,
  className: 'custom-active-marker-icon',
  iconSize: [110, 24],
  iconAnchor: [55, 24]
});

export const MarketScanner: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('Atlanta GA');
  const [properties, setProperties] = useState<DealFinderProperty[]>(mockDealFinderProperties);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Top Navigation / Filters */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row items-center gap-3 shadow-sm bg-white dark:bg-gray-900 z-10 w-full shrink-0">
        
        {/* Search Input */}
        <div className="relative w-full md:w-72 shrink-0">
          <input 
            type="text" 
            placeholder="Search address, city, or ZIP" 
            className="w-full pl-3 pr-10 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-2 top-1.5 flex items-center gap-1">
             {searchQuery && (
               <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X size={14} />
               </button>
             )}
             <Search size={16} className="text-gray-500 ml-1" />
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-hide shrink-0">
            <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm whitespace-nowrap bg-white dark:bg-gray-800">
                For sale <ChevronDown size={14} />
            </button>
            <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm whitespace-nowrap bg-white dark:bg-gray-800">
                Price <ChevronDown size={14} />
            </button>
            <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm whitespace-nowrap bg-white dark:bg-gray-800">
                Beds & baths <ChevronDown size={14} />
            </button>
            <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm whitespace-nowrap bg-white dark:bg-gray-800">
                Property type <ChevronDown size={14} />
            </button>
            <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm whitespace-nowrap bg-white dark:bg-gray-800">
                More filters <span className="inline-flex items-center justify-center w-4 h-4 ml-1 text-[10px] text-white bg-blue-600 rounded-full">3</span> <ChevronDown size={14} />
            </button>
            <button className="ml-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium whitespace-nowrap transition-colors">
                Save search
            </button>
        </div>

        {/* Home Count */}
        <div className="hidden lg:flex items-center ml-auto shrink-0 pr-2">
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400 mr-2">{properties.length * 25}</span>
            <Heart size={16} className="text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Map Area */}
        <div className="hidden lg:block lg:w-[60%] bg-[#e5eadd] dark:bg-[#1a261c] relative overflow-hidden z-0">
            <MapContainer 
               center={[33.7490, -84.3880]} // Atlanta default
               zoom={11} 
               className="w-full h-full z-0"
               zoomControl={false} // Disable default zoom to use our custom buttons
            >
               <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
               />
               
               {/* Example properties using the custom icons */}
               <Marker position={[33.8, -84.4]} icon={customActiveMarkerIcon}>
                  <Popup>
                     <div className="text-sm font-bold text-gray-900">Available Soon</div>
                     <div className="text-xs text-gray-500">123 Example St, Atlanta, GA</div>
                  </Popup>
               </Marker>
               
               <Marker position={[33.75, -84.35]} icon={customActiveMarkerIcon} />
               <Marker position={[33.7, -84.45]} icon={customActiveMarkerIcon} />

               {/* Random smaller dots */}
               {[...Array(12)].map((_, i) => (
                  <Marker 
                     key={i} 
                     position={[33.7490 + (Math.random() - 0.5) * 0.2, -84.3880 + (Math.random() - 0.5) * 0.2]} 
                     icon={customMarkerIcon} 
                  />
               ))}
               
            </MapContainer>
            
            <div className="absolute top-4 right-4 flex items-center gap-2 z-[400]">
                 <button className="px-3 py-1.5 bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-md text-sm flex items-center gap-1 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                     Schools <ChevronDown size={14} />
                 </button>
                 <button className="px-3 py-1.5 bg-white dark:bg-gray-800 shadow-sm border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-md text-sm flex items-center gap-1 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                     Remove Boundary <X size={14} />
                 </button>
            </div>

            <div className="absolute bottom-8 right-6 flex flex-col gap-2 z-[400]">
                <button className="w-10 h-10 bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition font-bold text-xl text-gray-700 dark:text-gray-300">+</button>
                <div className="flex bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 rounded-full h-10 w-24">
                   <button className="flex-1 flex justify-center items-center font-medium text-sm border-r border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-l-full">Map <ChevronDown size={14} className="ml-1"/></button>
                </div>
                <button className="w-10 h-10 bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition font-bold text-xl text-gray-700 dark:text-gray-300">-</button>
            </div>
        </div>

        {/* Right Property List Area */}
        <div className="w-full lg:w-[40%] bg-white dark:bg-gray-100 p-3 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3 pb-8">
            {properties.concat(properties).map((prop, idx) => (
              <div key={`${prop.id}-${idx}`} className="bg-white dark:bg-white rounded-md overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition">
                
                {/* Image container */}
                <div className="relative h-44 cursor-pointer group">
                  <img src={prop.imageUrl} alt={prop.address} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                  
                  {/* Top left badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                     <span className="bg-white/90 text-gray-800 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                        {idx % 3 === 0 ? "30 days on Zillow" : idx % 2 === 0 ? "Spacious owners suite" : "Cleared vacant lots"}
                     </span>
                  </div>

                  {/* Heart button */}
                  <button className="absolute top-2 right-2 p-1 text-white hover:text-red-500 transition drop-shadow-md">
                     <Heart size={24} className="fill-gray-900/40 stroke-white stroke-2 hover:fill-red-500/80 hover:stroke-white focus:outline-none" />
                  </button>

                  <div className="absolute bottom-2 right-2 flex gap-1">
                      <div className="bg-white/90 text-[9px] px-1 font-bold rounded shadow-sm uppercase">FMLS IDX</div>
                  </div>

                  {/* Image carousel dots indicator */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                      <div className="w-1.5 h-1.5 bg-white/50 rounded-full"></div>
                      <div className="w-1.5 h-1.5 bg-white/50 rounded-full"></div>
                  </div>
                </div>
                
                {/* Details container */}
                <div className="p-3 bg-white dark:bg-white text-gray-900">
                  <div className="flex justify-between items-start mb-0.5">
                    <div className="text-[22px] font-bold tracking-tight">{formatCurrency(prop.listPrice || 225000)}</div>
                    <button className="text-blue-600 hover:text-blue-800 pt-1">
                        <MoreHorizontal size={20} className="font-bold" />
                    </button>
                  </div>
                  
                  <div className="text-[13px] text-gray-700 mb-1 flex items-center flex-wrap">
                    <span className="font-bold mr-1">{prop.beds || 3}</span> <span className="mr-1">bds</span> <span className="text-gray-300 mx-1">|</span>
                    <span className="font-bold mr-1">{prop.baths || 2}</span> <span className="mr-1">ba</span> <span className="text-gray-300 mx-1">|</span>
                    <span className="font-bold mr-1">{prop.sqft?.toLocaleString() || '1,500'}</span> <span className="mr-1">sqft</span> <span className="text-gray-300 mx-1">|</span>
                    <span className="truncate">Active</span>
                  </div>
                  
                  <div className="text-[13px] text-gray-500 truncate mb-2">
                    {prop.address}, {prop.city}, {prop.state} {prop.zip}
                  </div>
                  
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-auto">
                    {idx % 2 === 0 ? 'THE MCGILL CO' : 'KELLER KNAPP'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

