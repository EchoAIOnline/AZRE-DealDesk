import re

with open("components/DFDScouter/DFDScouterMap.tsx", "r") as f:
    content = f.read()

orig_code = """    const locateUser = () => {
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
    };"""

new_code = """    const locateUser = () => {
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
                (error) => {
                    console.warn("Geolocation error:", error.message);
                    alert("Unable to detect location. Please ensure location permissions are granted.");
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            alert("Geolocation is not supported by your browser.");
        }
    };"""

content = content.replace(orig_code, new_code)

with open("components/DFDScouter/DFDScouterMap.tsx", "w") as f:
    f.write(content)
