import requests
import json

BASE_URL = "http://localhost:5000/api"

def check_endpoint(name, url):
    print(f"--- Checking {name} ---")
    try:
        r = requests.get(url)
        if r.status_code != 200:
            print(f"❌ Error: {r.status_code}")
            return
        data = r.json()
        print(f"Count: {len(data)}")
        if len(data) > 0:
            print("Sample Item Keys:")
            print(json.dumps(list(data[0].keys()), indent=2))
            print("Sample Item Data:")
            print(json.dumps(data[0], indent=2))
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == "__main__":
    check_endpoint("Customers", f"{BASE_URL}/customers")
    check_endpoint("Products", f"{BASE_URL}/products")
    check_endpoint("Quotes", f"{BASE_URL}/quotes")
