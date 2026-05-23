import math
import osmnx as ox
import networkx as nx
from functools import lru_cache

# =========================================================
# LOAD & CACHE ROAD GRAPH
# =========================================================

import os

GRAPH = None
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GRAPH_PATH = os.path.join(BASE_DIR, "danang.graphml")

try:
    if os.path.exists(GRAPH_PATH):
        print(f"Đang load graph từ: {GRAPH_PATH}...")
        GRAPH = ox.load_graphml(GRAPH_PATH)
        print("✅ Graph loaded successfully!")
    else:
        print(f"❌ ERROR: Không tìm thấy file tại {GRAPH_PATH}")

except Exception as e:
    print("GRAPH LOAD ERROR:", str(e))


# =========================================================
# DISTANCE FUNCTION
# =========================================================

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Tính khoảng cách giữa 2 điểm GPS (mét)
    """

    R = 6371000

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)

    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1)
        * math.cos(phi2)
        * math.sin(dlambda / 2) ** 2
    )

    return 2 * R * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a)
    )


# =========================================================
# DANGER PENALTY
# =========================================================

def calculate_hazard_penalty(lat, lng, hazards):
    """
    Tính penalty cho vùng nguy hiểm.

    hazards = [
        {
            "lat": 16.07,
            "lng": 108.22,
            "radius": 200,
            "severity": 3
        }
    ]
    """

    total_penalty = 0

    for hazard in hazards:

        distance = haversine_distance(
            lat,
            lng,
            hazard["lat"],
            hazard["lng"]
        )

        radius = hazard.get("radius", 100)
        severity = hazard.get("severity", 1)

        # Trong vùng nguy hiểm
        if distance <= radius:

            total_penalty += 5000 * severity

        # Gần vùng nguy hiểm
        elif distance <= radius * 2:

            total_penalty += 1000 * severity

    return total_penalty


# =========================================================
# CUSTOM EDGE WEIGHT
# =========================================================

def edge_weight_with_hazard(u, v, edge_data, graph, hazards):
    """
    Weight dùng cho A*
    """

    base_distance = edge_data.get("length", 1)

    node_u = graph.nodes[u]
    node_v = graph.nodes[v]

    # midpoint của edge
    mid_lat = (node_u["y"] + node_v["y"]) / 2
    mid_lng = (node_u["x"] + node_v["x"]) / 2

    danger_penalty = calculate_hazard_penalty(
        mid_lat,
        mid_lng,
        hazards
    )

    return base_distance + danger_penalty


# =========================================================
# MAIN A* ROUTING FUNCTION
# =========================================================

def get_rescue_route(
    start_coords,
    target_coords,
    hazards=None
):
    """

    Return:
    {
        "path": [...],
        "distance_meters": ...,
        "eta_seconds": ...
    }
    """

    if GRAPH is None:
        return {
            "status": "error",
            "message": "Graph not loaded"
        }

    if hazards is None:
        hazards = []

    try:

        # =================================================
        # LOAD GRAPH
        # =================================================

        

        start_lat, start_lng = start_coords
        end_lat, end_lng = target_coords

        print("Đang tìm node gần nhất...")

        # =================================================
        # FIND NEAREST ROAD NODES
        # =================================================

        origin_node = ox.distance.nearest_nodes(
            GRAPH,
            start_lng,
            start_lat
        )

        destination_node = ox.distance.nearest_nodes(
            GRAPH,
            end_lng,
            end_lat
        )

        print("Đang chạy thuật toán A*...")

        # =================================================
        # RUN A*
        # =================================================

        route = nx.astar_path(

            GRAPH,

            origin_node,

            destination_node,

            heuristic=lambda a, b: haversine_distance(
                GRAPH.nodes[a]["y"],
                GRAPH.nodes[a]["x"],
                GRAPH.nodes[b]["y"],
                GRAPH.nodes[b]["x"]
            ),

            weight=lambda u, v, data: edge_weight_with_hazard(
                u,
                v,
                data,
                GRAPH,
                hazards
            )
        )

        print("Đã tìm thấy tuyến đường!")

        # =================================================
        # BUILD POLYLINE
        # =================================================

        path = []

        total_distance = 0

        for i, node in enumerate(route):

            point = GRAPH.nodes[node]

            path.append({
                "latitude": point["y"],
                "longitude": point["x"]
            })

            # tính khoảng cách route
            if i < len(route) - 1:

                edge_data = GRAPH.get_edge_data(
                    route[i],
                    route[i + 1]
                )

                if edge_data:

                    first_edge = list(edge_data.values())[0]

                    total_distance += first_edge.get(
                        "length",
                        0
                    )

        # =================================================
        # ETA
        # =================================================

        # giả định xe cứu hộ ~ 35km/h
        average_speed_mps = 35 * 1000 / 3600

        eta_seconds = total_distance / average_speed_mps

        return {
            "status": "success",
            "path": path,
            "distance_meters": round(total_distance),
            "eta_seconds": round(eta_seconds)
        }

    except nx.NetworkXNoPath:

        return {
            "status": "error",
            "message": "Không tìm thấy tuyến đường"
        }

    except Exception as e:

        print("ROUTING ERROR:", str(e))

        return {
            "status": "error",
            "message": str(e)
        }

# import osmnx as ox

# print("Đang tải graph Đà Nẵng...")

# G = ox.graph_from_place(
#     "Da Nang, Vietnam",
#     network_type="drive"
# )

# print("Đang lưu graph...")

# ox.save_graphml(
#     G,
#     "danang.graphml"
# )

# print("Hoàn tất!")