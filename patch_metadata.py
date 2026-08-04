import json

with open("metadata.json", "r") as f:
    data = json.load(f)

if "requestFramePermissions" not in data:
    data["requestFramePermissions"] = []

if "geolocation" not in data["requestFramePermissions"]:
    data["requestFramePermissions"].append("geolocation")

with open("metadata.json", "w") as f:
    json.dump(data, f, indent=2)
