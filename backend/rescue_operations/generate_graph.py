import osmnx as ox

print("Đang tải graph Đà Nẵng...")

G = ox.graph_from_place(
    "Da Nang, Vietnam",
    network_type="drive"
)

print("Đang lưu graph...")

ox.save_graphml(
    G,
    "danang.graphml"
)

print("Hoàn tất!")

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