import base64

with open('Roboto-Regular.ttf', 'rb') as f:
    data = f.read()
    b64 = base64.b64encode(data).decode('utf-8')
    
print(b64)
