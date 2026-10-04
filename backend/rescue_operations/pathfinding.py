import os
import math
import networkx as nx
import osmnx as ox

from copy import deepcopy

# =========================================================
# LOAD GRAPH
# =========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GRAPH_PATH = os.path.join(BASE_DIR, "danang.graphml")

BASE_GRAPH = None

try:

    if os.path.exists(GRAPH_PATH):

        print(f"Loading graph from: {GRAPH_PATH}")

        BASE_GRAPH = ox.load_graphml(GRAPH_PATH)

        print("[SUCCESS] Graph loaded successfully!")

    else:

        print(f"[ERROR] Graph file not found: {GRAPH_PATH}")

except Exception as e:

    print("GRAPH LOAD ERROR:", str(e))


# =========================================================
# CONSTANTS
# =========================================================

EARTH_RADIUS = 6371000

# severity -> multiplier
SEVERITY_MULTIPLIER = {
    1: 1.2,
    2: 1.5,
    3: 2.0,
    4: float("inf"),  # blocked road
}


# =========================================================
# VALIDATION
# =========================================================

def validate_coordinates(coords):

    if not isinstance(coords, (tuple, list)):
        raise ValueError("Coordinates must be tuple/list")

    if len(coords) != 2:
        raise ValueError("Coordinates must have 2 values")

    lat, lng = coords

    if not (-90 <= lat <= 90):
        raise ValueError("Invalid latitude")

    if not (-180 <= lng <= 180):
        raise ValueError("Invalid longitude")


def validate_hazards(hazards):

    if not isinstance(hazards, list):
        raise ValueError("Hazards must be list")

    required_fields = ["lat", "lng"]

    for hazard in hazards:

        for field in required_fields:

            if field not in hazard:
                raise ValueError(f"Missing hazard field: {field}")


# =========================================================
# HAVERSINE DISTANCE
# =========================================================

def haversine_distance(lat1, lon1, lat2, lon2):

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

    return 2 * EARTH_RADIUS * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a)
    )


# =========================================================
# EDGE RISK CALCULATION
# =========================================================

def calculate_edge_penalty(edge_points, hazards):

    """
    edge_points:
    [
        (lat, lng),
        ...
    ]
    """

    max_penalty = 0

    for lat, lng in edge_points:

        for hazard in hazards:

            distance = haversine_distance(
                lat,
                lng,
                hazard["lat"],
                hazard["lng"]
            )

            radius = hazard.get("radius", 100)

            severity = hazard.get("severity", 1)

            multiplier = SEVERITY_MULTIPLIER.get(
                severity,
                1.0
            )

            # BLOCK ROAD
            if multiplier == float("inf"):

                if distance <= radius:

                    return float("inf")

            # INSIDE DANGER ZONE
            if distance <= radius:

                penalty = multiplier

            # NEAR DANGER ZONE
            elif distance <= radius * 2:

                penalty = multiplier * 0.5

            else:

                penalty = 1.0

            max_penalty = max(
                max_penalty,
                penalty
            )

    return max_penalty


# =========================================================
# BUILD ROUTING GRAPH
# =========================================================

def build_routing_graph(base_graph, hazards):

    """
    Precompute risk weights
    """

    graph = base_graph.copy()

    for u, v, k, data in graph.edges(
        keys=True,
        data=True
    ):

        base_length = data.get("length", 1)

        edge_points = []

        # =================================================
        # USE GEOMETRY IF AVAILABLE
        # =================================================

        if "geometry" in data:

            coords = list(data["geometry"].coords)

            for lng, lat in coords:

                edge_points.append((lat, lng))

        else:

            node_u = graph.nodes[u]
            node_v = graph.nodes[v]

            edge_points = [
                (node_u["y"], node_u["x"]),
                (
                    (node_u["y"] + node_v["y"]) / 2,
                    (node_u["x"] + node_v["x"]) / 2
                ),
                (node_v["y"], node_v["x"])
            ]

        # =================================================
        # CALCULATE PENALTY
        # =================================================

        penalty_multiplier = calculate_edge_penalty(
            edge_points,
            hazards
        )

        # blocked road
        if penalty_multiplier == float("inf"):

            data["risk_weight"] = float("inf")

        else:

            data["risk_weight"] = (
                base_length * penalty_multiplier
            )

    return graph


# =========================================================
# HEURISTIC
# =========================================================

def heuristic(graph, node_a, node_b):

    a = graph.nodes[node_a]
    b = graph.nodes[node_b]

    return haversine_distance(
        a["y"],
        a["x"],
        b["y"],
        b["x"]
    )


# =========================================================
# MAIN ROUTING
# =========================================================

def get_rescue_route(
    start_coords,
    target_coords,
    hazards=None
):

    if BASE_GRAPH is None:

        return {
            "status": "error",
            "message": "Graph not loaded"
        }

    if hazards is None:
        hazards = []

    try:

        # =================================================
        # VALIDATE INPUT
        # =================================================

        validate_coordinates(start_coords)
        validate_coordinates(target_coords)
        validate_hazards(hazards)

        # =================================================
        # BUILD SAFE ROUTING GRAPH
        # =================================================

        routing_graph = build_routing_graph(
            BASE_GRAPH,
            hazards
        )

        start_lat, start_lng = start_coords
        end_lat, end_lng = target_coords

        # =================================================
        # FIND NEAREST NODES
        # =================================================

        origin_node = ox.distance.nearest_nodes(
            routing_graph,
            start_lng,
            start_lat
        )

        destination_node = ox.distance.nearest_nodes(
            routing_graph,
            end_lng,
            end_lat
        )

        # =================================================
        # RUN A*
        # =================================================

        route = nx.astar_path(

            routing_graph,

            origin_node,

            destination_node,

            heuristic=lambda a, b: heuristic(
                routing_graph,
                a,
                b
            ),

            weight="risk_weight"
        )

        # =================================================
        # BUILD RESPONSE
        # =================================================

        path = []

        total_distance = 0

        for i, node in enumerate(route):

            point = routing_graph.nodes[node]

            path.append({
                "latitude": point["y"],
                "longitude": point["x"]
            })

            # =============================================
            # EDGE DISTANCE
            # =============================================

            if i < len(route) - 1:

                edge_dict = routing_graph.get_edge_data(
                    route[i],
                    route[i + 1]
                )

                if edge_dict:

                    best_edge = min(
                        edge_dict.values(),
                        key=lambda e: e.get(
                            "risk_weight",
                            float("inf")
                        )
                    )

                    total_distance += best_edge.get(
                        "length",
                        0
                    )

        # =================================================
        # ETA
        # =================================================

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
            "message": "No safe route found"
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