
import React, { useEffect, useRef } from 'react';
import { Map, View } from 'ol';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { OSM } from 'ol/source';
import { fromLonLat } from 'ol/proj';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Vector as VectorSource } from 'ol/source';
import { Style, Icon } from 'ol/style';
import 'ol/ol.css';

interface LiveBusLocationProps {
  latitude: number;
  longitude: number;
  busNumber: string;
  showDriverDot?: boolean;
  guardianLatitude?: number | null;
  guardianLongitude?: number | null;
}

const LiveBusLocation: React.FC<LiveBusLocationProps> = ({ 
  latitude, 
  longitude, 
  busNumber,
  showDriverDot = true,
  guardianLatitude = null,
  guardianLongitude = null,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  
  useEffect(() => {
    if (!mapRef.current) return;

    // Create map if it doesn't exist
    if (!mapInstanceRef.current) {
      const busLocation = fromLonLat([longitude, latitude]);
      
      // Create a vector source to hold our features
      const vectorSource = new VectorSource();
      
      // Add bus marker (driver)
      const busFeature = new Feature({
        geometry: new Point(busLocation),
        name: `Bus ${busNumber}`
      });
      
      // Style the bus feature - show as simple dot for guardian view
      if (showDriverDot) {
        busFeature.setStyle(
          new Style({
            image: new Icon({
              src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="6" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>
                </svg>
              `),
              scale: 1,
              anchor: [0.5, 0.5]
            })
          })
        );
      } else {
        busFeature.setStyle(
          new Style({
            image: new Icon({
              src: '/bus-icon.svg',
              scale: 1.5,
              anchor: [0.5, 0.5]
            })
          })
        );
      }
      
      vectorSource.addFeature(busFeature);

      // Add guardian marker when available
      if (guardianLatitude != null && guardianLongitude != null) {
        const guardianLoc = fromLonLat([guardianLongitude, guardianLatitude]);
        const guardianFeature = new Feature({
          geometry: new Point(guardianLoc),
          name: "You",
        });
        guardianFeature.setStyle(
          new Style({
            image: new Icon({
              src:
                "data:image/svg+xml;charset=utf-8," +
                encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
                    <circle cx="9" cy="9" r="7" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
                  </svg>
                `),
              scale: 1,
              anchor: [0.5, 0.5],
            }),
          }),
        );
        vectorSource.addFeature(guardianFeature);
      }
      
      // Create a vector layer for the markers
      const vectorLayer = new VectorLayer({
        source: vectorSource
      });
      
      // Create the map
      const map = new Map({
        target: mapRef.current,
        layers: [
          new TileLayer({
            source: new OSM()
          }),
          vectorLayer
        ],
        view: new View({
          center: busLocation,
          zoom: 15
        })
      });
      
      mapInstanceRef.current = map;
    } else {
      // Update positions if map already exists
      const busLocation = fromLonLat([longitude, latitude]);
      const view = mapInstanceRef.current.getView();
      
      // Get the vector layer and source
      const layers = mapInstanceRef.current.getLayers().getArray();
      const vectorLayer = layers[1] as VectorLayer<VectorSource>;
      const source = vectorLayer.getSource();
      
      if (source) {
        // Clear existing features
        source.clear();
        
        // Add updated bus feature
        const busFeature = new Feature({
          geometry: new Point(busLocation),
          name: `Bus ${busNumber}`
        });
        
        // Style the bus feature - show as simple dot for guardian view
        if (showDriverDot) {
          busFeature.setStyle(
            new Style({
              image: new Icon({
                src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
                    <circle cx="8" cy="8" r="6" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>
                  </svg>
                `),
                scale: 1,
                anchor: [0.5, 0.5]
              })
            })
          );
        } else {
          busFeature.setStyle(
            new Style({
              image: new Icon({
                src: '/bus-icon.svg',
                scale: 1.5,
                anchor: [0.5, 0.5]
              })
            })
          );
        }
        
        source.addFeature(busFeature);

        if (guardianLatitude != null && guardianLongitude != null) {
          const guardianLoc = fromLonLat([guardianLongitude, guardianLatitude]);
          const guardianFeature = new Feature({
            geometry: new Point(guardianLoc),
            name: "You",
          });
          guardianFeature.setStyle(
            new Style({
              image: new Icon({
                src:
                  "data:image/svg+xml;charset=utf-8," +
                  encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
                      <circle cx="9" cy="9" r="7" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
                    </svg>
                  `),
                scale: 1,
                anchor: [0.5, 0.5],
              }),
            }),
          );
          source.addFeature(guardianFeature);
        }
        
        // Center on bus location
        view.setCenter(busLocation);
        view.setZoom(15);
      }
    }
  }, [latitude, longitude, busNumber, showDriverDot, guardianLatitude, guardianLongitude]);
  
  return (
    <div ref={mapRef} className="w-full h-full min-h-[300px] relative">
      {(!latitude || !longitude) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 z-10">
          <p className="text-gray-500">Loading location data...</p>
        </div>
      )}
    </div>
  );
};

export default LiveBusLocation;
