import requests
import time
import sys
import uuid

BASE_URL = "http://localhost:5000"

def test_health():
    try:
        r = requests.get(BASE_URL)
        assert r.status_code == 200
        print("✅ Server is running")
    except Exception as e:
        print(f"❌ Server check failed: {e}")
        sys.exit(1)

def test_customers():
    # Create
    unique_name = f"Test Customer {uuid.uuid4().hex[:6]}"
    customer_data = {
        "name": unique_name,
        "email": "test@example.com",
        "company": "Test Co"
    }
    r = requests.post(f"{BASE_URL}/api/customers", json=customer_data)
    if r.status_code != 201:
        print(f"❌ Create Customer failed: {r.status_code} - {r.text}")
        sys.exit(1)
        
    cid = r.json()['id']
    print(f"✅ Customer created (ID: {cid})")

    # Get
    r = requests.get(f"{BASE_URL}/api/customers/{cid}")
    assert r.status_code == 200
    assert r.json()['name'] == unique_name
    print("✅ Customer retrieval verified")

    return cid

def test_products():
    # Create
    unique_code = f"TEST-{uuid.uuid4().hex[:6]}"
    product_data = {
        "code": unique_code,
        "name": "Test Product",
        "price": 100.0,
        "currency": "USD",
        "unit": "Adet"
    }
    r = requests.post(f"{BASE_URL}/api/products", json=product_data)
    if r.status_code != 201:
        print(f"❌ Create Product failed: {r.status_code} - {r.text}")
        sys.exit(1)
        
    pid = r.json()['id']
    print(f"✅ Product created (ID: {pid})")
    
    return pid

def test_quote(cid, pid):
    # Quote number
    r = requests.get(f"{BASE_URL}/api/quote-number")
    assert r.status_code == 200
    qnum = r.json()['quoteNumber']
    # Ensure qnum is unique if concurrent tests run
    qnum += f"-{uuid.uuid4().hex[:4]}"
    
    print(f"✅ Generated quote number: {qnum}")

    # Create Quote
    quote_data = {
        "quoteNumber": qnum,
        "customerId": cid,
        "status": "draft",
        "total": 100.0,
        "currency": "USD",
        "validDays": 30,
        "notes": "Automated test quote",
        "items": [
            {"productId": pid, "productCode": "TEST", "productName": "Test", "quantity": 1, "unitPrice": 100.0, "unit": "Adet"}
        ]
    }
    r = requests.post(f"{BASE_URL}/api/quotes", json=quote_data)
    if r.status_code != 201:
        print(f"❌ Create Quote failed: {r.status_code} - {r.text}")
        sys.exit(1)

    qid = r.json()['id']
    print(f"✅ Quote created (ID: {qid})")
    
    return qid

if __name__ == "__main__":
    # Wait for server to start
    time.sleep(1)
    test_health()
    cid = test_customers()
    pid = test_products()
    test_quote(cid, pid)
    print("\n🎉 All API tests passed!")
