import subprocess
import json
import os
import random
import math

# Bounding box for BKC
bbox = "(19.052,72.852,19.072,72.880)"

# Query 1: Buildings
query_buildings = f'[out:json][timeout:30];(way["building"]{bbox};);out geom;'

# Query 2: Greenery (Parks, Grass, Forests, Trees)
query_greenery = f'[out:json][timeout:30];(way["leisure"="park"]{bbox};way["landuse"="grass"]{bbox};way["natural"="wood"]{bbox};node["natural"="tree"]{bbox};);out geom;'

# Query 3: Water Bodies (Mithi River, local streams)
query_water = f'[out:json][timeout:30];(way["natural"="water"]{bbox};way["waterway"]{bbox};relation["natural"="water"]{bbox};);out geom;'

def run_overpass_query(query):
    cmd = [
        'curl.exe', '-A', 'BKCDigitalTwinSim/2.0',
        '--get', '--data-urlencode', f'data={query}',
        'https://overpass.openstreetmap.fr/api/interpreter'
    ]
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, stderr = process.communicate()
    if process.returncode != 0:
        raise Exception(f"Curl failed: {stderr.decode('utf-8', errors='ignore')}")
    return json.loads(stdout.decode('utf-8', errors='ignore'))

# Helper to create a small hexagon polygon around a point for 3D extrusion
def make_point_hexagon(lon, lat, radius_meters=1.5):
    lat_offset = radius_meters / 111320.0
    lon_offset = radius_meters / (40075000.0 * math.cos(math.radians(lat)) / 360.0)
    coords = []
    for i in range(6):
        angle = i * math.pi / 3
        coords.append([
            lon + math.cos(angle) * lon_offset,
            lat + math.sin(angle) * lat_offset
        ])
    coords.append(coords[0])
    return coords

print("Fetching BKC OSM Building data...")
try:
    buildings_data = run_overpass_query(query_buildings)
    buildings_geojson = {"type": "FeatureCollection", "features": []}
    for element in buildings_data.get('elements', []):
        if element.get('type') == 'way' and 'geometry' in element:
            coords = [[pt['lon'], pt['lat']] for pt in element['geometry']]
            if coords and coords[0] != coords[-1]:
                coords.append(coords[0])
            tags = element.get('tags', {})
            name = tags.get('name', 'BKC Office Block')
            
            height = tags.get('height')
            levels = tags.get('building:levels')
            if height:
                try:
                    height_val = float(height.replace('m', '').strip())
                except ValueError:
                    height_val = 15.0
            elif levels:
                try:
                    height_val = float(int(levels) * 3.5)
                except ValueError:
                    height_val = 15.0
            else:
                height_val = 15.0
                
            if height_val == 15.0:
                height_val = float(random.choice([15.0, 25.0, 35.0, 50.0, 70.0]))

            feature = {
                "type": "Feature",
                "properties": {
                    "id": element.get('id'),
                    "name": name,
                    "height": height_val,
                    "min_height": 0.0,
                    "building": tags.get('building', 'yes')
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [coords]
                }
            }
            buildings_geojson['features'].append(feature)
            
    b_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'bkc_buildings.geojson')
    with open(b_path, 'w', encoding='utf-8') as f:
        json.dump(buildings_geojson, f, indent=2)
    print(f"Saved {len(buildings_geojson['features'])} buildings to {b_path}")
except Exception as e:
    print(f"Error fetching buildings: {e}")

print("Fetching BKC OSM Greenery data...")
try:
    greenery_data = run_overpass_query(query_greenery)
    greenery_geojson = {"type": "FeatureCollection", "features": []}
    for element in greenery_data.get('elements', []):
        tags = element.get('tags', {})
        feature_type = 'park'
        if 'landuse' in tags and tags['landuse'] == 'grass':
            feature_type = 'grass'
        elif 'natural' in tags and tags['natural'] == 'wood':
            feature_type = 'wood'
            
        if element.get('type') == 'way' and 'geometry' in element:
            coords = [[pt['lon'], pt['lat']] for pt in element['geometry']]
            if coords and coords[0] != coords[-1]:
                coords.append(coords[0])
            feature = {
                "type": "Feature",
                "properties": {
                    "id": element.get('id'),
                    "name": tags.get('name', 'Green Zone'),
                    "type": feature_type,
                    "is_3d": False,
                    "height": 0
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [coords]
                }
            }
            greenery_geojson['features'].append(feature)
        elif element.get('type') == 'node' and 'lon' in element and 'lat' in element:
            lon = element['lon']
            lat = element['lat']
            hex_coords = make_point_hexagon(lon, lat, radius_meters=1.5)
            feature = {
                "type": "Feature",
                "properties": {
                    "id": element.get('id'),
                    "name": "Tree Canopy",
                    "type": "tree",
                    "is_3d": True,
                    "height": float(random.choice([6.0, 8.0, 10.0]))
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [hex_coords]
                }
            }
            greenery_geojson['features'].append(feature)
            
    g_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'bkc_greenery.geojson')
    with open(g_path, 'w', encoding='utf-8') as f:
        json.dump(greenery_geojson, f, indent=2)
    print(f"Saved {len(greenery_geojson['features'])} greenery features to {g_path}")
except Exception as e:
    print(f"Error fetching greenery: {e}")

print("Fetching BKC OSM Water data...")
try:
    water_data = run_overpass_query(query_water)
    water_geojson = {"type": "FeatureCollection", "features": []}
    for element in water_data.get('elements', []):
        tags = element.get('tags', {})
        # Overpass returns ways or relations for water bodies
        if element.get('type') in ['way', 'relation'] and 'geometry' in element:
            coords = [[pt['lon'], pt['lat']] for pt in element['geometry']]
            if coords and coords[0] != coords[-1]:
                coords.append(coords[0])
            feature = {
                "type": "Feature",
                "properties": {
                    "id": element.get('id'),
                    "name": tags.get('name', 'Mithi River'),
                    "type": "water"
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [coords]
                }
            }
            water_geojson['features'].append(feature)
            
    w_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'bkc_water.geojson')
    with open(w_path, 'w', encoding='utf-8') as f:
        json.dump(water_geojson, f, indent=2)
    print(f"Saved {len(water_geojson['features'])} water features to {w_path}")
except Exception as e:
    print(f"Error fetching water: {e}")
