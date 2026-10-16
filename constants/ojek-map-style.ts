// constants/mapStyle.ts
export const mapStyle = [
    // ---------- Dasar ----------
    { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#7a848b' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },

    // ---------- Administrasi ----------
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#e3e7e9' }] },
    { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.province', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#4a555c' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },

    // ---------- Lanskap ----------
    { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: '#ececec' }] },
    { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#e2e2e2' }] },
    { featureType: 'landscape.natural', elementType: 'geometry.fill', stylers: [{ color: '#f5f5f5' }] },
    { featureType: 'landscape.natural.terrain', stylers: [{ visibility: 'off' }] },

    // ---------- POI: hanya taman & area hijau ----------
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
    { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#cfeacf' }] },
    { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6f9f7a' }] },
    { featureType: 'poi.park', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.sports_complex', stylers: [{ visibility: 'on' }] },
    { featureType: 'poi.sports_complex', elementType: 'geometry.fill', stylers: [{ color: '#d6eed6' }] },
    { featureType: 'poi.sports_complex', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.medical', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.school', elementType: 'labels', stylers: [{ visibility: 'off' }] },

    // ---------- Jalan ----------
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e4e4e4' }, { weight: 1 }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9aa3a9' }] },
    { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { featureType: 'road.local', elementType: 'geometry.stroke', stylers: [{ color: '#efefef' }] },
    { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#aeb6bb' }] },
    { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#dcdcdc' }] },
    { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#8a949a' }] },
    { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#fff6dc' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#f1e1b0' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#8a949a' }] },
    { featureType: 'road.highway.controlled_access', elementType: 'geometry.fill', stylers: [{ color: '#fdeeba' }] },
    { featureType: 'road.highway.controlled_access', elementType: 'geometry.stroke', stylers: [{ color: '#ecd596' }] },

    // ---------- Transit: sembunyikan ----------
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },

    // ---------- Air ----------
    { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#bfe0f4' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#7da6bd' }] },
    { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
];