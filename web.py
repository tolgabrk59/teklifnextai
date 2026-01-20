import os
import sqlite3
import json
import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, request, send_from_directory, Response
from datetime import datetime
from urllib.parse import urljoin, urlparse

app = Flask(__name__, static_url_path='', static_folder='.')
DB_NAME = 'sales_quote.db'

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    
    # Customers table
    c.execute('''
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            company TEXT,
            email TEXT,
            phone TEXT,
            address TEXT,
            createdAt TEXT
        )
    ''')
    
    # Products table
    c.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            name TEXT NOT NULL,
            description TEXT,
            price REAL,
            currency TEXT,
            unit TEXT,
            imageUrl TEXT,
            createdAt TEXT
        )
    ''')
    
    # Quotes table
    c.execute('''
        CREATE TABLE IF NOT EXISTS quotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quoteNumber TEXT UNIQUE,
            customerId INTEGER,
            status TEXT,
            total REAL,
            currency TEXT,
            items TEXT, -- JSON string
            validDays INTEGER,
            notes TEXT,
            createdAt TEXT,
            FOREIGN KEY (customerId) REFERENCES customers (id)
        )
    ''')
    
    # Price History table
    c.execute('''
        CREATE TABLE IF NOT EXISTS price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            productId INTEGER,
            customerId INTEGER,
            quoteId INTEGER,
            price REAL,
            createdAt TEXT,
            FOREIGN KEY (productId) REFERENCES products (id),
            FOREIGN KEY (customerId) REFERENCES customers (id),
            FOREIGN KEY (quoteId) REFERENCES quotes (id)
        )
    ''')
    
    conn.commit()
    conn.close()

# Initialize DB on start
init_db()

# --- Static File Serving ---

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# Static file serving handled by Flask configuration

# --- API Endpoints ---

# CUSTOMERS
@app.route('/api/customers', methods=['GET'])
def get_customers():
    conn = get_db_connection()
    customers = conn.execute('SELECT * FROM customers ORDER BY id DESC').fetchall()
    conn.close()
    return jsonify([dict(row) for row in customers])

@app.route('/api/customers/<int:id>', methods=['GET'])
def get_customer(id):
    conn = get_db_connection()
    customer = conn.execute('SELECT * FROM customers WHERE id = ?', (id,)).fetchone()
    conn.close()
    if customer:
        return jsonify(dict(customer))
    return jsonify({'error': 'Customer not found'}), 404

@app.route('/api/customers', methods=['POST'])
def create_customer():
    data = request.json
    data['createdAt'] = datetime.now().isoformat()
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        INSERT INTO customers (name, company, email, phone, address, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (data['name'], data.get('company'), data.get('email'), data.get('phone'), data.get('address'), data['createdAt']))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return jsonify({'id': new_id, **data}), 201

@app.route('/api/customers/<int:id>', methods=['PUT'])
def update_customer(id):
    data = request.json
    conn = get_db_connection()
    conn.execute('''
        UPDATE customers SET name=?, company=?, email=?, phone=?, address=?
        WHERE id=?
    ''', (data['name'], data.get('company'), data.get('email'), data.get('phone'), data.get('address'), id))
    conn.commit()
    conn.close()
    return jsonify({'id': id, **data})

@app.route('/api/customers/<int:id>', methods=['DELETE'])
def delete_customer(id):
    conn = get_db_connection()
    conn.execute('DELETE FROM customers WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# PRODUCTS
@app.route('/api/products', methods=['GET'])
def get_products():
    conn = get_db_connection()
    products = conn.execute('SELECT * FROM products ORDER BY id DESC').fetchall()
    conn.close()
    return jsonify([dict(row) for row in products])

@app.route('/api/products/<int:id>', methods=['GET'])
def get_product(id):
    conn = get_db_connection()
    product = conn.execute('SELECT * FROM products WHERE id = ?', (id,)).fetchone()
    conn.close()
    if product:
        return jsonify(dict(product))
    return jsonify({'error': 'Product not found'}), 404

@app.route('/api/products', methods=['POST'])
def create_product():
    data = request.json
    data['createdAt'] = datetime.now().isoformat()
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute('''
            INSERT INTO products (code, name, description, price, currency, unit, imageUrl, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (data['code'], data['name'], data.get('description'), data.get('price'), data.get('currency'), data.get('unit'), data.get('imageUrl'), data['createdAt']))
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        return jsonify({'id': new_id, **data}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Product code must be unique'}), 400

@app.route('/api/products/<int:id>', methods=['PUT'])
def update_product(id):
    data = request.json
    conn = get_db_connection()
    conn.execute('''
        UPDATE products SET code=?, name=?, description=?, price=?, currency=?, unit=?, imageUrl=?
        WHERE id=?
    ''', (data['code'], data['name'], data.get('description'), data.get('price'), data.get('currency'), data.get('unit'), data.get('imageUrl'), id))
    conn.commit()
    conn.close()
    return jsonify({'id': id, **data})

@app.route('/api/products/<int:id>', methods=['DELETE'])
def delete_product(id):
    conn = get_db_connection()
    conn.execute('DELETE FROM products WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# QUOTES
@app.route('/api/quotes', methods=['GET'])
def get_quotes():
    conn = get_db_connection()
    # Join with customers to get customer name if needed, but for now just raw quotes
    # The frontend might expect customer details embedded or fetch them separately.
    # Looking at the frontend code, it often displays customer name. 
    # Let's return raw quotes first, frontend likely handles joins or stores customer name in UI models.
    # Actually, in `quotes.js`, it performs lookups.
    quotes = conn.execute('SELECT * FROM quotes ORDER BY id DESC').fetchall()
    
    # Parse items JSON
    result = []
    for row in quotes:
        d = dict(row)
        if d['items']:
            try:
                d['items'] = json.loads(d['items'])
            except:
                d['items'] = []
        result.append(d)
        
    conn.close()
    return jsonify(result)

@app.route('/api/quotes/<int:id>', methods=['GET'])
def get_quote(id):
    conn = get_db_connection()
    quote = conn.execute('SELECT * FROM quotes WHERE id = ?', (id,)).fetchone()
    conn.close()
    
    if quote:
        d = dict(quote)
        if d['items']:
            try:
                d['items'] = json.loads(d['items'])
            except:
                d['items'] = []
        return jsonify(d)
    return jsonify({'error': 'Quote not found'}), 404

@app.route('/api/quotes', methods=['POST'])
def create_quote():
    data = request.json
    data['createdAt'] = datetime.now().isoformat()
    conn = get_db_connection()
    cur = conn.cursor()
    
    items_json = json.dumps(data.get('items', []))
    
    try:
        cur.execute('''
            INSERT INTO quotes (quoteNumber, customerId, status, total, currency, items, validDays, notes, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (data['quoteNumber'], data['customerId'], data['status'], data['total'], data['currency'], items_json, data['validDays'], data.get('notes'), data['createdAt']))
        quote_id = cur.lastrowid
        
        # Add price history
        for item in data.get('items', []):
            if 'productId' in item:
                cur.execute('''
                    INSERT INTO price_history (productId, customerId, quoteId, price, createdAt)
                    VALUES (?, ?, ?, ?, ?)
                ''', (item['productId'], data['customerId'], quote_id, item['unitPrice'], data['createdAt']))
        
        conn.commit()
        conn.close()
        return jsonify({'id': quote_id, **data}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Quote number must be unique'}), 400

@app.route('/api/quotes/<int:id>', methods=['PUT'])
def update_quote(id):
    data = request.json
    conn = get_db_connection()
    
    # If status is updated only
    if 'status' in data and len(data) == 1:
        conn.execute('UPDATE quotes SET status=? WHERE id=?', (data['status'], id))
        conn.commit()
        conn.close()
        return jsonify({'id': id, 'status': data['status']})
        
    items_json = json.dumps(data.get('items', []))
    conn.execute('''
        UPDATE quotes SET customerId=?, status=?, total=?, currency=?, items=?, validDays=?, notes=?
        WHERE id=?
    ''', (data['customerId'], data['status'], data['total'], data['currency'], items_json, data['validDays'], data.get('notes'), id))
    conn.commit()
    conn.close()
    return jsonify({'id': id, **data})

@app.route('/api/quotes/<int:id>', methods=['DELETE'])
def delete_quote(id):
    conn = get_db_connection()
    conn.execute('DELETE FROM quotes WHERE id = ?', (id,))
    conn.execute('DELETE FROM price_history WHERE quoteId = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# AUXILIARY ENDPOINTS

@app.route('/api/quote-number', methods=['GET'])
def get_next_quote_number():
    conn = get_db_connection()
    year = datetime.now().year
    prefix = f"TKL-{year}-"
    
    # Get all quote numbers starting with prefix
    # SQLite doesn't have regex, so we fetch and filter or use LIKE
    quotes = conn.execute("SELECT quoteNumber FROM quotes WHERE quoteNumber LIKE ?", (f"{prefix}%",)).fetchall()
    
    max_num = 0
    for row in quotes:
        try:
            num_part = row['quoteNumber'].replace(prefix, '')
            num = int(num_part)
            if num > max_num:
                max_num = num
        except:
            pass
            
    conn.close()
    return jsonify({'quoteNumber': f"{prefix}{str(max_num + 1).zfill(4)}"})

@app.route('/api/price-history', methods=['GET'])
def get_price_history():
    product_id = request.args.get('productId')
    conn = get_db_connection()
    
    if product_id:
        history = conn.execute('SELECT * FROM price_history WHERE productId = ?', (product_id,)).fetchall()
    else:
        history = []
        
    conn.close()
    return jsonify([dict(row) for row in history])

# SCRAPING ENDPOINTS
@app.route('/api/scrape-product', methods=['POST'])
def scrape_product():
    """Scrape product info from a given URL"""
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract data from Open Graph meta tags first (most reliable)
        og_image = soup.find('meta', property='og:image')
        og_title = soup.find('meta', property='og:title')
        og_description = soup.find('meta', property='og:description')
        
        # Fallback to standard meta tags / title
        title_tag = soup.find('title')
        meta_description = soup.find('meta', attrs={'name': 'description'})
        
        # Try to find first large image if no og:image
        image_url = None
        if og_image and og_image.get('content'):
            image_url = og_image['content']
        else:
            # Look for product images
            for img in soup.find_all('img'):
                src = img.get('src') or img.get('data-src')
                if src and not 'logo' in src.lower() and not 'icon' in src.lower():
                    image_url = urljoin(url, src)
                    break
        
        # Get title
        title = ''
        if og_title and og_title.get('content'):
            title = og_title['content']
        elif title_tag:
            title = title_tag.get_text(strip=True)
        
        # Get description
        description = ''
        if og_description and og_description.get('content'):
            description = og_description['content']
        elif meta_description and meta_description.get('content'):
            description = meta_description['content']
        
        # Try to extract brand/model from title
        brand = ''
        model = ''
        title_parts = title.split(' - ') if title else []
        if len(title_parts) >= 2:
            brand = title_parts[0].strip()
            model = title_parts[1].strip() if len(title_parts) > 1 else ''
        elif title_parts:
            # Try first two words as brand/model
            words = title_parts[0].split()
            brand = words[0] if words else ''
            model = ' '.join(words[1:3]) if len(words) > 1 else ''
        
        return jsonify({
            'success': True,
            'data': {
                'imageUrl': image_url,
                'title': title[:200] if title else '',
                'brand': brand[:100] if brand else '',
                'model': model[:100] if model else '',
                'description': description[:500] if description else ''
            }
        })
        
    except requests.RequestException as e:
        return jsonify({'error': f'Failed to fetch URL: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': f'Scraping error: {str(e)}'}), 500

@app.route('/api/proxy-image')
def proxy_image():
    """Proxy an image to avoid CORS issues"""
    image_url = request.args.get('url')
    if not image_url:
        return jsonify({'error': 'URL required'}), 400
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(image_url, headers=headers, timeout=10, stream=True)
        response.raise_for_status()
        
        content_type = response.headers.get('Content-Type', 'image/jpeg')
        return Response(response.content, mimetype=content_type)
    except:
        return jsonify({'error': 'Failed to fetch image'}), 400

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
